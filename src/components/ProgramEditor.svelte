<script>
  import { t } from '../lib/i18n.js'
  import { saveCustomPrograms, loadCustomPrograms, updateCustomProgram } from '../lib/storage.js'

  let { onSave, onCancel, editProgram = null } = $props()

  let name = $state(editProgram ? editProgram.name.no : '')
  let stages = $state(editProgram ? JSON.parse(JSON.stringify(editProgram.stages)) : [createStage()])

  function createStage() {
    return {
      id: 'ds-' + Date.now(),
      name: { no: '', en: '' },
      type: 'precision',
      exercises: [createExercise('precision')],
    }
  }

  function createExercise(type) {
    if (type === 'duell') {
      return {
        seriesCount: 1,
        shotsPerSeries: 5,
        shotsPerShowing: 1,
        targetVisibleTime: 3,
        targetHiddenTime: 7,
        loadingTime: 60,
      }
    }
    if (type === 'rapid') {
      return {
        seriesCount: 1,
        shotsPerSeries: 5,
        timePerSeries: 10,
        targetHiddenTime: 7,
        loadingTime: 60,
      }
    }
    return {
      seriesCount: 1,
      shotsPerSeries: 5,
      timePerSeries: 150,
      loadingTime: 60,
    }
  }

  function addStage() {
    stages = [...stages, createStage()]
  }

  function removeStage(idx) {
    stages = stages.filter((_, i) => i !== idx)
  }

  function addExercise(dsIdx) {
    const ds = stages[dsIdx]
    ds.exercises = [...ds.exercises, createExercise(ds.type)]
    stages = [...stages]
  }

  function removeExercise(dsIdx, exIdx) {
    const ds = stages[dsIdx]
    ds.exercises = ds.exercises.filter((_, i) => i !== exIdx)
    stages = [...stages]
  }

  function updateType(dsIdx, type) {
    stages[dsIdx].type = type
    stages[dsIdx].exercises = [createExercise(type)]
    stages = [...stages]
  }

  function save() {
    if (!name.trim()) return

    const program = {
      id: editProgram ? editProgram.id : 'custom-' + Date.now(),
      name: { no: name, en: name },
      distance: '',
      calibers: [],
      totalCompetitionShots: 0,
      trialShots: 0,
      stages: stages.map((ds, i) => ({
        ...ds,
        id: `ds${i + 1}`,
        name: ds.name.no
          ? { no: ds.name.no, en: ds.name.no }
          : { no: `Delserie ${i + 1}`, en: `Stage ${i + 1}` },
      })),
    }

    if (editProgram) {
      updateCustomProgram(program)
    } else {
      const custom = loadCustomPrograms()
      custom.push(program)
      saveCustomPrograms(custom)
    }

    if (onSave) onSave(program)
  }
</script>

<div class="program-editor">
  <h3>{editProgram ? $t('editProgram') : $t('customProgram')}</h3>

  <label>
    <span>{$t('programName')}</span>
    <input type="text" bind:value={name} placeholder={$t('programName')} />
  </label>

  {#each stages as ds, dsIdx}
    <div class="stage-block">
      <div class="stage-header">
        <input type="text" bind:value={ds.name.no} placeholder={$t('stageName')} />
        <select value={ds.type} onchange={(e) => updateType(dsIdx, e.target.value)}>
          <option value="precision">{$t('precision')}</option>
          <option value="rapid">{$t('rapid')}</option>
          <option value="duell">{$t('duell')}</option>
        </select>
        {#if stages.length > 1}
          <button class="btn-danger btn-sm" onclick={() => removeStage(dsIdx)}>X</button>
        {/if}
      </div>

      {#each ds.exercises as ex, exIdx}
        <div class="exercise-block">
          {#if ds.exercises.length > 1}
            <button
              class="btn-remove-exercise"
              onclick={() => removeExercise(dsIdx, exIdx)}
              title={$t('removeExercise')}
              aria-label={$t('removeExercise')}
            >X</button>
          {/if}
          <div class="field-row">
            <label>
              <span>{$t('seriesCount')}</span>
              <input type="number" bind:value={ex.seriesCount} min="1" max="20" />
            </label>
            <label>
              <span>{$t('shotsPerSeries')}</span>
              <input type="number" bind:value={ex.shotsPerSeries} min="1" max="10" />
            </label>
            <label>
              <span>{$t('loadingTimeSec')}</span>
              <input type="number" bind:value={ex.loadingTime} min="0" max="300" />
            </label>
          </div>

          {#if ds.type === 'precision'}
            <label>
              <span>{$t('timePerSeriesSec')}</span>
              <input type="number" bind:value={ex.timePerSeries} min="1" max="600" />
            </label>
          {:else if ds.type === 'rapid'}
            <div class="field-row">
              <label>
                <span>{$t('timePerSeriesSec')}</span>
                <input type="number" bind:value={ex.timePerSeries} min="1" max="600" />
              </label>
              <label>
                <span>{$t('targetHiddenSec')}</span>
                <input type="number" bind:value={ex.targetHiddenTime} min="1" max="30" />
              </label>
            </div>
          {:else}
            <div class="field-row">
              <label>
                <span>{$t('targetVisibleSec')}</span>
                <input type="number" bind:value={ex.targetVisibleTime} min="1" max="30" />
              </label>
              <label>
                <span>{$t('targetHiddenSec')}</span>
                <input type="number" bind:value={ex.targetHiddenTime} min="1" max="30" />
              </label>
              <label>
                <span>{$t('shotsPerShowing')}</span>
                <input type="number" bind:value={ex.shotsPerShowing} min="1" max="5" />
              </label>
            </div>
          {/if}
        </div>
      {/each}

      <button class="btn-secondary btn-sm" onclick={() => addExercise(dsIdx)}>
        {$t('addExercise')}
      </button>
    </div>
  {/each}

  <button class="btn-secondary" onclick={addStage}>{$t('addStage')}</button>

  <div class="editor-actions">
    <button class="btn-primary" onclick={save}>{$t('save')}</button>
    <button class="btn-secondary" onclick={onCancel}>{$t('back')}</button>
  </div>
</div>

<style>
  .program-editor {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-bottom: 1rem;
  }

  h3 {
    color: var(--text-secondary);
    font-weight: 600;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }

  label span {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .stage-block {
    background: var(--bg-secondary);
    border-radius: var(--radius);
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .stage-header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .stage-header input {
    flex: 1;
  }

  select {
    font-family: var(--font-sans);
    font-size: 0.9rem;
    padding: 0.5rem;
    background: var(--bg-surface);
    color: var(--text-primary);
    border: 2px solid var(--bg-surface);
    border-radius: var(--radius);
  }

  .exercise-block {
    position: relative;
    padding: 0.5rem;
    background: var(--bg-primary);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .btn-remove-exercise {
    position: absolute;
    top: 0.3rem;
    right: 0.3rem;
    width: 22px;
    height: 22px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: var(--danger);
    border: 1px solid rgba(244, 67, 54, 0.3);
    border-radius: var(--radius);
    font-size: 0.65rem;
    font-weight: 700;
    opacity: 0.6;
    cursor: pointer;
    transition: opacity 0.15s, border-color 0.15s;
  }

  .btn-remove-exercise:hover {
    opacity: 1;
    border-color: var(--danger);
  }

  .field-row {
    display: flex;
    gap: 0.5rem;
  }

  input[type='number'] {
    width: 100%;
    padding: 0.5rem;
  }

  .btn-sm {
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
  }

  .editor-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    padding-top: 0.5rem;
  }
</style>
