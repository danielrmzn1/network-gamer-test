// Cloudflare Worker entry for FRAGRATE's hosted mode (Workers Static Assets).
//
// Serves the built client (client/dist, via the ASSETS binding) and exposes a
// single dynamic route, GET /api/turn, which mints short-lived Cloudflare
// Realtime TURN credentials server-side so the long-term key never reaches the
// browser. Every other path falls through to static assets, with an SPA
// fallback to index.html (configured as `not_found_handling` in wrangler.jsonc).
//
// There is intentionally no /api/health here: that endpoint only exists on the
// local Node measurement server (server/), so its absence is how the client's
// detectMode() resolves to "hosted" (browser-only) vs "local" (full report).

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  TURN_KEY_ID: string // secret — TURN Key/Token ID (URL path)
  TURN_KEY_API_TOKEN: string // secret — Bearer API token
}

interface IceServer {
  urls: string[]
  username?: string
  credential?: string
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  })

// GET /api/turn — returns the browser-ready { iceServers }. If the secrets
// aren't set, returns 500; the client treats any non-OK response as "no TURN"
// and degrades to available:false ("run locally").
async function handleTurn(env: Env): Promise<Response> {
  const { TURN_KEY_ID, TURN_KEY_API_TOKEN } = env

  if (!TURN_KEY_ID || !TURN_KEY_API_TOKEN) {
    return json({ error: 'TURN credentials not configured' }, 500)
  }

  const ttl = 86400 // seconds; max 172800 (48h)

  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TURN_KEY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl }),
    },
  )

  if (!res.ok) {
    return json({ error: 'Failed to mint TURN credentials', status: res.status }, 502)
  }

  const data = (await res.json()) as { iceServers: IceServer[] }

  // Drop :53 URLs — blocked by Chrome/Firefox; without trickle ICE they stall.
  const iceServers = data.iceServers.map((s) => ({
    ...s,
    urls: s.urls.filter((u) => !u.includes(':53')),
  }))

  return json({ iceServers }, 200, { 'Cache-Control': 'no-store' })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/turn') {
      if (request.method !== 'GET') return json({ error: 'Method Not Allowed' }, 405)
      return handleTurn(env)
    }

    // No local measurement server in hosted mode — 404 any other /api/* so the
    // client's detectMode() (which probes /api/health) cleanly resolves "hosted".
    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'Not found' }, 404)
    }

    // Static client + SPA fallback to index.html (not_found_handling).
    return env.ASSETS.fetch(request)
  },
}
