export type RunMode = 'local' | 'hosted'

let cached: RunMode | null = null

/**
 * Detect whether the local Node measurement server is present (full mode:
 * real per-game-region TCP ping + STUN loss), or we're running as a static
 * site on Cloudflare Pages (hosted mode: browser-only measurements).
 */
export async function detectMode(): Promise<RunMode> {
  if (cached) return cached
  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 2500)
    const res = await fetch('/api/health', { signal: ac.signal, cache: 'no-store' })
    clearTimeout(timer)
    if (res.ok) {
      const j = (await res.json()) as { service?: string }
      if (j?.service === 'netpulse') {
        cached = 'local'
        return cached
      }
    }
  } catch {
    /* no local server -> hosted */
  }
  cached = 'hosted'
  return cached
}
