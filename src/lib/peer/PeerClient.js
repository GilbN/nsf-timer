import { Peer } from 'peerjs'
import { MSG } from './messages.js'
import { roomState, timerState } from '../stores.js'

const PEER_PREFIX = 'opk-timer-'
const PING_INTERVAL = 5000
const RECONNECT_DELAYS = [1000, 2000, 3000, 5000, 5000, 5000, 10000, 10000, 10000]
const MAX_RECONNECT_ATTEMPTS = RECONNECT_DELAYS.length

export class PeerClient {
  constructor() {
    this.peer = null
    this.conn = null
    this.code = null
    this.name = ''
    this.lane = ''
    this._pingInterval = null
    this._onStatusChange = null // (status: 'connected'|'reconnecting'|'disconnected'|'roomClosed') => void
    this._destroyed = false
    this._roomClosed = false
    this._reconnectAttempt = 0
    this._reconnectTimer = null
  }

  /**
   * Single callback for all connection status changes.
   */
  onStatusChange(cb) { this._onStatusChange = cb }

  // Legacy compat
  onDisconnect(cb) {
    const existing = this._onStatusChange
    this._onStatusChange = (status) => {
      if (existing) existing(status)
      if (status === 'disconnected') cb()
    }
  }
  onRoomClosed(cb) {
    const existing = this._onStatusChange
    this._onStatusChange = (status) => {
      if (existing) existing(status)
      if (status === 'roomClosed') cb()
    }
  }

  async joinRoom(code, { name = '', lane = '' } = {}) {
    this.code = code.toUpperCase()
    this.name = name
    this.lane = lane
    this._destroyed = false
    this._roomClosed = false
    this._reconnectAttempt = 0

    return this._connect()
  }

  _connect() {
    const hostId = PEER_PREFIX + this.code

    return new Promise((resolve, reject) => {
      // Clean up previous peer if any
      if (this.peer) {
        try { this.peer.destroy() } catch {}
        this.peer = null
      }

      this.peer = new Peer()

      this.peer.on('open', () => {
        this.conn = this.peer.connect(hostId, { reliable: true })

        this.conn.on('open', () => {
          // Send identity to host — wait for JOIN_ACCEPTED before resolving
          this.conn.send({
            type: MSG.JOIN_INFO,
            payload: { name: this.name, lane: this.lane },
            ts: Date.now(),
          })
        })

        this.conn.on('data', (msg) => {
          if (msg.type === MSG.JOIN_ACCEPTED) {
            this._reconnectAttempt = 0
            roomState.update((s) => ({ ...s, code: this.code, isHost: false }))
            this._startPing()
            this._emitStatus('connected')
            resolve(this.code)
            return
          }
          // Handle lane rejection during join
          if (msg.type === MSG.LANE_REJECTED) {
            this._stopPing()
            this._clearReconnect()
            this._destroyed = true
            this._emitStatus('laneRejected')
            reject(new Error('laneRejected'))
            return
          }
          this._handleMessage(msg)
        })

        this.conn.on('close', () => {
          this._stopPing()
          if (!this._destroyed && !this._roomClosed) {
            this._autoReconnect()
          }
        })

        this.conn.on('error', () => {
          this._stopPing()
          if (!this._destroyed && !this._roomClosed) {
            this._autoReconnect()
          }
        })

        // Timeout if host not found on initial connect
        setTimeout(() => {
          if (!this.conn?.open && this._reconnectAttempt === 0) {
            reject(new Error('Could not connect to room'))
            this.destroy()
          }
        }, 10000)
      })

      this.peer.on('error', (err) => {
        if (this._reconnectAttempt === 0 && !this.conn?.open) {
          reject(err)
        } else if (!this._destroyed && !this._roomClosed) {
          // Connection error during session — try reconnect
          this._stopPing()
          this._autoReconnect()
        }
      })
    })
  }

  _autoReconnect() {
    if (this._destroyed || this._roomClosed) return
    if (this._reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this._emitStatus('disconnected')
      return
    }

    this._emitStatus('reconnecting')

    const delay = RECONNECT_DELAYS[this._reconnectAttempt] || 10000
    this._reconnectAttempt++

    this._reconnectTimer = setTimeout(async () => {
      if (this._destroyed || this._roomClosed) return

      try {
        // Tear down old peer
        if (this.conn) {
          try { this.conn.close() } catch {}
          this.conn = null
        }
        if (this.peer) {
          try { this.peer.destroy() } catch {}
          this.peer = null
        }

        await this._connect()
      } catch {
        // _connect failed — will retry via conn close/error handlers
        if (!this._destroyed && !this._roomClosed) {
          this._autoReconnect()
        }
      }
    }, delay)
  }

  _emitStatus(status) {
    if (this._onStatusChange) this._onStatusChange(status)
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case MSG.STATE_SYNC:
        timerState.set(msg.payload)
        break
      case MSG.TICK:
        timerState.update((s) => ({
          ...s,
          remainingMs: msg.payload.remainingMs,
          targetVisible: msg.payload.targetVisible ?? s.targetVisible,
        }))
        break
      case MSG.PHASE_CHANGE:
        timerState.update((s) => ({ ...s, ...msg.payload }))
        break
      case MSG.TARGET_TOGGLE:
        timerState.update((s) => ({
          ...s,
          targetVisible: msg.payload.targetVisible,
        }))
        break
      case MSG.PROGRAM_SET:
        timerState.update((s) => ({ ...s, ...msg.payload }))
        break
      case MSG.EXERCISE_ADVANCE:
        timerState.update((s) => ({ ...s, ...msg.payload }))
        break
      case MSG.RESHOOT_STATE:
        timerState.set({ ...msg.payload, isReshoot: true })
        break
      case MSG.LANE_REJECTED:
        this._stopPing()
        this._clearReconnect()
        this._emitStatus('laneRejected')
        break
      case MSG.ROOM_CLOSED:
        this._roomClosed = true
        this._stopPing()
        this._clearReconnect()
        this._emitStatus('roomClosed')
        break
    }
  }

  _startPing() {
    this._stopPing()
    this._pingInterval = setInterval(() => {
      if (this.conn?.open) {
        try {
          this.conn.send({ type: MSG.PING, ts: Date.now() })
        } catch {
          // ignore
        }
      }
    }, PING_INTERVAL)
  }

  _stopPing() {
    if (this._pingInterval) {
      clearInterval(this._pingInterval)
      this._pingInterval = null
    }
  }

  _clearReconnect() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
  }

  destroy() {
    this._destroyed = true
    this._stopPing()
    this._clearReconnect()
    if (this.conn) {
      try { this.conn.close() } catch {}
      this.conn = null
    }
    if (this.peer) {
      this.peer.destroy()
      this.peer = null
    }
    roomState.set({ code: null, isHost: false, connectedPeers: [] })
  }
}
