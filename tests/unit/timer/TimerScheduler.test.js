// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Silence audio/vibration side effects — TimerScheduler imports these at module load.
vi.mock('../../../src/lib/audio.js', () => ({
  beepStart: vi.fn(),
  beepStop: vi.fn(),
  beepTargetUp: vi.fn(),
  beepTargetDown: vi.fn(),
  unlockAudio: vi.fn(),
  setSoundEnabled: vi.fn(),
}))

// Node environment lacks rAF/cAF — back them with setTimeout so fake timers drive them.
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)

const { TimerScheduler } = await import('../../../src/lib/timer/TimerScheduler.js')
const { timerState } = await import('../../../src/lib/stores.js')
const { get } = await import('svelte/store')

// Helper: advance fake timers past a phase's duration with some slop for rAF boundaries
const RAF_SLOP = 100
function runPhase(ms) {
  vi.advanceTimersByTime(ms + RAF_SLOP)
}

describe('TimerScheduler', () => {
  let scheduler

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] })
    scheduler = new TimerScheduler()
  })

  afterEach(() => {
    scheduler?.destroy()
    vi.useRealTimers()
  })

  describe('loadProgram', () => {
    it('initialises state with idle phase and zeroed indices', () => {
      scheduler.loadProgram('standard')

      expect(scheduler.state.phase).toBe('idle')
      expect(scheduler.state.programId).toBe('standard')
      expect(scheduler.state.stageIndex).toBe(0)
      expect(scheduler.state.exerciseIndex).toBe(0)
      expect(scheduler.state.seriesIndex).toBe(0)
      expect(scheduler.state.remainingMs).toBe(0)
    })

    it('writes the new state into the timerState store', () => {
      scheduler.loadProgram('standard')
      expect(get(timerState).programId).toBe('standard')
    })

    it('does nothing when the program id is unknown', () => {
      scheduler.loadProgram('not-a-program')
      expect(scheduler.state).toBeNull()
      expect(scheduler.program).toBeNull()
    })

    it('notifies onStateChange subscribers', () => {
      const cb = vi.fn()
      scheduler.onStateChange(cb)
      scheduler.loadProgram('standard')

      expect(cb).toHaveBeenCalled()
      expect(cb.mock.calls.at(-1)[0].phase).toBe('idle')
    })
  })

  // NOTE: every built-in exercise has `targetHiddenTime` set, so even "precision"
  // stages route through _startRapidShooting — hidden phase (7s) then visible.
  describe('startSeries (standard / precision-stage flow)', () => {
    beforeEach(() => {
      scheduler.loadProgram('standard')
    })

    it('transitions idle → loading when started', () => {
      scheduler.startSeries()

      expect(scheduler.state.phase).toBe('loading')
      expect(scheduler.state.targetVisible).toBe(false)
      expect(scheduler.state.totalMs).toBe(60_000)
      expect(scheduler.state.remainingMs).toBe(60_000)
    })

    it('stamps phaseStartedAt so restoreState can reconcile wall-clock drift', () => {
      vi.setSystemTime(new Date('2026-04-17T10:00:00Z'))
      scheduler.startSeries()
      expect(scheduler.state.phaseStartedAt).toBe(Date.parse('2026-04-17T10:00:00Z'))
    })

    it('transitions loading → shooting (hidden phase) after loadingTime elapses', () => {
      scheduler.startSeries()
      runPhase(60_000)

      expect(scheduler.state.phase).toBe('shooting')
      // Rapid-style: hidden phase first, targetHiddenTime = 7s
      expect(scheduler.state.targetVisible).toBe(false)
      expect(scheduler.state.totalMs).toBe(7_000)
    })

    it('reveals the target after the hidden phase completes', () => {
      scheduler.startSeries()
      runPhase(60_000)  // loading
      runPhase(7_000)   // hidden phase

      expect(scheduler.state.targetVisible).toBe(true)
      expect(scheduler.state.totalMs).toBe(150_000) // trial timePerSeries
    })

    it('transitions shooting → stopped with seriesComplete reason', () => {
      // Trial stage has only 1 series (→ stageComplete), so jump to ds1 (4 series).
      scheduler.jumpTo(1, 0, 0)
      scheduler.startSeries()
      runPhase(60_000)   // loading
      runPhase(7_000)    // hidden
      runPhase(150_000)  // visible

      expect(scheduler.state.phase).toBe('stopped')
      expect(scheduler.state.stoppedReason).toBe('seriesComplete')
      expect(scheduler.state.seriesIndex).toBe(1)
    })

    it('sets stoppedReason to exerciseComplete on the final series of an exercise that is not the last in its stage', () => {
      scheduler.loadProgram('silhuett')
      // ds1 first exercise has 2 series — jump to the last one.
      scheduler.jumpTo(1, 0, 1)

      scheduler.startSeries()
      runPhase(60_000)   // loading
      runPhase(7_000)    // hidden
      runPhase(8_000)    // visible (timePerSeries=8)

      expect(scheduler.state.phase).toBe('stopped')
      expect(scheduler.state.stoppedReason).toBe('exerciseComplete')
      expect(scheduler.state.stageComplete).toBe(false)
    })

    it('sets stoppedReason to stageComplete on the final series of the final exercise of a non-last stage', () => {
      scheduler.loadProgram('standard')
      // ds1 has 4 series of 150s each. Jump to the last.
      scheduler.jumpTo(1, 0, 3)

      scheduler.startSeries()
      runPhase(60_000)
      runPhase(7_000)
      runPhase(150_000)

      expect(scheduler.state.phase).toBe('stopped')
      expect(scheduler.state.stoppedReason).toBe('stageComplete')
      expect(scheduler.state.stageComplete).toBe(true)
    })

    it('sets stoppedReason to programComplete after the very last series', () => {
      scheduler.loadProgram('standard')
      // Last stage (ds3), last exercise, 4 series total — jump to final.
      scheduler.jumpTo(3, 0, 3)

      scheduler.startSeries()
      runPhase(60_000)   // loading
      runPhase(7_000)    // hidden
      runPhase(10_000)   // visible (ds3 timePerSeries=10)

      expect(scheduler.state.stoppedReason).toBe('programComplete')
      expect(scheduler.state.stageComplete).toBe(true)
    })
  })

  describe('rapid program (targetHiddenTime then targetVisibleTime)', () => {
    beforeEach(() => {
      scheduler.loadProgram('silhuett')
      scheduler.jumpTo(1, 0, 0) // ds1, first exercise (8s timePerSeries)
    })

    it('starts the shooting phase with target hidden', () => {
      scheduler.startSeries()
      runPhase(60_000) // loading complete

      expect(scheduler.state.phase).toBe('shooting')
      expect(scheduler.state.targetVisible).toBe(false)
      expect(scheduler.state.totalMs).toBe(7_000) // targetHiddenTime
    })

    it('reveals the target after targetHiddenTime elapses', () => {
      scheduler.startSeries()
      runPhase(60_000)
      runPhase(7_000)

      expect(scheduler.state.targetVisible).toBe(true)
      expect(scheduler.state.totalMs).toBe(8_000) // timePerSeries
    })

    it('completes the series after the visible phase ends', () => {
      scheduler.startSeries()
      runPhase(60_000)
      runPhase(7_000)
      runPhase(8_000)

      expect(scheduler.state.phase).toBe('stopped')
    })
  })

  describe('duel program (repeated hidden/visible cycles)', () => {
    beforeEach(() => {
      scheduler.loadProgram('fingrov')
      scheduler.jumpTo(3, 0, 0) // ds2 is the duel stage
    })

    it('alternates target visibility across showings', () => {
      scheduler.startSeries()
      runPhase(60_000) // loading

      // First hidden phase
      expect(scheduler.state.phase).toBe('shooting')
      expect(scheduler.state.targetVisible).toBe(false)
      expect(scheduler.state.duelShowingIndex).toBe(0)

      // Advance through first hidden (7s) → target becomes visible
      runPhase(7_000)
      expect(scheduler.state.targetVisible).toBe(true)

      // Advance through first visible (3.29s) → back to hidden, showing index 1
      runPhase(3_290 + 100) // small extra for rAF frame
      expect(scheduler.state.targetVisible).toBe(false)
      expect(scheduler.state.duelShowingIndex).toBe(1)
    })

    it('completes the series after all showings (shotsPerSeries / shotsPerShowing cycles)', () => {
      scheduler.startSeries()
      runPhase(60_000) // loading

      // 5 shots / 1 per showing = 5 cycles, each 7s hidden + 3.29s visible
      const cycleMs = 7_000 + 3_290
      for (let i = 0; i < 5; i++) {
        runPhase(cycleMs)
      }

      expect(scheduler.state.phase).toBe('stopped')
    })
  })

  describe('pause / resume', () => {
    beforeEach(() => {
      scheduler.loadProgram('standard')
    })

    it('pause during loading freezes the timer', () => {
      scheduler.startSeries()
      vi.advanceTimersByTime(5_000)
      const beforePause = scheduler.state.remainingMs

      scheduler.pause()
      expect(scheduler.state.phase).toBe('paused')

      vi.advanceTimersByTime(10_000)
      expect(scheduler.state.remainingMs).toBe(beforePause)
    })

    it('resume continues from where pause left off', () => {
      scheduler.startSeries()
      vi.advanceTimersByTime(5_000)
      scheduler.pause()
      vi.advanceTimersByTime(10_000)
      scheduler.resume()

      expect(scheduler.state.phase).toBe('loading')
      // Eventually the loading phase completes
      runPhase(55_000)
      expect(scheduler.state.phase).toBe('shooting')
    })

    it('pause is a no-op in idle/stopped states', () => {
      expect(scheduler.state.phase).toBe('idle')
      scheduler.pause()
      expect(scheduler.state.phase).toBe('idle')
    })

    it('resume is a no-op when not paused', () => {
      scheduler.startSeries()
      expect(scheduler.state.phase).toBe('loading')
      scheduler.resume()
      expect(scheduler.state.phase).toBe('loading')
    })
  })

  describe('stop (manual abort)', () => {
    it('sets stoppedReason to "aborted" when stopped mid-flight', () => {
      scheduler.loadProgram('standard')
      scheduler.startSeries()
      vi.advanceTimersByTime(5_000)
      scheduler.stop()

      expect(scheduler.state.phase).toBe('stopped')
      expect(scheduler.state.stoppedReason).toBe('aborted')
      expect(scheduler.state.targetVisible).toBe(false)
    })
  })

  describe('nextSeries', () => {
    it('advances to the next series index after a natural completion', () => {
      scheduler.loadProgram('standard')
      scheduler.jumpTo(1, 0, 0)
      scheduler.startSeries()
      runPhase(60_000)    // loading
      runPhase(7_000)     // hidden
      runPhase(150_000)   // visible
      // seriesIndex was auto-advanced to 1; stoppedReason = seriesComplete
      expect(scheduler.state.seriesIndex).toBe(1)

      scheduler.nextSeries()
      expect(scheduler.state.phase).toBe('loading')
      expect(scheduler.state.seriesIndex).toBe(1) // Already at 1
    })

    it('advances past an aborted series index', () => {
      scheduler.loadProgram('standard')
      scheduler.jumpTo(1, 0, 1) // series 1
      scheduler.startSeries()
      scheduler.stop()

      scheduler.nextSeries()
      expect(scheduler.state.seriesIndex).toBe(2)
      expect(scheduler.state.phase).toBe('loading')
    })

    it('is a no-op when aborted at the last series (no next to advance to)', () => {
      scheduler.loadProgram('standard')
      scheduler.jumpTo(1, 0, 3) // last series
      scheduler.startSeries()
      scheduler.stop() // aborted, seriesIndex still 3

      const phaseBefore = scheduler.state.phase
      const indexBefore = scheduler.state.seriesIndex
      scheduler.nextSeries()
      // aborted branch advances to seriesIndex+1=4, which is >= seriesCount=4
      expect(scheduler.state.phase).toBe(phaseBefore)
      expect(scheduler.state.seriesIndex).toBe(indexBefore)
    })
  })

  describe('restartSeries', () => {
    beforeEach(() => {
      scheduler.loadProgram('standard')
    })

    it('restarts the just-aborted series', () => {
      scheduler.jumpTo(1, 0, 2)
      scheduler.startSeries()
      scheduler.stop() // aborted, seriesIndex still 2

      scheduler.restartSeries()
      expect(scheduler.state.seriesIndex).toBe(2)
      expect(scheduler.state.phase).toBe('loading')
    })

    it('restarts the series that just completed (seriesComplete)', () => {
      scheduler.jumpTo(1, 0, 0)
      scheduler.startSeries()
      runPhase(60_000)
      runPhase(7_000)
      runPhase(150_000)
      // seriesIndex auto-advanced to 1, stoppedReason = seriesComplete

      scheduler.restartSeries()
      // Goes back to series 0, which is the one that just finished
      expect(scheduler.state.seriesIndex).toBe(0)
      expect(scheduler.state.phase).toBe('loading')
    })

    it('restarts the last series of the exercise after exerciseComplete', () => {
      scheduler.loadProgram('silhuett')
      scheduler.jumpTo(1, 0, 1) // last series of ds1 first exercise
      scheduler.startSeries()
      runPhase(60_000)
      runPhase(7_000)
      runPhase(8_000)
      expect(scheduler.state.stoppedReason).toBe('exerciseComplete')

      scheduler.restartSeries()
      // Exercise has seriesCount=2, so last series is index 1
      expect(scheduler.state.seriesIndex).toBe(1)
    })
  })

  describe('nextExercise', () => {
    it('advances to the next exercise when one exists in the stage', () => {
      scheduler.loadProgram('silhuett')
      scheduler.jumpTo(1, 0, 0) // ds1, exercise 0

      scheduler.nextExercise()
      expect(scheduler.state.stageIndex).toBe(1)
      expect(scheduler.state.exerciseIndex).toBe(1)
      expect(scheduler.state.seriesIndex).toBe(0)
      expect(scheduler.state.phase).toBe('idle')
    })

    it('advances to the next stage when the current exercise is the last one', () => {
      scheduler.loadProgram('silhuett')
      scheduler.jumpTo(1, 2, 0) // ds1, last exercise

      scheduler.nextExercise()
      expect(scheduler.state.stageIndex).toBe(2)
      expect(scheduler.state.exerciseIndex).toBe(0)
    })

    it('marks the program complete when already on the last exercise of the last stage', () => {
      scheduler.loadProgram('standard')
      // Jump to last stage, last exercise
      scheduler.jumpTo(3, 0, 0)

      scheduler.nextExercise()
      expect(scheduler.state.phase).toBe('stopped')
      expect(scheduler.state.stoppedReason).toBe('programComplete')
    })
  })

  describe('reshoot', () => {
    beforeEach(() => {
      scheduler.loadProgram('standard')
      scheduler.jumpTo(1, 0, 0)
      scheduler.startSeries()
      runPhase(60_000)   // loading
      runPhase(7_000)    // hidden
      runPhase(150_000)  // visible
      // stoppedReason = seriesComplete, seriesIndex = 1
    })

    it('runs the loading/shooting pipeline with isReshoot=true', () => {
      scheduler.startReshoot('Alice')
      expect(scheduler.state.phase).toBe('loading')
      expect(scheduler.state.isReshoot).toBe(true)
      expect(scheduler.state.reshootPeerName).toBe('Alice')

      runPhase(60_000)
      expect(scheduler.state.phase).toBe('shooting')
      expect(scheduler.state.isReshoot).toBe(true)
    })

    it('clears isReshoot on completion and restores the pre-reshoot stoppedReason', () => {
      scheduler.startReshoot('Alice')
      runPhase(60_000)
      runPhase(7_000)
      runPhase(150_000)

      expect(scheduler.state.phase).toBe('stopped')
      expect(scheduler.state.isReshoot).toBe(false)
      expect(scheduler.state.reshootPeerName).toBeNull()
      // Pre-reshoot stoppedReason was 'seriesComplete' — should be restored
      expect(scheduler.state.stoppedReason).toBe('seriesComplete')
    })

    it('does not advance seriesIndex when a reshoot completes', () => {
      const beforeIndex = scheduler.state.seriesIndex
      scheduler.startReshoot('Alice')
      runPhase(60_000)
      runPhase(7_000)
      runPhase(150_000)

      expect(scheduler.state.seriesIndex).toBe(beforeIndex)
    })
  })

  describe('reset', () => {
    it('returns to idle state at the start of the program', () => {
      scheduler.loadProgram('standard')
      scheduler.jumpTo(2, 0, 1)
      scheduler.startSeries()

      scheduler.reset()

      expect(scheduler.state.phase).toBe('idle')
      expect(scheduler.state.stageIndex).toBe(0)
      expect(scheduler.state.exerciseIndex).toBe(0)
      expect(scheduler.state.seriesIndex).toBe(0)
    })

    it('is a no-op when no program is loaded', () => {
      expect(() => scheduler.reset()).not.toThrow()
    })
  })

  describe('jumpTo', () => {
    beforeEach(() => {
      scheduler.loadProgram('standard')
    })

    it('sets stage/exercise/series indices and returns to idle', () => {
      scheduler.jumpTo(2, 0, 1)

      expect(scheduler.state.stageIndex).toBe(2)
      expect(scheduler.state.exerciseIndex).toBe(0)
      expect(scheduler.state.seriesIndex).toBe(1)
      expect(scheduler.state.phase).toBe('idle')
    })

    it('ignores out-of-range stage index', () => {
      const before = { ...scheduler.state }
      scheduler.jumpTo(99, 0, 0)
      expect(scheduler.state).toEqual(before)
    })

    it('ignores out-of-range exercise index', () => {
      const before = { ...scheduler.state }
      scheduler.jumpTo(1, 99, 0)
      expect(scheduler.state).toEqual(before)
    })

    it('ignores out-of-range series index', () => {
      const before = { ...scheduler.state }
      scheduler.jumpTo(1, 0, 99)
      expect(scheduler.state).toEqual(before)
    })

    it('rejects negative series index', () => {
      const before = { ...scheduler.state }
      scheduler.jumpTo(1, 0, -1)
      expect(scheduler.state).toEqual(before)
    })
  })

  describe('restoreState', () => {
    it('restores a stopped state as-is', () => {
      const saved = {
        phase: 'stopped',
        programId: 'standard',
        stageIndex: 1,
        exerciseIndex: 0,
        seriesIndex: 2,
        stoppedReason: 'seriesComplete',
        remainingMs: 0,
        totalMs: 0,
        targetVisible: false,
      }
      scheduler.restoreState(saved)
      expect(scheduler.state.phase).toBe('stopped')
      expect(scheduler.state.seriesIndex).toBe(2)
    })

    it('resumes a loading countdown accounting for elapsed real time', () => {
      vi.setSystemTime(new Date('2026-04-17T10:00:00Z'))
      const phaseStartedAt = Date.parse('2026-04-17T09:59:50Z') // 10s ago
      const saved = {
        phase: 'loading',
        programId: 'standard',
        stageIndex: 1,
        exerciseIndex: 0,
        seriesIndex: 0,
        phaseStartedAt,
        totalMs: 60_000,
        remainingMs: 60_000,
        targetVisible: false,
      }

      scheduler.restoreState(saved)
      expect(scheduler.state.phase).toBe('loading')
      // 50s remaining (60s total - 10s elapsed)
      expect(scheduler.state.remainingMs).toBeCloseTo(50_000, -3)
    })

    it('transitions to stopped when the phase would have already expired', () => {
      vi.setSystemTime(new Date('2026-04-17T10:00:00Z'))
      const phaseStartedAt = Date.parse('2026-04-17T09:58:00Z') // 2min ago
      const saved = {
        phase: 'loading',
        programId: 'standard',
        stageIndex: 1,
        exerciseIndex: 0,
        seriesIndex: 0,
        phaseStartedAt,
        totalMs: 60_000,
        remainingMs: 60_000,
        targetVisible: false,
      }

      scheduler.restoreState(saved)
      expect(scheduler.state.phase).toBe('stopped')
      expect(scheduler.state.stoppedReason).toBe('aborted')
    })

    it('restores paused state as-is so the host can resume manually', () => {
      const saved = {
        phase: 'paused',
        programId: 'standard',
        stageIndex: 1,
        exerciseIndex: 0,
        seriesIndex: 0,
        totalMs: 60_000,
        remainingMs: 30_000,
        phaseStartedAt: Date.now(),
        targetVisible: false,
      }
      scheduler.restoreState(saved)
      expect(scheduler.state.phase).toBe('paused')
      expect(scheduler.state.remainingMs).toBe(30_000)
    })

    it('does nothing for unknown programs', () => {
      scheduler.restoreState({ phase: 'idle', programId: 'bogus' })
      expect(scheduler.program).toBeNull()
    })
  })

  describe('getCurrentStageKey', () => {
    it('returns a stable string per stage for jam tracking', () => {
      scheduler.loadProgram('standard')
      expect(scheduler.getCurrentStageKey()).toBe('stage0')
      scheduler.jumpTo(2, 0, 0)
      expect(scheduler.getCurrentStageKey()).toBe('stage2')
    })
  })

  describe('onStateChange', () => {
    it('fires on every state transition', () => {
      const cb = vi.fn()
      scheduler.onStateChange(cb)
      scheduler.loadProgram('standard')
      const initialCallCount = cb.mock.calls.length

      scheduler.startSeries()
      expect(cb.mock.calls.length).toBeGreaterThan(initialCallCount)
    })

    it('passes a copy of state, not the live reference', () => {
      const received = []
      scheduler.onStateChange((state) => received.push(state))
      scheduler.loadProgram('standard')

      // Mutating the received state shouldn't affect the scheduler
      received[0].phase = 'mutated'
      expect(scheduler.state.phase).toBe('idle')
    })
  })
})
