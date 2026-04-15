<script>
  import { timerState, preferences } from '../lib/stores.js'
  import { t, getLocalizedName } from '../lib/i18n.js'
  import { getProgramById } from '../lib/programs/registry.js'

  let program = $derived(getProgramById($timerState.programId))
  let stage = $derived(program?.stages[$timerState.stageIndex])
  let exercise = $derived(stage?.exercises[$timerState.exerciseIndex])
  let lang = $derived($preferences.lang)
  let reason = $derived($timerState.stoppedReason)

  function exerciseLabelFor(idx) {
    return `${$t('exercise')} ${idx + 1}`
  }

  function fmtSec(s) {
    if (s == null) return ''
    return Number.isInteger(s) ? `${s}s` : `${Math.round(s * 10) / 10}s`
  }

  /**
   * Exercise metadata shown below the main progress line.
   * Shape depends on stage type: precision = shoot time; rapid = hidden→visible;
   * duel = visible/hidden cycle + shots per showing. Loading time always appended.
   */
  let metaLine = $derived.by(() => {
    if (!exercise || !stage) return null
    const parts = []

    // Order: loading → hidden → visible (the order the phases actually occur).
    if (exercise.loadingTime) {
      parts.push(`${fmtSec(exercise.loadingTime)} ${$t('metaLoading')}`)
    }

    // Duell: hidden/visible cycle + shots per showing.
    // Any other exercise with targetHiddenTime runs a hidden→visible flow
    // (precision, rapid — the scheduler dispatches on the presence of this field).
    if (stage.type === 'duell' && exercise.targetVisibleTime && exercise.targetHiddenTime) {
      parts.push(`${fmtSec(exercise.targetHiddenTime)} ${$t('metaHidden')} / ${fmtSec(exercise.targetVisibleTime)} ${$t('metaVisible')}`)
      if (exercise.shotsPerShowing) {
        parts.push(`${exercise.shotsPerShowing} ${$t('metaShotsPerShowing')}`)
      }
    } else if (exercise.targetHiddenTime && exercise.timePerSeries) {
      parts.push(`${fmtSec(exercise.targetHiddenTime)} ${$t('metaHidden')} → ${fmtSec(exercise.timePerSeries)} ${$t('metaVisible')}`)
    } else if (exercise.timePerSeries) {
      parts.push(`${fmtSec(exercise.timePerSeries)} / ${$t('metaPerSeries')}`)
    }

    return parts.length ? parts.join(' · ') : null
  })

  /**
   * "Up next" preview describing the primary forward action.
   * Returns { text, muted? } or null when no preview applies (running/paused).
   */
  let upNext = $derived.by(() => {
    if (!program || !stage || !exercise) return null

    // Idle: first series of current exercise (just after loading/jumping)
    if ($timerState.phase === 'idle') {
      const exLabel = exerciseLabelFor($timerState.exerciseIndex)
      return {
        text: `${exLabel} — ${$t('series')} 1/${exercise.seriesCount}`,
      }
    }

    if ($timerState.phase !== 'stopped') return null

    // When a next series exists, mirror the green "Next series" button.
    // - After 'seriesComplete' seriesIndex is already advanced (points at upcoming).
    // - After 'aborted' seriesIndex still points at the aborted one, so upcoming = seriesIndex + 2 (1-based).
    if (reason === 'seriesComplete' && $timerState.seriesIndex < exercise.seriesCount) {
      const exLabel = exerciseLabelFor($timerState.exerciseIndex)
      return {
        text: `${exLabel} — ${$t('series')} ${$timerState.seriesIndex + 1}/${exercise.seriesCount}`,
      }
    }
    if (reason === 'aborted' && $timerState.seriesIndex + 1 < exercise.seriesCount) {
      const exLabel = exerciseLabelFor($timerState.exerciseIndex)
      return {
        text: `${exLabel} — ${$t('series')} ${$timerState.seriesIndex + 2}/${exercise.seriesCount}`,
      }
    }

    // No next series → mirror slot 3 (Next exercise / Next stage).
    if (reason === 'aborted' || reason === 'exerciseComplete') {
      const nextEx = stage.exercises[$timerState.exerciseIndex + 1]
      if (nextEx) return { text: exerciseLabelFor($timerState.exerciseIndex + 1) }
      // fall through to next-stage preview
      const nextStage = program.stages[$timerState.stageIndex + 1]
      if (!nextStage) return null
      const stageLabel = getLocalizedName(nextStage.name, lang) ?? ''
      const firstEx = nextStage.exercises[0]
      if (!firstEx) return { text: stageLabel }
      return { text: `${stageLabel} — ${exerciseLabelFor(0)}` }
    }

    if (reason === 'stageComplete') {
      const nextStage = program.stages[$timerState.stageIndex + 1]
      if (!nextStage) return null
      const stageLabel = getLocalizedName(nextStage.name, lang) ?? ''
      const firstEx = nextStage.exercises[0]
      if (!firstEx) return { text: stageLabel }
      return { text: `${stageLabel} — ${exerciseLabelFor(0)}` }
    }

    if (reason === 'programComplete') {
      return { text: $t('programComplete'), muted: true }
    }

    return null
  })
</script>

{#if program && stage && exercise}
  <div class="series-progress">
    <span class="tag prog">{getLocalizedName(program.name, lang)}</span>
    <span class="divider">·</span>
    <span class="tag stage" class:trial={stage.isTrialStage}>
      {getLocalizedName(stage.name, lang)}
    </span>
    {#if stage.exercises.length > 1}
      <span class="divider">·</span>
      <span class="tag">{$t('exercise')} {$timerState.exerciseIndex + 1}/{stage.exercises.length}</span>
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
  {#if metaLine}
    <div class="meta-line">{metaLine}</div>
  {/if}
  {#if upNext}
    <div class="next-up" class:muted={upNext.muted}>
      <span class="next-label">{$t('upNext')}:</span>
      <span class="next-name">{upNext.text}</span>
    </div>
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

  .tag.stage.trial {
    color: var(--warning);
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

  .meta-line {
    text-align: center;
    font-size: 0.66rem;
    font-weight: 500;
    color: var(--text-secondary);
    letter-spacing: 0.02em;
    opacity: 0.75;
    padding: 0 0.5rem 0.1rem;
  }

  .next-label {
    color: var(--text-secondary);
    margin-right: 0.25em;
  }

  .next-up.muted .next-name {
    color: var(--text-secondary);
    opacity: 0.7;
  }
</style>
