import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
// In production the built client lives at client/dist; from server/dist that is ../../client/dist
const CLIENT_DIR = resolve(__dirname, '../../client/dist')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
}

export function clientBuildExists(): boolean {
  return existsSync(join(CLIENT_DIR, 'index.html'))
}

/**
 * Serve the built SPA. Returns false if the request clearly isn't a static
 * asset request we can satisfy (so the caller can 404). Unknown non-file paths
 * fall back to index.html for client-side routing.
 */
export function serveStatic(req: IncomingMessage, res: ServerResponse): boolean {
  if (!clientBuildExists()) return false

  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
  const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, '')
  let filePath = join(CLIENT_DIR, safePath)

  // Directory or unknown route -> serve index.html (SPA fallback).
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(CLIENT_DIR, 'index.html')
  }

  // Final containment check.
  if (!filePath.startsWith(CLIENT_DIR)) {
    res.writeHead(403)
    res.end('forbidden')
    return true
  }

  const type = MIME[extname(filePath)] ?? 'application/octet-stream'
  const isImmutable = filePath.includes(`${'assets'}`) // hashed vite assets
  res.writeHead(200, {
    'content-type': type,
    'cache-control': isImmutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  createReadStream(filePath)
    .on('error', () => {
      if (!res.headersSent) res.writeHead(500)
      res.end()
    })
    .pipe(res)
  return true
}
