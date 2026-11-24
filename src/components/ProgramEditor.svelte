<script>
  import { t } from '../lib/i18n.js'
  import { saveCustomPrograms, loadCustomPrograms, updateCustomProgram } from '../lib/storage.js'
  import Icon from './ui/Icon.svelte'

  let { onSave, onCancel, editProgram = null } = $props()

  // Initial state is seeded from editProgram at mount time. The component is
  // re-mounted whenever the editor opens (via {#if showEditor} in LobbyView),
  // so capturing the initial prop value is exactly the intended behavior:
  // the user's subsequent edits to `name`/`stages` must not be overwritten
  // by prop reactivity.
  /* svelte-ignore state_referenced_locally */
  let name = $state(editProgram ? editProgram.name.no : '')
  /* svelte-ignore state_referenced_locally */
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

  // Set on the first save attempt so an empty name gets marked
  let triedSave = $state(false)

  const TYPES = ['precision', 'rapid', 'duell']

  /** Number fields per stage type, in the order the phases run. */
  function fieldsFor(type) {
    const common = [
      { key: 'seriesCount', label: 'seriesCount', min: 1, max: 20, step: 1 },
      { key: 'shotsPerSeries', label: 'shotsPerSeries', min: 1, max: 10, step: 1 },
      { key: 'loadingTime', label: 'loadingTimeSec', min: 0, max: 300, step: 5 },
    ]
    if (type === 'duell') {
      return [
        ...common,
        { key: 'targetHiddenTime', label: 'targetHiddenSec', min: 1, max: 30, step: 1 },
        { key: 'targetVisibleTime', label: 'targetVisibleSec', min: 1, max: 30, step: 1 },
        { key: 'shotsPerShowing', label: 'shotsPerShowing', min: 1, max: 5, step: 1 },
      ]
    }
    if (type === 'rapid') {
      return [
        ...common,
        { key: 'targetHiddenTime', label: 'targetHiddenSec', min: 1, max: 30, step: 1 },
        { key: 'timePerSeries', label: 'timePerSeriesSec', min: 1, max: 600, step: 1 },
      ]
    }
    return [...common, { key: 'timePerSeries', label: 'timePerSeriesSec', min: 1, max: 600, step: 5 }]
  }

  function nudge(ex, field, dir) {
    const current = Number(ex[field.key]) || 0
    ex[field.key] = Math.min(field.max, Math.max(field.min, current + dir * field.step))
  }

  function save() {
    triedSave = true
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
  <div class="head">
    <h2>{editProgram ? $t('editProgram') : $t('customProgram')}</h2>
  </div>

  <label class="block">
    <span class="field-label">{$t('programName')}</span>
    <input
      class="input"
      type="text"
      bind:value={name}
      placeholder={$t('programName')}
      aria-invalid={triedSave && !name.trim() ? 'true' : undefined}
    />
  </label>

  {#each stages as ds, dsIdx (dsIdx)}
    <section class="stage well" aria-label="{$t('stage')} {dsIdx + 1}">
      <div class="stage-head">
        <span class="stage-no tnum">{$t('stage')} {dsIdx + 1}</span>
        {#if stages.length > 1}
          <button class="btn btn-ghost btn-icon" onclick={() => removeStage(dsIdx)} aria-label="{$t('removeStage')} {dsIdx + 1}">
            <Icon name="trash" />
          </button>
        {/if}
      </div>

      <input class="input" type="text" bind:value={ds.name.no} placeholder={$t('stageName')} aria-label={$t('stageName')} />

      <div class="types" role="radiogroup" aria-label="{$t('stage')} {dsIdx + 1}">
        {#each TYPES as type (type)}
          <button
            class="type"
            class:on={ds.type === type}
            role="radio"
            aria-checked={ds.type === type}
            onclick={() => { if (ds.type !== type) updateType(dsIdx, type) }}
          >{$t(type)}</button>
        {/each}
      </div>

      {#each ds.exercises as ex, exIdx (exIdx)}
        <div class="exercise">
          {#if ds.exercises.length > 1}
            <div class="exercise-head">
              <span class="muted tnum">{$t('exercise')} {exIdx + 1}</span>
              <button class="btn btn-ghost btn-icon" onclick={() => removeExercise(dsIdx, exIdx)} title={$t('removeExercise')} aria-label={$t('removeExercise')}>
                <Icon name="x" />
              </button>
            </div>
          {/if}
          <div class="fields">
            {#each fieldsFor(ds.type) as field (field.key)}
              <div class="num key">
                <label class="num-label" for="f-{dsIdx}-{exIdx}-{field.key}">{$t(field.label)}</label>
                <div class="stepper">
                  <button class="step" onclick={() => nudge(ex, field, -1)} aria-label="{$t(field.label)} -{field.step}" disabled={Number(ex[field.key]) <= field.min}>
                    <Icon name="minus" />
                  </button>
                  <input
                    id="f-{dsIdx}-{exIdx}-{field.key}"
                    class="value tnum"
                    type="number"
                    inputmode="numeric"
                    bind:value={ex[field.key]}
                    min={field.min}
                    max={field.max}
                  />
                  <button class="step" onclick={() => nudge(ex, field, 1)} aria-label="{$t(field.label)} +{field.step}" disabled={Number(ex[field.key]) >= field.max}>
                    <Icon name="plus" />
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}

      <button class="key key-line key-row add" onclick={() => addExercise(dsIdx)}>
        <Icon name="plus" />{$t('addExercise').replace(/^\+\s*/, '')}
      </button>
    </section>
  {/each}

  <button class="key key-line key-row add" onclick={addStage}>
    <Icon name="plus" />{$t('addStage').replace(/^\+\s*/, '')}
  </button>

  <div class="actions">
    <button class="key key-white" onclick={save}>
      <Icon name="check" />
      <span>{$t('save')}</span>
    </button>
    <button class="key" onclick={onCancel}>
      <Icon name="arrow-left" />
      <span>{$t('back')}</span>
    </button>
  </div>
</div>

<style>
  .program-editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 8px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 4px 0;
  }

  .head h2 {
    font-size: 1.375rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .block { display: block; }

  .stage {
    padding: 14px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .stage-head, .exercise-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 32px;
    padding-left: 6px;
  }

  .stage-no { font-size: 0.8125rem; font-weight: 800; color: var(--muted); }
  .exercise-head { font-size: 0.8125rem; font-weight: 700; }
  .stage-head .btn, .exercise-head .btn { height: 36px; width: 36px; color: var(--muted); }

  .types {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .type {
    height: 44px;
    border-radius: 14px;
    background: var(--key);
    box-shadow: var(--key-shadow);
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--muted);
  }

  .type.on {
    background: var(--fg);
    color: var(--ink);
    box-shadow: var(--white-shadow);
  }

  .exercise { display: flex; flex-direction: column; gap: 6px; }

  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  /* Each number is its own key: label on top, stepper below */
  .num {
    padding: 10px 10px 8px;
    gap: 6px;
    min-height: 0;
    justify-content: flex-start;
  }

  .num-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--muted);
    padding-left: 4px;
  }

  .stepper {
    display: grid;
    grid-template-columns: 36px 1fr 36px;
    align-items: center;
    width: 100%;
    gap: 4px;
  }

  .step {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: var(--key-2);
  }

  .step :global(svg) { width: 18px; height: 18px; }
  .step:disabled { opacity: 0.3; }
  .step:active:not(:disabled) { filter: brightness(1.3); }

  .value {
    width: 100%;
    min-width: 0;
    height: 36px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    text-align: center;
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .value::-webkit-outer-spin-button,
  .value::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .value:focus-visible { outline: 2px solid var(--fg); outline-offset: 0; }

  .add {
    min-height: 52px;
    color: var(--muted);
  }

  .actions {
    position: sticky;
    bottom: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding-top: 10px;
    background: linear-gradient(to bottom, transparent, var(--bg) 14px);
  }

  .actions .key { min-height: 64px; flex-direction: row; align-items: center; justify-content: flex-start; }
</style>
