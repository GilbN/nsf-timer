<script>
  import { timerState, preferences } from '../lib/stores.js'
  import { t, getLocalizedName } from '../lib/i18n.js'
  import { getProgramById } from '../lib/programs/registry.js'

  let program = $derived(getProgramById($timerState.programId))
  let stage = $derived(program?.stages[$timerState.stageIndex])
  let exercise = $derived(stage?.exercises[$timerState.exerciseIndex])
  let lang = $derived($preferences.lang)
</script>

{#if program && stage && exercise}
  <div class="series-progress">
    <div class="program-name">{getLocalizedName(program.name, lang)}</div>
    <div class="stage-name">{getLocalizedName(stage.name, lang)}</div>
    {#if stage.exercises.length > 1}
      <div class="exercise-info">
        {$t('series')} {$timerState.exerciseIndex + 1}/{stage.exercises.length}
      </div>
    {/if}
    <div class="series-info">
      {$t('series')} {$timerState.seriesIndex + 1} {$t('of')} {exercise.seriesCount}
      {#if exercise.shotsPerSeries}
        — {exercise.shotsPerSeries} {$preferences.lang === 'no' ? 'skudd' : 'shots'}
      {/if}
    </div>
    {#if stage.type === 'duell' && exercise.targetVisibleTime && $timerState.phase === 'shooting'}
      <div class="duel-info">
        {$t('showing')} {$timerState.duelShowingIndex + 1}/{Math.ceil(exercise.shotsPerSeries / exercise.shotsPerShowing)}
      </div>
    {/if}
  </div>
{/if}

<style>
  .series-progress {
    text-align: center;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .program-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .stage-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--accent);
  }

  .exercise-info,
  .series-info {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .duel-info {
    font-size: 0.85rem;
    color: var(--warning);
    font-weight: 600;
  }
</style>
