# Geo-nearest region + remembered last selection

**Date:** 2026-07-01
**Status:** Approved design (pre-implementation)

## 1. Context & problem

FRAGRATE opens with two selections the user makes before running a test
(`client/src/App.tsx`): the **primary game** and the **region** to grade against.
Both are seeded from hardcoded defaults in the store singleton
(`client/src/state/store.ts`): `new EngineStore('lol', 'LATAM-North')`.

Two consequences we want to fix:

1. **Every visitor starts on `LATAM-North`**, regardless of where they are. An EU
   or Asia user sees a Mexico-City region pre-highlighted until they either run a
   test (the measured latency then refines the pick via `bestRegion`) or manually
   change it. The initial guess should instead be the user's *geographically
   nearest* region.
2. **Nothing is remembered between visits.** A returning user re-picks their game
   and region every time. We want to restore their last game and their last
   explicit region choice.

**Key existing facts that shape the design:**

- The client is **statically prerendered** by `vite-react-ssg` and hydrated. The
  store's `getServerSnapshot` returns the static idle state so the prerender and
  the client's first render agree. All per-user personalization (the ES-locale
  redirect, the `?game=` deep-link, `detectMode`) already runs **client-only in a
  mount `useEffect`** precisely to avoid a hydration mismatch. Both features here
  follow that same pattern.
- A persistence pattern already exists in `i18n.tsx`: `rememberLang` /
  `preferredLang` use `localStorage` with `try/catch` and validate on read.
- Latency-based region selection already exists: `bestRegion()`
  (`client/src/engine/orchestrator.ts`) picks the lowest-median region *after a
  test runs*. Geo detection only improves the **pre-test initial guess**; the
  measured latency still refines it afterward.
- Production is the **Cloudflare Worker** (hosted mode), which exposes free edge
  geolocation via `request.cf` (latitude/longitude/country/continent). The Worker
  currently serves only `/api/turn`. Local dev is a Node server that sees only the
  loopback address (no useful IP geo).

## 2. Goals & non-goals

**Goals**
- Replace the hardcoded initial region with the user's **nearest region**,
  constrained to the selected game's allowed regions.
- **Remember** the last game and the last *explicit* region choice across visits.
- No GPS/permission prompt; no new runtime dependencies; no new infrastructure.
- Preserve SSG hydration correctness (all detection is client-only, post-mount).

**Non-goals**
- Precise geolocation. A nearest-metro guess is enough; measured latency corrects
  it on the first run.
- Persisting the full measurement report or any measured values.
- Browser Geolocation (GPS) API — intentionally excluded (intrusive prompt, high
  denial rate for a utility).
- Server-side (build-time) personalization — impossible under SSG; the prerendered
  HTML is identical for all visitors.

## 3. Decisions (chosen)

1. **Location mechanism: Cloudflare edge geo + timezone/locale fallback.** A new
   `GET /api/geo` on the Worker returns `request.cf` coordinates (accurate, free,
   no prompt). When that call fails or returns no coordinates (local dev, or
   `request.cf` absent), fall back to a client-side timezone→coordinates heuristic
   with `navigator.language` as a secondary hint.
2. **Persist last game + last explicit region.** Auto-location fills the region
   only until the user explicitly clicks one; from then on their choice is
   remembered and takes precedence over geo on future visits.
3. **`localStorage`, not cookies.** The value is needed only client-side; nothing
   in the build-time prerender consumes it. This matches the existing
   `fragrate-lang` persistence.

## 4. Design

### 4.1 Region coordinates — `shared/regions.ts`

Add `lat` and `lon` (numbers) to the `RegionInfo` interface and to each of the 13
entries, using the region's metro city. This is the single source of truth for
"where a region is," consumed by the Haversine nearest-region computation.
Approximate metro coordinates:

| Region | Metro | lat | lon |
|---|---|---|---|
| LATAM-North | Mexico City | 19.43 | -99.13 |
| NA-East | Virginia (Ashburn) | 39.04 | -77.49 |
| NA-Central | Ohio (Columbus) | 39.96 | -82.99 |
| NA-West | Oregon (Boardman) | 45.87 | -119.69 |
| EU-West | London | 51.51 | -0.13 |
| EU-Central | Frankfurt | 50.11 | 8.68 |
| Asia-East | Tokyo | 35.69 | 139.69 |
| Asia-Korea | Seoul | 37.57 | 126.98 |
| Asia-SE | Singapore | 1.35 | 103.82 |
| Asia-South | Mumbai | 19.08 | 72.88 |
| OCE | Sydney | -33.87 | 151.21 |
| SA-East | São Paulo | -23.55 | -46.63 |
| ME-Central | UAE (Dubai) | 25.20 | 55.27 |

No existing consumer of `RegionInfo` breaks — the fields are additive. The server
does not use them; they are harmless there.

### 4.2 Persistence — `client/src/state/prefs.ts` (new)

A small module mirroring the `i18n.tsx` pattern (`try/catch`, validate on read):

```
rememberGame(id: string): void          // localStorage 'fragrate-game'
preferredGame(): string | null          // valid iff id in GAME_BY_ID, else null
rememberRegion(r: Region): void         // localStorage 'fragrate-region'
preferredRegion(): Region | null        // valid iff r in REGIONS, else null
```

- All writes wrapped in `try/catch` (private mode / disabled storage → no-op).
- Reads validate against the current catalog so a game/region removed since the
  last visit reads back as `null` (never restore a dead selection).
- Region validity is checked against the full `REGIONS` set here; whether a stored
  region applies to the *current game* is decided by the caller in `App.tsx`
  (§4.4), because it depends on the resolved game.

### 4.3 Location → nearest region — `client/src/engine/geo.ts` (new)

Sits beside `mode.ts` as a client-only detection concern.

```
detectCoords(): Promise<{ lat: number; lon: number } | null>   // memoized
nearestRegion(coords: {lat,lon}, allowed: Region[]): Region | null   // pure
detectNearestRegion(allowed: Region[]): Promise<Region | null>       // compose
```

**`detectCoords` (memoized — the promise is cached after first call):**
1. `fetch('/api/geo', { cache: 'no-store' })`. On OK JSON with numeric
   `lat`/`lon`, return them.
2. On any non-OK, thrown error, or missing coordinates, fall back to
   **timezone → coordinates**: read `Intl.DateTimeFormat().resolvedOptions().timeZone`,
   look it up in a compact IANA-zone→`{lat,lon}` table; if the exact zone is
   absent, use a continent-prefix centroid (`America/`, `Europe/`, `Asia/`,
   `Australia/`, `Pacific/`, `Africa/`, `Atlantic/`, `Indian/`). As a secondary
   hint when the timezone is unhelpful, map the `navigator.language` region subtag
   (e.g. `es-MX`, `en-GB`) to a country centroid.
3. If even that yields nothing, return `null` (caller keeps the current default).

Memoization caches the returned promise (a module-level singleton), so a game
switch (§4.4) `await`s the *already-resolved* `detectCoords()` — no refetch, and
effectively synchronous since detection ran on mount.

**`nearestRegion` (pure):** Haversine great-circle distance from `coords` to each
region's `{lat,lon}` in `REGIONS`, filtered to `allowed`, returning the minimum. If
`allowed` is empty, consider all regions. Returns `null` only when there are no
candidate regions (should not happen for real games).

The Haversine helper and the timezone table live in this module (or a sibling
data file if the table grows); no new npm dependency.

### 4.4 Endpoints

**`worker/index.ts` — add `GET /api/geo`.** Inserted before the existing
`/api/*` → 404 catch-all, following the file's conventions (literal
`url.pathname === '/api/geo'` compare, the local `json()` helper, Web APIs only,
`Cache-Control: no-store`). Returns coordinates from `request.cf`:

```
{ lat: number, lon: number, country?: string, continent?: string }
```

If `request.cf` (or `latitude`/`longitude`) is absent, return
`json({ available: false }, 200)`; the client treats a missing `lat`/`lon` as a
fallback trigger. **Invariant preserved:** this route does not touch `/api/health`,
so `detectMode()` still distinguishes hosted vs local correctly. Non-GET on
`/api/geo` may fall through to the `/api/*` 404 (no special handling needed).

**`server/src/index.ts` — add `GET /api/geo` → `{ available: false }`.** The
loopback Node server can't geolocate; this route just spares local dev a 404 in
the console. The client falls back to timezone regardless, so this is a
convenience, not a correctness requirement.

### 4.5 Wiring — `client/src/App.tsx`

All changes are inside the existing mount `useEffect` (client-only,
post-hydration) plus the two selection handlers. No change to render output shape,
so hydration is unaffected.

**Game precedence** (resolving `selectedGameId` on mount):
1. `?game=<id>` query param (explicit deep-link) — highest.
2. `preferredGame()` from `localStorage`.
3. Store default (`'lol'`).

When resolved via (1) or (2), also `store.set({ selectedGameId })` and
`recompute({ gameId })` (mirrors today's deep-link handling). A game resolved from
a deep-link is also persisted via `rememberGame`.

**Region precedence** (resolving `selectedRegion` on mount, for the resolved
game's `gameRegions(game)`):
1. `preferredRegion()` **if it is in `gameRegions(game)`** — explicit past choice
   wins.
2. `await detectNearestRegion(gameRegions(game))` — geo guess.
3. Store default (`'LATAM-North'`).

Auto-selected regions (2) are written to the store but **not** persisted.

**Persistence triggers:**
- `onPickGame(id)` → `rememberGame(id)` (in addition to today's `store.set` +
  `recompute`).
- `onPickRegion(r)` → `rememberRegion(r)` (this is the *only* place a region
  becomes "explicit"; auto-selection never calls it).

**Game-switch region refinement (in `onPickGame`):** after switching games, if the
current `selectedRegion` is not in the new game's `gameRegions`, re-pick the
nearest allowed region from the **cached** coordinates (`await detectNearestRegion(newAllowed)`,
which resolves instantly from the memoized promise — no refetch) and set it.
If coordinates are unavailable, leave selection to the existing `recompute` /
`bestRegion` fallback. This keeps the pre-test highlight sensible when switching to
a game that doesn't operate in the previously selected region.

### 4.6 Interaction with the existing engine

`runTest` / `recompute` already treat `selectedRegion` as a *request* and fall back
to `bestRegion` (lowest measured median within the game's allowed set) when the
requested region is unreachable or invalid (`assembleReport` in
`orchestrator.ts`). The geo pick simply provides a better initial `selectedRegion`
than the old hardcoded default; none of the post-test grading logic changes.

There is a brief first-paint flash: the static prerender shows the default region,
then the mount effect swaps to the user's nearest region. This is identical in
nature to the existing ES-redirect flash and is acceptable. (The store's default
region is left as `LATAM-North` as the ultimate fallback to keep the change
minimal.)

## 5. Testing

`pnpm --filter client run test` is wired (see `client/src/engine/regionPing.test.ts`).
Written test-first for the pure logic:

**`client/src/engine/geo.test.ts`**
- `nearestRegion`: Mexico City → `LATAM-North`; London → `EU-West`; Tokyo →
  `Asia-East`; Sydney → `OCE`.
- `nearestRegion` respects `allowed`: with `LATAM-North` excluded, Mexico City
  coordinates fall through to the next-nearest allowed region.
- timezone → coordinates for representative zones (`America/Mexico_City`,
  `Europe/London`, `Asia/Tokyo`, `Australia/Sydney`) map to the expected region.
- `detectCoords` fallback: mocked `fetch` returning non-OK → timezone path is used
  (and OK JSON → those coordinates are returned).

**`client/src/state/prefs.test.ts`**
- remember → read round-trip for game and region (mocked `localStorage`).
- an invalid / unknown stored value reads back as `null`.

The `App.tsx` wiring (precedence, persistence triggers, game-switch refinement) is
verified by running the app (webapp-testing / manual), since it is UI-effect glue
over the unit-tested pieces.

## 6. Files touched

**New**
- `client/src/state/prefs.ts` — game + explicit-region persistence.
- `client/src/engine/geo.ts` — coordinate detection + Haversine nearest-region.
- `client/src/engine/geo.test.ts`, `client/src/state/prefs.test.ts` — tests.

**Modified**
- `shared/regions.ts` — add `lat`/`lon` to `RegionInfo` + all 13 entries.
- `worker/index.ts` — add `GET /api/geo` (edge geo).
- `server/src/index.ts` — add `GET /api/geo` → `{ available: false }`.
- `client/src/App.tsx` — extend mount `useEffect` (game/region precedence),
  persistence triggers in `onPickGame` / `onPickRegion`, game-switch region
  refinement.

## 7. Delivery

New branch (git worktree for isolation) → TDD implementation → `pnpm typecheck` +
`pnpm --filter client run test` green → **draft PR to `main`**.

## 8. Scope guardrails (YAGNI)

- No browser GPS permission prompt.
- No persisting the full report or measured values.
- No new npm dependencies (Haversine + a small timezone table are hand-rolled).
- Regions remain a static catalog; no dynamic region discovery.
