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
import { useNavigate } from 'react-router-dom'
import { useLang, rememberLang, preferredLang, t, genreLabel, gaugeStateWord, noteTitle, noteBody } from './i18n'
import { Link } from 'react-router-dom'
import { Seo } from './seo/Seo'
import { SITE_URL } from './seo/config'
import './styles/components.css'

export default function App() {
  const s = useEngine()
  const lang = useLang()
  const navigate = useNavigate()
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

  // On mount (client only): a first-time visitor who prefers Spanish and lands
  // on the default English route is redirected to /es/. Googlebot (US IP, no
  // Accept-Language) won't trigger this, so '/' stays indexed as English.
  // Then detect local (full) vs hosted (browser-only) mode.
  useEffect(() => {
    if (lang === 'en' && preferredLang() === 'es') navigate('/es', { replace: true })
    // Deep link from a per-game page ("Run the test" → /?game=<id>) preselects it.
    const q = new URLSearchParams(window.location.search).get('game')
    if (q && GAME_BY_ID[q]) {
      store.set({ selectedGameId: q })
      recompute({ gameId: q })
    }
    void detectMode().then((m) => store.set({ mode: m }, true))
  }, [lang, navigate])

  const path = lang === 'es' ? '/es' : '/'
  const alternates = [
    { hreflang: 'en', path: '/' },
    { hreflang: 'es', path: '/es' },
    { hreflang: 'x-default', path: '/' },
  ]

  const seo =
    lang === 'es'
      ? {
          title: 'Test de Ping, Pérdida de Paquetes y Bufferbloat para Gamers — FRAGRATE',
          description:
            'Mide ping, jitter, pérdida de paquetes UDP y bufferbloat hacia regiones reales de juego y obtén un veredicto Jugable / Riesgoso / No apto por cada juego.',
        }
      : {
          title: 'Gaming Ping, Packet Loss & Bufferbloat Test — FRAGRATE',
          description:
            'Free gamer network test: ping, jitter, UDP packet loss and bufferbloat to real game regions — with a per-game Playable / Risky / No-go verdict.',
        }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'FRAGRATE',
    url: `${SITE_URL}${path}`,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: seo.description,
  }

  return (
    <div className="np-app">
      <Seo
        title={seo.title}
        description={seo.description}
        path={path}
        locale={lang}
        alternates={alternates}
        jsonLd={jsonLd}
      />
      <header className="np-header">
        <div className="np-brand">
          <div className="np-wordmark">
            FRAG<span className="mag">RATE</span>
          </div>
          <span className="np-tag">{t(lang, 'tagline')}</span>
          {s.mode === 'hosted' && <span className="np-hosted-badge">{t(lang, 'hostedBadge')}</span>}
        </div>
        <div className="np-lang" role="group" aria-label="Language">
          <button
            type="button"
            className="np-lang-btn"
            aria-pressed={lang === 'en'}
            onClick={() => {
              rememberLang('en')
              navigate('/')
            }}
          >
            EN
          </button>
          <button
            type="button"
            className="np-lang-btn"
            aria-pressed={lang === 'es'}
            onClick={() => {
              rememberLang('es')
              navigate('/es')
            }}
          >
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
                mode={s.mode === 'unknown' ? undefined : s.mode}
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

      <footer className="np-footer">
        <span className="np-footer-label">{lang === 'es' ? 'Guías por juego' : 'Per-game guides'}</span>
        <nav className="np-footer-links">
          {GAMES.map((g) => (
            <Link key={g.id} to={`/${g.id}-ping-test`} className="np-footer-link">
              {g.name} {lang === 'es' ? 'ping' : 'ping test'}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  )
}
