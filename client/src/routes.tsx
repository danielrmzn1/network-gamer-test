import { StrictMode, type ReactNode } from 'react'
import type { RouteRecord } from 'vite-react-ssg'
import { GAMES } from '@shared/catalog'
import App from './App'
import { GamePage } from './pages/GamePage'
import { VARIANTS, variantPath } from './seo/gameContent'
import { LangProvider, type Lang } from './i18n'

// vite-react-ssg route table. Each entry is prerendered to static HTML at build
// time; the interactive tester then hydrates on the client.
//   '/'  '/es'                       English / Spanish tester
//   '/<game>-ping-test'             per-game ping + full metrics
//   '/good-ping-for-<game>'         "what is a good ping" thresholds page
//   '/<game>-packet-loss-test'      packet-loss test + fix checklist
// Explicit literal routes (one per game × variant) avoid a greedy /:slug
// catch-all and need no getStaticPaths.
const page = (lang: Lang, node: ReactNode): ReactNode => (
  <StrictMode>
    <LangProvider lang={lang}>{node}</LangProvider>
  </StrictMode>
)

const gameRoutes: RouteRecord[] = GAMES.flatMap((g) =>
  VARIANTS.map((v) => ({
    path: variantPath(g.id, v),
    element: page('en', <GamePage gameId={g.id} variant={v} />),
  })),
)

export const routes: RouteRecord[] = [
  { path: '/', element: page('en', <App />) },
  { path: '/es', element: page('es', <App />) },
  ...gameRoutes,
]
