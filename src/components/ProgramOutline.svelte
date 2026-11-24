<script>
  import { timerState, preferences } from '../lib/stores.js'
  import { t, getLocalizedName } from '../lib/i18n.js'
  import { getProgramById } from '../lib/programs/registry.js'
  import { fmtSec } from '../lib/timer/progress.js'
  import Icon from './ui/Icon.svelte'

  /**
   * Read-only list of the program's stages for wide screens: finished
   * stages ticked off, the current one lit, the rest waiting. Jumping
   * stays in the menu so a stray tap can't move the match.
   */

  let ts = $derived($timerState)
  let lang = $derived($preferences.lang)
  let program = $derived(getProgramById(ts.programId))
  let finished = $derived(ts.phase === 'stopped' && ts.stoppedReason === 'programComplete')

  /** "4 × 5, 20 s" per exercise: series × shots, then the shooting time */
  function summary(stage) {
    return stage.exercises
      .map((ex) => `${ex.seriesCount} × ${ex.shotsPerSeries}, ${fmtSec(ex.timePerSeries ?? ex.targetVisibleTime)}`)
      .join(' / ')
  }

  function stateOf(i) {
    if (finished || i < ts.stageIndex) return 'done'
    if (i === ts.stageIndex) return 'current'
    return 'next'
  }
</script>

{#if program}
  <section class="program-outline well" aria-label={$t('program')}>
    <header>
      <small>{$t('program')}</small>
      <b>{getLocalizedName(program.name, lang)}</b>
    </header>
    <ol>
      {#each program.stages as stage, i (stage.id ?? i)}
        {@const state = stateOf(i)}
        <li class={state} aria-current={state === 'current' ? 'step' : undefined}>
          <span class="mark tnum">
            {#if state === 'done'}<Icon name="check" />{:else}{i + 1}{/if}
          </span>
          <span class="text">
            <b>{getLocalizedName(stage.name, lang)}</b>
            <small class="tnum">{summary(stage)}</small>
          </span>
        </li>
      {/each}
    </ol>
  </section>
{/if}

<style>
  /* Not .outline: Tailwind generates a utility with that name */
  .program-outline {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 12px 12px;
    min-height: 0;
    overflow-y: auto;
    flex: 1;
  }

  header { display: flex; flex-direction: column; gap: 2px; padding: 0 6px; }
  header small { font-size: 0.75rem; font-weight: 700; color: var(--muted); }
  header b { font-size: 1.0625rem; font-weight: 800; letter-spacing: -0.01em; }

  ol { list-style: none; display: flex; flex-direction: column; gap: 6px; }

  li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 16px;
    min-width: 0;
  }

  .mark {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex: none;
    font-size: 0.8125rem;
    font-weight: 800;
    box-shadow: inset 0 0 0 1.5px var(--stroke-faint);
    color: var(--muted);
  }

  .mark :global(svg) { width: 16px; height: 16px; }

  .text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .text b { font-size: 0.9375rem; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .text small { font-size: 0.75rem; font-weight: 600; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  li.done .text b { color: var(--muted); }
  li.done .mark { background: var(--key); box-shadow: none; color: var(--fg); }

  li.current { background: var(--key); box-shadow: var(--key-shadow); }
  li.current .mark { background: var(--fg); color: var(--ink); box-shadow: none; }
</style>
