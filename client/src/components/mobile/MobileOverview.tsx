import type { EngineState } from '../../state/store'
import type { Game, Genre } from '@shared/catalog.types'
import type { Lang } from '../../i18n'
import type { Tone } from '../../lib/tone'
import { GENRE_BANDS } from '@shared/thresholds'
import { ArcGauge } from '../ArcGauge'
import { Meters } from '../Meters'
import { Sparkline } from '../Sparkline'
import { ShareButton } from '../ShareButton'
import { SectionTitle } from './SectionTitle'
import { gaugeMax } from '../../lib/tone'
import { t, gaugeStateWord, genreLabel } from '../../i18n'

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

const PANEL = '[clip-path:var(--cut-12)] shadow-[inset_0_0_0_1px_rgb(201_168_92/0.2)] [background:linear-gradient(150deg,#0e1d2b,#0a1521)]'

export function MobileOverview({ s, lang, game, bands, ping, jitter, loss, pingTone, jitterTone, lossTone }: MobileOverviewProps) {
  return (
    <div>
      <SectionTitle>{`${t(lang, 'coreMetrics')} · ${genreLabel(lang, game.genre as Genre)}`}</SectionTitle>

      <div className={`${PANEL} px-2.5 py-4 flex justify-around`}>
        <ArcGauge size={88} name={t(lang, 'gaugePing')}   value={ping}   max={gaugeMax(bands.pingMs)}   unit="ms" tone={pingTone}   stateLabel={gaugeStateWord(lang, pingTone)} />
        <ArcGauge size={88} name={t(lang, 'gaugeJitter')} value={jitter} max={gaugeMax(bands.jitterMs)} unit="ms" decimals={1} tone={jitterTone} stateLabel={gaugeStateWord(lang, jitterTone)} />
        <ArcGauge size={88} name={t(lang, 'gaugeLoss')}   value={loss}   max={gaugeMax(bands.lossPct)}  unit="%"  decimals={2} tone={lossTone}   stateLabel={gaugeStateWord(lang, lossTone)} />
      </div>

      <div className={`${PANEL} mt-3`}>
        <Meters download={s.download} upload={s.upload} liveDown={s.liveDownMbps} liveUp={s.liveUpMbps} bufferbloat={s.bufferbloat} />
      </div>

      <div className={`${PANEL} mt-3`}>
        <Sparkline data={s.liveLatency} height={110} />
      </div>

      {s.status === 'done' && s.report && (
        <div className="mt-3">
          <ShareButton report={s.report} game={game} compact />
        </div>
      )}
    </div>
  )
}
