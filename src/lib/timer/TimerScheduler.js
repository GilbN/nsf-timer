import { TimerEngine } from './TimerEngine.js'
import { timerState } from '../stores.js'
import { getProgramById } from '../programs/registry.js'
import { beepStart, beepStop, beepTargetUp, beepTargetDown } from '../audio.js'

/**
 * Milliseconds left on a saved running countdown. Uses the wall-clock
 * deadline when the save has one, and the older phaseStartedAt + totalMs
 * pair otherwise. Returns null when neither is usable.
 */
function remainingFromSaved(saved) {
  if (saved.phaseEndsAt) return saved.phaseEndsAt - Date.now()
  if (saved.phaseStartedAt && saved.totalMs) return saved.totalMs - (Date.now() - saved.phaseStartedAt)
  return null
}

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
    this._onTick = null
    this._lastTickSecond = null
  }

  /** Called with a full state snapshot on every discrete change (phase, series, target...). */
  onStateChange(cb) {
    this._onStateChange = cb
  }

  /** Called with `{ remainingMs, targetVisible }` once per displayed second while counting down. */
  onTick(cb) {
    this._onTick = cb
  }

  _updateState(partial) {
    this.state = { ...this.state, ...partial }
    this._lastTickSecond = Math.ceil(this.state.remainingMs / 1000)
    timerState.set({ ...this.state })
    if (this._onStateChange) this._onStateChange({ ...this.state })
  }

  /**
   * Engine tick. The engine runs every animation frame, but the display only
   * shows whole seconds, so the store and the network only hear about it when
   * the displayed second changes.
   */
  _tickState(remainingMs) {
    this.state.remainingMs = remainingMs
    const second = Math.ceil(remainingMs / 1000)
    if (second === this._lastTickSecond) return
    this._lastTickSecond = second
    timerState.set({ ...this.state })
    if (this._onTick) this._onTick({ remainingMs, targetVisible: this.state.targetVisible })
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
      phaseEndsAt: null,
      pausedPhase: null,
      isReshoot: false,
      reshootPeerName: null,
      stageComplete: false,
      stoppedReason: null,
    }
    this._updateState({})
  }

  /**
   * Restore from saved state (e.g. after host page reload).
   * A running countdown picks up where its wall-clock deadline says it
   * should be, including mid-way through a rapid or duel cycle. If the
   * deadline passed during the reload, the series is marked stopped.
   * A paused state comes back paused, and resume() re-arms the engine.
   */
  restoreState(savedState) {
    this.program = getProgramById(savedState.programId)
    if (!this.program) return

    const wasRunning = savedState.phase === 'loading' || savedState.phase === 'shooting'
    const remaining = wasRunning ? remainingFromSaved(savedState) : null

    if (remaining !== null && remaining <= 0) {
      this.state = {
        ...savedState,
        phase: 'stopped',
        remainingMs: 0,
        targetVisible: false,
        phaseEndsAt: null,
        stoppedReason: savedState.stoppedReason ?? 'aborted',
      }
    } else if (remaining !== null) {
      this.state = { ...savedState }
      // Send a full snapshot first. Countdown ticks alone can't change
      // the phase clients last saw.
      this._updateState({ remainingMs: remaining, phaseEndsAt: Date.now() + remaining })
      this.engine.startCountdown(remaining, (r) => this._tickState(r), this._segmentCompletion())
      return
    } else {
      this.state = { ...savedState }
    }

    this._updateState({})
  }

  /**
   * What should happen when the countdown that is currently on screen ends.
   * Lets a countdown be re-armed after a reload or a resume without knowing
   * which code path started it.
   */
  _segmentCompletion() {
    const stage = this.getCurrentStage()
    const exercise = this.getCurrentExercise()
    const phase = this.state.phase === 'paused' ? this.state.pausedPhase : this.state.phase

    if (phase === 'loading') return () => this._startShooting()
    if (stage?.type === 'duell' && exercise?.targetVisibleTime) {
      const total = Math.ceil(exercise.shotsPerSeries / exercise.shotsPerShowing)
      const showing = this.state.duelShowingIndex ?? 0
      return this.state.targetVisible
        ? () => this._hideDuelTarget(exercise, showing, total)
        : () => this._showDuelTarget(exercise, showing, total)
    }
    if (exercise?.targetHiddenTime) {
      return this.state.targetVisible
        ? () => { beepTargetDown(); this._seriesComplete() }
        : () => this._showRapidTarget(exercise)
    }
    return () => this._seriesComplete()
  }

  /** Update state for a new countdown segment and start the engine on it. */
  _startSegment(partial, ms, onComplete) {
    this._updateState({ ...partial, remainingMs: ms, totalMs: ms, phaseEndsAt: Date.now() + ms })
    this.engine.startCountdown(ms, (r) => this._tickState(r), onComplete)
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
   * Internal: run the loading → shooting pipeline for the given series index.
   * Shared by startSeries(), nextSeries(), and restartSeries().
   */
  _runSeries(seriesIdx) {
    const stage = this.getCurrentStage()
    if (!stage) return
    const exercise = stage.exercises[this.state.exerciseIndex]
    if (!exercise) return

    this.engine.stop()
    this._clearDuelTimer()

    const loadingMs = (exercise.loadingTime || 60) * 1000
    beepStart()
    this._startSegment({
      phase: 'loading',
      seriesIndex: seriesIdx,
      targetVisible: false,
      phaseStartedAt: Date.now(),
      isReshoot: false,
      reshootPeerName: null,
      stageComplete: false,
      stoppedReason: null,
    }, loadingMs, () => this._startShooting())
  }

  /**
   * Start the current series: loading phase first, then shooting.
   */
  startSeries() {
    this._runSeries(this.state.seriesIndex)
  }

  /**
   * Start the next series. After a natural completion `seriesIndex` is
   * already advanced; after a manual abort it still points at the aborted
   * series, so we advance it here. No-op if there's no next series to run.
   */
  nextSeries() {
    const stage = this.getCurrentStage()
    const exercise = stage?.exercises[this.state.exerciseIndex]
    if (!exercise) return

    const target = this.state.stoppedReason === 'aborted'
      ? this.state.seriesIndex + 1
      : this.state.seriesIndex

    if (target >= exercise.seriesCount) return
    this._runSeries(target)
  }

  /**
   * Restart a series. Target depends on why we stopped:
   *  - 'aborted'          → current seriesIndex (the aborted series)
   *  - 'seriesComplete'   → seriesIndex - 1 (the series that just finished)
   *  - 'exerciseComplete' → last series of the just-finished exercise
   *  - 'stageComplete'    → last series of the just-finished exercise
   *  - 'programComplete'  → last series of the just-finished exercise
   */
  restartSeries() {
    const stage = this.getCurrentStage()
    const exercise = stage?.exercises[this.state.exerciseIndex]
    if (!exercise) return

    let target
    switch (this.state.stoppedReason) {
      case 'seriesComplete':
        target = Math.max(0, this.state.seriesIndex - 1)
        break
      case 'exerciseComplete':
      case 'stageComplete':
      case 'programComplete':
        target = exercise.seriesCount - 1
        break
      case 'aborted':
      default:
        target = this.state.seriesIndex
    }

    this._runSeries(target)
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

    // Stash the pre-reshoot stoppedReason so nextSeries()/restartSeries()
    // can resume correctly after the reshoot completes.
    this._preReshootStoppedReason = this.state.stoppedReason ?? null

    const loadingMs = (exercise.loadingTime || 60) * 1000
    beepStart()
    this._startSegment({
      phase: 'loading',
      targetVisible: false,
      phaseStartedAt: Date.now(),
      isReshoot: true,
      reshootPeerName: peerName,
      stoppedReason: null,
    }, loadingMs, () => this._startShooting())
  }

  _startShooting() {
    const exercise = this.getCurrentExercise()
    const stage = this.getCurrentStage()
    if (!exercise || !stage) return

    beepStart()

    if (stage.type === 'duell' && exercise.targetVisibleTime) {
      this._startDuelShooting(exercise)
    } else if (exercise.targetHiddenTime) {
      this._startRapidShooting(exercise)
    } else {
      this._startPrecisionShooting(exercise)
    }
  }

  _startPrecisionShooting(exercise) {
    this._startSegment({
      phase: 'shooting',
      targetVisible: true,
      phaseStartedAt: Date.now(),
    }, exercise.timePerSeries * 1000, () => this._seriesComplete())
  }

  _startRapidShooting(exercise) {
    // Hidden phase first
    this._startSegment({
      phase: 'shooting',
      targetVisible: false,
      phaseStartedAt: Date.now(),
    }, exercise.targetHiddenTime * 1000, () => this._showRapidTarget(exercise))
  }

  _showRapidTarget(exercise) {
    beepTargetUp()
    this._startSegment({ targetVisible: true, phaseStartedAt: Date.now() }, exercise.timePerSeries * 1000, () => {
      beepTargetDown()
      this._seriesComplete()
    })
  }

  _startDuelShooting(exercise) {
    const showingsPerSeries = Math.ceil(exercise.shotsPerSeries / exercise.shotsPerShowing)

    this._updateState({
      phase: 'shooting',
      duelShowingIndex: 0,
      phaseStartedAt: Date.now(),
    })

    this._runDuelCycle(exercise, 0, showingsPerSeries)
  }

  _runDuelCycle(exercise, showingIndex, totalShowings) {
    if (showingIndex >= totalShowings) {
      this._seriesComplete()
      return
    }

    // Hidden phase first
    this._startSegment({
      targetVisible: false,
      duelShowingIndex: showingIndex,
      phaseStartedAt: Date.now(),
    }, exercise.targetHiddenTime * 1000, () => this._showDuelTarget(exercise, showingIndex, totalShowings))
  }

  _showDuelTarget(exercise, showingIndex, totalShowings) {
    beepTargetUp()
    this._startSegment({ targetVisible: true, phaseStartedAt: Date.now() }, exercise.targetVisibleTime * 1000,
      () => this._hideDuelTarget(exercise, showingIndex, totalShowings))
  }

  _hideDuelTarget(exercise, showingIndex, totalShowings) {
    beepTargetDown()
    this._runDuelCycle(exercise, showingIndex + 1, totalShowings)
  }

  _seriesComplete() {
    this.engine.stop()
    this._clearDuelTimer()
    beepStop()

    const wasReshoot = this.state.isReshoot

    if (wasReshoot) {
      // Restore the pre-reshoot stoppedReason so the series state-machine
      // (nextSeries/restartSeries) picks up where it left off rather than
      // treating the reshoot as a manual abort.
      const restoredReason = this._preReshootStoppedReason ?? null
      this._preReshootStoppedReason = null
      this._updateState({
        phase: 'stopped',
        remainingMs: 0,
        targetVisible: false,
        isReshoot: false,
        reshootPeerName: null,
        stoppedReason: restoredReason,
      })
      return
    }

    const stage = this.getCurrentStage()
    const exercise = this.getCurrentExercise()
    const nextSeriesIndex = this.state.seriesIndex + 1

    if (nextSeriesIndex < exercise.seriesCount) {
      // More series remain in this exercise
      this._updateState({
        phase: 'stopped',
        seriesIndex: nextSeriesIndex,
        remainingMs: 0,
        targetVisible: false,
        stageComplete: false,
        stoppedReason: 'seriesComplete',
      })
      return
    }

    // Last series of this exercise just finished.
    const isLastExerciseInStage = this.state.exerciseIndex === stage.exercises.length - 1
    const isLastStage = this.state.stageIndex === this.program.stages.length - 1

    let stoppedReason
    if (!isLastExerciseInStage) {
      stoppedReason = 'exerciseComplete'
    } else if (!isLastStage) {
      stoppedReason = 'stageComplete'
    } else {
      stoppedReason = 'programComplete'
    }

    this._updateState({
      phase: 'stopped',
      remainingMs: 0,
      targetVisible: false,
      stageComplete: isLastExerciseInStage,
      stoppedReason,
    })
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
        stageComplete: false,
        stoppedReason: null,
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
        stageComplete: false,
        stoppedReason: null,
      })
      return
    }

    this._updateState({
      phase: 'stopped',
      remainingMs: 0,
      targetVisible: false,
      stoppedReason: 'programComplete',
    })
  }

  pause() {
    if (this.state.phase !== 'shooting' && this.state.phase !== 'loading') return
    this.engine.pause()
    this._updateState({
      phase: 'paused',
      pausedPhase: this.state.phase,
      remainingMs: this.engine.remainingMs,
      phaseEndsAt: null,
    })
  }

  resume() {
    if (this.state.phase !== 'paused') return
    const exercise = this.getCurrentExercise()
    // States saved before pausedPhase existed: guess from the segment length
    const phase = this.state.pausedPhase
      ?? (this.state.totalMs === (exercise?.loadingTime || 60) * 1000 ? 'loading' : 'shooting')
    const remaining = this.state.remainingMs

    this.state = { ...this.state, phase, pausedPhase: null }
    // Re-arm instead of calling engine.resume(). After a reload the engine has
    // no countdown to resume.
    this.engine.stop()
    this._updateState({ phaseEndsAt: Date.now() + remaining, phaseStartedAt: Date.now(), stoppedReason: null })
    this.engine.startCountdown(remaining, (r) => this._tickState(r), this._segmentCompletion())
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
        stageComplete: false,
        stoppedReason: null,
      })
    }
  }

  /**
   * Jump to a specific stage/exercise/series without resetting the whole program.
   * Used when the host needs to restart mid-competition from a specific position.
   */
  jumpTo(stageIndex, exerciseIndex, seriesIndex) {
    if (!this.program) return
    const stage = this.program.stages[stageIndex]
    if (!stage) return
    const exercise = stage.exercises[exerciseIndex]
    if (!exercise) return
    if (seriesIndex < 0 || seriesIndex >= exercise.seriesCount) return

    this.engine.stop()
    this._clearDuelTimer()

    this._updateState({
      phase: 'idle',
      stageIndex,
      exerciseIndex,
      seriesIndex,
      remainingMs: 0,
      totalMs: 0,
      targetVisible: false,
      duelShowingIndex: 0,
      phaseStartedAt: null,
      isReshoot: false,
      reshootPeerName: null,
      stageComplete: false,
      stoppedReason: null,
    })
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
      stoppedReason: 'aborted',
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
