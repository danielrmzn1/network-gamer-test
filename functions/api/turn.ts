// Served at GET /api/turn (Cloudflare Pages Function). Mints short-lived
// Cloudflare Realtime TURN credentials server-side and returns the
// browser-ready { iceServers } object. The long-term TURN key never reaches the
// client. If the secrets aren't set, returns 500 — the client treats any non-OK
// response as "no TURN" and degrades to available:false ("run locally").

interface Env {
  TURN_KEY_ID: string // secret — TURN Key/Token ID (URL path)
  TURN_KEY_API_TOKEN: string // secret — Bearer API token
}

interface IceServer {
  urls: string[]
  username?: string
  credential?: string
}

export const onRequestGet = async (context: { env: Env }): Promise<Response> => {
  const { TURN_KEY_ID, TURN_KEY_API_TOKEN } = context.env

  if (!TURN_KEY_ID || !TURN_KEY_API_TOKEN) {
    return new Response(JSON.stringify({ error: 'TURN credentials not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ttl = 86400 // seconds; max 172800 (48h)

  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TURN_KEY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl }),
    },
  )

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Failed to mint TURN credentials', status: res.status }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const data = (await res.json()) as { iceServers: IceServer[] }

  // Drop :53 URLs — blocked by Chrome/Firefox; without trickle ICE they stall.
  const iceServers = data.iceServers.map((s) => ({
    ...s,
    urls: s.urls.filter((u) => !u.includes(':53')),
  }))

  return new Response(JSON.stringify({ iceServers }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
