import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomFillSync } from 'node:crypto'

// Pre-generate one block of incompressible random bytes. We reuse it for every
// download response so we never pay crypto cost per request, while still
// defeating any gzip/proxy compression that would inflate the measured speed.
const BLOCK_SIZE = 1 << 20 // 1 MiB
const BLOCK = Buffer.allocUnsafe(BLOCK_SIZE)
randomFillSync(BLOCK)

const MAX_DOWNLOAD = 1024 * 1024 * 1024 // 1 GiB hard cap per request

/**
 * GET /dl?bytes=N
 * Streams N bytes of incompressible random data. Honors TCP backpressure so a
 * slow client throttles us instead of buffering unbounded memory. The client
 * times how long the body takes to arrive to compute download throughput.
 */
export function handleDownload(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const requested = Number(url.searchParams.get('bytes') ?? 25 * 1024 * 1024)
  const total = Number.isFinite(requested)
    ? Math.min(Math.max(Math.floor(requested), 0), MAX_DOWNLOAD)
    : 25 * 1024 * 1024

  res.writeHead(200, {
    'content-type': 'application/octet-stream',
    'content-length': String(total),
    'cache-control': 'no-store, no-cache, must-revalidate',
    // Make sure no intermediary tries to compress incompressible data.
    'content-encoding': 'identity',
    'x-fragrate': 'download',
  })

  let sent = 0
  const pump = (): void => {
    let ok = true
    while (sent < total && ok) {
      const remaining = total - sent
      const chunk = remaining >= BLOCK_SIZE ? BLOCK : BLOCK.subarray(0, remaining)
      sent += chunk.length
      // res.write returns false when the kernel/socket buffer is full.
      ok = res.write(chunk)
    }
    if (sent >= total) {
      res.end()
    }
  }

  // Resume pumping once the socket buffer drains (backpressure).
  res.on('drain', pump)
  req.on('close', () => res.destroy())
  pump()
}

/**
 * POST /ul
 * Sinks the request body, counts bytes, and reports how long it took to
 * receive. The client sends a known number of random bytes and uses the
 * server-measured duration (or its own) to compute upload throughput.
 */
export function handleUpload(req: IncomingMessage, res: ServerResponse): void {
  let bytes = 0
  const start = process.hrtime.bigint()

  req.on('data', (chunk: Buffer) => {
    bytes += chunk.length
  })
  req.on('aborted', () => res.destroy())
  req.on('end', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6
    res.writeHead(200, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    })
    res.end(JSON.stringify({ bytes, ms }))
  })
  req.on('error', () => res.destroy())
}
