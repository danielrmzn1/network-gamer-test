import type { Region } from '@shared/catalog.types'
import { GAME_BY_ID } from '@shared/catalog'
import { REGION_BY_ID } from '@shared/regions'

// localStorage (not cookies): these are only needed client-side; nothing in the
// build-time prerender consumes them. Mirrors the fragrate-lang pattern in i18n.tsx.
const GAME_KEY = 'fragrate-game'
const REGION_KEY = 'fragrate-region'

/** Persist the user's last game choice. */
export function rememberGame(id: string): void {
  try { localStorage.setItem(GAME_KEY, id) } catch { /* ignore */ }
}

/** The last game choice, if still a valid catalog game; else null. */
export function preferredGame(): string | null {
  try {
    const v = localStorage.getItem(GAME_KEY)
    // hasOwnProperty, not truthiness: GAME_BY_ID is an Object.fromEntries map, so
    // a bare GAME_BY_ID['toString'] would return an inherited prototype member.
    if (v && Object.prototype.hasOwnProperty.call(GAME_BY_ID, v)) return v
  } catch { /* ignore */ }
  return null
}

/** Persist the user's explicit region choice. */
export function rememberRegion(r: Region): void {
  try { localStorage.setItem(REGION_KEY, r) } catch { /* ignore */ }
}

/** The last explicit region choice, if still a valid region; else null. */
export function preferredRegion(): Region | null {
  try {
    const v = localStorage.getItem(REGION_KEY)
    if (v && Object.prototype.hasOwnProperty.call(REGION_BY_ID, v)) return v as Region
  } catch { /* ignore */ }
  return null
}
