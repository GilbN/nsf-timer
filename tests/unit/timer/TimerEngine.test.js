// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TimerEngine } from '../../../src/lib/timer/TimerEngine.js'

// Shim rAF/cAF onto globalThis using setTimeout so fake timers can control them.
// Node doesn't ship these, and keeping the env as `node` avoids happy-dom
// intercepting our fake-timer hooks.
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)

describe('TimerEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('countdown', () => {
    it('calls onTick with decreasing remaining time as the animation loop runs', () => {
      const engine = new TimerEngine()
      const ticks = []

      engine.startCountdown(1000, (remaining) => ticks.push(remaining), () => {})

      // First tick fires synchronously inside startCountdown
      expect(ticks[0]).toBe(1000)

      vi.advanceTimersByTime(500)
      // After ~500ms the most recent tick has approximately 500ms left —
      // exact value depends on rAF frame alignment, so allow a small slop.
      const last = ticks[ticks.length - 1]
      expect(last).toBeLessThan(1000)
      expect(last).toBeGreaterThan(400)
      // All ticks should be monotonically non-increasing
      for (let i = 1; i < ticks.length; i++) {
        expect(ticks[i]).toBeLessThanOrEqual(ticks[i - 1])
      }
    })

    it('fires onComplete exactly once when duration elapses', () => {
      const engine = new TimerEngine()
      const onComplete = vi.fn()

      engine.startCountdown(1000, () => {}, onComplete)
      // Advance past the end to account for rAF frame alignment (16ms slop)
      vi.advanceTimersByTime(1100)

      expect(onComplete).toHaveBeenCalledTimes(1)
      expect(engine.isRunning).toBe(false)
    })

    it('does not fire onComplete before duration is reached', () => {
      const engine = new TimerEngine()
      const onComplete = vi.fn()

      engine.startCountdown(1000, () => {}, onComplete)
      vi.advanceTimersByTime(999)

      expect(onComplete).not.toHaveBeenCalled()
    })

    it('clamps remaining to 0 rather than going negative during the tick', () => {
      const engine = new TimerEngine()
      const ticks = []
      engine.startCountdown(500, (remaining) => ticks.push(remaining), () => {})

      vi.advanceTimersByTime(600) // Past the end

      expect(ticks[ticks.length - 1]).toBe(0)
      // No tick value should ever be negative
      for (const t of ticks) expect(t).toBeGreaterThanOrEqual(0)
    })
  })

  describe('countup (stopwatch)', () => {
    it('invokes onTick with increasing elapsed time', () => {
      const engine = new TimerEngine()
      const ticks = []

      engine.startCountup((elapsed) => ticks.push(elapsed))

      vi.advanceTimersByTime(200)
      const lastTick = ticks[ticks.length - 1]
      expect(lastTick).toBeGreaterThan(0)
      expect(lastTick).toBeLessThanOrEqual(200)
    })

    it('never completes on its own', () => {
      const engine = new TimerEngine()
      engine.startCountup(() => {})
      vi.advanceTimersByTime(60_000)

      expect(engine.isRunning).toBe(true)
    })

    it('remainingMs returns the elapsed time in countup mode', () => {
      const engine = new TimerEngine()
      engine.startCountup(() => {})
      vi.advanceTimersByTime(750)

      // countup's "remaining" is actually elapsed
      expect(engine.remainingMs).toBeGreaterThanOrEqual(750)
    })
  })

  describe('pause / resume', () => {
    it('pause stops the engine and freezes remaining time', () => {
      const engine = new TimerEngine()
      engine.startCountdown(1000, () => {}, () => {})

      vi.advanceTimersByTime(300)
      engine.pause()
      const pausedRemaining = engine.remainingMs

      vi.advanceTimersByTime(500)
      expect(engine.remainingMs).toBe(pausedRemaining)
      expect(engine.isRunning).toBe(false)
    })

    it('resume continues the countdown from where it paused', () => {
      const engine = new TimerEngine()
      const onComplete = vi.fn()
      engine.startCountdown(1000, () => {}, onComplete)

      vi.advanceTimersByTime(300)
      engine.pause()
      const pausedRemaining = engine.remainingMs
      vi.advanceTimersByTime(10_000) // Wall clock passes but engine is paused
      expect(engine.remainingMs).toBe(pausedRemaining) // No drift during pause
      engine.resume()
      // Advance well past the remaining time to tolerate rAF boundary rounding
      vi.advanceTimersByTime(pausedRemaining + 100)

      expect(onComplete).toHaveBeenCalledTimes(1)
    })

    it('pause is a no-op when already paused', () => {
      const engine = new TimerEngine()
      engine.startCountdown(1000, () => {}, () => {})

      vi.advanceTimersByTime(300)
      engine.pause()
      const firstRemaining = engine.remainingMs
      engine.pause()  // Should not change anything
      expect(engine.remainingMs).toBe(firstRemaining)
    })

    it('resume is a no-op when already running', () => {
      const engine = new TimerEngine()
      engine.startCountdown(1000, () => {}, () => {})

      vi.advanceTimersByTime(300)
      engine.resume()  // Already running
      expect(engine.isRunning).toBe(true)
    })
  })

  describe('stop', () => {
    it('cancels the countdown without invoking onComplete', () => {
      const engine = new TimerEngine()
      const onComplete = vi.fn()
      engine.startCountdown(1000, () => {}, onComplete)

      vi.advanceTimersByTime(500)
      engine.stop()
      vi.advanceTimersByTime(5000)

      expect(onComplete).not.toHaveBeenCalled()
      expect(engine.isRunning).toBe(false)
    })
  })

  describe('setRemaining', () => {
    it('adjusts the countdown so remainingMs returns the new value', () => {
      const engine = new TimerEngine()
      engine.startCountdown(1000, () => {}, () => {})

      vi.advanceTimersByTime(200)
      engine.pause()
      engine.setRemaining(5000)

      // Engine is paused, so remainingMs uses the adjusted _pausedElapsed
      // duration is 1000, setRemaining(5000) gives _pausedElapsed = -4000
      // remainingMs = max(0, 1000 - (-4000)) = 5000
      expect(engine.remainingMs).toBe(5000)
    })
  })

  describe('isRunning', () => {
    it('is false before start', () => {
      expect(new TimerEngine().isRunning).toBe(false)
    })

    it('is true during a countdown', () => {
      const engine = new TimerEngine()
      engine.startCountdown(1000, () => {}, () => {})
      expect(engine.isRunning).toBe(true)
    })

    it('is false after the countdown completes', () => {
      const engine = new TimerEngine()
      engine.startCountdown(100, () => {}, () => {})
      vi.advanceTimersByTime(200)
      expect(engine.isRunning).toBe(false)
    })
  })
})
