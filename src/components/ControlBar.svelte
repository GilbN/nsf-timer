<script>
  import { timerState, preferences } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'
  import { getProgramById } from '../lib/programs/registry.js'
  import { forwardOptions, upNextText, contextFor } from '../lib/timer/progress.js'
  import Icon from './ui/Icon.svelte'

  /**
   * The host's keypad. The white key is always the thing to press next.
   * The bottom row holds Nullstill plus either Skyttere (rooms) or
   * Velg delserie (solo).
   */
  let {
    onStart,
    onPause,
    onResume,
    onStop,
    onRestart,
    onNextSeries,
    onNext,
    onReset,
    onShooters = undefined,
    peerCount = 0,
    onJump = undefined,
  } = $props()

  let ts = $derived($timerState)
  let phase = $derived(ts.phase)
  let lang = $derived($preferences.lang)
  let program = $derived(getProgramById(ts.programId))
  let exercise = $derived(contextFor(program, ts).exercise)
  let f = $derived(forwardOptions(program, ts, $t, lang))
  let finished = $derived(phase === 'stopped' && ts.stoppedReason === 'programComplete')
  let startHint = $derived(upNextText(program, ts, $t, lang) ?? '')

  // Which series Restart serie repeats, mirroring TimerScheduler.restartSeries()
  let restartNumber = $derived.by(() => {
    if (!exercise) return 1
    if (ts.stoppedReason === 'seriesComplete') return Math.max(1, ts.seriesIndex)
    if (ts.stoppedReason === 'exerciseComplete' || ts.stoppedReason === 'stageComplete' || ts.stoppedReason === 'programComplete') return exercise.seriesCount
    return ts.seriesIndex + 1
  })

  let slot3Label = $derived(f.slot3?.kind === 'stage' ? $t('nextStageLabel') : $t('nextExerciseLabel'))
  let loadingSuffix = $derived(exercise?.loadingTime ? `, ${exercise.loadingTime} s ${$t('metaLoading')}` : '')
</script>

<div class="keypad" data-phase={phase}>
  {#if phase === 'idle'}
    <div class="main one">
      <button class="key key-white" onclick={onStart}>
        <Icon name="play" filled />
        <span>{$t('start')}<small>{startHint}</small></span>
      </button>
    </div>

  {:else if phase === 'loading' || phase === 'shooting'}
    <div class="main two">
      <button class="key key-white" onclick={onPause}>
        <Icon name="pause" filled />
        <span>{$t('pause')}<small>{$t('pauseHint')}</small></span>
      </button>
      <button class="key" onclick={onStop}>
        <Icon name="stop" />
        <span>{$t('stop')}<small>{$t('stopHint')}</small></span>
      </button>
    </div>

  {:else if phase === 'paused'}
    <div class="main two">
      <button class="key key-white" onclick={onResume}>
        <Icon name="play" filled />
        <span>{$t('resume')}<small>{$t('resumeHint')}</small></span>
      </button>
      <button class="key" onclick={onStop}>
        <Icon name="stop" />
        <span>{$t('stop')}<small>{$t('stopHint')}</small></span>
      </button>
    </div>

  {:else if finished}
    <div class="main one">
      <div class="key key-line done" role="status">
        <Icon name="check" />
        <span>{$t('programComplete')}</span>
      </div>
    </div>

  {:else}
    <!-- Stopped: up to three ways on, the usual one in white and full width -->
    <div class="main stopped" class:three={f.showNextSeries && f.slot3}>
      {#if f.showNextSeries}
        <button class="key" class:key-white={f.primary === 'nextSeries'} class:wide={f.primary === 'nextSeries' && f.slot3} onclick={onNextSeries}>
          <Icon name="arrow-right" />
          <span>{$t('nextSeries')}<small>{$t('series')} {f.nextSeriesNumber}/{exercise?.seriesCount}{loadingSuffix}</small></span>
        </button>
      {/if}
      {#if f.slot3}
        <button class="key" class:key-white={f.primary === 'slot3'} class:wide={f.primary === 'slot3' && f.showNextSeries} onclick={onNext}>
          <Icon name="skip" />
          <span>{slot3Label}<small>{f.slot3.name}</small></span>
        </button>
      {/if}
      <button class="key" onclick={onRestart}>
        <Icon name="reset" />
        <span>{$t('restartSeries')}<small>{$t('series')} {restartNumber} {$t('again')}</small></span>
      </button>
    </div>
  {/if}

  <div class="row">
    <button class="key key-row" onclick={onReset}>
      <Icon name="reset" />{$t('reset')}
    </button>
    {#if onShooters}
      <button class="key key-row" onclick={onShooters}>
        <Icon name="users" />{$t('shooters')}<span class="count tnum">{peerCount}</span>
      </button>
    {:else if onJump}
      <button class="key key-row" onclick={onJump} disabled={phase !== 'idle' && phase !== 'stopped'}>
        <Icon name="jump" />{$t('jumpToPosition')}
      </button>
    {/if}
  </div>
</div>

<style>
  .keypad {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: none;
  }

  .main {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    height: clamp(128px, 24dvh, 190px);
  }

  .main.one { grid-template-columns: 1fr; }
  .main.stopped { grid-auto-rows: 1fr; }
  .main.stopped:not(.three) { grid-template-columns: 1fr 1fr; }
  .main.three { height: clamp(220px, 36dvh, 300px); grid-template-rows: 1.15fr 1fr; }
  .main .wide { grid-column: span 2; }

  .main .key span { display: block; }

  .done { cursor: default; color: var(--muted); }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .row .key { min-height: 60px; padding: 12px 16px; }
  .row .key:only-child { grid-column: span 2; }

  .count {
    margin-left: auto;
    font-size: 0.8125rem;
    font-weight: 800;
    color: var(--muted);
  }
</style>
