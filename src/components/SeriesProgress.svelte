<script>
  import { timerState, preferences } from '../lib/stores.js'
  import { t, getLocalizedName } from '../lib/i18n.js'
  import { getProgramById } from '../lib/programs/registry.js'

  let program = $derived(getProgramById($timerState.programId))
  let stage = $derived(program?.stages[$timerState.stageIndex])
  let exercise = $derived(stage?.exercises[$timerState.exerciseIndex])
  let lang = $derived($preferences.lang)
  let nextName = $derived.by(() => {
    if (!program || !stage || $timerState.phase !== 'stopped') return null
    const nextExIdx = $timerState.exerciseIndex + 1
    if (nextExIdx < stage.exercises.length) {
      return getLocalizedName(stage.name, lang)
    }
    const nextStageIdx = $timerState.stageIndex + 1
    if (nextStageIdx < program.stages.length) {
      return getLocalizedName(program.stages[nextStageIdx].name, lang)
    }
    return null
  })
</script>

{#if program && stage && exercise}
  <div class="series-progress">
    <span class="tag prog">{getLocalizedName(program.name, lang)}</span>
    <span class="divider">·</span>
    <span class="tag stage">{getLocalizedName(stage.name, lang)}</span>
    {#if stage.exercises.length > 1}
      <span class="divider">·</span>
      <span class="tag">{$t('series')} {$timerState.exerciseIndex + 1}/{stage.exercises.length}</span>
    {/if}
    <span class="divider">·</span>
    <span class="tag">
      {$t('series')} {$timerState.seriesIndex + 1}/{exercise.seriesCount}
      {#if exercise.shotsPerSeries}
        · {exercise.shotsPerSeries}{lang === 'no' ? 'sk' : 'sh'}
      {/if}
    </span>
    {#if stage.type === 'duell' && exercise.targetVisibleTime && $timerState.phase === 'shooting'}
      <span class="divider">·</span>
      <span class="tag duel">{$t('showing')} {$timerState.duelShowingIndex + 1}/{Math.ceil(exercise.shotsPerSeries / exercise.shotsPerShowing)}</span>
    {/if}
  </div>
  {#if nextName}
    <div class="next-up">{$t('nextExercise')}: <span class="next-name">{nextName}</span></div>
  {/if}
{/if}

<style>
  .series-progress {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.15rem 0.1rem;
    padding: 0.4rem 0.5rem;
  }

  .tag {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-secondary);
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .tag.prog {
    color: var(--text-primary);
    font-weight: 700;
  }

  .tag.stage {
    color: var(--accent);
  }

  .tag.duel {
    color: var(--warning);
  }

  .divider {
    font-size: 0.7rem;
    color: var(--text-secondary);
    opacity: 0.4;
    margin: 0 0.1rem;
  }

  .next-up {
    text-align: center;
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-secondary);
    letter-spacing: 0.04em;
    padding-bottom: 0.2rem;
  }

  .next-name {
    color: var(--accent);
  }
</style>
