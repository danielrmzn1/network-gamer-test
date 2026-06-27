import { StrictMode, type ReactNode } from 'react'
import type { RouteRecord } from 'vite-react-ssg'
import { GAMES } from '@shared/catalog'
import App from './App'
import { GamePage } from './pages/GamePage'
import { VARIANTS, variantPath } from './seo/gameContent'
import { LangProvider, type Lang } from './i18n'

const LOCALES: Lang[] = ['en', 'es']

// vite-react-ssg route table — every entry is prerendered to static HTML.
//   '/'  '/es'                          English / Spanish tester (App)
//   '/<game>-ping-test' etc.           EN per-game pages (3 variants)
//   '/es/<game>-ping-test' etc.        ES per-game pages (3 variants)
// 10 games × 3 variants × 2 locales = 60 game pages (+ 2 testers = 62).
const appPage = (lang: Lang): ReactNode => (
  <StrictMode>
    <LangProvider lang={lang}>
      <App />
    </LangProvider>
  </StrictMode>
)

const gameRoutes: RouteRecord[] = GAMES.flatMap((g) =>
  LOCALES.flatMap((lang) =>
    VARIANTS.map((v) => ({
      path: variantPath(g.id, v, lang),
      // GamePage is fully driven by its props (no useLang), so no provider needed.
      element: (
        <StrictMode>
          <GamePage gameId={g.id} variant={v} lang={lang} />
        </StrictMode>
      ),
    })),
  ),
)

export const routes: RouteRecord[] = [
  { path: '/', element: appPage('en') },
  { path: '/es', element: appPage('es') },
  ...gameRoutes,
]
