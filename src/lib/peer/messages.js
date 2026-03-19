// Host → Client message types
export const MSG = {
  STATE_SYNC: 'STATE_SYNC',       // Full state snapshot
  TICK: 'TICK',                   // Timer tick (remainingMs, targetVisible)
  PHASE_CHANGE: 'PHASE_CHANGE',   // Phase transition
  TARGET_TOGGLE: 'TARGET_TOGGLE', // Duell target visibility
  PROGRAM_SET: 'PROGRAM_SET',     // Program selected
  EXERCISE_ADVANCE: 'EXERCISE_ADVANCE',
  ROOM_CLOSED: 'ROOM_CLOSED',
  RESHOOT_STATE: 'RESHOOT_STATE', // Reshoot timer state for a specific peer

  // Client → Host
  PING: 'PING',                   // Presence heartbeat
  JOIN_INFO: 'JOIN_INFO',         // { name, lane }

  // Host → Client (rejection)
  LANE_REJECTED: 'LANE_REJECTED', // { lane, message }
}

export function createMessage(type, payload = {}) {
  return { type, payload, ts: Date.now() }
}
