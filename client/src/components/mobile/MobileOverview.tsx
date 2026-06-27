import type { EngineState } from '../../state/store'
import type { Game } from '@shared/catalog.types'
import type { Lang } from '../../i18n'
import type { Tone } from '../../lib/tone'
import { GENRE_BANDS } from '@shared/thresholds'

export interface MobileOverviewProps {
  s: EngineState
  lang: Lang
  game: Game
  bands: (typeof GENRE_BANDS)[Game['genre']]
  ping: number | null
  jitter: number | null
  loss: number | null
  pingTone: Tone
  jitterTone: Tone
  lossTone: Tone
}

export function MobileOverview(_props: MobileOverviewProps) {
  return <div data-tab="overview" />
}
