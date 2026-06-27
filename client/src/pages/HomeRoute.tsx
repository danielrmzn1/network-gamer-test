import { StrictMode } from 'react'
import { useLoaderData } from 'react-router-dom'
import App from '../App'
import { LangProvider, type Lang } from '../i18n'

// Lazy route module (code-split) for the interactive tester. Isolating App here
// keeps the measurement engine out of the per-game content pages' bundle.
export function Component() {
  const { lang } = useLoaderData() as { lang: Lang }
  return (
    <StrictMode>
      <LangProvider lang={lang}>
        <App />
      </LangProvider>
    </StrictMode>
  )
}
