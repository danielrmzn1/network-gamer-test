import type { Game } from '@shared/catalog.types'
import { REGION_BY_ID } from '@shared/regions'
import { RankBadge } from './RankBadge'
import { Frame } from './Frame'
import type { EngineState } from '../state/store'
import { fmt, fmtMbps } from '../lib/format'
import { useLang, t, heroIdle, heroVerdict, weakPointText, lossText, phaseLabel, type Lang } from '../i18n'

function VerdictText({ lang, state, game }: { lang: Lang; state: EngineState; game: Game }) {
  if (state.status === 'idle') {
    const h = heroIdle(lang)
    return (
      <>
        <h1 className="m-0 mb-3.5 font-display font-normal text-[clamp(26px,3.4vw,40px)] leading-[1.12] text-ink-hi [text-wrap:balance]">
          {h.pre}
          <span className="text-teal [text-shadow:var(--text-glow-teal)]">{h.hl}</span>
          {h.post}
        </h1>
        <p className="m-0 mb-[22px] text-base leading-normal text-ink-body max-w-[680px]">{t(lang, 'idleSub')}</p>
      </>
    )
  }
  if (state.status === 'running') {
    return (
      <>
        <h1 className="m-0 mb-3.5 font-display font-normal text-[clamp(26px,3.4vw,40px)] leading-[1.12] text-ink-hi [text-wrap:balance]">
          {t(lang, 'heroRunning')}
          <span className="text-teal [text-shadow:var(--text-glow-teal)]">…</span>
        </h1>
        <p className="m-0 mb-[22px] text-base leading-normal text-ink-body max-w-[680px]">{state.phase ? phaseLabel(lang, state.phase) : t(lang, 'measuring')}</p>
      </>
    )
  }
  if (state.status === 'error') {
    return (
      <>
        <h1 className="m-0 mb-3.5 font-display font-normal text-[clamp(26px,3.4vw,40px)] leading-[1.12] text-ink-hi [text-wrap:balance]">{t(lang, 'heroErrorLine')}</h1>
        <p className="m-0 mb-[22px] text-base leading-normal text-ink-body max-w-[680px]">{state.error ?? t(lang, 'heroErrorSub')}</p>
      </>
    )
  }

  const report = state.report
  const v = report?.verdicts.find((x) => x.gameId === game.id)
  const regionLabel = report ? REGION_BY_ID[report.region]?.label ?? report.region : ''
  const ping = report?.selectedPing?.median ?? null
  const lt = lossText(lang, report?.loss?.lossPct ?? null, fmt)
  const bloat = report?.bufferbloat?.grade ?? 'n/a'
  const dl = fmtMbps(report?.download?.meanMbps)
  const ul = fmtMbps(report?.upload?.meanMbps)
  const hv = heroVerdict(lang, v?.state ?? 'NO')
  const where = lang === 'es' ? `a ${regionLabel}` : `to ${regionLabel}`
  const tail = ''
  const mode = state.mode === 'unknown' ? undefined : state.mode
  const metrics =
    lang === 'es'
      ? `${weakPointText('es', v?.reason ?? null, mode)}${fmt(ping, 0)} ms ${where}, ${lt}, ${dl}↓/${ul}↑ Mbps, bufferbloat ${bloat}.${tail}`
      : `${weakPointText('en', v?.reason ?? null, mode)}${fmt(ping, 0)} ms ${where}, ${lt}, ${dl}↓/${ul}↑ Mbps, ${bloat} bufferbloat.${tail}`

  return (
    <>
      <h1 className="m-0 mb-3.5 font-display font-normal text-[clamp(26px,3.4vw,40px)] leading-[1.12] text-ink-hi [text-wrap:balance]">
        {hv.pre}
        <span className="text-teal [text-shadow:var(--text-glow-teal)]">{game.name}</span>
        {hv.post}
      </h1>
      <p className="m-0 mb-[22px] text-base leading-normal text-ink-body max-w-[680px]">{metrics}</p>
    </>
  )
}

export function Hero({ state, game, onRun }: { state: EngineState; game: Game; onRun: () => void }) {
  const lang = useLang()
  const hosted = state.mode === 'hosted'
  const running = state.status === 'running'
  const v = state.report?.verdicts.find((x) => x.gameId === game.id)
  const rank = state.status === 'done' ? v?.rank ?? state.report?.overallRank ?? null : null
  const ctaLabel = running ? t(lang, 'testing') : state.status === 'done' ? t(lang, 'runAgain') : t(lang, 'runTest')
  const lossMethod = state.report?.loss?.method
  // Region shown in the eyebrow: the graded region after a run, otherwise the
  // currently selected region (so it's visible before running and updates live
  // when a different region is picked on the map).
  const eyebrowRegionId = state.report?.region ?? state.selectedRegion
  const eyebrowRegion = eyebrowRegionId ? REGION_BY_ID[eyebrowRegionId]?.label : null

  return (
    <Frame hero className="mt-[22px]">
      <div className="flex items-center gap-10 px-9 py-8 max-[760px]:flex-col max-[760px]:text-center">
        <RankBadge rank={rank} />
        <div className="flex-1 min-w-0">
          <div className="font-ui text-xs tracking-[0.3em] uppercase text-teal mb-3.5">
            {t(lang, 'verdict')} · {game.name}
            {eyebrowRegion ? ` · ${eyebrowRegion}` : ''}
          </div>
          <VerdictText lang={lang} state={state} game={game} />
          <div className="flex items-center gap-7 flex-wrap max-[760px]:justify-center">
            <button
              type="button"
              className="font-ui font-bold text-[15px] tracking-[0.2em] uppercase text-abyss bg-gradient-to-b from-gold-light to-gold border-none px-[38px] py-3.5 [clip-path:var(--cut-12)] shadow-glow-gold [transition:filter_0.14s_ease,transform_0.12s_ease] hover:brightness-[1.08] active:translate-y-px data-[running=true]:bg-gradient-to-b data-[running=true]:from-[#2a6f78] data-[running=true]:to-teal-dim data-[running=true]:text-[#d7faf6] data-[running=true]:cursor-progress data-[running=true]:animate-pulse-hud"
              data-running={running}
              onClick={onRun}
              disabled={running}
            >
              {ctaLabel}
            </button>
            <div className="flex gap-[26px] flex-wrap text-[13px] max-[760px]:justify-center [&_span]:text-ink-lo [&_b]:text-ink-mid [&_b]:font-semibold">
              {state.backendLabel && (
                <span>
                  {t(lang, 'throughputVia')} <b>{state.backendLabel}</b>
                </span>
              )}
              {lossMethod && (
                <span>
                  {t(lang, 'lossMethodLabel')}{' '}
                  <b>{lossMethod === 'stun-udp' ? 'STUN/UDP' : lossMethod === 'webrtc' ? 'WebRTC' : 'n/a'}</b>
                </span>
              )}
              <span>{t(lang, hosted ? 'latencyHttps' : 'latencyTcp')}</span>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  )
}
