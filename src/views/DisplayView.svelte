<script>
  import { roomState, timerState, preferences } from '../lib/stores.js'
  import { t, getLocalizedName } from '../lib/i18n.js'
  import { getProgramById } from '../lib/programs/registry.js'
  import { acquireWakeLock, releaseWakeLock } from '../lib/wakeLock.js'
  import { session, rememberRoom, endSession } from '../lib/session.js'
  import ConnectionStatus from '../components/ConnectionStatus.svelte'
  import Display from '../components/ui/Display.svelte'
  import Meter from '../components/ui/Meter.svelte'
  import Icon from '../components/ui/Icon.svelte'
  import { signalFor } from '../lib/signal.js'
  import { seriesLabel, seriesProgress, exerciseFacts, clockText } from '../lib/timer/progress.js'

  let connectionStatus = $state('connected')

  let phase = $derived($timerState.phase)
  let program = $derived(getProgramById($timerState.programId))
  let stage = $derived(program?.stages[$timerState.stageIndex])
  let exercise = $derived(stage?.exercises[$timerState.exerciseIndex])
  let isTrialStage = $derived(stage?.isTrialStage ?? false)
  let hasNextStage = $derived(program && $timerState.stageIndex < program.stages.length - 1)
  let lang = $derived($preferences.lang)
  let nextStageName = $derived.by(() => {
    if (!program || !$timerState.stageComplete) return null
    const nextIdx = $timerState.stageIndex + 1
    if (nextIdx < program.stages.length) return getLocalizedName(program.stages[nextIdx].name, lang)
    return null
  })

  let signal = $derived(signalFor($timerState))
  let progress = $derived(seriesProgress(exercise, $timerState))
  let facts = $derived(exerciseFacts(stage, exercise, $t))

  let stateWord = $derived.by(() => {
    if (phase === 'idle') return $t('waitingForHost')
    if (phase === 'shooting') return $timerState.targetVisible ? $t('targetUp') : $t('targetDown')
    if (phase === 'stopped' && $timerState.stoppedReason === 'programComplete') return $t('programComplete')
    return $t(phase)
  })

  let showing = $derived.by(() => {
    if (stage?.type !== 'duell' || !exercise?.targetVisibleTime || phase !== 'shooting') return null
    const total = Math.ceil(exercise.shotsPerSeries / (exercise.shotsPerShowing || 1))
    return `${$t('showing')} ${$timerState.duelShowingIndex + 1}/${total}`
  })

  let digits = $derived(clockText($timerState, exercise, $preferences.countdownFormat))

  let tone = $derived(
    phase === 'loading' || phase === 'shooting' ? 'live' : phase === 'paused' ? 'paused' : 'rest'
  )

  // Client connection status
  $effect(() => {
    const client = session.client
    if (client) {
      client.onStatusChange((status) => {
        if (status === 'connected') connectionStatus = 'connected'
        else if (status === 'reconnecting') connectionStatus = 'reconnecting'
        else if (status === 'roomClosed') connectionStatus = 'roomClosed'
        else connectionStatus = 'disconnected'
      })
    }
  })

  // Always hold wake lock on display screens
  $effect(() => {
    acquireWakeLock()
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') acquireWakeLock()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      releaseWakeLock()
    }
  })

  function disconnect() {
    rememberRoom({ isHost: false, isSpectator: true })
    endSession()
  }
</script>

<div class="spectator">
  <div class="top-bar">
    <div class="cluster">
      {#if $roomState.code}<span class="pill code tnum">{$roomState.code}</span>{/if}
      <ConnectionStatus status={connectionStatus} variant="pill" />
      <span class="pill muted-pill"><Icon name="screen" />{$t('spectator')}</span>
    </div>
    <button class="btn btn-icon" onclick={disconnect} aria-label={$t('disconnect')}><Icon name="x" /></button>
  </div>

  <div class="notices">
    <ConnectionStatus status={connectionStatus} variant="banner" />
    {#if $timerState.isReshoot && $timerState.reshootPeerName}
      <div class="notice" role="status"><Icon name="reset" /><div>{$t('reshootFor')} {$timerState.reshootPeerName}</div></div>
    {/if}
    {#if $timerState.stageComplete}
      <div class="notice" role="status">
        <Icon name="check" />
        <div>
          {hasNextStage ? $t('stageComplete') : $t('programComplete')}
          {#if nextStageName}<small>{$t('nextStageLabel')}: {nextStageName}</small>{/if}
        </div>
      </div>
    {/if}
  </div>

  <Display lamp={signal.lamp} lit={signal.lit} class="spectator-display">
    <div class="chips">
      <span class="chip">{stateWord}</span>
      {#if isTrialStage}<span class="chip ghost">{$t('trial')}</span>{/if}
      {#if showing}<span class="chip ghost tnum">{showing}</span>{/if}
    </div>

    <div class="cols">
      <div class="info">
        {#if program && stage && exercise}
          <span class="stage">{getLocalizedName(stage.name, lang)}</span>
          <span class="series tnum">{seriesLabel(exercise, $timerState, $t)}{#if stage.exercises.length > 1}, {$t('exercise')} {$timerState.exerciseIndex + 1}/{stage.exercises.length}{/if}</span>
          <span class="sub">{getLocalizedName(program.name, lang)}</span>
          {#if facts.length}<span class="sub tnum facts">{#each facts as fact, i (i)}<span class="fact">{fact}{i < facts.length - 1 ? ',' : ''}</span>{/each}</span>{/if}
        {/if}
      </div>
      <div class="time" data-tone={tone}>
        <span class="digits" style="--chars: {digits.length}">{digits}</span>
      </div>
    </div>

    {#if progress.count > 1}
      <Meter count={progress.count} done={progress.done} current={progress.current} />
    {/if}
  </Display>
</div>

<style>
  .spectator {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: calc(env(safe-area-inset-top, 0px) + 6px) var(--pad-x) calc(env(safe-area-inset-bottom, 0px) + 12px);
  }

  .top-bar { padding: 0 4px; }
  .cluster { flex-wrap: wrap; }
  .code { font-size: 0.9375rem; font-weight: 800; letter-spacing: 0.04em; }
  .muted-pill { color: var(--muted); }

  .notices { display: flex; flex-direction: column; gap: 8px; }
  .notices:not(:empty) { margin-bottom: 10px; }

  .notice {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border-radius: 20px;
    background: var(--fg);
    color: var(--ink);
    font-size: clamp(1rem, 2.4vw, 1.5rem);
    font-weight: 800;
  }

  .notice :global(svg) { width: 1.2em; height: 1.2em; flex: none; }
  .notice small { display: block; font-size: 0.7em; font-weight: 600; color: var(--ink-soft); }

  :global(.spectator-display) { flex: 1; min-height: 0; padding: 30px clamp(18px, 3vw, 36px) clamp(16px, 2.5vw, 28px) !important; }

  .chips { display: flex; gap: 8px; flex-wrap: wrap; flex: none; }

  .chip {
    display: inline-flex;
    align-items: center;
    height: clamp(32px, 5vh, 52px);
    padding: 0 clamp(14px, 2vw, 22px);
    border-radius: 999px;
    background: var(--chip-bg);
    color: var(--chip-fg);
    font-size: clamp(0.9375rem, 2.6vh, 1.5rem);
    font-weight: 800;
  }

  .chip.ghost { background: transparent; box-shadow: inset 0 0 0 2px currentColor; color: var(--sub); }

  /* Portrait: digits on top, context underneath */
  .cols {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column-reverse;
    gap: 12px;
  }

  .info { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: none; }
  .stage { font-size: clamp(1.5rem, 5vw, 3rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; }
  .series { font-size: clamp(1.125rem, 3.4vw, 2rem); font-weight: 800; }
  .sub { font-size: clamp(0.9375rem, 2.4vw, 1.25rem); font-weight: 600; color: var(--sub); }

  .time {
    flex: 1;
    min-height: 0;
    container-type: size;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
  }

  .facts { display: flex; flex-wrap: wrap; column-gap: 0.3em; }
  .fact { white-space: nowrap; }

  .digits {
    font-size: min(calc(100cqw / (var(--chars) * 0.6)), 96cqh);
    white-space: nowrap;
  }

  .time[data-tone='live'] .digits { color: #e4e4e7; }
  .time[data-tone='paused'] .digits { color: var(--muted); }
  .time[data-tone='rest'] .digits { color: var(--faint); }
  :global(.display.lit) .time .digits { color: var(--ink); }

  /* Landscape: context bottom left, digits filling the right */
  @media (orientation: landscape) {
    .cols { flex-direction: row; align-items: stretch; gap: clamp(16px, 3vw, 40px); }
    .info { width: min(34%, 360px); padding-bottom: 6px; align-self: flex-end; }
    .stage { font-size: clamp(1.5rem, 4vh, 3rem); }
    .series { font-size: clamp(1.125rem, 3.4vh, 2.25rem); }
    .sub { font-size: clamp(0.9375rem, 2.4vh, 1.375rem); }
  }
</style>
