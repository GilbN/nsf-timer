import { get } from 'svelte/store'
import { MSG, createMessage } from './messages.js'
import { roomState, timerState } from '../stores.js'
import { WS_SERVER_URL } from '../config.js'

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no O/0/I/1/L
const RECONNECT_DELAY = 2000

/**
 * Peer details stored per connection:
 * { name, lane, jamsUsed, jamStageKeys }
 */
export class SocketHost {
  constructor() {
    this.ws = null
    this.connections = new Map() // peerId → { name, lane, jamsUsed, jamStageKeys }
    this.code = null
    this._onPeersChange = null
    this._lastTimerState = null
    this._destroyed = false
    this._reconnectTimer = null
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
    this._destroyed = false
    this.code = existingCode || this.generateCode()

    return new Promise((resolve, reject) => {
      this._openSocket(resolve, reject, existingCode)
    })
  }

  _openSocket(resolve, reject, existingCode) {
    if (this.ws) {
      try { this.ws.close() } catch {}
      this.ws = null
    }

    const ws = new WebSocket(WS_SERVER_URL)
    this.ws = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'CREATE_ROOM', code: this.code }))
    }

    ws.onmessage = (event) => {
      let envelope
      try { envelope = JSON.parse(event.data) } catch { return }

      if (resolve) {
        // Still in initial setup — wait for ROOM_CREATED or ERROR
        if (envelope.action === 'ROOM_CREATED') {
          this._syncRoomState()
          this._attachMessageHandler()
          resolve(this.code)
          resolve = null
          reject = null
        } else if (envelope.action === 'ERROR') {
          if (envelope.reason === 'code_taken' && !existingCode) {
            // Retry with a fresh code (only when not restoring a session).
            // Hand off the pending promise to the new socket *before* closing
            // this one — otherwise ws.onclose fires the old reject handler
            // and the outer promise is rejected before the retry succeeds.
            const pendingResolve = resolve
            const pendingReject = reject
            resolve = null
            reject = null
            this.code = this.generateCode()
            ws.close()
            this._openSocket(pendingResolve, pendingReject, null)
          } else {
            reject(new Error(envelope.reason))
            resolve = null
            reject = null
          }
        }
      }
    }

    ws.onerror = () => {
      if (reject) {
        reject(new Error('WebSocket connection failed'))
        resolve = null
        reject = null
      }
    }

    ws.onclose = () => {
      if (reject) {
        reject(new Error('WebSocket closed before room was created'))
        resolve = null
        reject = null
      }
    }
  }

  _attachMessageHandler() {
    if (!this.ws) return

    this.ws.onmessage = (event) => {
      let envelope
      try { envelope = JSON.parse(event.data) } catch { return }
      this._handleEnvelope(envelope)
    }

    this.ws.onclose = () => {
      if (!this._destroyed) {
        // Host lost connection to relay — attempt to reclaim room
        this._scheduleReconnect()
      }
    }
  }

  _handleEnvelope(envelope) {
    switch (envelope.action) {
      case 'PEER_JOINED': {
        const { peerId, name, lane } = envelope
        // Evict any stale entry that occupies the same lane — the server
        // enforces lane uniqueness, so any prior match must come from a
        // stale connection whose PEER_LEFT was missed (e.g. dropped while
        // the host was reconnecting to the relay).
        if (lane) {
          for (const [existingId, entry] of this.connections) {
            if (existingId !== peerId && entry.lane === lane) {
              this.connections.delete(existingId)
            }
          }
        }
        this.connections.set(peerId, {
          name: name || '',
          lane: lane || '',
          jamsUsed: 0,
          jamStageKeys: new Set(),
        })
        // Send current timer state to the new peer
        this._sendStateToPeer(peerId)
        this._syncRoomState()
        break
      }
      case 'PEER_LEFT': {
        this.connections.delete(envelope.peerId)
        this._syncRoomState()
        break
      }
      case 'PEERS_SNAPSHOT': {
        // Server sent a fresh peer list (typically on host reclaim after a
        // relay reconnect). Rebuild connections to match, preserving
        // existing jam state for peerIds that are still present.
        const snapshotIds = new Set()
        for (const p of envelope.peers || []) {
          snapshotIds.add(p.peerId)
          if (!this.connections.has(p.peerId)) {
            this.connections.set(p.peerId, {
              name: p.name || '',
              lane: p.lane || '',
              jamsUsed: 0,
              jamStageKeys: new Set(),
            })
          }
        }
        for (const existingId of [...this.connections.keys()]) {
          if (!snapshotIds.has(existingId)) {
            this.connections.delete(existingId)
          }
        }
        this._syncRoomState()
        break
      }
      case 'RELAYED': {
        // Clients can relay messages to host (e.g. future use)
        break
      }
    }
  }

  _scheduleReconnect() {
    if (this._destroyed || this._reconnectTimer) return
    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null
      if (this._destroyed) return
      try {
        await this._reconnect()
      } catch {
        this._scheduleReconnect()
      }
    }, RECONNECT_DELAY)
  }

  async _reconnect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_SERVER_URL)
      this.ws = ws

      ws.onopen = () => {
        ws.send(JSON.stringify({ action: 'CREATE_ROOM', code: this.code }))
      }

      ws.onmessage = (event) => {
        let envelope
        try { envelope = JSON.parse(event.data) } catch { return }
        if (envelope.action === 'ROOM_CREATED') {
          this._attachMessageHandler()
          // Re-broadcast current state so any remaining clients get it
          const state = this._lastTimerState || get(timerState)
          if (state?.programId) {
            this.broadcast(MSG.STATE_SYNC, state)
          }
          resolve()
        } else if (envelope.action === 'ERROR') {
          reject(new Error(envelope.reason))
        }
      }

      ws.onerror = () => reject(new Error('reconnect failed'))
      ws.onclose = () => reject(new Error('closed during reconnect'))
    })
  }

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
      isSolo: false,
      isSpectator: false,
      connectedPeers: peers,
    }))
    if (this._onPeersChange) this._onPeersChange(peers)
  }

  canPeerDeclareJam(peerId, stageKey) {
    const entry = this.connections.get(peerId)
    if (!entry) return false
    if (entry.jamsUsed >= 2) return false
    if (entry.jamStageKeys.has(stageKey)) return false
    return true
  }

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

  resetAllJams() {
    for (const entry of this.connections.values()) {
      entry.jamsUsed = 0
      entry.jamStageKeys.clear()
    }
    this._syncRoomState()
  }

  broadcast(type, payload = {}) {
    const msg = createMessage(type, payload)
    this._sendEnvelope({ action: 'RELAY', message: msg })
  }

  sendToPeer(peerId, type, payload = {}) {
    const msg = createMessage(type, payload)
    this._sendEnvelope({ action: 'RELAY_TO', peerId, message: msg })
  }

  broadcastState(state) {
    const prevStageIndex = this._lastTimerState?.stageIndex
    this._lastTimerState = state
    this.broadcast(MSG.STATE_SYNC, state)
    if (state.stageIndex !== prevStageIndex) {
      this._syncRoomState()
    }
  }

  _sendEnvelope(envelope) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(envelope))
      } catch {
        // ignore
      }
    }
  }

  _sendStateToPeer(peerId) {
    const state = this._lastTimerState || get(timerState)
    if (!state?.programId) return
    this.sendToPeer(peerId, MSG.STATE_SYNC, state)
  }

  destroy() {
    this._destroyed = true
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
    // Ask the server to close the room — it will notify all clients and
    // delete the room entry, preventing a spurious 30-minute grace period.
    this._sendEnvelope({ action: 'CLOSE_ROOM' })
    if (this.ws) {
      try { this.ws.close() } catch {}
      this.ws = null
    }
    this.connections.clear()
    roomState.set({ code: null, isHost: false, connectedPeers: [] })
  }
}
