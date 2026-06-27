import { ViteReactSSG } from 'vite-react-ssg'
import { routes } from './routes'
import './styles/index.css'

// vite-react-ssg entry. It prerenders `routes` to static HTML at build time
// (so crawlers and AI bots get real content) and hydrates them on the client.
// Replaces the old `createRoot(document.getElementById('root')).render(...)`
// SPA mount — the build/hydration is now driven by this exported createRoot.
export const createRoot = ViteReactSSG({ routes })
