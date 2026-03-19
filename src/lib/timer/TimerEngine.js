/**
 * Raw countdown/countup timer using requestAnimationFrame + performance.now()
 * No drift, accurate for competition use.
 */
export class TimerEngine {
  constructor() {
    this._rafId = null
    this._startTime = null
    this._duration = 0
    this._elapsed = 0
    this._pausedElapsed = 0
    this._running = false
    this._direction = 'down' // 'down' = countdown, 'up' = countup
    this._onTick = null
    this._onComplete = null
  }

  /**
   * Start a countdown from durationMs
   */
  startCountdown(durationMs, onTick, onComplete) {
    this._direction = 'down'
    this._duration = durationMs
    this._pausedElapsed = 0
    this._onTick = onTick
    this._onComplete = onComplete
    this._start()
  }

  /**
   * Start a countup (stopwatch)
   */
  startCountup(onTick) {
    this._direction = 'up'
    this._duration = Infinity
    this._pausedElapsed = 0
    this._onTick = onTick
    this._onComplete = null
    this._start()
  }

  _start() {
    this._running = true
    this._startTime = performance.now()
    this._tick()
  }

  pause() {
    if (!this._running) return
    this._running = false
    if (this._rafId) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
    this._pausedElapsed += performance.now() - this._startTime
  }

  resume() {
    if (this._running) return
    this._running = true
    this._startTime = performance.now()
    this._tick()
  }

  stop() {
    this._running = false
    if (this._rafId) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
  }

  /**
   * Get current remaining ms (countdown) or elapsed ms (countup)
   */
  get remainingMs() {
    const elapsed = this._getCurrentElapsed()
    if (this._direction === 'down') {
      return Math.max(0, this._duration - elapsed)
    }
    return elapsed
  }

  get isRunning() {
    return this._running
  }

  _getCurrentElapsed() {
    if (this._running) {
      return this._pausedElapsed + (performance.now() - this._startTime)
    }
    return this._pausedElapsed
  }

  _tick() {
    if (!this._running) return

    const elapsed = this._getCurrentElapsed()

    if (this._direction === 'down') {
      const remaining = Math.max(0, this._duration - elapsed)
      if (this._onTick) this._onTick(remaining)
      if (remaining <= 0) {
        this._running = false
        if (this._onComplete) this._onComplete()
        return
      }
    } else {
      if (this._onTick) this._onTick(elapsed)
    }

    this._rafId = requestAnimationFrame(() => this._tick())
  }

  /**
   * Set remaining time directly (for restoring state)
   */
  setRemaining(ms) {
    this._pausedElapsed = this._duration - ms
  }
}
