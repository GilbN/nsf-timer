import { WebSocketServer, WebSocket } from 'ws'

const PORT = process.env.PORT || 8080
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*'
const HEARTBEAT_INTERVAL = 30_000
const HEARTBEAT_TIMEOUT = 10_000
const HOST_GRACE_PERIOD = 60_000 * 30 // 10 minutes for host to reconnect

// roomCode → { host: WebSocket|null, clients: Map<peerId, { ws, name, lane }>, lastState: object|null, graceTimer: number|null }
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

function getRoomForClient(ws) {
  for (const [code, room] of rooms) {
    if (room.host === ws) return { code, room, role: 'host' }
    for (const [peerId, client] of room.clients) {
      if (client.ws === ws) return { code, room, role: 'client', peerId }
    }
  }
  return null
}

function isLaneTaken(room, lane) {
  for (const client of room.clients.values()) {
    if (client.isSpectator) continue
    if (client.lane === lane) return true
  }
  return false
}

// --- Message handlers ---

function handleCreateRoom(ws, { code }) {
  if (!code || code.length !== 4) {
    send(ws, { action: 'ERROR', reason: 'invalid_code' })
    return
  }
  
  const existingRoom = rooms.get(code)
  
  // Allow reclaim if room exists but host is disconnected (in grace period)
  if (existingRoom) {
    if (existingRoom.host === null && existingRoom.graceTimer) {
      // Host is reclaiming the room
      clearTimeout(existingRoom.graceTimer)
      existingRoom.graceTimer = null
      existingRoom.host = ws
      ws._roomCode = code
      ws._role = 'host'
      send(ws, { action: 'ROOM_CREATED', code })

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
    send(ws, { action: 'ERROR', reason: 'code_taken' })
    return
  }
  
  rooms.set(code, { host: ws, clients: new Map(), lastState: null, graceTimer: null })
  ws._roomCode = code
  ws._role = 'host'
  send(ws, { action: 'ROOM_CREATED', code })
  console.log(`[room] created ${code}`)
}

function handleJoinRoom(ws, { code, name, lane, role }) {
  const room = rooms.get(code)
  if (!room) {
    send(ws, { action: 'ERROR', reason: 'room_not_found' })
    return
  }
  const isSpectator = role === 'spectator'
  // Spectators don't occupy a lane — ignore any lane they send
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

  const { code, room, role } = entry

  if (role === 'host') {
    // Cache STATE_SYNC for reconnecting clients
    if (message?.type === 'STATE_SYNC') {
      room.lastState = message
    }
    // Fan out to all clients
    for (const { ws: clientWs } of room.clients.values()) {
      send(clientWs, { action: 'RELAYED', message })
    }
  } else {
    // Spectators are read-only — drop any traffic they try to send upstream
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

  // Cancel any pending grace timer — the host is telling us explicitly
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
  console.log(`[room] ${code} closed by host`)
}

// --- Connection lifecycle ---

function handleClose(ws) {
  const entry = getRoomForClient(ws)
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
      // Grace period expired — close the room
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

function startHeartbeat(wss) {
  setInterval(() => {
    for (const ws of wss.clients) {
      ws._alive = false
      ws.ping()
      ws._heartbeatTimer = setTimeout(() => {
        if (!ws._alive) ws.terminate()
      }, HEARTBEAT_TIMEOUT)
    }
  }, HEARTBEAT_INTERVAL)
}

// --- Server setup ---

const wss = new WebSocketServer({
  port: PORT,
  verifyClient: ({ origin }, cb) => {
    if (ALLOWED_ORIGINS === '*' || !origin) return cb(true)
    const allowed = ALLOWED_ORIGINS.split(',').map(o => o.trim())
    cb(allowed.includes(origin), 403, 'Forbidden')
  },
})

wss.on('connection', (ws) => {
  ws._alive = true

  ws.on('pong', () => {
    ws._alive = true
    clearTimeout(ws._heartbeatTimer)
  })

  ws.on('message', (data) => {
    let msg
    try {
      msg = JSON.parse(data)
    } catch {
      return
    }

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

startHeartbeat(wss)

console.log(`opk-timer relay server listening on ws://localhost:${PORT}`)
