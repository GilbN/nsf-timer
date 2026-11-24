import { get } from 'svelte/store'
import { SocketHost } from './peer/SocketHost.js'
import { SocketClient } from './peer/SocketClient.js'
import { TimerScheduler, interruptedReason } from './timer/TimerScheduler.js'
import { currentView, roomState, timerState } from './stores.js'
import { confirmRequest } from './confirm.js'
import { addRoomToHistory, clearRoomState, clearTimerState, loadRoomState, saveRoomState } from './storage.js'

/**
 * The connection and scheduler this tab is running. Only one session is
 * active at a time: a host (with a scheduler once a program is picked), a
 * client, or solo (scheduler only).
 *
 * @type {{ host: SocketHost | null, client: SocketClient | null, scheduler: TimerScheduler | null }}
 */
export const session = { host: null, client: null, scheduler: null }

/**
 * Create a room as host, or reclaim `code` when `hostToken` matches.
 * @param {string | null} [code]
 * @param {string | null} [hostToken]
 */
export async function hostRoom(code = null, hostToken = null) {
  const host = new SocketHost()
  // A relay restart re-creates the room with a new token; keep the saved
  // copy current so a later reload can still reclaim it.
  host.onHostToken((token) => {
    const saved = loadRoomState()
    if (saved?.isHost && saved.code === host.code) saveRoomState({ ...saved, hostToken: token })
  })
  // Another tab or device took over this room. Stop the timer here and go
  // home. The saved session now belongs to the new host, so leave it alone.
  host.onReplaced(() => {
    if (session.host !== host) return
    // A confirm left open here (Disconnect, Reset...) would act on the room
    // the new host now owns. Answer it with Cancel.
    confirmRequest.update((pending) => {
      pending?.resolve(false)
      return null
    })
    stopScheduler()
    session.host = null
    roomState.set({ code: null, isHost: false, isSpectator: false, isSolo: false, connectedPeers: [] })
    currentView.set('home')
  })
  try {
    await host.createRoom(code, hostToken)
  } catch (e) {
    host.destroy()
    throw e
  }
  session.host = host
  return host
}

/**
 * Join a room as a shooter or, with `role: 'spectator'`, as a display.
 * @param {string} code
 * @param {{ name?: string, lane?: string, role?: string }} [options]
 */
export async function joinRoom(code, options = {}) {
  const client = new SocketClient()
  try {
    await client.joinRoom(code, options)
  } catch (e) {
    client.destroy()
    throw e
  }
  session.client = client
  return client
}

/**
 * Start a scheduler for `programId`, or resume `savedTimer` after a reload.
 * When hosting, state changes go out to the room.
 * @param {string} programId
 * @param {any} [savedTimer]
 */
export function startScheduler(programId, savedTimer = null) {
  stopScheduler()
  const scheduler = new TimerScheduler()
  const host = session.host
  if (host) {
    scheduler.onStateChange((state) => host.broadcastState(state))
    scheduler.onTick((tick) => host.broadcastTick(tick))
  }
  // Don't call loadProgram before restoring. It would broadcast an 'idle'
  // snapshot, and every client would beep when the real state follows.
  if (savedTimer?.programId) scheduler.restoreState(savedTimer)
  if (!scheduler.program) scheduler.loadProgram(programId)
  session.scheduler = scheduler
  return scheduler
}

export function stopScheduler() {
  session.scheduler?.destroy()
  session.scheduler = null
}

/**
 * Add the current room to the recent-rooms list so it can be rejoined.
 * @param {Record<string, any>} [extra]
 */
export function rememberRoom(extra = {}) {
  const room = get(roomState)
  if (!room.code || room.isSolo) return
  const saved = loadRoomState() || {}
  addRoomToHistory({
    // Lets a host who rejoins from the list continue where the program was
    timer: room.isHost ? hostTimerSnapshot(extra.programId) : undefined,
    code: room.code,
    isHost: room.isHost,
    isSpectator: room.isSpectator,
    name: saved.name,
    lane: saved.lane,
    hostToken: session.host?.hostToken ?? saved.hostToken,
    ...extra,
  })
}

/**
 * The host's position for the recent-rooms list. A series that was running
 * when the host left is stored as stopped. Disconnecting closes the room,
 * so a later rejoin must not start counting with nobody there.
 * @param {string | undefined} programId
 */
function hostTimerSnapshot(programId) {
  const timer = get(timerState)
  if (!programId || timer.programId !== programId) return undefined
  if (timer.phase !== 'loading' && timer.phase !== 'shooting') return timer
  return {
    ...timer,
    phase: 'stopped',
    remainingMs: 0,
    targetVisible: false,
    phaseEndsAt: null,
    isReshoot: false,
    reshootPeerName: null,
    stoppedReason: interruptedReason(timer),
  }
}

/** Tear down everything, forget the saved session and go back home. */
export function endSession() {
  stopScheduler()
  session.host?.destroy()
  session.host = null
  session.client?.destroy()
  session.client = null
  clearTimerState()
  clearRoomState()
  roomState.set({ code: null, isHost: false, isSpectator: false, isSolo: false, connectedPeers: [] })
  currentView.set('home')
}
