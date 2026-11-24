<script>
  import { tick } from 'svelte'
  import { get } from 'svelte/store'
  import { preferences } from '../lib/stores.js'
  import { t, getLocalizedName } from '../lib/i18n.js'
  import { confirmAction } from '../lib/confirm.js'
  import { getAllPrograms } from '../lib/programs/registry.js'
  import { loadCustomPrograms, deleteCustomProgram } from '../lib/storage.js'
  import Modal from './Modal.svelte'
  import Icon from './ui/Icon.svelte'

  let { onSelect, onCustom, onEdit } = $props()

  let builtinPrograms = getAllPrograms()
  let customPrograms = $state(loadCustomPrograms())
  let lang = $derived($preferences.lang)

  /**
   * The program whose details sheet is open, built-in or custom.
   * @type {any}
   */
  let sheetProgram = $state(null)
  let sheetIsCustom = $derived(!!sheetProgram && customPrograms.some((p) => p.id === sheetProgram?.id))

  function openSheet(e, program) {
    e.stopPropagation()
    sheetProgram = program
  }

  function closeSheet() {
    sheetProgram = null
  }

  function startFromSheet() {
    const id = sheetProgram?.id
    sheetProgram = null
    if (id) onSelect(id)
  }

  function handleEdit(e, program) {
    e.stopPropagation()
    sheetProgram = null
    if (onEdit) onEdit(program)
  }

  async function handleDelete(e, program) {
    e.stopPropagation()
    sheetProgram = null
    // Let the sheet close first so the confirm isn't stacked on top of it
    await tick()
    if (!(await confirmAction(get(t)('confirmDeleteProgram'), get(t)('deleteProgram')))) return
    deleteCustomProgram(program.id)
    customPrograms = loadCustomPrograms()
  }

  /** "25m, 60 skudd" */
  function metaFor(program) {
    const shots = `${program.totalCompetitionShots} ${$t('shotsShort')}`
    return program.distance ? `${program.distance}, ${shots}` : shots
  }

  function stagesOf(program) {
    return program.stages.map((s) => getLocalizedName(s.name, lang)).filter(Boolean)
  }
</script>

<div class="program-picker">
  <h2 class="heading">{$t('selectProgram')}</h2>

  <div class="grid">
    {#each builtinPrograms as program (program.id)}
      <div class="slot">
        <button class="key program" onclick={() => onSelect(program.id)}>
          <span class="name">{getLocalizedName(program.name, lang)}</span>
          <small>{metaFor(program)}</small>
        </button>
        <button
          class="corner"
          onclick={(e) => openSheet(e, program)}
          aria-label="{$t('programInfo')}: {getLocalizedName(program.name, lang)}"
        >
          <Icon name="info" />
        </button>
      </div>
    {/each}

    {#each customPrograms as program (program.id)}
      <div class="slot">
        <button class="key key-line program" onclick={() => onSelect(program.id)}>
          <span class="name">{getLocalizedName(program.name, lang)}</span>
          <small>{$t('customProgram')}</small>
        </button>
        <button
          class="corner"
          onclick={(e) => openSheet(e, program)}
          aria-label="{$t('editProgram')}: {getLocalizedName(program.name, lang)}"
        >
          <Icon name="more" />
        </button>
      </div>
    {/each}

    {#if onCustom}
      <button class="key key-line key-row add" onclick={onCustom}>
        <Icon name="plus" />{$t('customProgram')}
      </button>
    {/if}
  </div>
</div>

{#if sheetProgram}
  {@const program = sheetProgram}
  <Modal variant="sheet" onClose={closeSheet} labelledby="program-sheet-title">
    <div class="sheet-panel">
      <div class="sheet-head">
        <h2 id="program-sheet-title">{getLocalizedName(program.name, lang)}</h2>
        <span class="aside">{sheetIsCustom ? $t('customProgram') : program.distance}</span>
      </div>

      {#if sheetIsCustom}
        <div class="stages">
          {#each stagesOf(program) as stage, i (i)}
            <span class="pill">{stage}</span>
          {/each}
        </div>
        <div class="key-grid actions">
          <button class="key key-white span-2" onclick={startFromSheet}>
            <Icon name="play" filled />
            <span>{$t('start')}<small>{getLocalizedName(program.name, lang)}</small></span>
          </button>
          <button class="key key-row" onclick={(e) => handleEdit(e, program)}>
            <Icon name="edit" />{$t('editProgram')}
          </button>
          <button class="key key-row" onclick={(e) => handleDelete(e, program)}>
            <Icon name="trash" />{$t('deleteProgram')}
          </button>
        </div>
      {:else}
        <div class="facts">
          <div class="tile"><small>{$t('competitionShots')}</small><b class="tnum">{program.totalCompetitionShots}</b></div>
          <div class="tile"><small>{$t('practiceShots')}</small><b class="tnum">{program.trialShots}</b></div>
        </div>

        <dl class="rows">
          {#if program.calibers?.length}
            <div><dt>{$t('caliber')}</dt><dd>{program.calibers.join(', ')}</dd></div>
          {/if}
          {#if program.startPosition}
            <div><dt>{$t('startPosition')}</dt><dd>{getLocalizedName(program.startPosition, lang)}</dd></div>
          {/if}
          {#if program.weaponGroups}
            <div>
              <dt>{$t('weaponGroups')}</dt>
              <dd>
                <ul>
                  {#each (program.weaponGroups[lang] || program.weaponGroups.no) as group (group)}
                    <li>{group}</li>
                  {/each}
                </ul>
              </dd>
            </div>
          {/if}
          <div>
            <dt>{$t('stage')}</dt>
            <dd class="stages">
              {#each stagesOf(program) as stage, i (i)}
                <span class="pill">{stage}</span>
              {/each}
            </dd>
          </div>
        </dl>

        <div class="key-grid actions">
          <button class="key key-white" onclick={startFromSheet}>
            <Icon name="play" filled />
            <span>{$t('start')}<small>{getLocalizedName(program.name, lang)}</small></span>
          </button>
          <button class="key" onclick={closeSheet}>
            <Icon name="arrow-left" />
            <span>{$t('back')}</span>
          </button>
        </div>
      {/if}
    </div>
  </Modal>
{/if}

<style>
  .heading {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--muted);
    margin: 0 4px 10px;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .slot { position: relative; min-width: 0; }

  /* min-height so long names and big text grow the key; top padding clears the corner button */
  .program {
    width: 100%;
    min-height: 112px;
    height: 100%;
    padding-top: 48px;
    justify-content: flex-end;
  }

  .name {
    font-size: 1.0625rem;
    font-weight: 800;
    letter-spacing: -0.01em;
    line-height: 1.2;
    overflow-wrap: break-word;
    hyphens: auto;
  }

  .program small { margin-top: 0; }

  .corner {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 40px;
    height: 40px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    color: var(--muted);
  }

  .corner :global(svg) { width: 20px; height: 20px; }
  .corner:active { background: var(--key-2); color: var(--fg); }

  .add {
    grid-column: span 2;
    min-height: 60px;
    color: var(--muted);
  }

  /* Wide lobbies (landscape tablets and desktops) take three keys a row */
  .program-picker { container-type: inline-size; }

  @container (min-width: 600px) {
    .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .program { min-height: 140px; }
    .add { grid-column: 1 / -1; }
  }

  /* ── Sheet ── */
  .facts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .rows {
    display: flex;
    flex-direction: column;
    padding: 0 4px;
  }

  .rows > div {
    display: grid;
    grid-template-columns: 7.5rem 1fr;
    gap: 12px;
    padding: 10px 0;
    border-top: 1px solid var(--line);
    font-size: 0.875rem;
  }

  dt { color: var(--muted); font-weight: 700; }
  dd { font-weight: 600; }
  dd ul { list-style: none; display: flex; flex-direction: column; gap: 4px; }

  .stages { display: flex; flex-wrap: wrap; gap: 6px; }
  .stages .pill { height: 26px; font-size: 0.75rem; }

  .actions { margin-top: 4px; }
  .actions .key { min-height: 96px; }
  .actions .key-row { min-height: 60px; }
</style>
