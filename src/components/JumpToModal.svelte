<script>
  import { timerState, preferences } from '../lib/stores.js'
  import { t, getLocalizedName } from '../lib/i18n.js'

  let { program, onClose } = $props()

  let selectedStageIdx = $state($timerState.stageIndex)
  let selectedExerciseIdx = $state($timerState.exerciseIndex)
  let selectedSeriesIdx = $state($timerState.seriesIndex)

  let selectedStage = $derived(program.stages[selectedStageIdx])
  let selectedExercise = $derived(selectedStage?.exercises[selectedExerciseIdx])
  let showExercisePicker = $derived((selectedStage?.exercises.length ?? 0) > 1)

  $effect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  function selectStage(i) {
    selectedStageIdx = i
    selectedExerciseIdx = 0
    selectedSeriesIdx = 0
  }

  function selectExercise(i) {
    selectedExerciseIdx = i
    selectedSeriesIdx = 0
  }

  function handleConfirm() {
    window.__opkScheduler?.jumpTo(selectedStageIdx, selectedExerciseIdx, selectedSeriesIdx)
    onClose()
  }
</script>

<div class="modal-backdrop" role="presentation" onclick={onClose}>
  <div class="modal-panel" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
    <h2 class="modal-title">{$t('jumpToPosition')}</h2>

    <!-- Stage selector -->
    <div class="field">
      <span class="field-label">{$t('stage')}</span>
      <div class="option-grid">
        {#each program.stages as stage, i}
          <button
            class="option-btn"
            class:selected={selectedStageIdx === i}
            onclick={() => selectStage(i)}
          >
            {getLocalizedName(stage.name, $preferences.lang)}
          </button>
        {/each}
      </div>
    </div>

    <!-- Exercise selector (only when stage has >1 exercise) -->
    {#if showExercisePicker && selectedStage}
      <div class="field">
        <span class="field-label">{$t('exercise')}</span>
        <div class="option-grid">
          {#each selectedStage.exercises as _, i}
            <button
              class="option-btn"
              class:selected={selectedExerciseIdx === i}
              onclick={() => selectExercise(i)}
            >
              {i + 1}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Series selector -->
    {#if selectedExercise}
      <div class="field">
        <span class="field-label">{$t('series')}</span>
        <div class="option-grid">
          {#each { length: selectedExercise.seriesCount } as _, i}
            <button
              class="option-btn"
              class:selected={selectedSeriesIdx === i}
              onclick={() => (selectedSeriesIdx = i)}
            >
              {i + 1}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Actions -->
    <div class="modal-actions">
      <button class="btn-secondary" onclick={onClose}>{$t('back')}</button>
      <button class="btn-confirm" onclick={handleConfirm}>{$t('jumpTo')}</button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-panel {
    background: var(--bg-secondary);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg, var(--radius));
    padding: 1.25rem;
    width: min(90vw, 380px);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    font-size: 13px;
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: 0.04em;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .field-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-secondary);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .option-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .option-btn {
    background: var(--bg-surface);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius);
    padding: 0.45rem 0.75rem;
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--text-secondary);
    transition: background 0.1s, color 0.1s, border-color 0.1s;
    min-width: 2.5rem;
  }

  .option-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-primary);
  }

  .option-btn.selected {
    background: var(--accent);
    color: #0d0d1a;
    border-color: var(--accent);
    font-weight: 700;
  }

  .modal-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    margin-top: 0.25rem;
  }

  .btn-secondary {
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-weight: 500;
    padding: 0.4rem 0.75rem;
    border-radius: var(--radius);
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .btn-secondary:hover {
    opacity: 1;
  }

  .btn-confirm {
    background: var(--accent);
    color: #0d0d1a;
    font-size: 0.82rem;
    font-weight: 700;
    padding: 0.45rem 1rem;
    border-radius: var(--radius);
    letter-spacing: 0.04em;
    transition: opacity 0.15s;
  }

  .btn-confirm:hover {
    opacity: 0.9;
  }
</style>
