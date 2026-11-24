import { writable, derived } from 'svelte/store'

/**
 * @typedef {{ peerId: string, name: string, lane: string, jamsUsed: number, canJam: boolean }} Peer
 *
 * @typedef {object} RoomState
 * @property {string | null} code
 * @property {boolean} isHost
 * @property {boolean} [isSpectator]
 * @property {boolean} [isSolo]
 * @property {Peer[]} connectedPeers
 *
 * @typedef {object} TimerState
 * @property {string} phase 'idle' | 'loading' | 'shooting' | 'paused' | 'stopped'
 * @property {string | null} programId
 * @property {number} stageIndex
 * @property {number} exerciseIndex
 * @property {number} seriesIndex
 * @property {number} remainingMs
 * @property {number} totalMs
 * @property {boolean} targetVisible
 * @property {number} duelShowingIndex
 * @property {number | null} phaseStartedAt
 * @property {number | null} [phaseEndsAt] wall-clock time the running countdown ends
 * @property {string | null} [pausedPhase] the phase a paused countdown returns to
 * @property {boolean} isReshoot
 * @property {string | null} reshootPeerName
 * @property {boolean} stageComplete
 * @property {string | null} [stoppedReason]
 */

// View routing
export const currentView = writable('home') // 'home' | 'lobby' | 'timer' | 'stopwatch' | 'display'

// Room state
/** @type {import('svelte/store').Writable<RoomState>} */
export const roomState = writable({
  code: null,
  isHost: false,
  isSpectator: false,
  isSolo: false,
  connectedPeers: [],
})

// Timer state (authoritative on host, synced to clients)
/** @type {import('svelte/store').Writable<TimerState>} */
export const timerState = writable({
  phase: 'idle',          // 'idle' | 'loading' | 'shooting' | 'paused' | 'stopped'
  programId: null,
  stageIndex: 0,
  exerciseIndex: 0,
  seriesIndex: 0,
  remainingMs: 0,
  totalMs: 0,
  targetVisible: false,
  duelShowingIndex: 0,
  phaseStartedAt: null,
  isReshoot: false,       // true when running a reshoot for a specific peer
  reshootPeerName: null,  // name of peer getting reshoot
  stageComplete: false,   // true when all exercises in the current stage are done
})

// UI preferences
export const preferences = writable({
  lang: 'no',
  soundEnabled: true,
  textScale: 1,   // 1 | 1.2 | 1.4
  wakeLockEnabled: false,
  countdownFormat: 'seconds',  // 'seconds' | 'mmss'
  stopwatchFormat: 'mmss',     // 'mmss' | 'seconds'
})

// Derived: formatted time
export const formattedTime = derived(timerState, ($ts) => {
  const totalSec = Math.max(0, Math.ceil($ts.remainingMs / 1000))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return {
    minutes: String(min).padStart(2, '0'),
    seconds: String(sec).padStart(2, '0'),
    totalSeconds: totalSec,
    raw: $ts.remainingMs,
  }
})
