import type { RouteRecord } from 'vite-react-ssg'
import { GAMES } from '@shared/catalog'
import { VARIANTS, variantPath } from './seo/gameContent'
import type { Lang } from './i18n'

const LOCALES: Lang[] = ['en', 'es', 'pt']

// vite-react-ssg route table. Routes are code-split via `lazy` (+ `entry` so the
// SSG build can locate the module): the tester (HomeRoute → App + engine) and
// the per-game content pages (GameRoute → GamePage) land in separate chunks, so
// visiting a content page never downloads the measurement engine. Per-route data
// is supplied by `loader` (lazy components take no props).
//   '/'  '/es'  '/pt'                English / Spanish / Portuguese tester
//   '/<game>-ping-test' etc.         EN per-game pages (3 variants)
//   '/es/<game>-ping-test' etc.      ES per-game pages (3 variants)
//   '/pt/<game>-ping-test' etc.      PT per-game pages (3 variants)
// 10 games × 3 variants × 3 locales = 90 game pages (+ 3 testers = 93).
const gameRoutes: RouteRecord[] = GAMES.flatMap((g) =>
  LOCALES.flatMap((lang) =>
    VARIANTS.map((v) => ({
      path: variantPath(g.id, v, lang),
      lazy: () => import('./pages/GameRoute'),
      entry: 'src/pages/GameRoute.tsx',
      loader: () => ({ gameId: g.id, variant: v, lang }),
    })),
  ),
)

export const routes: RouteRecord[] = [
  { path: '/', lazy: () => import('./pages/HomeRoute'), entry: 'src/pages/HomeRoute.tsx', loader: () => ({ lang: 'en' }) },
  { path: '/es', lazy: () => import('./pages/HomeRoute'), entry: 'src/pages/HomeRoute.tsx', loader: () => ({ lang: 'es' }) },
  { path: '/pt', lazy: () => import('./pages/HomeRoute'), entry: 'src/pages/HomeRoute.tsx', loader: () => ({ lang: 'pt' }) },
  ...gameRoutes,
]
