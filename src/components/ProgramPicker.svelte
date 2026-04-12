<script>
  import { get } from 'svelte/store'
  import { preferences } from '../lib/stores.js'
  import { t, getLocalizedName } from '../lib/i18n.js'
  import { getAllPrograms } from '../lib/programs/registry.js'
  import { loadCustomPrograms, deleteCustomProgram } from '../lib/storage.js'

  let { onSelect, onCustom, onEdit } = $props()

  let builtinPrograms = getAllPrograms()
  let customPrograms = $state(loadCustomPrograms())
  let lang = $derived($preferences.lang)
  let expandedId = $state(null)

  function toggleInfo(e, id) {
    e.stopPropagation()
    expandedId = expandedId === id ? null : id
  }

  function handleEdit(e, program) {
    e.stopPropagation()
    if (onEdit) onEdit(program)
  }

  function handleDelete(e, program) {
    e.stopPropagation()
    if (!confirm(get(t)('confirmDeleteProgram'))) return
    deleteCustomProgram(program.id)
    customPrograms = loadCustomPrograms()
  }
</script>

<div class="program-picker">
  <p class="section-label">{$t('selectProgram')}</p>

  <div class="program-list">
    {#each builtinPrograms as program}
      <div class="program-entry" class:expanded={expandedId === program.id}>
        <div class="program-row">
          <button class="program-select" onclick={() => onSelect(program.id)}>
            <span class="program-name">{getLocalizedName(program.name, lang)}</span>
            <span class="program-meta">{program.distance} · {program.totalCompetitionShots} {lang === 'no' ? 'skudd' : 'shots'}</span>
          </button>
          <button
            class="info-btn"
            class:active={expandedId === program.id}
            onclick={(e) => toggleInfo(e, program.id)}
            aria-label={$t('programInfo')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </button>
        </div>

        {#if expandedId === program.id}
          <div class="info-panel">
            <div class="info-row">
              <span class="info-label">{$t('distance')}</span>
              <span class="info-value">{program.distance}</span>
            </div>
            {#if program.calibers?.length}
              <div class="info-row">
                <span class="info-label">{$t('caliber')}</span>
                <span class="info-value">{program.calibers.join(', ')}</span>
              </div>
            {/if}
            {#if program.startPosition}
              <div class="info-row">
                <span class="info-label">{$t('startPosition')}</span>
                <span class="info-value">{getLocalizedName(program.startPosition, lang)}</span>
              </div>
            {/if}
            <div class="info-row">
              <span class="info-label">{$t('competitionShots')}</span>
              <span class="info-value">{program.totalCompetitionShots}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{$t('practiceShots')}</span>
              <span class="info-value">{program.trialShots}</span>
            </div>
            {#if program.weaponGroups}
              <div class="info-row info-row-groups">
                <span class="info-label">{$t('weaponGroups')}</span>
                <ul class="weapon-group-list">
                  {#each (program.weaponGroups[lang] || program.weaponGroups.no) as group}
                    <li>{group}</li>
                  {/each}
                </ul>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}

    {#each customPrograms as program}
      <div class="program-entry">
        <div class="program-row">
          <button class="program-select" onclick={() => onSelect(program.id)}>
            <span class="program-name">{getLocalizedName(program.name, lang)}</span>
            <span class="program-meta">{$t('customProgram')}</span>
          </button>
          <button
            class="action-btn"
            onclick={(e) => handleEdit(e, program)}
            aria-label={$t('editProgram')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button
            class="action-btn action-btn-danger"
            onclick={(e) => handleDelete(e, program)}
            aria-label={$t('deleteProgram')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    {/each}
  </div>

  {#if onCustom}
    <button class="btn-secondary add-custom" onclick={onCustom}>
      + {$t('customProgram')}
    </button>
  {/if}
</div>

<style>
  .program-picker {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .section-label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-secondary);
    padding-left: 0.25rem;
  }

  .program-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .program-entry {
    border-left: 2px solid transparent;
    border-radius: 0 var(--radius) var(--radius) 0;
    background: var(--bg-secondary);
    transition: border-color 0.15s;
    overflow: hidden;
  }

  .program-entry:hover,
  .program-entry.expanded {
    border-left-color: var(--accent);
  }

  .program-row {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .program-select {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
    padding: 0.7rem 0.5rem 0.7rem 0.85rem;
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    min-width: 0;
  }

  .program-name {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .program-meta {
    font-size: 0.72rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .info-btn {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: var(--text-secondary);
    opacity: 0.5;
    cursor: pointer;
    transition: opacity 0.15s, color 0.15s;
  }

  .info-btn svg {
    width: 16px;
    height: 16px;
  }

  .info-btn:hover,
  .info-btn.active {
    opacity: 1;
    color: var(--accent);
  }

  .info-panel {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0 0.85rem 0.75rem 0.85rem;
    border-top: 1px solid rgba(255,255,255,0.04);
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 0.75rem;
  }

  .info-row-groups {
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-label {
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .info-value {
    color: var(--text-primary);
    font-weight: 600;
    text-align: right;
  }

  .weapon-group-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .weapon-group-list li {
    font-size: 0.72rem;
    color: var(--text-primary);
    padding-left: 0.75rem;
    position: relative;
  }

  .weapon-group-list li::before {
    content: '—';
    position: absolute;
    left: 0;
    color: var(--accent);
    font-size: 0.65rem;
  }

  .action-btn {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: var(--text-secondary);
    border: none;
    opacity: 0.5;
    cursor: pointer;
    transition: opacity 0.15s, color 0.15s;
  }

  .action-btn svg {
    width: 15px;
    height: 15px;
  }

  .action-btn:hover {
    opacity: 1;
    color: var(--accent);
  }

  .action-btn-danger:hover {
    color: var(--danger);
  }

  .add-custom {
    align-self: flex-start;
    margin-top: 0.25rem;
    font-size: 0.85rem;
    padding: 0.5rem 1rem;
  }
</style>
