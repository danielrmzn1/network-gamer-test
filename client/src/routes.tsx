import { StrictMode, type ReactNode } from 'react'
import type { RouteRecord } from 'vite-react-ssg'
import { GAMES } from '@shared/catalog'
import App from './App'
import { GamePage } from './pages/GamePage'
import { LangProvider, type Lang } from './i18n'

// vite-react-ssg route table. Each entry is prerendered to static HTML at build
// time; the interactive tester then hydrates on the client.
//   '/'                    English tester
//   '/es'                  Spanish tester
//   '/<game>-ping-test'    per-game content page (one literal route per catalog
//                          game — explicit routes avoid a greedy /:slug catch-all
//                          and need no getStaticPaths).
const page = (lang: Lang, node: ReactNode): ReactNode => (
  <StrictMode>
    <LangProvider lang={lang}>{node}</LangProvider>
  </StrictMode>
)

const gameRoutes: RouteRecord[] = GAMES.map((g) => ({
  path: `/${g.id}-ping-test`,
  element: page('en', <GamePage gameId={g.id} />),
}))

export const routes: RouteRecord[] = [
  { path: '/', element: page('en', <App />) },
  { path: '/es', element: page('es', <App />) },
  ...gameRoutes,
]
