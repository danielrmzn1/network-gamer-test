import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { useLang, rememberLang, preferredLang, t, genreLabel, gaugeStateWord, noteTitle, noteBody } from './i18n'
import { Seo } from './seo/Seo'
import { SITE_URL } from './seo/config'

const LANG_BTN =
  'bg-transparent border-none text-ink-faint font-ui text-[13px] font-semibold tracking-[0.14em] px-4 py-[7px] [transition:all_0.15s_ease] aria-pressed:bg-gradient-to-b aria-pressed:from-gold-light aria-pressed:to-gold aria-pressed:text-abyss aria-pressed:font-bold aria-[pressed=false]:hover:text-ink-mid'

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
  // on the default English route is redirected to /es. Googlebot (US IP, no
  // Accept-Language) won't trigger this, so '/' stays indexed as English.
  // A deep link from a per-game page ("Run the test" → /?game=<id>) preselects
  // that game. Then detect local (full) vs hosted (browser-only) mode.
  useEffect(() => {
    if (lang === 'en' && preferredLang() === 'es') navigate('/es', { replace: true })
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
    <div className="np-app relative max-w-[1320px] mx-auto px-10 pt-[30px] pb-14 max-[760px]:px-4 max-[760px]:pt-[22px] max-[760px]:pb-12">
      <Seo
        title={seo.title}
        description={seo.description}
        path={path}
        locale={lang}
        alternates={alternates}
        jsonLd={jsonLd}
      />
      <header className="flex items-center justify-between gap-6 flex-wrap mb-1.5">
        <div className="flex items-baseline gap-4">
          <div className="m-0 font-display font-normal text-[30px] tracking-[1px] text-ink-hi">
            FRAG<span className="text-teal [text-shadow:var(--text-glow-teal)]">RATE</span>
          </div>
          <span className="font-ui text-xs tracking-[0.25em] uppercase text-ink-lo">{t(lang, 'tagline')}</span>
          {s.mode === 'hosted' && (
            <span className="font-ui text-[10px] font-bold tracking-[0.18em] uppercase text-gold-light [clip-path:var(--cut-6)] shadow-[inset_0_0_0_1px_var(--gold-line-strong)] px-2.5 py-1">
              {t(lang, 'hostedBadge')}
            </span>
          )}
        </div>
        <div
          className="flex items-center [clip-path:var(--cut-10)] shadow-[inset_0_0_0_1px_var(--gold-line-strong)]"
          role="group"
          aria-label="Language"
        >
          <button
            type="button"
            className={LANG_BTN}
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
            className={LANG_BTN}
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

      <div className="mt-[22px] mb-2">
        <span className="block mb-2.5 font-ui text-[11px] font-semibold tracking-[0.25em] uppercase text-ink-lo">
          {t(lang, 'primaryGame')}
        </span>
        <div className="flex flex-wrap gap-2">
          {GAMES.map((g) => (
            <button
              key={g.id}
              type="button"
              className="font-ui text-xs tracking-[0.12em] uppercase px-4 py-2 [clip-path:var(--cut-8)] bg-white/[0.03] shadow-[inset_0_0_0_1px_var(--gold-line)] text-ink-body border-none [transition:all_0.16s_ease] hover:text-ink-mid aria-pressed:[background:linear-gradient(180deg,rgb(63_214_201/0.22),rgb(63_214_201/0.06))] aria-pressed:shadow-[inset_0_0_0_1px_rgb(63_214_201/0.55),0_0_14px_rgb(63_214_201/0.22)] aria-pressed:text-[#bff3ee]"
              aria-pressed={g.id === s.selectedGameId}
              onClick={() => onPickGame(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {s.status === 'error' && (
        <div className="px-[18px] py-3.5 [clip-path:var(--cut-10)] shadow-[inset_0_0_0_1px_rgb(224_69_92/0.5)] text-bad bg-[rgb(224_69_92/0.08)] my-[18px]">
          ⚠ {s.error}
        </div>
      )}

      <Hero state={s} game={game} onRun={onRun} />

      <PhaseStepper phase={s.phase} status={s.status} />

      <div className="np-section-title">
        <span className="np-eyebrow">
          {t(lang, 'coreMetrics')} · {genreLabel(lang, game.genre)}
        </span>
      </div>
      <div className="grid grid-cols-[1.55fr_1fr] gap-[18px] max-[980px]:grid-cols-1">
        <Frame>
          <div className="flex justify-around gap-4 p-[26px] max-[460px]:flex-col max-[460px]:items-center">
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
      <div className="grid grid-cols-5 gap-3.5 max-[980px]:grid-cols-3 max-[760px]:grid-cols-2 max-[460px]:grid-cols-1">
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
        <p className="mt-2.5 text-xs leading-normal text-ink-faint">
          {Object.values(s.regions).some((r) => r.received > 0)
            ? t(lang, 'hostedRegionNote')
            : t(lang, 'hostedRegionUnreachable')}
        </p>
      )}
      {s.mode === 'hosted' && s.report && Object.values(s.regions).some((r) => r.received > 0) && (
        <p className="mt-1.5 text-xs text-ink-faint">
          {t(lang, 'gradedOn')} {REGION_BY_ID[s.report.region].label}
        </p>
      )}

      <p className="mt-[30px] mx-0.5 mb-0 pt-5 [border-top:1px_solid_var(--gold-line)] text-xs leading-[1.6] text-ink-lo max-w-[1100px] [&_b]:text-gold [&_b]:font-semibold">
        <b>{noteTitle[lang]}</b> {noteBody(lang, s.backendLabel || 'Cloudflare', s.mode)}
      </p>

      <footer className="mt-11 pt-[22px] [border-top:1px_solid_var(--gold-line)]">
        <span className="block mb-3 font-ui text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-lo">
          {lang === 'es' ? 'Guías por juego' : 'Per-game guides'}
        </span>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          {GAMES.map((g) => (
            <Link
              key={g.id}
              to={`/${g.id}-ping-test`}
              className="text-[13px] text-ink-body no-underline hover:text-teal"
            >
              {g.name} {lang === 'es' ? 'ping' : 'ping test'}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  )
}
