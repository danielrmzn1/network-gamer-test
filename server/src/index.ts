import { createServer } from 'node:http'
import type { Socket } from 'node:net'
import { WebSocketServer } from 'ws'
import { handleDownload, handleUpload } from './speedtest'
import { serveStatic, clientBuildExists } from './static'
import { NetSession } from './ws/session'

const PORT = Number(process.env.PORT ?? 8787)

const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0]

  if (path === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    res.end(JSON.stringify({ ok: true, service: 'fragrate', ts: Date.now() }))
    return
  }
  if (path === '/dl' && req.method === 'GET') return handleDownload(req, res)
  if (path === '/ul' && req.method === 'POST') return handleUpload(req, res)

  // Production: serve the built SPA. In dev, Vite serves the UI and proxies here.
  if (serveStatic(req, res)) return

  res.writeHead(404, { 'content-type': 'text/plain' })
  res.end('not found')
})

// WebSocket measurement channel at /net.
const wss = new WebSocketServer({ noServer: true })
server.on('upgrade', (req, socket, head) => {
  const path = (req.url ?? '/').split('?')[0]
  if (path !== '/net') {
    socket.destroy()
    return
  }
  ;(socket as Socket).setNoDelay(true)
  wss.handleUpgrade(req, socket, head, (ws) => {
    new NetSession(ws)
  })
})

server.listen(PORT, () => {
  console.log(`[fragrate] measurement server on http://localhost:${PORT}`)
  console.log(`[fragrate] client build present: ${clientBuildExists()} (dev uses Vite :5173)`)
})
