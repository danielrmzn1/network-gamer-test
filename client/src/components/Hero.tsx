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
        <h1 className="np-verdict-line">
          {h.pre}
          <span className="hl">{h.hl}</span>
          {h.post}
        </h1>
        <p className="np-verdict-sub">{t(lang, 'idleSub')}</p>
      </>
    )
  }
  if (state.status === 'running') {
    return (
      <>
        <h1 className="np-verdict-line">
          {t(lang, 'heroRunning')}
          <span className="hl">…</span>
        </h1>
        <p className="np-verdict-sub">{state.phase ? phaseLabel(lang, state.phase) : t(lang, 'measuring')}</p>
      </>
    )
  }
  if (state.status === 'error') {
    return (
      <>
        <h1 className="np-verdict-line">{t(lang, 'heroErrorLine')}</h1>
        <p className="np-verdict-sub">{state.error ?? t(lang, 'heroErrorSub')}</p>
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
  const hosted = state.mode === 'hosted'
  const where = hosted ? t(lang, 'internetRtt') : lang === 'es' ? `a ${regionLabel}` : `to ${regionLabel}`
  const tail = hosted ? ` ${t(lang, 'hostedApprox')}` : ''
  const metrics =
    lang === 'es'
      ? `${weakPointText('es', v?.reason ?? null)}${fmt(ping, 0)} ms ${where}, ${lt}, ${dl}↓/${ul}↑ Mbps, bufferbloat ${bloat}.${tail}`
      : `${weakPointText('en', v?.reason ?? null)}${fmt(ping, 0)} ms ${where}, ${lt}, ${dl}↓/${ul}↑ Mbps, ${bloat} bufferbloat.${tail}`

  return (
    <>
      <h1 className="np-verdict-line">
        {hv.pre}
        <span className="hl">{game.name}</span>
        {hv.post}
      </h1>
      <p className="np-verdict-sub">{metrics}</p>
    </>
  )
}

export function Hero({ state, game, onRun }: { state: EngineState; game: Game; onRun: () => void }) {
  const lang = useLang()
  const running = state.status === 'running'
  const v = state.report?.verdicts.find((x) => x.gameId === game.id)
  const rank = state.status === 'done' ? v?.rank ?? state.report?.overallRank ?? null : null
  const ctaLabel = running ? t(lang, 'testing') : state.status === 'done' ? t(lang, 'runAgain') : t(lang, 'runTest')
  const lossMethod = state.report?.loss?.method

  return (
    <Frame hero className="np-hero-frame">
      <div className="np-hero">
        <RankBadge rank={rank} />
        <div className="np-hero-info">
          <div className="np-hero-eyebrow">
            {t(lang, 'verdict')} · {game.name}
          </div>
          <VerdictText lang={lang} state={state} game={game} />
          <div className="np-hero-actions">
            <button type="button" className="np-cta" data-running={running} onClick={onRun} disabled={running}>
              {ctaLabel}
            </button>
            <div className="np-hero-meta">
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
              <span>{t(lang, 'latencyTcp')}</span>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  )
}
