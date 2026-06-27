import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Seo } from '../seo/Seo'
import { buildGamePage } from '../seo/gameContent'
import '../styles/content.css'

/**
 * Prerendered, crawlable per-game content page (e.g. /valorant-ping-test).
 * This is NOT the interactive tester — it's static HTML (threshold table, FAQ,
 * regions) that answers the search query directly, then deep-links into the
 * live tester with the game preselected.
 */
export function GamePage({ gameId }: { gameId: string }) {
  const d = buildGamePage(gameId)
  if (!d) {
    return (
      <main className="np-doc">
        <p>
          Game not found. <Link to="/">Back to FRAGRATE</Link>
        </p>
      </main>
    )
  }
  const b = d.bands

  return (
    <main className="np-doc">
      <Seo
        title={d.title}
        description={d.description}
        path={d.path}
        locale="en"
        type="article"
        jsonLd={d.jsonLd}
      />

      <nav className="np-doc-nav">
        <Link to="/" className="np-doc-brand">
          FRAG<span className="mag">RATE</span>
        </Link>
        <Link to={`/?game=${d.id}`} className="np-doc-navcta">
          Run the test →
        </Link>
      </nav>

      <article className="np-doc-body">
        <p className="np-doc-eyebrow">
          {d.genre} · {d.publisher}
        </p>
        <h1>{d.name} Ping Test</h1>
        <p className="np-doc-lead">{d.lead}</p>

        <h2>Good ping, jitter &amp; packet loss for {d.name}</h2>
        <div className="np-doc-tablewrap">
          <table className="np-doc-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Optimal</th>
                <th>Good</th>
                <th>Playable max</th>
                <th>No-go</th>
              </tr>
            </thead>
            <tbody>
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
                <td>Packet loss</td>
                <td>{b.lossPct.great}%</td>
                <td>&le; {b.lossPct.good}%</td>
                <td>&le; {b.lossPct.ok}%</td>
                <td>&gt; {b.lossPct.bad}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="np-doc-note">{b.note}</p>

        <h2>{d.name} regions FRAGRATE checks</h2>
        <ul className="np-doc-regions">
          {d.regions.map((r) => (
            <li key={r.label}>
              <strong>{r.label}</strong> <span>· {r.metro}</span>
            </li>
          ))}
        </ul>

        <h2>How FRAGRATE measures this</h2>
        <p>
          FRAGRATE measures ping and jitter as a TCP-handshake to a public endpoint in each game region, packet
          loss via UDP/WebRTC, and bufferbloat as the latency added while your line is saturated. Run it locally
          for true per-region game-server ping, or use the hosted browser test for ping, loss and bufferbloat.
        </p>

        <h2>FAQ</h2>
        <dl className="np-doc-faq">
          {d.faqs.map((f) => (
            <Fragment key={f.q}>
              <dt>{f.q}</dt>
              <dd>{f.a}</dd>
            </Fragment>
          ))}
        </dl>

        <p className="np-doc-cta">
          <Link to={`/?game=${d.id}`} className="np-doc-btn">
            Run the live {d.name} test →
          </Link>
        </p>
      </article>
    </main>
  )
}
