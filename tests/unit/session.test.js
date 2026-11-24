import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('../../src/lib/audio.js', () => ({
  beepStart: vi.fn(), beepStop: vi.fn(), beepTargetUp: vi.fn(), beepTargetDown: vi.fn(),
  unlockAudio: vi.fn(), setSoundEnabled: vi.fn(),
}))

const { session, startScheduler, stopScheduler } = await import('../../src/lib/session.js')

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
