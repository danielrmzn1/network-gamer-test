import { useLoaderData } from 'react-router-dom'
import { GamePage } from './GamePage'
import type { Variant } from '../seo/gameContent'
import type { Lang } from '../i18n'

// Lazy route module (code-split): keeps the per-game content pages off the
// tester engine's bundle. Per-page data comes from the route loader so the
// component takes no props (React Router lazy convention).
interface Data {
  gameId: string
  variant: Variant
  lang: Lang
}

export function Component() {
  const d = useLoaderData() as Data
  return <GamePage gameId={d.gameId} variant={d.variant} lang={d.lang} />
}
