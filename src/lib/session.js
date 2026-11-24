import { get } from 'svelte/store'
import { SocketHost } from './peer/SocketHost.js'
import { SocketClient } from './peer/SocketClient.js'
import { TimerScheduler } from './timer/TimerScheduler.js'
import { currentView, roomState } from './stores.js'
import { addRoomToHistory, clearRoomState, clearTimerState, loadRoomState } from './storage.js'

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
  if (savedTimer?.programId) {
    scheduler.loadProgram(savedTimer.programId)
    scheduler.restoreState(savedTimer)
  } else {
    scheduler.loadProgram(programId)
  }
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
    code: room.code,
    isHost: room.isHost,
    isSpectator: room.isSpectator,
    name: saved.name,
    lane: saved.lane,
    hostToken: saved.hostToken,
    ...extra,
  })
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
