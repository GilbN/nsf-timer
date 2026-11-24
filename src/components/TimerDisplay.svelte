<script>
  import { timerState, preferences } from '../lib/stores.js'
  import { t, getLocalizedName } from '../lib/i18n.js'
  import { getProgramById } from '../lib/programs/registry.js'
  import { signalFor } from '../lib/signal.js'
  import { contextFor, seriesLabel, seriesProgress, clockText, exerciseFacts } from '../lib/timer/progress.js'
  import Display from './ui/Display.svelte'
  import Meter from './ui/Meter.svelte'

  /**
   * isHost picks the idle wording: hosts start, shooters wait.
   * live is false while a shooter's connection is down: the last state
   * received may be stale, so the lamp goes off and the display stays dark
   * instead of showing Ild that may no longer be true.
   */
  let { isHost = false, live = true } = $props()

  let ts = $derived($timerState)
  let phase = $derived(ts.phase)
  let lang = $derived($preferences.lang)
  let program = $derived(getProgramById(ts.programId))
  let ctx = $derived(contextFor(program, ts))
  let signal = $derived(live ? signalFor(ts) : { lamp: 'off', lit: false })
  let progress = $derived(seriesProgress(ctx.exercise, ts))

  let stateWord = $derived.by(() => {
    if (!live) return $t('lastReceived')
    if (phase === 'idle') return isHost ? $t('readyToStart') : $t('waitingForHost')
    if (phase === 'shooting') return ts.targetVisible ? $t('targetUp') : $t('targetDown')
    if (phase === 'stopped' && ts.stoppedReason === 'programComplete') return $t('programComplete')
    return $t(phase)
  })

  let showing = $derived.by(() => {
    const ex = ctx.exercise
    if (ctx.stage?.type !== 'duell' || !ex?.targetVisibleTime || phase !== 'shooting') return null
    const total = Math.ceil(ex.shotsPerSeries / (ex.shotsPerShowing || 1))
    return `${$t('showing')} ${ts.duelShowingIndex + 1}/${total}`
  })

  let digits = $derived(clockText(ts, ctx.exercise, $preferences.countdownFormat))

  // "Øvelse 2/3, Serie 2/4" in stages with several exercises
  let position = $derived.by(() => {
    const series = seriesLabel(ctx.exercise, ts, $t)
    const count = ctx.stage?.exercises.length ?? 0
    return count > 1 ? `${$t('exercise')} ${ts.exerciseIndex + 1}/${count}, ${series}` : series
  })

  // Loading, hidden/visible or time per series, and shots, so everyone can
  // tell which exercise is next before the targets turn
  let facts = $derived(exerciseFacts(ctx.stage, ctx.exercise, $t))

  // How bright the digits are when the display is dark
  let tone = $derived(
    !live ? 'rest' : phase === 'loading' || phase === 'shooting' ? 'live' : phase === 'paused' ? 'paused' : 'rest'
  )
</script>

<Display lamp={signal.lamp} lit={signal.lit} class="timer-display">
  <div class="line">
    <span class="stage">{ctx.stage ? getLocalizedName(ctx.stage.name, lang) : ''}</span>
    <span class="sub tnum">{position}</span>
  </div>
  <div class="line">
    <span class="chips">
      <span class="chip">{stateWord}</span>
      {#if ctx.stage?.isTrialStage}<span class="chip ghost">{$t('trial')}</span>{/if}
    </span>
    <span class="sub ellipsis">{program ? getLocalizedName(program.name, lang) : ''}</span>
  </div>

  <div class="time" data-tone={tone}>
    <span class="digits" style="--chars: {digits.length}" aria-live="off">{digits}</span>
  </div>

  {#if showing || facts.length}
    <div class="line facts">
      <!-- Each fact stays whole; the line wraps between them at big text sizes -->
      <span class="sub tnum fact-list">{#each facts as fact, i (i)}<span class="fact">{fact}{i < facts.length - 1 ? ',' : ''}</span>{/each}</span>
      {#if showing}<span class="sub tnum">{showing}</span>{/if}
    </div>
  {/if}
  {#if progress.count > 1}
    <Meter count={progress.count} done={progress.done} current={progress.current} />
  {/if}
</Display>

<style>
  :global(.timer-display) { flex: 1; min-height: 0; }

  .line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    font-size: 0.875rem;
    font-weight: 700;
    min-width: 0;
    flex: none;
  }

  .stage { font-size: 1rem; font-weight: 800; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { color: var(--sub); font-weight: 600; white-space: nowrap; }
  .ellipsis { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .facts { font-size: 0.8125rem; align-items: flex-start; }
  .fact-list { display: flex; flex-wrap: wrap; column-gap: 0.3em; white-space: normal; min-width: 0; }
  .fact { white-space: nowrap; }
  .chips { display: flex; gap: 6px; flex: none; }

  .chip {
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 13px;
    border-radius: 999px;
    background: var(--chip-bg);
    color: var(--chip-fg);
    font-size: 0.8125rem;
    font-weight: 800;
  }

  .chip.ghost { background: transparent; box-shadow: inset 0 0 0 1.5px currentColor; color: var(--sub); }

  /* The digits fill whatever room the display has, in any layout */
  /* The digits always keep this much height; the display grows around it */
  .time {
    flex: 1;
    min-height: clamp(96px, 20dvh, 220px);
    container-type: size;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .digits {
    font-size: min(calc(100cqw / (var(--chars) * 0.6)), 92cqh);
    white-space: nowrap;
  }

  .time[data-tone='live'] .digits { color: #e4e4e7; }
  .time[data-tone='paused'] .digits { color: var(--soft); }
  .time[data-tone='rest'] .digits { color: var(--muted); }
  :global(.display.lit) .time .digits { color: var(--ink); }
</style>
