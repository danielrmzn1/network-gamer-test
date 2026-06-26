import { useEffect } from 'react'
import { useEngine, store } from './state/store'
import { runTest, recompute } from './engine/orchestrator'
import { detectMode } from './engine/mode'
import { GAMES, GAME_BY_ID, gameRegions } from '@shared/catalog'
import { REGION_BY_ID } from '@shared/regions'
import { GENRE_BANDS } from '@shared/thresholds'
import type { Region } from '@shared/catalog.types'
import { Hero } from './components/Hero'
import { Frame } from './components/Frame'
import { ArcGauge } from './components/ArcGauge'
import { Meters } from './components/Meters'
import { Sparkline } from './components/Sparkline'
import { GameCard } from './components/GameCard'
import { RegionSelector } from './components/RegionSelector'
import { PhaseStepper } from './components/PhaseStepper'
import { toneLower, gaugeMax } from './lib/tone'
import { useLang, setLang, t, genreLabel, gaugeStateWord, noteTitle, noteBody } from './i18n'
import './styles/components.css'

export default function App() {
  const s = useEngine()
  const lang = useLang()
  const game = GAME_BY_ID[s.selectedGameId] ?? GAMES[0]
  const bands = GENRE_BANDS[game.genre]

  const liveRegion = s.selectedRegion ? s.regions[s.selectedRegion] : undefined
  const ping = s.report?.selectedPing?.median ?? liveRegion?.median ?? null
  const jitter = s.report?.selectedPing?.jitter ?? liveRegion?.jitter ?? null
  const loss = s.report?.loss?.lossPct ?? (s.lossIdle?.available ? s.lossIdle.lossPct : null)

  const pingTone = toneLower(ping, bands.pingMs)
  const jitterTone = toneLower(jitter, bands.jitterMs)
  const lossTone = toneLower(loss, bands.lossPct)

  const onRun = (): void => void runTest({ gameId: s.selectedGameId, region: s.selectedRegion })
  const onPickGame = (id: string): void => {
    store.set({ selectedGameId: id })
    recompute({ gameId: id })
  }
  const onPickRegion = (r: Region): void => recompute({ region: r })

  // Detect once whether the local measurement server is present (full mode) or
  // we're a static Cloudflare Worker deploy (hosted mode).
  useEffect(() => {
    void detectMode().then((m) => store.set({ mode: m }, true))
  }, [])

  return (
    <div className="np-app">
      <header className="np-header">
        <div className="np-brand">
          <h1>
            FRAG<span className="mag">RATE</span>
          </h1>
          <span className="np-tag">{t(lang, 'tagline')}</span>
          {s.mode === 'hosted' && <span className="np-hosted-badge">{t(lang, 'hostedBadge')}</span>}
        </div>
        <div className="np-lang" role="group" aria-label="Language">
          <button type="button" className="np-lang-btn" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
            EN
          </button>
          <button type="button" className="np-lang-btn" aria-pressed={lang === 'es'} onClick={() => setLang('es')}>
            ES
          </button>
        </div>
      </header>

      <div className="np-gamepicker">
        <span className="np-label">{t(lang, 'primaryGame')}</span>
        <div className="np-gamepicker-row">
          {GAMES.map((g) => (
            <button
              key={g.id}
              type="button"
              className="np-game-chip"
              aria-pressed={g.id === s.selectedGameId}
              onClick={() => onPickGame(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {s.status === 'error' && <div className="np-error">⚠ {s.error}</div>}

      <Hero state={s} game={game} onRun={onRun} />

      <PhaseStepper phase={s.phase} status={s.status} />

      <div className="np-section-title">
        <span className="np-eyebrow">
          {t(lang, 'coreMetrics')} · {genreLabel(lang, game.genre)}
        </span>
      </div>
      <div className="np-cluster">
        <Frame>
          <div className="np-gauges">
            <ArcGauge name={t(lang, 'gaugePing')} value={ping} max={gaugeMax(bands.pingMs)} unit="ms" tone={pingTone} stateLabel={gaugeStateWord(lang, pingTone)} />
            <ArcGauge name={t(lang, 'gaugeJitter')} value={jitter} max={gaugeMax(bands.jitterMs)} unit="ms" decimals={1} tone={jitterTone} stateLabel={gaugeStateWord(lang, jitterTone)} />
            <ArcGauge name={t(lang, 'gaugeLoss')} value={loss} max={gaugeMax(bands.lossPct)} unit="%" decimals={2} tone={lossTone} stateLabel={gaugeStateWord(lang, lossTone)} />
          </div>
        </Frame>
        <Frame>
          <Meters
            download={s.download}
            upload={s.upload}
            liveDown={s.liveDownMbps}
            liveUp={s.liveUpMbps}
            bufferbloat={s.bufferbloat}
          />
        </Frame>
      </div>

      <Frame>
        <Sparkline data={s.liveLatency} />
      </Frame>

      <div className="np-section-title">
        <span className="np-eyebrow">{t(lang, 'canYouPlay')}</span>
      </div>
      <div className="np-cards">
        {s.report
          ? s.report.verdicts.map((v) => (
              <GameCard
                key={v.gameId}
                name={v.name}
                genre={v.genre}
                rank={v.rank}
                state={v.state}
                reason={v.reason}
                selected={v.gameId === s.selectedGameId}
                onSelect={() => onPickGame(v.gameId)}
              />
            ))
          : GAMES.map((g) => (
              <GameCard
                key={g.id}
                name={g.name}
                genre={g.genre}
                selected={g.id === s.selectedGameId}
                onSelect={() => onPickGame(g.id)}
              />
            ))}
      </div>

      <div className="np-section-title">
        <span className="np-eyebrow">{t(lang, 'regionMap')}</span>
      </div>
      <RegionSelector
        regions={s.regions}
        selected={s.selectedRegion}
        allowed={gameRegions(s.selectedGameId)}
        onSelect={onPickRegion}
      />
      {s.mode === 'hosted' && (
        <p className="np-runlocal-note">
          {Object.values(s.regions).some((r) => r.received > 0)
            ? t(lang, 'hostedRegionNote')
            : t(lang, 'hostedRegionUnreachable')}
        </p>
      )}
      {s.mode === 'hosted' && s.report && Object.values(s.regions).some((r) => r.received > 0) && (
        <p className="np-region-graded">
          {t(lang, 'gradedOn')} {REGION_BY_ID[s.report.region].label}
        </p>
      )}

      <p className="np-note">
        <b>{noteTitle[lang]}</b> {noteBody(lang, s.backendLabel || 'Cloudflare', s.mode)}
      </p>
    </div>
  )
}
