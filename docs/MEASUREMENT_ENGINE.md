# FRAGRATE — Measurement Engine Technical Design

Status: implementable spec, v1
Stack (already scaffolded): Node 20 + `node:http` + `ws` + `node-datachannel` (server, port `8787`), React 18 + Vite (client, dev `5173`, proxied to server). In production both are same-origin behind the Node server, so **CORS is a non-issue**. Route prefixes are already reserved in `vite.config.ts`: `/api`, `/dl`, `/ul`, `/net` (WS).

This document specifies the four measurement subsystems (download, upload, latency/jitter, bufferbloat, packet loss), the exact client↔server contracts (HTTP routes, WS JSON messages, WebRTC signaling), and the orchestration timeline.

---

## 0. Conventions, units, and ground rules

### 0.1 Bytes vs bits
- **All throughput results are reported in megabits per second (Mbps), base-10**: `Mbps = bytes * 8 / 1e6 / seconds`.
- Internally, all byte counters are plain integers of **wire bytes transferred** (the `Content-Length`/chunk byte counts we actually read/write), never the decompressed or logical payload size.
- Never use `1024`-based units for the headline number; gamers compare against ISP marketing numbers which are base-10.

### 0.2 Time source
- Browser: `performance.now()` (monotonic, sub-ms). Never `Date.now()` for intervals.
- Node: `process.hrtime.bigint()` for any server-side interval; `Date.now()` only for wall-clock log/`ts` fields.
- RTT samples are computed on the side that owns both endpoints of the round trip (the **client** for WS ping/pong; the **server** for game-endpoint TCP timing).

### 0.3 Compression and caching must be disabled on measurement bytes
- `/dl` and `/ul` responses/requests MUST NOT be gzip/br compressed (random bytes are incompressible anyway, but a proxy could still try). Set `Content-Encoding: identity` and `Cache-Control: no-store, no-transform` on `/dl`. Never send `Accept-Encoding` games — the payload is random so compression yields nothing, but `no-transform` prevents intermediary buffering.
- `/dl` URLs always carry a unique `?n=<nonce>` to defeat any cache.

### 0.4 Random byte generation (cheap, non-blocking)
- Do **not** call `crypto.randomBytes()` per chunk in the hot path (it is CPU-bound and will cap throughput on the server, making you measure the CPU not the link).
- Pre-allocate a single reusable random buffer once at boot:
  ```ts
  const RAND_SIZE = 4 * 1024 * 1024 // 4 MiB
  const RAND = randomBytes(RAND_SIZE) // crypto.randomBytes, once
  ```
  Serve `/dl` by repeatedly writing slices of `RAND` (cycling offset). Incompressible, zero per-chunk CPU. This is the standard trick (same as Cloudflare/Ookla-style servers).

### 0.5 Browser connection limits (critical pitfall)
- Browsers cap **concurrent HTTP/1.1 connections per origin at ~6**. If the Node server speaks HTTP/1.1, more than 6 parallel `/dl` fetches will queue, not parallelize → you under-measure on fast links.
- Two mitigations, pick one and document it:
  1. **HTTP/1.1 + ≤6 streams** (default; simplest, works everywhere). Use 6 download / 3 upload connections.
  2. **HTTP/2 (h2c or TLS)**: one TCP connection multiplexes many streams, sidestepping the 6-conn cap, but a single TCP connection's congestion window can become the bottleneck on high-BDP links, and h2c (cleartext h2) is not supported by browsers — you need TLS. For a localhost/LAN gamer tool, HTTP/1.1 with 6 connections is the pragmatic choice. **This spec assumes HTTP/1.1.**

### 0.6 Slow-start / TCP congestion window (critical pitfall)
- A fresh TCP connection starts in slow-start; the first ~hundreds of ms under-utilize the link while cwnd grows. **The first portion of every throughput phase must be discarded** (warmup). We open connections, let them ramp, then measure only the steady-state window.

### 0.7 Nagle's algorithm and `TCP_NODELAY` (latency pitfall)
- For **latency** paths (WS ping/pong, WebRTC, game-endpoint TCP probes), small packets must not be coalesced. Set `socket.setNoDelay(true)` on:
  - the `ws` server's underlying sockets (`wss` → on `connection`, `ws._socket.setNoDelay(true)`),
  - every game-endpoint probe socket (`net.Socket`, `setNoDelay(true)` — though for a pure connect-timing probe we send no payload so it matters less),
  - the HTTP server is left at default for `/dl`/`/ul` (throughput wants coalescing).

### 0.8 Result envelope
Every phase emits a typed result object; the orchestrator assembles them into a final report. All progress is streamed live over WS (§6.4).

---

## 1. DOWNLOAD throughput

### 1.1 Endpoint
```
GET /dl?bytes=<N>&n=<nonce>
→ 200, Content-Type: application/octet-stream
  Content-Encoding: identity
  Cache-Control: no-store, no-transform
  Content-Length: <N>            // when N is known/bounded
  body: N random bytes (slices of RAND, §0.4)
```
- `bytes` (clamped to `[1, 2_000_000_000]`). If omitted, stream **unbounded** until the client aborts (preferred for the saturation model below — use chunked transfer, no `Content-Length`).
- Recommended primary mode: **unbounded streamed body** that the client kills with `AbortController` when the phase timer ends. This avoids guessing a size that is "big enough" for fast links yet not wasteful on slow ones.

### 1.2 Connections, chunks, durations
| Parameter | Value | Rationale |
|---|---|---|
| Parallel connections | **6** | Browser per-origin HTTP/1.1 cap (§0.5); aggregates multiple cwnds to saturate high-BDP links. |
| Per-write chunk on server | **64 KiB** | Large enough to amortize syscalls, small enough for smooth backpressure. |
| Total phase duration | **10 s** | Long enough for steady state on slow links; bounded for UX. |
| Warmup / discard window | **first 2 s** | Discards slow-start (§0.6). |
| Steady-state measure window | **remaining 8 s** | The reported window. |
| Sampling tick | **every 200 ms** | Drives live progress + steady-state detection. |

### 1.3 Client algorithm (browser)
```text
download(durationMs=10000, warmupMs=2000, conns=6):
  controller = new AbortController()
  bytesPerConn = Int32Array(conns) // total bytes read per stream
  marks = []                       // {t, totalBytes} samples every 200ms
  t0 = performance.now()

  for i in 0..conns-1:
    spawn fetchStream(i)           // see below, runs until abort

  // sampler
  every 200ms until t0+durationMs:
    now = performance.now()
    total = sum(bytesPerConn)
    marks.push({ t: now - t0, total })
    emit WS {type:"progress", phase:"download", mbps: instMbps(marks), elapsed}

  at t0+durationMs: controller.abort()
  await all streams settle

  return computeSteady(marks, warmupMs, durationMs)

fetchStream(i):
  while not aborted:
    res = await fetch(`/dl?n=${rand()}`, {signal: controller.signal, cache:'no-store'})
    reader = res.body.getReader()
    while true:
      {done, value} = await reader.read()   // value: Uint8Array
      if done: break
      bytesPerConn[i] += value.byteLength    // count WIRE bytes
    // if server bounded the body and it ended early, loop reopens a new stream
```

### 1.4 Steady-state throughput computation
Use **windowed average over the steady region**, not a single end-to-end division (which would include warmup).
```text
computeSteady(marks, warmupMs, durationMs):
  steady = marks.filter(m => m.t >= warmupMs)
  first = steady[0], last = steady[last]
  bytes = last.total - first.total
  secs  = (last.t - first.t) / 1000
  meanMbps = bytes * 8 / 1e6 / secs

  // robustness: also compute per-200ms instantaneous Mbps across steady region,
  // take the median and the 90th percentile (peak) for reporting.
  inst = consecutive deltas of steady → mbps each
  return { meanMbps, medianMbps: median(inst), peakMbps: p90(inst), samples: inst.length }
```
- **Headline number = `meanMbps`** of the steady window. Report `medianMbps` and `peakMbps` as secondary.
- Optional adaptive stop: if the last 3 s of `inst` are within ±5% of each other, you may end early (saturation reached). Keep the hard cap at 10 s.

### 1.5 Server algorithm (`/dl`)
```text
on GET /dl:
  write headers (identity, no-store, no-transform; chunked since unbounded)
  off = 0
  function pump():
    while res.write(RAND.subarray(off, off+65536)) === true:   // 64 KiB
      off = (off + 65536) % RAND.length
      if off + 65536 > RAND.length: off = 0
    // res.write returned false → kernel buffer full → wait for 'drain'
  res.on('drain', pump)
  pump()
  req.on('close', () => { stop pumping; cleanup })   // client aborted
```
- Respect backpressure (`write()` boolean + `drain`) so a slow client cannot blow up server memory.
- This is the natural, correct flow-control loop; throughput is whatever the link sustains.

---

## 2. UPLOAD throughput

Symmetric to download, direction reversed.

### 2.1 Endpoint
```
POST /ul
  Content-Type: application/octet-stream
  body: random bytes streamed by the browser
→ 200 {"received": <bytes>}   (server counts and discards)
```
- Server reads and **discards** the body (`req.on('data', c => total += c.length)`), never buffering it all. Replies once the request stream ends or the client closes.

### 2.2 Parameters
| Parameter | Value | Rationale |
|---|---|---|
| Parallel connections | **3** | Upload pipes are usually narrower; fewer connections still saturate, and the browser body-generation cost is real. Stays under the 6-conn cap alongside any control traffic. |
| Per-write chunk (browser) | **64 KiB** slices of a pre-made random `Uint8Array` | Avoid regenerating randomness per chunk (same pitfall as §0.4, client side). |
| Duration / warmup / window | **10 s / 2 s / 8 s** | Same methodology as download. |
| Sampling tick | **200 ms** | |

### 2.3 Client algorithm
Browsers cannot easily measure "bytes acked by the OS"; `fetch` with a `ReadableStream` body resolves only at the end. So we count **bytes we have handed to the stream's `controller.enqueue`** as the throughput proxy, sampled at 200 ms. This is accurate because TCP backpressure propagates into the `ReadableStream` pull mechanism: the browser only pulls more when the socket can take it.

```text
upload(durationMs=10000, warmupMs=2000, conns=3):
  CHUNK = randomUint8Array(65536)        // reused
  sent = Float64Array(conns)
  controller = new AbortController()
  t0 = performance.now()

  for i in 0..conns-1:
    body = new ReadableStream({
      pull(ctrl) {
        if (aborted) { ctrl.close(); return }
        ctrl.enqueue(CHUNK.slice())       // pull-driven == backpressure-driven
        sent[i] += CHUNK.byteLength        // count on enqueue
      }
    })
    spawn fetch('/ul', {method:'POST', body, duplex:'half', signal, headers:{'content-type':'application/octet-stream'}})

  sampler every 200ms: marks.push({t, total: sum(sent)}); emit progress
  at durationMs: abort; settle
  return computeSteady(marks, warmupMs, durationMs)   // identical to §1.4
```
- **Requires `duplex: 'half'`** in `fetch` for a streaming request body (Chromium/▽). Where unsupported (Safari), fall back to sending fixed-size `Blob` POSTs in a loop and counting completed POST bytes; clearly a coarser sampler. Detect via feature test at startup and record `uploadMethod: "stream" | "blob-loop"` in the report.
- **Cross-check (recommended):** have the server also report bytes received per 200 ms over WS (`{type:"ul-rx", bytes}`) so the client can reconcile its enqueue-based estimate against true server-received bytes. If they diverge >10%, prefer the server count for the headline (the server's count is authoritative wire bytes).

### 2.4 Server algorithm (`/ul`)
```text
on POST /ul:
  total = 0; lastEmit = now
  req.on('data', chunk => {
    total += chunk.length
    if (now - lastEmit >= 200ms) { push WS {type:"ul-rx", conn, bytes: total}; lastEmit = now }
  })
  req.on('end', () => res.end(JSON.stringify({received: total})))
  req.on('close', () => res.end(...))   // aborted
```

---

## 3. IDLE LATENCY + JITTER

Two independent measurements:
**(A)** Browser↔Node application-layer RTT over WebSocket (what *this app's* path looks like).
**(B)** Node→real game-server TCP connect timing (what the player's path to the game actually looks like), run by the backend, root-free.

### 3.1 (A) WebSocket ping/pong RTT

Use **application-level JSON ping/pong**, not the WS protocol-level ping frame, so timestamps are under our control and consistent across browsers.

```
client → server: {"type":"ping","seq":k,"t0":<perf.now>}
server → client: {"type":"pong","seq":k,"t0":<echoed>,"srv":<hrtime ns>}   // echo immediately
client computes: rtt_k = performance.now() - t0
```
- **Samples:** 30 (configurable 20–50).
- **Spacing:** send the next ping when the previous pong arrives, **plus a 30–50 ms gap** (do not blast; spacing avoids self-induced queueing and gives an honest idle RTT). Total ≈ 30 × (rtt + 40 ms) ≈ 2–3 s.
- **Per-ping timeout:** 2 s → mark that sample as `lost` (feeds §5 fallback), do not let it stall the loop.
- Server **must `setNoDelay(true)`** on the socket and echo synchronously (no awaits, no JSON.parse on a worker) so server-side processing time ≈ 0.

#### Metrics
```text
rtts = [rtt_0 ... rtt_n-1]                 // ms, excluding lost
min   = min(rtts)
avg   = mean(rtts)
median= p50(rtts)
p95   = p95(rtts)
// Jitter = mean absolute deviation of CONSECUTIVE RTTs (RFC-3550-ish):
jitter = mean( |rtt_i - rtt_{i-1}| for i in 1..n-1 )
```
Report `{min, avg, median, p95, jitter, sent, received, lost}`.

### 3.2 (B) Game-server TCP connect timing (backend, root-free)

We **cannot** open raw ICMP from the browser, and raw sockets need root in Node. The honest, root-free signal is **TCP connect time** to the game's published TCP endpoints (login/matchmaking/game ports). A successful TCP handshake = one RTT to the endpoint (SYN→SYN/ACK), which is an excellent latency proxy and also confirms reachability.

#### Endpoint set
- Maintained server-side as a config map, e.g.:
  ```ts
  const GAME_ENDPOINTS = {
    "valorant-eu":   [{host:"...riot...", port:443}, ...],
    "cs2-eu-west":   [{host:"...", port:27015}, ...],
    // host:port pairs known to accept TCP
  }
  ```
- The client requests a measurement for a chosen game/region; the server measures and returns per-endpoint stats.

#### Algorithm (per endpoint)
```text
probeTcp(host, port, samples=10, perTimeout=1500ms, gap=50ms):
  results = []
  for k in 0..samples-1:
    t0 = hrtime()
    sock = net.connect({host, port})
    sock.setNoDelay(true)
    on 'connect': dt = ms(hrtime()-t0); sock.destroy(); results.push(dt)
    on 'error'|'timeout': results.push(null)   // unreachable/blocked sample
    wait until settled, then sleep(gap)
  ok = results.filter(non-null)
  return {
    host, port,
    samples, ok: ok.length, failed: samples-ok.length,
    min: min(ok), avg: mean(ok),
    jitter: meanAbsDev(consecutive ok)        // same formula as 3.1
  }
```
- **Open a fresh connection per sample** (we are timing the handshake; a kept-open connection would only time application echo, which the game server won't do generically). Tear down immediately after `connect` to avoid hammering the endpoint.
- **Rate-limit & cap:** ≤10 samples × ≤4 endpoints per game, ≥50 ms gap, hard 1.5 s timeout, so we never look like an attack.
- **Pitfall:** TCP connect time includes the SYN/SYN-ACK round trip *plus* any SYN-cookie/anti-DDoS delay on the game side; it is a *latency proxy*, slightly pessimistic vs ICMP. Label it "TCP ping (handshake)" in the UI, not "ping".
- Runs entirely on the Node backend → no browser sandbox issue, no root needed (connect, not raw sockets).

#### Contract
```
client → server (WS): {"type":"game-latency:start","game":"valorant-eu"}
server → client (WS): {"type":"game-latency:progress","host":..,"port":..,"sample":k,"rttMs":..}
server → client (WS): {"type":"game-latency:result","game":"valorant-eu",
                        "endpoints":[{host,port,ok,failed,min,avg,jitter}, ...]}
```

---

## 4. BUFFERBLOAT / latency-under-load

Goal: quantify how much RTT degrades when the link is saturated — the single most important number for gamers.

### 4.1 Procedure
1. **Idle baseline:** run §3.1 (≈30 samples) with no other traffic → `idleRtt` stats.
2. **Loaded-download:** start the §1 download saturation. **While it runs**, keep the WS ping/pong loop going at the same 30–50 ms cadence. Collect RTTs only from the steady window (skip the 2 s warmup). → `loadedDownRtt`.
3. **Loaded-upload:** stop download, start §2 upload, again sample WS RTT in the steady window. → `loadedUpRtt`.
4. Compute deltas and RPM.

> The WS control connection is one of the (≤6) origin connections. During download we use 6 `/dl` connections — that already exceeds the cap, so **the WS connection competes for the slot pool.** Mitigation: during the bufferbloat download phase, drop download to **5** `/dl` connections so the WS socket always has a live connection (it does not get head-of-line blocked behind a queued fetch). Document this 5+1 split.

### 4.2 Metrics
```text
deltaDownMs = loadedDownRtt.median - idleRtt.median
deltaUpMs   = loadedUpRtt.median   - idleRtt.median
loadedMedian = median(all loaded samples, down+up)

// RPM (Round-trips Per Minute), Apple/IETF "responsiveness" style:
// RPM = 60000 / (median loaded RTT in ms)
rpmIdle   = 60000 / idleRtt.median
rpmLoaded = 60000 / loadedMedian
```
- Report `rpmLoaded` as the headline responsiveness figure (higher is better), plus the idle/loaded delta in ms.

### 4.3 Grading bands
Grade off **bufferbloat delta (loaded median − idle median)** primarily; cross-check with RPM.

| Grade | Added latency under load | RPM (loaded) | Gamer meaning |
|---|---|---|---|
| **A+** | < 5 ms | > 6000 | Competitive-grade; no perceptible degradation |
| **A**  | 5–30 ms | 2000–6000 | Excellent |
| **B**  | 30–60 ms | 1000–2000 | Good; fine for most games |
| **C**  | 60–150 ms | 400–1000 | Noticeable lag spikes under load |
| **D**  | 150–400 ms | 130–400 | Bad bufferbloat; rubber-banding likely |
| **F**  | > 400 ms | < 130 | Unplayable while anything else uses the link |

(If RPM band and delta band disagree, take the **worse** of the two for the displayed grade.)

---

## 5. PACKET LOSS — the honest browser options

True packet loss requires an **unreliable, unordered** datagram channel. TCP **retransmits transparently**, so any TCP-based measurement *cannot see real loss* — it sees the *symptom* (stalls/latency), not the lost packets. Be explicit about this in the UI.

### 5.1 PRIMARY: WebRTC DataChannel (true UDP-like loss)

Use a WebRTC `RTCDataChannel` configured **unreliable + unordered**:
```js
pc.createDataChannel("loss", { ordered: false, maxRetransmits: 0 })
```
This rides SCTP-over-DTLS-over-**UDP**. With `maxRetransmits:0` and `ordered:false`, dropped packets are **not** retransmitted and gaps are observable → genuine loss measurement. Server side uses **`node-datachannel`** (already a dependency) to terminate the peer connection in Node.

#### Probe design
| Param | Value |
|---|---|
| Probe rate | **50 probes/sec** (every 20 ms) |
| Count per run | **idle: 250 probes (5 s); under-load: 250 probes (5 s)** |
| Probe payload | `{seq:uint32, t0:float64}` packed into a small fixed binary frame (≤64 B) — or JSON if simpler; binary preferred |
| Direction | **Both:** server→client probes (downlink loss) and client→server probes (uplink loss), each independently sequenced. Run them as two labeled sub-streams. |
| Loss timeout | a `seq` is declared **lost** if it never arrives and a later `seq + GAP_TOLERANCE(=10)` has arrived, or 1 s has elapsed since the run ended. Because the channel is *unordered*, do not declare loss on first out-of-order arrival; wait for the tolerance window. |

#### Algorithm (receiver side, symmetric for both directions)
```text
sender: for seq in 0..N-1: send(pack(seq, now)); sleep(20ms)   // fixed rate
sender: after last, send {type:"loss-done", sent:N}

receiver:
  received = new Set(); maxSeqSeen = -1; arrivals = {}
  on probe(seq, t0): received.add(seq); maxSeqSeen=max; arrivals[seq]=now
  on done(N) OR (now - lastArrival > 1000ms):
    lost = 0
    for seq in 0..N-1:
      if !received.has(seq):
        // confirm it is truly gone: a seq beyond seq+GAP_TOLERANCE arrived
        if maxSeqSeen >= seq + GAP_TOLERANCE: lost++
        else if runEnded: lost++
    lossPct = lost / N * 100
    // one-way delay variation is also available from t0 vs arrival, optional
  report { direction, sent:N, received: received.size, lost, lossPct }
```
- Run the **idle** loss probe during the idle phase, and the **under-load** loss probe *during* the §1/§2 saturation (loss usually only appears under load — that's the interesting number for gamers).
- Report idle loss %, loaded-download loss %, loaded-upload loss %, both directions.

#### Signaling handshake (over the existing `/net` WebSocket — see §6.3)
WebRTC needs an out-of-band signaling channel; we reuse the WS:
```
1. client → server: {"type":"rtc:offer-request"}                 // client asks to start
2. client creates RTCPeerConnection, the "loss" DataChannel, createOffer()
   client → server: {"type":"rtc:offer","sdp":<offer.sdp>}
3. server (node-datachannel) sets remote desc, createAnswer()
   server → client: {"type":"rtc:answer","sdp":<answer.sdp>}
4. ICE trickle, both ways:
   client → server: {"type":"rtc:ice","candidate":<cand>,"mid":..,"mlineindex":..}
   server → client: {"type":"rtc:ice","candidate":<cand>, ...}
5. DataChannel "open" on both ends → ready to probe.
```
- **STUN/TURN:** for a localhost/same-LAN gamer tool the peers are usually directly reachable; configure `iceServers: []` or a single public STUN (`stun:stun.l.google.com:19302`) for NAT discovery. No TURN needed (we are not relaying media). If ICE fails to connect within **8 s**, fall back to §5.2.
- `node-datachannel` exposes `PeerConnection`, `onLocalDescription`, `onLocalCandidate`, `onDataChannel` — wire those to the WS messages above.

### 5.2 FALLBACK: WS sequenced probes (approximate, clearly labeled)

When WebRTC fails (ICE timeout, blocked UDP, unsupported), fall back to sequenced probes over the **TCP** WebSocket. **This cannot measure true loss** (TCP retransmits). It measures *effective* loss = probes that arrived so late they're useless, and connection stalls.

```
client → server: {"type":"wsloss:probe","seq":k,"t0":<now>}   every 20ms, N=250
server echoes:   {"type":"wsloss:echo","seq":k,"t0":<echoed>}
client:
  rtt_k = now - t0
  // "effective loss": a probe whose RTT > STALL_THRESHOLD (e.g. 3× idle p95, min 250ms)
  //  is counted as effectively lost (too late to matter for a game tick).
  effLost = count(rtt > threshold) + count(neverReturned within 2s)
  effLossPct = effLost / N * 100
```
- Report as `lossMethod: "ws-approx"` with an explicit UI caveat: *"Estimated — your browser/network blocked the precise (UDP) test; this counts severe latency spikes as effective loss."*
- Always record which method produced the loss figure: `lossMethod: "webrtc" | "ws-approx"`.

### 5.3 Pitfalls recap
- **TCP hides loss** → never report TCP-based loss as "packet loss"; only WebRTC unreliable mode is truthful.
- **Unordered ≠ lost:** with `ordered:false`, reordering is normal — use the gap-tolerance window before declaring loss.
- **Bursty senders:** keep a strict fixed 20 ms cadence; a `setInterval` that drifts will distort one-way-delay; prefer a self-correcting scheduler (`nextTick = start + (k+1)*20`).

---

## 6. Full client ↔ server API

All endpoints are **same-origin** in production (no CORS). Dev proxy already maps `/api`, `/dl`, `/ul`, `/net` → `:8787`.

### 6.1 HTTP routes
| Method | Path | Purpose | Response |
|---|---|---|---|
| GET | `/api/health` | liveness (exists) | `{ok, service, ts}` |
| GET | `/api/games` | list game/region endpoint groups for the latency picker | `{games:[{id,label,region}]}` |
| GET | `/dl?n=<nonce>[&bytes=N]` | download throughput source (§1) | random octet-stream |
| POST | `/ul` | upload throughput sink (§2) | `{received:<bytes>}` |

### 6.2 WebSocket — `/net`
Single multiplexed JSON WebSocket per test session. Server sets `setNoDelay(true)` on connect. Every message is `{"type": "...", ...}`. Server assigns a `sessionId` on open.

**Control / lifecycle**
```
server → client: {"type":"hello","sessionId":"...", "caps":{"webrtc":true}}
client → server: {"type":"session:start","plan":["idle","download","upload","bufferbloat","loss"],"game":"valorant-eu"}
server → client: {"type":"session:phase","phase":"download","status":"begin"|"end"}
client → server: {"type":"session:abort"}
```

**Latency (§3.1)**
```
client → server: {"type":"ping","seq":k,"t0":<perf.now ms>}
server → client: {"type":"pong","seq":k,"t0":<echoed>,"srv":<ns>}
```

**Game-endpoint latency (§3.2)**
```
client → server: {"type":"game-latency:start","game":"valorant-eu"}
server → client: {"type":"game-latency:progress","host":..,"port":..,"sample":k,"rttMs":..}
server → client: {"type":"game-latency:result","game":..,"endpoints":[{host,port,ok,failed,min,avg,jitter}]}
```

**Upload server-side byte feedback (§2.3)**
```
server → client: {"type":"ul-rx","conn":i,"bytes":<cumulative>}
```

**Live progress (§6.4)** — emitted by client logic for client-measured phases, by server for server-measured phases:
```
* → client UI: {"type":"progress","phase":"download"|"upload","mbps":..,"elapsed":ms,"window":"warmup"|"steady"}
* → client UI: {"type":"progress","phase":"bufferbloat","rttMs":..,"loadKind":"download"|"upload"}
* → client UI: {"type":"progress","phase":"loss","direction":"down"|"up","sent":..,"received":..,"lossPct":..}
```

**Phase results** (authoritative, one per phase)
```
{"type":"result","phase":"idle",       "data":{min,avg,median,p95,jitter,sent,received,lost}}
{"type":"result","phase":"download",   "data":{meanMbps,medianMbps,peakMbps,samples}}
{"type":"result","phase":"upload",     "data":{meanMbps,medianMbps,peakMbps,samples,uploadMethod}}
{"type":"result","phase":"bufferbloat","data":{idleMedian,loadedMedian,deltaDownMs,deltaUpMs,rpmIdle,rpmLoaded,grade}}
{"type":"result","phase":"loss",       "data":{lossMethod,idle:{...},loadedDown:{...},loadedUp:{...}}}
{"type":"session:complete","report":{...full aggregate...,"verdicts":{...per-game grades...}}}
```

**WS-loss fallback (§5.2)**
```
client → server: {"type":"wsloss:probe","seq":k,"t0":..}
server → client: {"type":"wsloss:echo","seq":k,"t0":..}
```

### 6.3 WebRTC signaling messages (over `/net`, §5.1)
```
client → server: {"type":"rtc:offer-request"}
client → server: {"type":"rtc:offer","sdp":"<sdp>"}
server → client: {"type":"rtc:answer","sdp":"<sdp>"}
client → server: {"type":"rtc:ice","candidate":"<c>","mid":"<mid>"}
server → client: {"type":"rtc:ice","candidate":"<c>","mid":"<mid>"}
server → client: {"type":"rtc:state","state":"connecting"|"connected"|"failed"}
```
Probe frames travel **on the DataChannel itself** (binary), not over WS:
```
DataChannel binary frame: [ uint8 kind=0(probe)|1(done) ][ uint32 seq ][ float64 t0 ][ uint32 totalIfDone ]
```

### 6.4 Streaming live progress to the UI
- The React client subscribes to the single `/net` WebSocket and reduces messages into a state store (`useReducer`/Zustand). Each `progress`/`result` message updates the relevant gauge.
- Client-measured phases (download/upload/latency/bufferbloat RTT) compute locally at 200 ms (throughput) / per-pong (latency) cadence and the **client both updates its own UI and echoes a `progress` message** so the server can log the session. Server-measured phases (game-latency, loss results, ul-rx) push directly.
- Throttle UI repaints to ≤10 fps; keep the raw sample arrays for the final report but render smoothed values.

---

## 7. Recommended overall test sequence / timeline

Order matters: measure **idle first** (before saturating anything), and never run a throughput phase concurrently with the idle latency baseline.

```
t=0     hello / session:start, open WS, setNoDelay
t       [Phase 1] IDLE LATENCY (§3.1)          ~3 s   30 WS pings @ ~40ms gap
t       [Phase 2] GAME-ENDPOINT TCP (§3.2)     ~4 s   parallel-OK with idle WS (different sockets); run after idle pings to keep baseline clean
t       [Phase 3] WEBRTC SETUP + IDLE LOSS     ~6 s   signaling handshake; if OK, 250 probes idle (§5.1); else mark fallback
t       [Phase 4] DOWNLOAD (§1)                 10 s   6→5 conns; sample mbps; ALSO sample WS RTT (→bufferbloat down) + WebRTC loss (loaded-down)
t       [Phase 5] UPLOAD (§2)                   10 s   3 conns; sample mbps; ALSO sample WS RTT (→bufferbloat up) + WebRTC loss (loaded-up)
t       [Phase 6] COMPUTE                        <1 s  bufferbloat deltas, RPM, grades, per-game verdicts
t       session:complete with full report
```
Total ≈ 33–35 s. Phases 4 and 5 each *fold in* the bufferbloat-RTT and loaded-loss sampling so we don't pay for them twice — saturating the link once and watching latency+loss simultaneously is exactly the loaded condition we want to characterize.

Sequencing rules:
- Never overlap Phase 1 (idle baseline) with any throughput.
- During Phase 4/5, reserve one connection slot for WS (the 5+1 split, §4.1) so RTT sampling isn't head-of-line blocked.
- If `session:abort` arrives, abort all fetches (`AbortController`), close the DataChannel, stop probe schedulers, and emit `session:complete` with whatever partial results exist.

---

## 8. Pitfalls checklist (implementer-facing)

- [ ] Report **bits**, base-10 Mbps; counters are **wire bytes** (§0.1).
- [ ] Discard **slow-start** warmup (first 2 s) on every throughput phase (§0.6).
- [ ] Respect the **6-connection** browser cap; reserve a slot for WS during loaded phases (§0.5, §4.1).
- [ ] `setNoDelay(true)` (disable **Nagle**) on all latency sockets; leave it default for bulk transfer (§0.7).
- [ ] **CORS is a non-issue** (same-origin in prod, Vite proxy in dev) — do not add CORS middleware that could interfere (§0).
- [ ] Pre-generate the random buffer **once**; never `crypto.randomBytes` per chunk (§0.4) — otherwise you measure server CPU, not the link.
- [ ] Disable **compression/transform** on `/dl` (`no-transform`, `identity`) and cache (`no-store`, `?n=nonce`) (§0.3).
- [ ] **TCP retransmit hides loss** — only WebRTC `maxRetransmits:0, ordered:false` gives true loss; everything TCP-based is "effective/approximate" loss and must be labeled (§5).
- [ ] With unordered DataChannel, **reordering ≠ loss** — apply the gap-tolerance window (§5.1).
- [ ] Use a **drift-free** fixed-rate scheduler for probes (`start + k*interval`), not naive `setInterval` (§5.3).
- [ ] Respect HTTP **backpressure** on `/dl` (`write()`/`drain`) and stream-discard `/ul` so the server can't OOM (§1.5, §2.4).
- [ ] Game-endpoint timing is **TCP handshake RTT** (a latency *proxy*), root-free, rate-limited — label accordingly (§3.2).
- [ ] Use `performance.now()` / `hrtime.bigint()`, never `Date.now()`, for intervals (§0.2).
```
