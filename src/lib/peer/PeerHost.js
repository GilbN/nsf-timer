import { Peer } from 'peerjs'
import { get } from 'svelte/store'
import { MSG, createMessage } from './messages.js'
import { roomState, timerState } from '../stores.js'

const PEER_PREFIX = 'opk-timer-'
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no O/0/I/1/L
const PING_TIMEOUT = 15000

/**
 * Peer details stored per connection:
 * { conn, lastPing, name, lane, jamsUsed, jamStageKeys }
 *
 * jamStageKeys: Set of "stage{i}" strings where a jam was used (max 1 per stage)
 */
export class PeerHost {
  constructor() {
    this.peer = null
    this.connections = new Map() // peerId → peer detail object
    this.code = null
    this._pingInterval = null
    this._onPeersChange = null
    this._lastTimerState = null // cached for sending to new connections
  }

  onPeersChange(cb) {
    this._onPeersChange = cb
  }

  generateCode() {
    let code = ''
    for (let i = 0; i < 4; i++) {
      code += CHARS[Math.floor(Math.random() * CHARS.length)]
    }
    return code
  }

  async createRoom(existingCode = null) {
    this.code = existingCode || this.generateCode()
    const peerId = PEER_PREFIX + this.code

    return new Promise((resolve, reject) => {
      this.peer = new Peer(peerId)

      this.peer.on('open', () => {
        this._syncRoomState()
        this.peer.on('connection', (conn) => this._handleConnection(conn))
        this._pingInterval = setInterval(() => this._checkPings(), PING_TIMEOUT)
        resolve(this.code)
      })

      this.peer.on('error', (err) => {
        if (err.type === 'unavailable-id' && !existingCode) {
          this.destroy()
          this.createRoom().then(resolve).catch(reject)
        } else {
          reject(err)
        }
      })
    })
  }

  _handleConnection(conn) {
    conn.on('open', () => {
      this.connections.set(conn.peer, {
        conn,
        lastPing: Date.now(),
        name: '',
        lane: '',
        jamsUsed: 0,
        jamStageKeys: new Set(),
      })
      this._syncRoomState()
      // Send current timer state to the new peer immediately
      this._sendStateToPeer(conn)
    })

    conn.on('data', (msg) => {
      const entry = this.connections.get(conn.peer)
      if (!entry) return

      if (msg.type === MSG.PING) {
        entry.lastPing = Date.now()
      } else if (msg.type === MSG.JOIN_INFO) {
        const lane = msg.payload.lane || ''
        // Check for duplicate lane
        if (lane && this._isLaneTaken(lane, conn.peer)) {
          try {
            conn.send(createMessage(MSG.LANE_REJECTED, { lane }))
          } catch {}
          // Close connection after a short delay so the message arrives
          setTimeout(() => {
            this.connections.delete(conn.peer)
            try { conn.close() } catch {}
            this._syncRoomState()
          }, 500)
          return
        }
        entry.name = msg.payload.name || ''
        entry.lane = lane
        this._syncRoomState()
      }
    })

    conn.on('close', () => {
      this.connections.delete(conn.peer)
      this._syncRoomState()
    })

    conn.on('error', () => {
      this.connections.delete(conn.peer)
      this._syncRoomState()
    })
  }

  _checkPings() {
    const now = Date.now()
    let changed = false
    for (const [peerId, entry] of this.connections) {
      if (now - entry.lastPing > PING_TIMEOUT) {
        this.connections.delete(peerId)
        changed = true
      }
    }
    if (changed) this._syncRoomState()
  }

  /**
   * Get peer list with details for UI
   */
  getPeerDetails(stageKey = null) {
    const peers = []
    for (const [peerId, entry] of this.connections) {
      peers.push({
        peerId,
        name: entry.name,
        lane: entry.lane,
        jamsUsed: entry.jamsUsed,
        canJam: entry.jamsUsed < 2 && (stageKey === null || !entry.jamStageKeys.has(stageKey)),
      })
    }
    // Sort by lane number (numeric), then name
    peers.sort((a, b) => {
      const la = parseInt(a.lane) || 999
      const lb = parseInt(b.lane) || 999
      return la - lb || a.name.localeCompare(b.name)
    })
    return peers
  }

  _syncRoomState() {
    const state = get(timerState)
    const stageKey = state?.stageIndex != null ? `stage${state.stageIndex}` : null
    const peers = this.getPeerDetails(stageKey)
    roomState.update((s) => ({
      ...s,
      code: this.code,
      isHost: true,
      connectedPeers: peers,
    }))
    if (this._onPeersChange) this._onPeersChange(peers)
  }

  /**
   * Check if a lane number is already in use by another peer
   */
  _isLaneTaken(lane, excludePeerId) {
    for (const [peerId, entry] of this.connections) {
      if (peerId !== excludePeerId && entry.lane === lane) {
        return true
      }
    }
    return false
  }

  /**
   * Check if a peer can declare a malfunction for the current stage.
   * Rules: max 2 per program, max 1 per stage.
   */
  canPeerDeclareJam(peerId, stageKey) {
    const entry = this.connections.get(peerId)
    if (!entry) return false
    if (entry.jamsUsed >= 2) return false
    if (entry.jamStageKeys.has(stageKey)) return false
    return true
  }

  /**
   * Record a malfunction for a peer. Returns true if allowed.
   * Rules: max 2 per program, max 1 per stage.
   */
  recordJam(peerId, stageKey) {
    const entry = this.connections.get(peerId)
    if (!entry) return false
    if (entry.jamsUsed >= 2) return false
    if (entry.jamStageKeys.has(stageKey)) return false

    entry.jamsUsed++
    entry.jamStageKeys.add(stageKey)
    this._syncRoomState()
    return true
  }

  /**
   * Reset jam counters for all peers (on program reset)
   */
  resetAllJams() {
    for (const entry of this.connections.values()) {
      entry.jamsUsed = 0
      entry.jamStageKeys.clear()
    }
    this._syncRoomState()
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(type, payload = {}) {
    const msg = createMessage(type, payload)
    for (const { conn } of this.connections.values()) {
      try {
        if (conn.open) conn.send(msg)
      } catch {
        // ignore send errors
      }
    }
  }

  /**
   * Send a message to a specific peer
   */
  sendToPeer(peerId, type, payload = {}) {
    const entry = this.connections.get(peerId)
    if (!entry?.conn?.open) return
    try {
      entry.conn.send(createMessage(type, payload))
    } catch {
      // ignore
    }
  }

  /**
   * Broadcast full timer state and cache it for new connections
   */
  broadcastState(state) {
    const prevStageIndex = this._lastTimerState?.stageIndex
    this._lastTimerState = state
    this.broadcast(MSG.STATE_SYNC, state)
    if (state.stageIndex !== prevStageIndex) {
      this._syncRoomState()
    }
  }

  /**
   * Send current timer state to a specific connection.
   * Uses cached state from last broadcast, falling back to the timerState store.
   */
  _sendStateToPeer(conn) {
    const state = this._lastTimerState || get(timerState)
    if (!state?.programId) return
    try {
      if (conn.open) {
        conn.send(createMessage(MSG.STATE_SYNC, state))
      }
    } catch {
      // ignore
    }
  }

  destroy() {
    if (this._pingInterval) {
      clearInterval(this._pingInterval)
      this._pingInterval = null
    }
    this.broadcast(MSG.ROOM_CLOSED)
    for (const { conn } of this.connections.values()) {
      try { conn.close() } catch {}
    }
    this.connections.clear()
    if (this.peer) {
      this.peer.destroy()
      this.peer = null
    }
    roomState.set({ code: null, isHost: false, connectedPeers: [] })
  }
}
