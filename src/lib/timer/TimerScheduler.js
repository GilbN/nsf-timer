import { TimerEngine } from './TimerEngine.js'
import { timerState } from '../stores.js'
import { getProgramById } from '../programs/registry.js'
import { beepStart, beepStop, beepTargetUp, beepTargetDown } from '../audio.js'

/**
 * Orchestrates the full competition flow:
 * loading -> shooting -> stopped, with duell target toggle phases.
 *
 * Host-only: clients receive state via P2P sync.
 */
export class TimerScheduler {
  constructor() {
    this.engine = new TimerEngine()
    this.program = null
    this.state = null
    this._duelTimer = null
    this._onStateChange = null
  }

  onStateChange(cb) {
    this._onStateChange = cb
  }

  _updateState(partial) {
    this.state = { ...this.state, ...partial }
    timerState.set({ ...this.state })
    if (this._onStateChange) this._onStateChange({ ...this.state })
  }

  loadProgram(programId) {
    this.program = getProgramById(programId)
    if (!this.program) return

    this.state = {
      phase: 'idle',
      programId,
      stageIndex: 0,
      exerciseIndex: 0,
      seriesIndex: 0,
      remainingMs: 0,
      totalMs: 0,
      targetVisible: false,
      duelShowingIndex: 0,
      phaseStartedAt: null,
      isReshoot: false,
      reshootPeerName: null,
    }
    this._updateState({})
  }

  /**
   * Restore from saved state (e.g. after host page reload).
   * If the timer was actively running (loading/shooting), it resumes
   * the countdown accounting for elapsed time during the reload.
   * If too much time passed, the phase is set to stopped.
   */
  restoreState(savedState) {
    this.program = getProgramById(savedState.programId)
    if (!this.program) return

    const wasRunning = savedState.phase === 'loading' || savedState.phase === 'shooting'
    const wasPaused = savedState.phase === 'paused'

    if (wasRunning && savedState.phaseStartedAt && savedState.totalMs) {
      // Calculate how much time has elapsed since the phase started
      const elapsedSinceStart = Date.now() - savedState.phaseStartedAt
      const remaining = savedState.totalMs - elapsedSinceStart

      if (remaining <= 0) {
        // Time ran out during reload — mark as stopped
        this.state = {
          ...savedState,
          phase: 'stopped',
          remainingMs: 0,
          targetVisible: false,
        }
      } else {
        // Time remains — resume the countdown
        this.state = {
          ...savedState,
          remainingMs: remaining,
        }
        timerState.set({ ...this.state })
        this._resumeCountdown(remaining, savedState.phase)
        return
      }
    } else if (wasPaused) {
      // Paused state restores as-is — host can resume manually
      this.state = { ...savedState }
    } else {
      this.state = { ...savedState }
    }

    timerState.set({ ...this.state })
  }

  /**
   * Resume a countdown after restore with the given remaining time.
   */
  _resumeCountdown(remainingMs, phase) {
    if (phase === 'loading') {
      this.engine.startCountdown(remainingMs, (remaining) => {
        this._updateState({ remainingMs: remaining })
      }, () => {
        this._startShooting()
      })
    } else if (phase === 'shooting') {
      const stage = this.getCurrentStage()
      const exercise = this.getCurrentExercise()

      if (stage?.type === 'duell' && exercise?.targetVisibleTime) {
        // For duell, we can't easily resume mid-cycle, so pause it
        this._updateState({
          phase: 'paused',
          remainingMs,
        })
      } else {
        // Precision — resume the countdown
        this.engine.startCountdown(remainingMs, (remaining) => {
          this._updateState({ remainingMs: remaining })
        }, () => {
          this._seriesComplete()
        })
      }
    }
  }

  getCurrentStage() {
    if (!this.program) return null
    return this.program.stages[this.state.stageIndex]
  }

  getCurrentExercise() {
    const stage = this.getCurrentStage()
    if (!stage) return null
    return stage.exercises[this.state.exerciseIndex]
  }

  /**
   * Get a string key identifying the current stage.
   * Used by PeerHost for per-peer jam tracking (max 1 jam per stage).
   */
  getCurrentStageKey() {
    return `stage${this.state.stageIndex}`
  }

  /**
   * Start the current series: loading phase first, then shooting.
   */
  startSeries() {
    const exercise = this.getCurrentExercise()
    if (!exercise) return

    this.engine.stop()
    this._clearDuelTimer()

    const loadingMs = (exercise.loadingTime || 60) * 1000
    this._updateState({
      phase: 'loading',
      remainingMs: loadingMs,
      totalMs: loadingMs,
      targetVisible: false,
      phaseStartedAt: Date.now(),
      isReshoot: false,
      reshootPeerName: null,
    })

    beepStart()

    this.engine.startCountdown(loadingMs, (remaining) => {
      this._updateState({ remainingMs: remaining })
    }, () => {
      this._startShooting()
    })
  }

  /**
   * Start a reshoot series for a specific peer.
   * Runs the same exercise/series again.
   */
  startReshoot(peerName) {
    const exercise = this.getCurrentExercise()
    if (!exercise) return

    this.engine.stop()
    this._clearDuelTimer()

    const loadingMs = (exercise.loadingTime || 60) * 1000
    this._updateState({
      phase: 'loading',
      remainingMs: loadingMs,
      totalMs: loadingMs,
      targetVisible: false,
      phaseStartedAt: Date.now(),
      isReshoot: true,
      reshootPeerName: peerName,
    })

    beepStart()

    this.engine.startCountdown(loadingMs, (remaining) => {
      this._updateState({ remainingMs: remaining })
    }, () => {
      this._startShooting()
    })
  }

  _startShooting() {
    const exercise = this.getCurrentExercise()
    const stage = this.getCurrentStage()
    if (!exercise || !stage) return

    beepStart()

    if (stage.type === 'duell' && exercise.targetVisibleTime) {
      this._startDuelShooting(exercise)
    } else {
      this._startPrecisionShooting(exercise)
    }
  }

  _startPrecisionShooting(exercise) {
    const totalMs = exercise.timePerSeries * 1000
    this._updateState({
      phase: 'shooting',
      remainingMs: totalMs,
      totalMs,
      targetVisible: true,
      phaseStartedAt: Date.now(),
    })

    this.engine.startCountdown(totalMs, (remaining) => {
      this._updateState({ remainingMs: remaining })
    }, () => {
      this._seriesComplete()
    })
  }

  _startDuelShooting(exercise) {
    const showingsPerSeries = Math.ceil(exercise.shotsPerSeries / exercise.shotsPerShowing)

    this._updateState({
      phase: 'shooting',
      targetVisible: true,
      duelShowingIndex: 0,
      remainingMs: exercise.targetVisibleTime * 1000,
      totalMs: exercise.targetVisibleTime * 1000,
      phaseStartedAt: Date.now(),
    })

    beepTargetUp()
    this._runDuelCycle(exercise, 0, showingsPerSeries)
  }

  _runDuelCycle(exercise, showingIndex, totalShowings) {
    if (showingIndex >= totalShowings) {
      this._seriesComplete()
      return
    }

    this._updateState({
      targetVisible: true,
      duelShowingIndex: showingIndex,
      remainingMs: exercise.targetVisibleTime * 1000,
      totalMs: exercise.targetVisibleTime * 1000,
    })

    beepTargetUp()

    this.engine.startCountdown(exercise.targetVisibleTime * 1000, (remaining) => {
      this._updateState({ remainingMs: remaining })
    }, () => {
      beepTargetDown()
      if (showingIndex + 1 >= totalShowings) {
        this._seriesComplete()
        return
      }

      this._updateState({
        targetVisible: false,
        remainingMs: exercise.targetHiddenTime * 1000,
        totalMs: exercise.targetHiddenTime * 1000,
      })

      this.engine.startCountdown(exercise.targetHiddenTime * 1000, (remaining) => {
        this._updateState({ remainingMs: remaining })
      }, () => {
        this._runDuelCycle(exercise, showingIndex + 1, totalShowings)
      })
    })
  }

  _seriesComplete() {
    this.engine.stop()
    this._clearDuelTimer()
    beepStop()

    const wasReshoot = this.state.isReshoot

    if (wasReshoot) {
      // Reshoot complete — go back to stopped, not advancing series
      this._updateState({
        phase: 'stopped',
        remainingMs: 0,
        targetVisible: false,
        isReshoot: false,
        reshootPeerName: null,
      })
      return
    }

    const exercise = this.getCurrentExercise()
    const nextSeriesIndex = this.state.seriesIndex + 1

    if (nextSeriesIndex < exercise.seriesCount) {
      this._updateState({
        phase: 'stopped',
        seriesIndex: nextSeriesIndex,
        remainingMs: 0,
        targetVisible: false,
      })
    } else {
      this._updateState({
        phase: 'stopped',
        remainingMs: 0,
        targetVisible: false,
      })
    }
  }

  nextExercise() {
    if (!this.program) return

    const stage = this.getCurrentStage()

    const nextExIdx = this.state.exerciseIndex + 1
    if (nextExIdx < stage.exercises.length) {
      this._updateState({
        phase: 'idle',
        exerciseIndex: nextExIdx,
        seriesIndex: 0,
        remainingMs: 0,
        duelShowingIndex: 0,
        targetVisible: false,
        isReshoot: false,
        reshootPeerName: null,
      })
      return
    }

    const nextDsIdx = this.state.stageIndex + 1
    if (nextDsIdx < this.program.stages.length) {
      this._updateState({
        phase: 'idle',
        stageIndex: nextDsIdx,
        exerciseIndex: 0,
        seriesIndex: 0,
        remainingMs: 0,
        duelShowingIndex: 0,
        targetVisible: false,
        isReshoot: false,
        reshootPeerName: null,
      })
      return
    }

    this._updateState({
      phase: 'stopped',
      remainingMs: 0,
      targetVisible: false,
    })
  }

  pause() {
    if (this.state.phase !== 'shooting' && this.state.phase !== 'loading') return
    this.engine.pause()
    this._updateState({ phase: 'paused' })
  }

  resume() {
    if (this.state.phase !== 'paused') return
    this.engine.resume()
    const exercise = this.getCurrentExercise()
    const isLoading = this.state.totalMs === (exercise?.loadingTime || 60) * 1000
      && this.state.remainingMs > 0

    this._updateState({
      phase: isLoading ? 'loading' : 'shooting',
      phaseStartedAt: Date.now(),
    })
  }

  reset() {
    this.engine.stop()
    this._clearDuelTimer()

    if (this.program) {
      this._updateState({
        phase: 'idle',
        stageIndex: 0,
        exerciseIndex: 0,
        seriesIndex: 0,
        remainingMs: 0,
        totalMs: 0,
        targetVisible: false,
        duelShowingIndex: 0,
        phaseStartedAt: null,
        isReshoot: false,
        reshootPeerName: null,
      })
    }
  }

  stop() {
    this.engine.stop()
    this._clearDuelTimer()
    this._updateState({
      phase: 'stopped',
      remainingMs: 0,
      targetVisible: false,
      isReshoot: false,
      reshootPeerName: null,
    })
  }

  _clearDuelTimer() {
    if (this._duelTimer) {
      clearTimeout(this._duelTimer)
      this._duelTimer = null
    }
  }

  destroy() {
    this.engine.stop()
    this._clearDuelTimer()
  }
}
