import { randomUUID } from 'node:crypto'
import { realpathSync } from 'node:fs'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'

const WS_PORT = process.env.WS_PORT || 8080
const WS_ALLOWED_ORIGINS = process.env.WS_ALLOWED_ORIGINS || '*'
const HEARTBEAT_INTERVAL = 30_000
const MAX_PAYLOAD = 64 * 1024
// Token bucket per connection: sustained rate and burst size
const RATE_PER_SEC = 100
const RATE_BURST = 200
// Close code sent to an old host socket replaced by a reclaim
const CLOSE_HOST_REPLACED = 4001
const DEFAULT_HOST_GRACE_PERIOD = 60_000 * 30 // 30 minutes for host to reconnect
let HOST_GRACE_PERIOD = DEFAULT_HOST_GRACE_PERIOD

// roomCode → { host: WebSocket|null, hostToken: string, clients: Map<peerId, { ws, name, lane }>, lastState: object|null, graceTimer: number|null }
const rooms = new Map()

let nextPeerId = 1
function generatePeerId() {
  return `peer-${Date.now()}-${nextPeerId++}`
}

function send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj))
  }
}

// O(1) lookup from the fields set on join/create. Checks membership too, so
// a stale _roomCode (room closed, code reused) does not match a new room.
function getRoomForClient(ws) {
  const code = ws._roomCode
  if (!code) return null
  const room = rooms.get(code)
  if (!room) return null
  if (ws._role === 'host' && room.host === ws) return { code, room, role: 'host' }
  if (ws._role === 'client' && room.clients.get(ws._peerId)?.ws === ws) {
    return { code, room, role: 'client', peerId: ws._peerId }
  }
  return null
}

function detach(ws) {
  ws._roomCode = null
  ws._role = null
  ws._peerId = null
  ws._isSpectator = false
}

function isLaneTaken(room, lane) {
  for (const client of room.clients.values()) {
    if (client.isSpectator) continue
    if (client.lane === lane) return true
  }
  return false
}

// --- Message handlers ---

function handleCreateRoom(ws, { code, hostToken }) {
  if (typeof code !== 'string' || code.length !== 4) {
    send(ws, { action: 'ERROR', reason: 'invalid_code' })
    return
  }

  const current = getRoomForClient(ws)
  if (current && !(current.role === 'host' && current.code === code)) {
    send(ws, { action: 'ERROR', reason: 'already_in_room' })
    return
  }

  const existingRoom = rooms.get(code)

  if (existingRoom) {
    if (!hostToken || hostToken !== existingRoom.hostToken) {
      send(ws, { action: 'ERROR', reason: 'code_taken' })
      return
    }

    // Reclaim. The old host socket may still be open if a page reload
    // raced its close, so detach it first so its close is a no-op.
    const oldHost = existingRoom.host
    if (oldHost && oldHost !== ws) {
      detach(oldHost)
      oldHost.close(CLOSE_HOST_REPLACED, 'host_replaced')
    }
    clearTimeout(existingRoom.graceTimer)
    existingRoom.graceTimer = null
    existingRoom.host = ws
    ws._roomCode = code
    ws._role = 'host'
    send(ws, { action: 'ROOM_CREATED', code, hostToken: existingRoom.hostToken })

    // Send a snapshot of current non-spectator peers so the host can
    // rebuild its connections map. Any PEER_JOINED / PEER_LEFT messages
    // emitted while the host was offline were silently dropped, so
    // without this the host's view of the lobby can drift from ground
    // truth (missing peers, duplicated peers after later rejoins, etc).
    const peers = []
    for (const [peerId, client] of existingRoom.clients) {
      if (client.isSpectator) continue
      peers.push({ peerId, name: client.name, lane: client.lane })
    }
    send(ws, { action: 'PEERS_SNAPSHOT', peers })

    // Notify clients that host is back
    for (const { ws: clientWs } of existingRoom.clients.values()) {
      send(clientWs, { action: 'HOST_RECONNECTED' })
    }
    console.log(`[room] ${code} host reclaimed (${peers.length} peer${peers.length === 1 ? '' : 's'})`)
    return
  }

  const token = randomUUID()
  rooms.set(code, { host: ws, hostToken: token, clients: new Map(), lastState: null, graceTimer: null })
  ws._roomCode = code
  ws._role = 'host'
  send(ws, { action: 'ROOM_CREATED', code, hostToken: token })
  console.log(`[room] created ${code}`)
}

function handleJoinRoom(ws, { code, name, lane, role }) {
  if (getRoomForClient(ws)) {
    send(ws, { action: 'ERROR', reason: 'already_in_room' })
    return
  }
  const room = rooms.get(code)
  if (!room) {
    send(ws, { action: 'ERROR', reason: 'room_not_found' })
    return
  }
  const isSpectator = role === 'spectator'
  // Spectators don't occupy a lane, so ignore any lane they send
  const effectiveLane = isSpectator ? '' : (lane || '')
  if (!isSpectator && effectiveLane && isLaneTaken(room, effectiveLane)) {
    send(ws, { action: 'ERROR', reason: 'lane_taken' })
    return
  }
  const peerId = generatePeerId()
  room.clients.set(peerId, { ws, name: name || '', lane: effectiveLane, isSpectator })
  ws._roomCode = code
  ws._role = 'client'
  ws._isSpectator = isSpectator
  ws._peerId = peerId

  // Always send join acknowledgement first
  send(ws, { action: 'JOINED', peerId, code })

  // Notify host for non-spectators only (spectators are invisible to host)
  if (!isSpectator && room.host) {
    send(room.host, { action: 'PEER_JOINED', peerId, name: name || '', lane: lane || '' })
  }

  // Send cached state immediately if available
  if (room.lastState) {
    send(ws, { action: 'CACHED_STATE', message: room.lastState })
  }
  
  // If host is disconnected (in grace period), let client know
  if (!room.host) {
    send(ws, { action: 'HOST_DISCONNECTED' })
  }

  console.log(`[room] ${code} peer joined: ${peerId} (${name}, lane ${lane})`)
}

function handleRelay(ws, { message }) {
  const entry = getRoomForClient(ws)
  if (!entry) return

  const { room, role } = entry

  if (role === 'host') {
    // Cache STATE_SYNC for reconnecting clients
    if (message?.type === 'STATE_SYNC') {
      room.lastState = message
    } else if (message?.type === 'TICK' && room.lastState) {
      // Keep the cached countdown current so late joiners see the right time
      const tick = message.payload || {}
      room.lastState = {
        ...room.lastState,
        payload: {
          ...room.lastState.payload,
          remainingMs: tick.remainingMs ?? room.lastState.payload?.remainingMs,
          targetVisible: tick.targetVisible ?? room.lastState.payload?.targetVisible,
        },
      }
    }
    // Fan out to all clients
    for (const { ws: clientWs } of room.clients.values()) {
      send(clientWs, { action: 'RELAYED', message })
    }
  } else {
    // Spectators are read-only, so drop any traffic they try to send upstream
    if (ws._isSpectator) return
    // Client → forward to host only (if connected)
    if (room.host) {
      send(room.host, { action: 'RELAYED', message })
    }
  }
}

function handleRelayTo(ws, { peerId, message }) {
  const entry = getRoomForClient(ws)
  if (!entry || entry.role !== 'host') return

  const client = entry.room.clients.get(peerId)
  if (client) {
    send(client.ws, { action: 'RELAYED', message })
  }
}

function handleCloseRoom(ws) {
  const entry = getRoomForClient(ws)
  if (!entry || entry.role !== 'host') return

  const { code, room } = entry

  // Cancel any pending grace timer. The host is telling us explicitly
  // that the session is over, so we should not wait to clean up.
  if (room.graceTimer) {
    clearTimeout(room.graceTimer)
    room.graceTimer = null
  }

  // Notify every client that the room has been closed by the host.
  const closedMsg = {
    action: 'RELAYED',
    message: { type: 'ROOM_CLOSED', payload: {}, ts: Date.now() },
  }
  for (const { ws: clientWs } of room.clients.values()) {
    send(clientWs, closedMsg)
  }

  rooms.delete(code)
  detach(ws)
  console.log(`[room] ${code} closed by host`)
}

// --- Connection lifecycle ---

function handleClose(ws) {
  const entry = getRoomForClient(ws)
  // Clear first so a second call ('error' then 'close') is a no-op
  detach(ws)
  if (!entry) return

  const { code, room, role, peerId } = entry

  if (role === 'host') {
    // Start grace period instead of immediately closing
    room.host = null
    
    // Notify clients that host is temporarily disconnected
    for (const { ws: clientWs } of room.clients.values()) {
      send(clientWs, { action: 'HOST_DISCONNECTED' })
    }
    
    console.log(`[room] ${code} host disconnected, grace period started`)
    
    room.graceTimer = setTimeout(() => {
      // Grace period expired, close the room
      const closedMsg = { action: 'RELAYED', message: { type: 'ROOM_CLOSED', payload: {}, ts: Date.now() } }
      for (const { ws: clientWs } of room.clients.values()) {
        send(clientWs, closedMsg)
      }
      rooms.delete(code)
      console.log(`[room] closed ${code} (grace period expired)`)
    }, HOST_GRACE_PERIOD)
  } else {
    room.clients.delete(peerId)
    if (room.host && !ws._isSpectator) {
      send(room.host, { action: 'PEER_LEFT', peerId })
    }
    console.log(`[room] ${code} peer left: ${peerId}`)
  }
}

// --- Heartbeat ---

// Terminate sockets that missed the previous ping, then ping the rest
function startHeartbeat(wss) {
  return setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws._alive) {
        ws.terminate()
        continue
      }
      ws._alive = false
      ws.ping()
    }
  }, HEARTBEAT_INTERVAL)
}

// Returns false when the socket is over its message budget
function takeToken(ws) {
  const now = performance.now()
  ws._tokens = Math.min(RATE_BURST, ws._tokens + (now - ws._lastRefill) * RATE_PER_SEC / 1000)
  ws._lastRefill = now
  if (ws._tokens < 1) return false
  ws._tokens -= 1
  return true
}

// --- Server setup ---

function setupConnectionHandler(wss) {
  wss.on('connection', (ws) => {
    ws._alive = true
    ws._tokens = RATE_BURST
    ws._lastRefill = performance.now()

    ws.on('pong', () => { ws._alive = true })

    ws.on('message', (data) => {
      if (!takeToken(ws)) return
      let msg
      try {
        msg = JSON.parse(data)
      } catch {
        return
      }
      // Valid JSON like `null` or `42` must not crash the process
      if (!msg || typeof msg !== 'object') return

      switch (msg.action) {
        case 'CREATE_ROOM':  handleCreateRoom(ws, msg);          break
        case 'JOIN_ROOM':    handleJoinRoom(ws, msg);             break
        case 'RELAY':        handleRelay(ws, msg);                break
        case 'RELAY_TO':     handleRelayTo(ws, msg);              break
        case 'CLOSE_ROOM':   handleCloseRoom(ws);                 break
        case 'PING':         send(ws, { action: 'PONG' });        break
      }
    })

    ws.on('close', () => handleClose(ws))
    ws.on('error', () => handleClose(ws))
  })
}

function handleHttp(req, res) {
  const path = req.url.split('?')[0]
  if ((req.method === 'GET' || req.method === 'HEAD') && path === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('not found')
}

/**
 * Create a relay server instance. Exposed as a factory so tests can spin up
 * isolated servers on random ports without racing on the global one.
 */
export function createServer({
  port = WS_PORT,
  allowedOrigins = WS_ALLOWED_ORIGINS,
  hostGracePeriod = DEFAULT_HOST_GRACE_PERIOD,
} = {}) {
  HOST_GRACE_PERIOD = hostGracePeriod
  const server = http.createServer(handleHttp)
  const wss = new WebSocketServer({
    server,
    maxPayload: MAX_PAYLOAD,
    verifyClient: ({ origin }, cb) => {
      if (allowedOrigins === '*' || !origin) return cb(true)
      const allowed = allowedOrigins.split(',').map(o => o.trim())
      cb(allowed.includes(origin), 403, 'Forbidden')
    },
  })

  setupConnectionHandler(wss)
  const heartbeatTimer = startHeartbeat(wss)
  server.listen(port)

  return {
    wss,
    get address() { return server.address() },
    close() {
      clearInterval(heartbeatTimer)
      return new Promise((resolve) => {
        for (const client of wss.clients) {
          try { client.terminate() } catch {}
        }
        wss.close(() => {
          server.closeAllConnections()
          server.close(() => resolve())
        })
      })
    },
  }
}

function isEntrypoint() {
  if (!process.argv[1]) return false
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1])
  } catch {
    return false
  }
}

// CLI bootstrap, only when this file is the entrypoint, not when imported.
if (isEntrypoint()) {
  const instance = createServer()
  instance.wss.on('listening', () => {
    console.log(`nsf-timer relay server listening on ws://localhost:${instance.address.port}`)
  })
  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down`)
    instance.close().then(() => process.exit(0))
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}
