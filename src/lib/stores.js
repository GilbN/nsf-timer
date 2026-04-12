import { writable, derived } from 'svelte/store'

// View routing
export const currentView = writable('home') // 'home' | 'lobby' | 'timer' | 'stopwatch' | 'display'

// Room state
export const roomState = writable({
  code: null,
  isHost: false,
  isSpectator: false,
  connectedPeers: [],
})

// Timer state (authoritative on host, synced to clients)
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
