const STORAGE_KEYS = {
  TIMER_STATE: 'nsf-timer-state',
  PREFERENCES: 'nsf-timer-prefs',
  ROOM: 'nsf-timer-room',
  CUSTOM_PROGRAMS: 'nsf-timer-custom-programs',
  ROOM_HISTORY: 'nsf-timer-room-history',
}

const MAX_ROOM_HISTORY = 10

function safeGet(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full or unavailable
  }
}

export function saveTimerState(state) {
  safeSet(STORAGE_KEYS.TIMER_STATE, state)
}

export function loadTimerState() {
  return safeGet(STORAGE_KEYS.TIMER_STATE)
}

export function clearTimerState() {
  localStorage.removeItem(STORAGE_KEYS.TIMER_STATE)
}

export function savePreferences(prefs) {
  safeSet(STORAGE_KEYS.PREFERENCES, prefs)
}

export function loadPreferences() {
  return safeGet(STORAGE_KEYS.PREFERENCES)
}

export function saveRoomState(room) {
  safeSet(STORAGE_KEYS.ROOM, room)
}

export function loadRoomState() {
  return safeGet(STORAGE_KEYS.ROOM)
}

export function clearRoomState() {
  localStorage.removeItem(STORAGE_KEYS.ROOM)
}

export function saveCustomPrograms(programs) {
  safeSet(STORAGE_KEYS.CUSTOM_PROGRAMS, programs)
}

export function loadCustomPrograms() {
  return safeGet(STORAGE_KEYS.CUSTOM_PROGRAMS) || []
}

export function updateCustomProgram(program) {
  const programs = loadCustomPrograms()
  const idx = programs.findIndex(p => p.id === program.id)
  if (idx !== -1) {
    programs[idx] = program
  } else {
    programs.push(program)
  }
  saveCustomPrograms(programs)
}

export function deleteCustomProgram(id) {
  const programs = loadCustomPrograms().filter(p => p.id !== id)
  saveCustomPrograms(programs)
}

export function addRoomToHistory(entry) {
  // entry: { code, isHost, programId?, joinedAt }
  const history = safeGet(STORAGE_KEYS.ROOM_HISTORY) || []
  // Remove existing entry with same code to avoid duplicates
  const filtered = history.filter((r) => r.code !== entry.code)
  filtered.unshift({ ...entry, joinedAt: Date.now() })
  // Keep only the most recent entries
  safeSet(STORAGE_KEYS.ROOM_HISTORY, filtered.slice(0, MAX_ROOM_HISTORY))
}

export function loadRoomHistory() {
  return safeGet(STORAGE_KEYS.ROOM_HISTORY) || []
}

export function clearRoomHistory() {
  localStorage.removeItem(STORAGE_KEYS.ROOM_HISTORY)
}
