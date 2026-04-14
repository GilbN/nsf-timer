<script>
  import { timerState, preferences } from '../lib/stores.js'
  import { t, getLocalizedName } from '../lib/i18n.js'
  import { getProgramById } from '../lib/programs/registry.js'

  let {
    onStart,
    onPause,
    onResume,
    onStop,
    onRestart,
    onNextSeries,
    onNext,
    onReset,
    bottomExtra = undefined,
  } = $props()

  let program = $derived(getProgramById($timerState.programId))
  let stage = $derived(program?.stages[$timerState.stageIndex])
  let lang = $derived($preferences.lang)
  let reason = $derived($timerState.stoppedReason)

  // Label for the next exercise in the current stage (unnamed exercises fall back to numbered label).
  function exerciseLabelFor(idx) {
    return `${$t('exercise')} ${idx + 1}`
  }

  // Slot 3 descriptor: { kind: 'stage' | 'exercise', name }
  // null when there is no forward target (program end).
  let slot3 = $derived.by(() => {
    if (!program || !stage) return null
    if (reason === 'programComplete') return null

    // Stage boundary crossed (or about to cross)
    if (reason === 'stageComplete') {
      const nextStage = program.stages[$timerState.stageIndex + 1]
      if (!nextStage) return null
      return { kind: 'stage', name: getLocalizedName(nextStage.name, lang) ?? '' }
    }

    // Next exercise exists in the current stage
    const nextExIdx = $timerState.exerciseIndex + 1
    if (stage.exercises[nextExIdx]) {
      return { kind: 'exercise', name: exerciseLabelFor(nextExIdx) }
    }

    // No more exercises in stage — show next stage as the forward action
    const nextStage = program.stages[$timerState.stageIndex + 1]
    if (nextStage) {
      return { kind: 'stage', name: getLocalizedName(nextStage.name, lang) ?? '' }
    }

    return null
  })

  // Next-series button is visible only when a next series actually exists in the current exercise.
  // - After 'seriesComplete' seriesIndex was advanced, so it points at the upcoming series.
  // - After 'aborted' seriesIndex still points at the aborted series, so "next" = seriesIndex + 1.
  let showNextSeries = $derived.by(() => {
    const exercise = stage?.exercises[$timerState.exerciseIndex]
    if (!exercise) return false
    if (reason === 'seriesComplete') return $timerState.seriesIndex < exercise.seriesCount
    if (reason === 'aborted') return $timerState.seriesIndex + 1 < exercise.seriesCount
    return false
  })

  // Exactly one primary (green) button per phase. Which slot?
  let primary = $derived.by(() => {
    if (reason === 'programComplete') return null
    if (reason === 'stageComplete' || reason === 'exerciseComplete') return 'slot3'
    if (showNextSeries) return 'slot2'
    return 'slot3'
  })
</script>

<div class="control-bar">
  <div class="main-actions">
    {#if $timerState.phase === 'idle'}
      <button class="btn-action primary" onclick={onStart}>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        {$t('start')}
      </button>

    {:else if $timerState.phase === 'stopped' && reason === 'programComplete'}
      <div class="program-complete-label">{$t('programComplete')}</div>

    {:else if $timerState.phase === 'stopped'}
      <!-- Slot 1: Restart series (always shown while stopped) -->
      <button
        class="btn-action btn-restart"
        class:primary={primary === 'slot1'}
        onclick={onRestart}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
        {$t('restartSeries')}
      </button>

      <!-- Slot 2: Next series -->
      {#if showNextSeries}
        <button
          class="btn-action btn-next-series"
          class:primary={primary === 'slot2'}
          onclick={onNextSeries}
        >
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          {$t('nextSeries')}
        </button>
      {/if}

      <!-- Slot 3: Next exercise / Next stage -->
      {#if slot3}
        <button
          class="btn-action btn-next-context"
          class:primary={primary === 'slot3'}
          onclick={onNext}
        >
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/></svg>
          {slot3.kind === 'stage' ? $t('nextStageLabel') : $t('nextExerciseLabel')}
        </button>
      {/if}

    {:else if $timerState.phase === 'loading' || $timerState.phase === 'shooting'}
      <button class="btn-action btn-pause" onclick={onPause}>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        {$t('pause')}
      </button>
      <button class="btn-action btn-stop" onclick={onStop}>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
        {$t('stop')}
      </button>

    {:else if $timerState.phase === 'paused'}
      <button class="btn-action primary" onclick={onResume}>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        {$t('resume')}
      </button>
      <button class="btn-action btn-stop" onclick={onStop}>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
        {$t('stop')}
      </button>
    {/if}
  </div>

  {#if $timerState.phase === 'stopped' && reason !== 'programComplete' && slot3?.name}
    <div class="slot3-subline-row">
      <div class="slot3-spacer"></div>
      {#if showNextSeries}<div class="slot3-spacer"></div>{/if}
      <div class="slot3-subline" class:slot3-subline-primary={primary === 'slot3'}>{slot3.name}</div>
    </div>
  {/if}

  <div class="bottom-row">
    <button class="btn-reset" onclick={onReset}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
      {$t('reset')}
    </button>
    {#if bottomExtra}
      {@render bottomExtra()}
    {/if}
  </div>
</div>

<style>
  .control-bar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem 0 0;
  }

  .main-actions {
    display: flex;
    gap: 0.6rem;
  }

  .btn-action {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 54px;
    padding: 0 0.75rem;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    border-radius: var(--radius);
    background: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid rgba(255,255,255,0.08);
  }

  .btn-action:hover { background: #252550; }

  .btn-action svg {
    width: 1.25em;
    height: 1.25em;
    flex-shrink: 0;
  }

  /* Primary (green) — exactly one per phase */
  .btn-action.primary {
    background: var(--accent);
    color: #0d0d1a;
    border-color: transparent;
  }

  .btn-action.primary:hover { background: var(--accent-dim); }

  /* Stop button keeps its red treatment regardless of primary */
  .btn-stop {
    background: rgba(244, 67, 54, 0.15);
    color: var(--danger);
    border: 1px solid rgba(244, 67, 54, 0.3);
  }
  .btn-stop:hover { background: rgba(244, 67, 54, 0.25); }

  /* Subline row mirrors button row layout so the name centers under slot 3 */
  .slot3-subline-row {
    display: flex;
    gap: 0.6rem;
    margin-top: -0.25rem;
  }

  .slot3-spacer {
    flex: 1;
    min-width: 0;
  }

  .slot3-subline {
    flex: 1;
    min-width: 0;
    text-align: center;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-secondary);
    opacity: 0.7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .slot3-subline-primary {
    color: var(--accent);
    opacity: 0.85;
  }

  /* Program-complete sentinel */
  .program-complete-label {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 54px;
    font-size: 1rem;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .bottom-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }

  .btn-reset {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.4rem 1.25rem;
    min-height: 36px;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: var(--radius);
  }

  .btn-reset svg {
    width: 1em;
    height: 1em;
    flex-shrink: 0;
  }

  .btn-reset:hover {
    color: var(--text-primary);
    border-color: rgba(255,255,255,0.15);
  }

  /* Narrow phones: tighten buttons */
  @media (max-width: 420px) {
    .btn-action { font-size: 0.92rem; padding: 0 0.5rem; }
  }
</style>
