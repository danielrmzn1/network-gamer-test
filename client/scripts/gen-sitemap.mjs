// Postbuild: generate dist/sitemap.xml from the pages vite-react-ssg actually
// prerendered (dist/*.html). Deriving from the build output means the sitemap
// can never drift from the real routes. Override the origin with VITE_SITE_URL.
import { readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const distDir = fileURLToPath(new URL('../dist/', import.meta.url))
const origin = (process.env.VITE_SITE_URL ?? 'https://fragrate.gg').replace(/\/+$/, '')

const toPath = (file) => (file === 'index.html' ? '/' : `/${file.replace(/\.html$/, '')}`)

const paths = readdirSync(distDir)
  .filter((f) => f.endsWith('.html'))
  .map(toPath)
  .sort((a, b) => a.localeCompare(b))

const body = paths.map((p) => `  <url>\n    <loc>${origin}${p}</loc>\n  </url>`).join('\n')
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`

writeFileSync(new URL('../dist/sitemap.xml', import.meta.url), xml)
console.log(`[gen-sitemap] wrote ${paths.length} urls to dist/sitemap.xml (origin: ${origin})`)
