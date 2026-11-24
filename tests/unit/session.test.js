import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('../../src/lib/audio.js', () => ({
  beepStart: vi.fn(), beepStop: vi.fn(), beepTargetUp: vi.fn(), beepTargetDown: vi.fn(),
  unlockAudio: vi.fn(), setSoundEnabled: vi.fn(),
}))

// A stand-in SocketHost that lets the test fire the relay's 4001 replacement
const fakeHosts = []
vi.mock('../../src/lib/peer/SocketHost.js', () => ({
  SocketHost: class {
    constructor() { this.code = null; this.hostToken = null; fakeHosts.push(this) }
    onHostToken(cb) { this.tokenCb = cb }
    onReplaced(cb) { this.replacedCb = cb }
    async createRoom(code) { this.code = code || 'ABCD'; this.hostToken = 'token'; return this.code }
    broadcastState() {}
    broadcastTick() {}
    destroy() {}
  },
}))

const { session, startScheduler, stopScheduler, hostRoom, rememberRoom } = await import('../../src/lib/session.js')
const { loadRoomHistory } = await import('../../src/lib/storage.js')
const { confirmAction, confirmRequest } = await import('../../src/lib/confirm.js')
const { currentView, roomState, timerState } = await import('../../src/lib/stores.js')
const { get } = await import('svelte/store')

describe('startScheduler', () => {
  afterEach(() => {
    stopScheduler()
    session.host = null
  })

  it('restores a saved timer without broadcasting an idle snapshot first', () => {
    const sent = []
    session.host = /** @type {any} */ ({ broadcastState: (s) => sent.push(s), broadcastTick: () => {} })
    startScheduler('standard', {
      phase: 'stopped', programId: 'standard', stageIndex: 2, exerciseIndex: 0, seriesIndex: 1,
      remainingMs: 0, totalMs: 0, targetVisible: false, stoppedReason: 'seriesComplete',
    })
    expect(sent.map((s) => s.phase)).toEqual(['stopped'])
    expect(sent[0].stageIndex).toBe(2)
  })

  it('loads the program when there is no saved timer', () => {
    const sent = []
    session.host = /** @type {any} */ ({ broadcastState: (s) => sent.push(s), broadcastTick: () => {} })
    startScheduler('standard')
    expect(sent.map((s) => s.phase)).toEqual(['idle'])
  })
})

describe('hostRoom replacement', () => {
  afterEach(() => {
    stopScheduler()
    session.host = null
    confirmRequest.set(null)
  })

  it('cancels an open confirm and goes home when another tab takes the room', async () => {
    const host = await hostRoom()
    startScheduler('standard')
    currentView.set('timer')
    const answer = confirmAction('Disconnect?', 'Disconnect')

    fakeHosts.at(-1).replacedCb()

    await expect(answer).resolves.toBe(false)
    expect(get(confirmRequest)).toBeNull()
    expect(session.host).toBeNull()
    expect(session.scheduler).toBeNull()
    expect(get(currentView)).toBe('home')
    expect(host).toBe(fakeHosts.at(-1))
  })
})

describe('rememberRoom', () => {
  afterEach(() => {
    stopScheduler()
    roomState.set({ code: null, isHost: false, isSpectator: false, isSolo: false, connectedPeers: [] })
  })

  it('keeps the host\'s position so a rejoin from the list continues there', () => {
    roomState.set({ code: 'WXYZ', isHost: true, isSpectator: false, isSolo: false, connectedPeers: [] })
    timerState.update((s) => ({ ...s, phase: 'stopped', programId: 'standard', stageIndex: 2, seriesIndex: 1, stoppedReason: 'seriesComplete' }))
    rememberRoom({ programId: 'standard' })

    const entry = loadRoomHistory()[0]
    expect(entry.timer.stageIndex).toBe(2)

    const scheduler = startScheduler(entry.programId, entry.timer)
    expect(scheduler.state.stageIndex).toBe(2)
    expect(scheduler.state.seriesIndex).toBe(1)
  })

  it('does not store a timer for shooters', () => {
    roomState.set({ code: 'WXYZ', isHost: false, isSpectator: false, isSolo: false, connectedPeers: [] })
    timerState.update((s) => ({ ...s, programId: 'standard' }))
    rememberRoom()
    expect(loadRoomHistory()[0].timer).toBeUndefined()
  })
})

