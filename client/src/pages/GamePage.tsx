import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Seo } from '../seo/Seo'
import { buildGamePage, type Variant } from '../seo/gameContent'
import { homePath, type Lang } from '../i18n'

const H2 = 'font-ui font-semibold text-[20px] tracking-[0.01em] text-ink-mid mt-[38px] mb-3.5'
const P = 'leading-[1.65] text-ink-body'

/**
 * Prerendered, crawlable per-game content page (e.g. /valorant-ping-test,
 * /es/good-ping-for-cs2, /warzone-packet-loss-test). Static HTML that answers
 * the search query in the page's locale, then deep-links into the live tester.
 */
export function GamePage({ gameId, variant, lang }: { gameId: string; variant: Variant; lang: Lang }) {
  const d = buildGamePage(gameId, variant, lang)
  if (!d) {
    return (
      <main className="max-w-[760px] mx-auto px-5 pt-6 pb-[72px]">
        <p className={P}>
          Game not found. <Link to="/" className="text-teal">Back to FRAGRATE</Link>
        </p>
      </main>
    )
  }
  const b = d.bands
  const L = d.labels
  const testHref = `${homePath(lang)}?game=${d.id}`

  return (
    <main className="max-w-[760px] mx-auto px-5 pt-6 pb-[72px]">
      <Seo
        title={d.title}
        description={d.description}
        path={d.path}
        locale={d.lang}
        alternates={d.alternates}
        type="article"
        jsonLd={d.jsonLd}
      />

      <nav className="flex items-center justify-between gap-4 pt-1.5 pb-[22px] mb-[30px] [border-bottom:1px_solid_var(--gold-line)]">
        <Link to={homePath(lang)} className="font-display text-[22px] tracking-[1px] text-ink-hi no-underline">
          FRAG<span className="text-teal [text-shadow:var(--text-glow-teal)]">RATE</span>
        </Link>
        <Link
          to={testHref}
          className="font-ui text-[13px] font-semibold tracking-[0.12em] uppercase text-gold-light no-underline hover:text-gold-bright"
        >
          {L.navRun}
        </Link>
      </nav>

      <article>
        <p className="font-ui text-xs font-semibold tracking-[0.22em] uppercase text-gold m-0 mb-2.5">
          {d.genre} · {d.publisher}
        </p>
        <h1 className="font-display font-normal text-[clamp(28px,6vw,40px)] leading-[1.1] text-ink-hi m-0 mb-[18px]">
          {d.h1}
        </h1>
        <p className="text-[17px] leading-[1.65] text-ink-body m-0">{d.lead}</p>

        {d.showTable && (
          <>
            <h2 className={H2}>{L.thresholdsHeading}</h2>
            <div className="overflow-x-auto [clip-path:var(--cut-12)] shadow-[inset_0_0_0_1px_var(--gold-line)] [background:linear-gradient(150deg,var(--color-inset),var(--color-abyss))]">
              <table className="w-full min-w-[460px] border-collapse font-ui">
                <thead>
                  <tr className="[&_th]:text-left [&_th]:px-4 [&_th]:py-[11px] [&_th]:text-[11px] [&_th]:tracking-[0.12em] [&_th]:uppercase [&_th]:text-ink-lo [&_th]:[border-bottom:1px_solid_var(--gold-line)]">
                    <th>{L.table.metric}</th>
                    <th>{L.table.optimal}</th>
                    <th>{L.table.good}</th>
                    <th>{L.table.playableMax}</th>
                    <th>{L.table.nogo}</th>
                  </tr>
                </thead>
                <tbody className="[&_td]:px-4 [&_td]:py-[11px] [&_td]:tabular-nums [&_td]:text-ink-mid [&_td]:[border-bottom:1px_solid_rgb(201_168_92/0.1)] [&_tr:last-child_td]:border-b-0 [&_td:first-child]:text-ink-hi [&_td:first-child]:font-semibold">
                  <tr>
                    <td>Ping</td>
                    <td>&le; {b.pingMs.great} ms</td>
                    <td>&le; {b.pingMs.good} ms</td>
                    <td>&le; {b.pingMs.ok} ms</td>
                    <td>&gt; {b.pingMs.bad} ms</td>
                  </tr>
                  <tr>
                    <td>Jitter</td>
                    <td>&le; {b.jitterMs.great} ms</td>
                    <td>&le; {b.jitterMs.good} ms</td>
                    <td>&le; {b.jitterMs.ok} ms</td>
                    <td>&gt; {b.jitterMs.bad} ms</td>
                  </tr>
                  <tr>
                    <td>{lang === 'es' ? 'Pérdida' : lang === 'pt' ? 'Perda' : 'Packet loss'}</td>
                    <td>{b.lossPct.great}%</td>
                    <td>&le; {b.lossPct.good}%</td>
                    <td>&le; {b.lossPct.ok}%</td>
                    <td>&gt; {b.lossPct.bad}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {d.showNote && <p className="text-sm text-ink-lo italic mt-3 mx-0.5">{b.note}</p>}
          </>
        )}

        {d.fixSteps.length > 0 && (
          <>
            <h2 className={H2}>{L.fixHeading}</h2>
            <ol className="list-none p-0 m-0 grid gap-3">
              {d.fixSteps.map((st, i) => (
                <li
                  key={st.title}
                  className="[clip-path:var(--cut-10)] shadow-[inset_0_0_0_1px_var(--gold-line)] [background:linear-gradient(150deg,var(--color-inset),var(--color-abyss))] px-[18px] py-3.5"
                >
                  <div className="font-ui font-semibold text-ink-hi">
                    <span className="text-teal">{i + 1}.</span> {st.title}
                  </div>
                  <p className="text-sm leading-[1.6] text-ink-body m-0 mt-1.5">{st.body}</p>
                </li>
              ))}
            </ol>
          </>
        )}

        {d.showRegions && (
          <>
            <h2 className={H2}>{L.regionsHeading}</h2>
            <ul className="list-none p-0 m-0 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-[18px] gap-y-2">
              {d.regions.map((r) => (
                <li key={r.label} className="text-sm text-ink-body">
                  <strong className="text-ink-hi font-semibold">{r.label}</strong>{' '}
                  <span className="text-ink-lo">· {r.metro}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <h2 className={H2}>{L.measureHeading}</h2>
        <p className={P}>{L.measureBody}</p>

        <h2 className={H2}>{L.faqHeading}</h2>
        <dl className="m-0">
          {d.faqs.map((f) => (
            <Fragment key={f.q}>
              <dt className="font-semibold text-ink-hi mt-[18px]">{f.q}</dt>
              <dd className="m-0 mt-1.5 leading-[1.6] text-ink-body">{f.a}</dd>
            </Fragment>
          ))}
        </dl>

        <h2 className={H2}>{L.relatedHeading}</h2>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          {d.related.map((r) => (
            <Link key={r.path} to={r.path} className="text-sm text-teal no-underline hover:text-gold-light">
              {r.label} →
            </Link>
          ))}
        </nav>

        <p className="mt-10">
          <Link
            to={testHref}
            className="inline-block [clip-path:var(--cut-8)] px-[22px] py-[13px] [background:linear-gradient(150deg,var(--up-gold-b),var(--color-gold-deep))] text-abyss font-ui font-bold tracking-[0.08em] uppercase no-underline shadow-glow-gold hover:brightness-110"
          >
            {L.cta}
          </Link>
        </p>
      </article>
    </main>
  )
}
