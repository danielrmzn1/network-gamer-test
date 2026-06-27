import type { EngineState } from '../../state/store'
import type { Game } from '@shared/catalog.types'
import type { Lang } from '../../i18n'
import type { Tone } from '../../lib/tone'
import { GENRE_BANDS } from '@shared/thresholds'
import type { Genre } from '@shared/catalog.types'
import { ArcGauge } from '../ArcGauge'
import { Meters } from '../Meters'
import { Sparkline } from '../Sparkline'
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
const EYEBROW = 'flex items-center gap-2.5 mx-0.5 mb-2.5'

function SectionTitle({ children }: { children: string }) {
  return (
    <div className={EYEBROW}>
      <span className="w-1.5 h-1.5 bg-teal rotate-45 shadow-[0_0_7px_var(--color-teal)] shrink-0" />
      <span className="font-ui font-semibold tracking-[0.2em] text-[11px] text-gold uppercase whitespace-nowrap">{children}</span>
      <span className="flex-1 h-px [background:linear-gradient(90deg,var(--gold-line-strong),transparent)]" />
    </div>
  )
}

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
    </div>
  )
}
