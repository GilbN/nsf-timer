<script>
  import { preferences } from '../lib/stores.js'
  import { t, getLocalizedName } from '../lib/i18n.js'
  import { getAllPrograms } from '../lib/programs/registry.js'
  import { loadCustomPrograms } from '../lib/storage.js'

  let { onSelect, onCustom } = $props()

  let builtinPrograms = getAllPrograms()
  let customPrograms = $state(loadCustomPrograms())
  let lang = $derived($preferences.lang)
  let expandedId = $state(null)

  function toggleInfo(e, id) {
    e.stopPropagation()
    expandedId = expandedId === id ? null : id
  }
</script>

<div class="program-picker">
  <h3>{$t('selectProgram')}</h3>

  <div class="program-list">
    {#each builtinPrograms as program}
      <div class="program-card-wrapper">
        <div class="program-card">
          <div class="program-card-header">
            <button class="program-card-select" onclick={() => onSelect(program.id)}>
              <span class="program-name">{getLocalizedName(program.name, lang)}</span>
              <span class="program-detail">{program.distance} — {program.totalCompetitionShots} {lang === 'no' ? 'skudd' : 'shots'}</span>
            </button>
            <button class="info-btn" class:active={expandedId === program.id} onclick={(e) => toggleInfo(e, program.id)} aria-label={$t('programInfo')}>
              ℹ
            </button>
          </div>
        </div>
        {#if expandedId === program.id}
          <div class="program-info-panel">
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
      <button class="program-card custom" onclick={() => onSelect(program.id)}>
        <span class="program-name">{getLocalizedName(program.name, lang)}</span>
        <span class="program-detail">{$t('customProgram')}</span>
      </button>
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
    gap: 0.75rem;
  }

  h3 {
    font-size: 1.1rem;
    color: var(--text-secondary);
    font-weight: 600;
  }

  .program-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .program-card-wrapper {
    display: flex;
    flex-direction: column;
    border: 2px solid var(--bg-surface);
    border-radius: var(--radius);
    background: var(--bg-secondary);
    transition: border-color 0.15s;
  }

  .program-card-wrapper:hover {
    border-color: var(--accent);
  }

  .program-card {
    padding: 0;
    background: transparent;
  }

  .program-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem 0.5rem 0;
  }

  .program-card-select {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
    padding: 0.75rem 0.5rem 0.75rem 1rem;
    background: transparent;
    border: none;
    border-radius: var(--radius);
    text-align: left;
    cursor: pointer;
  }

  .program-card-text {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .program-card.custom {
    border: 2px dashed var(--bg-surface);
    background: var(--bg-secondary);
    padding: 1rem;
  }

  .program-name {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .program-detail {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .info-btn {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--bg-surface);
    color: var(--text-secondary);
    font-size: 0.9rem;
    border: none;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .info-btn:hover,
  .info-btn.active {
    color: var(--accent);
    background: rgba(0, 230, 118, 0.1);
  }

  .program-info-panel {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0 1rem 1rem;
    border-top: 1px solid var(--bg-surface);
    margin-top: 0;
    padding-top: 0.75rem;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 0.8rem;
  }

  .info-row-groups {
    flex-direction: column;
    gap: 0.3rem;
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
    gap: 0.2rem;
  }

  .weapon-group-list li {
    font-size: 0.75rem;
    color: var(--text-primary);
    padding-left: 0.75rem;
    position: relative;
  }

  .weapon-group-list li::before {
    content: '•';
    position: absolute;
    left: 0;
    color: var(--accent);
  }

  .add-custom {
    align-self: center;
    margin-top: 0.5rem;
  }
</style>
