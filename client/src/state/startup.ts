import type { Region } from '@shared/catalog.types'
import { GAME_BY_ID, gameRegions } from '@shared/catalog'
import { nearestRegion, type Coords } from '../engine/geo'

// Matches the store's default game (client/src/state/store.ts). Used only to
// resolve the region's allowed set when no game is otherwise selected.
const DEFAULT_GAME_ID = 'lol'

export interface StartupInput {
  queryGame: string | null // ?game=<id>
  storedGame: string | null // preferredGame()
  storedRegion: Region | null // preferredRegion()
  coords: Coords | null // detectCoords() result
}

export interface StartupSelection {
  gameId: string | null // null = keep the store default
  region: Region | null // null = keep the store default
}

/**
 * Resolve the initial game + region purely from deep-link / stored prefs / geo.
 *   game:   valid query deep-link > valid stored > null (keep default)
 *   region: stored-if-valid-for-game > geo-nearest > null (keep default)
 * A null field means "leave the store's existing value untouched".
 */
export function resolveStartup(input: StartupInput): StartupSelection {
  const gameId =
    (input.queryGame && GAME_BY_ID[input.queryGame] ? input.queryGame : null) ??
    (input.storedGame && GAME_BY_ID[input.storedGame] ? input.storedGame : null)

  const allowed = gameRegions(gameId ?? DEFAULT_GAME_ID)

  let region: Region | null = null
  if (input.storedRegion && allowed.includes(input.storedRegion)) {
    region = input.storedRegion
  } else if (input.coords) {
    region = nearestRegion(input.coords, allowed)
  }

  return { gameId, region }
}
