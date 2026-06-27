// Postbuild: generate dist/sitemap.xml from the pages vite-react-ssg actually
// prerendered (every *.html under dist/, including nested locale dirs like
// dist/es/). Deriving from the build output keeps the sitemap in sync with the
// real routes. Override the origin with VITE_SITE_URL.
import { readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, sep } from 'node:path'

const distDir = fileURLToPath(new URL('../dist/', import.meta.url))
const origin = (process.env.VITE_SITE_URL ?? 'https://fragrate.daniel-ramirez.dev').replace(/\/+$/, '')
const SKIP_DIRS = new Set(['assets', 'fonts'])

function walk(dir) {
  const found = []
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (!SKIP_DIRS.has(ent.name)) found.push(...walk(join(dir, ent.name)))
    } else if (ent.name.endsWith('.html') && ent.name !== '404.html') {
      found.push(join(dir, ent.name))
    }
  }
  return found
}

const toPath = (abs) => {
  let rel = relative(distDir, abs).split(sep).join('/')
  if (rel === 'index.html') return '/'
  rel = rel.replace(/\.html$/, '').replace(/\/index$/, '')
  return `/${rel}`
}

const paths = [...new Set(walk(distDir).map(toPath))].sort((a, b) => a.localeCompare(b))
const body = paths.map((p) => `  <url>\n    <loc>${origin}${p}</loc>\n  </url>`).join('\n')
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`

writeFileSync(new URL('../dist/sitemap.xml', import.meta.url), xml)
console.log(`[gen-sitemap] wrote ${paths.length} urls to dist/sitemap.xml (origin: ${origin})`)
