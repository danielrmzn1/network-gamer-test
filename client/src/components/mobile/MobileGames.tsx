import type { EngineState } from '../../state/store'
import type { Game } from '@shared/catalog.types'
import type { Lang } from '../../i18n'

export interface MobileGamesProps {
  s: EngineState
  lang: Lang
  game: Game
  filter: 'all' | 'playable'
  setFilter: (f: 'all' | 'playable') => void
  expandedId: string | null
  setExpandedId: (fn: (prev: string | null) => string | null) => void
  onPickGame: (id: string) => void
}

export function MobileGames(_props: MobileGamesProps) {
  return <div data-tab="games" />
}
