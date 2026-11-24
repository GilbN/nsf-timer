<script>
  import { timerState, preferences } from '../lib/stores.js'
  import { t, getLocalizedName } from '../lib/i18n.js'
  import { session } from '../lib/session.js'
  import Modal from './Modal.svelte'
  import Icon from './ui/Icon.svelte'

  let { program, onClose } = $props()

  let selectedStageIdx = $state($timerState.stageIndex)
  let selectedExerciseIdx = $state($timerState.exerciseIndex)
  let selectedSeriesIdx = $state($timerState.seriesIndex)

  function stageSummary(stage) {
    const exs = stage.exercises
    const totalSeries = exs.reduce((s, e) => s + e.seriesCount, 0)
    const shots = exs[0].shotsPerSeries
    const times = [...new Set(exs.map(e => e.timePerSeries ?? e.targetVisibleTime))]
    const timeStr = times.length === 1 ? `${fmt(times[0])} s` : `${fmt(Math.min(...times))}–${fmt(Math.max(...times))} s`
    return `${totalSeries} × ${shots}, ${timeStr}`
  }

  /** @param {number} s */
  function fmt(s) {
    return Number.isInteger(s) ? String(s) : String(Math.round(s * 10) / 10)
  }

  let selectedStage = $derived(program.stages[selectedStageIdx])
  let selectedExercise = $derived(selectedStage?.exercises[selectedExerciseIdx])
  let showExercisePicker = $derived((selectedStage?.exercises.length ?? 0) > 1)
  let lang = $derived($preferences.lang)

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
    session.scheduler?.jumpTo(selectedStageIdx, selectedExerciseIdx, selectedSeriesIdx)
    onClose()
  }
</script>

<Modal variant="sheet" {onClose} labelledby="jump-to-title">
  <div class="sheet-panel">
    <div class="sheet-head">
      <h2 id="jump-to-title">{$t('jumpToPosition')}</h2>
      <span class="aside">{getLocalizedName(program.name, lang)}</span>
    </div>

    <div class="key-grid stages" role="radiogroup" aria-label={$t('stage')}>
      {#each program.stages as stage, i (i)}
        <button
          class="key opt"
          class:key-white={selectedStageIdx === i}
          role="radio"
          aria-checked={selectedStageIdx === i}
          onclick={() => selectStage(i)}
        >
          <span>{getLocalizedName(stage.name, lang)}<small class="tnum">{stageSummary(stage)}</small></span>
        </button>
      {/each}
    </div>

    {#if showExercisePicker && selectedStage}
      <span class="field-label">{$t('exercise')}</span>
      <div class="key-grid" role="radiogroup" aria-label={$t('exercise')}>
        {#each selectedStage.exercises as ex, i (i)}
          <button
            class="key opt"
            class:key-white={selectedExerciseIdx === i}
            role="radio"
            aria-checked={selectedExerciseIdx === i}
            onclick={() => selectExercise(i)}
          >
            <span>{$t('exercise')} {i + 1}<small class="tnum">{ex.seriesCount} × {ex.shotsPerSeries}, {fmt(ex.timePerSeries ?? ex.targetVisibleTime)} s</small></span>
          </button>
        {/each}
      </div>
    {/if}

    {#if selectedExercise}
      <span class="field-label">{$t('series')}</span>
      <div class="numbers" role="radiogroup" aria-label={$t('series')}>
        {#each { length: selectedExercise.seriesCount } as _, i (i)}
          <button
            class="key num tnum"
            class:key-white={selectedSeriesIdx === i}
            role="radio"
            aria-checked={selectedSeriesIdx === i}
            onclick={() => (selectedSeriesIdx = i)}
          >{i + 1}</button>
        {/each}
      </div>
    {/if}

    <div class="key-grid foot">
      <button class="key key-row key-center" onclick={onClose}><Icon name="arrow-left" />{$t('back')}</button>
      <button class="key key-white key-row key-center" onclick={handleConfirm}><Icon name="check" />{$t('jumpTo')}</button>
    </div>
  </div>
</Modal>

<style>
  .opt {
    min-height: 72px;
    padding: 12px 16px;
    justify-content: center;
    font-size: 0.9375rem;
  }

  .numbers {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
    gap: 8px;
  }

  .num {
    min-height: 52px;
    padding: 0;
    align-items: center;
    justify-content: center;
    border-radius: 16px;
    font-size: 1.125rem;
    font-weight: 800;
  }

  .foot { margin-top: 4px; }
  .foot .key { min-height: 56px; }
</style>
