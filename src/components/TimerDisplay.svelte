<script>
  import { timerState, preferences } from '../lib/stores.js'
  import { t, getLocalizedName } from '../lib/i18n.js'
  import { getProgramById } from '../lib/programs/registry.js'
  import { signalFor } from '../lib/signal.js'
  import { contextFor, seriesLabel, seriesProgress, clockText } from '../lib/timer/progress.js'
  import Display from './ui/Display.svelte'
  import Meter from './ui/Meter.svelte'

  /** isHost picks the idle wording: hosts start, shooters wait. */
  let { isHost = false } = $props()

  let ts = $derived($timerState)
  let phase = $derived(ts.phase)
  let lang = $derived($preferences.lang)
  let program = $derived(getProgramById(ts.programId))
  let ctx = $derived(contextFor(program, ts))
  let signal = $derived(signalFor(ts))
  let progress = $derived(seriesProgress(ctx.exercise, ts))

  let stateWord = $derived.by(() => {
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

  // How bright the digits are when the display is dark
  let tone = $derived(
    phase === 'loading' || phase === 'shooting' ? 'live' : phase === 'paused' ? 'paused' : 'rest'
  )
</script>

<Display lamp={signal.lamp} lit={signal.lit} class="timer-display">
  <div class="line">
    <span class="stage">{ctx.stage ? getLocalizedName(ctx.stage.name, lang) : ''}</span>
    <span class="sub tnum">{seriesLabel(ctx.exercise, ts, $t)}</span>
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

  {#if showing}<div class="line"><span class="sub tnum">{showing}</span></div>{/if}
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
  .time {
    flex: 1;
    min-height: 0;
    container-type: size;
    display: flex;
    align-items: flex-end;
  }

  .digits {
    font-size: min(calc(100cqw / (var(--chars) * 0.6)), 92cqh);
    white-space: nowrap;
  }

  .time[data-tone='live'] .digits { color: #e4e4e7; }
  .time[data-tone='paused'] .digits { color: var(--muted); }
  .time[data-tone='rest'] .digits { color: var(--faint); }
  :global(.display.lit) .time .digits { color: var(--ink); }
</style>
