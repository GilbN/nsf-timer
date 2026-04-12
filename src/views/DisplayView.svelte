<script>
  import { currentView, roomState, timerState, preferences, formattedTime } from '../lib/stores.js'
  import { t, getLocalizedName } from '../lib/i18n.js'
  import { getProgramById } from '../lib/programs/registry.js'
  import { acquireWakeLock, releaseWakeLock } from '../lib/wakeLock.js'
  import { clearRoomState, clearTimerState, addRoomToHistory, loadRoomState } from '../lib/storage.js'
  import ConnectionStatus from '../components/ConnectionStatus.svelte'

  let connectionStatus = $state('connected')

  let phase = $derived($timerState.phase)
  let isTargetUp = $derived($timerState.targetVisible && phase === 'shooting')
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

  // Client connection status
  $effect(() => {
    const client = window.__opkClient
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
    if ($roomState.code) {
      const savedRoom = loadRoomState()
      addRoomToHistory({
        code: $roomState.code,
        isHost: false,
        isSpectator: true,
        name: savedRoom?.name,
        lane: savedRoom?.lane,
      })
    }
    if (window.__opkClient) {
      window.__opkClient.destroy()
      window.__opkClient = null
    }
    clearTimerState()
    clearRoomState()
    currentView.set('home')
  }
</script>

<div
  class="display-view"
  class:phase-loading={phase === 'loading'}
  class:phase-shooting={phase === 'shooting'}
  class:phase-paused={phase === 'paused'}
  class:phase-stopped={phase === 'stopped'}
  class:target-up={isTargetUp}
  class:target-down={!isTargetUp && phase === 'shooting'}
  class:trial={isTrialStage}
>
  <!-- Top bar -->
  <div class="top-bar">
    <div class="top-left">
      {#if $roomState.code}
        <span class="room-code">{$roomState.code}</span>
      {/if}
      <ConnectionStatus status={connectionStatus} variant="dot" />
      <span class="spectator-label">{$t('spectator')}</span>
    </div>
    <button class="disconnect-btn" onclick={disconnect}>✕</button>
  </div>

  <!-- Main display area -->
  <div class="display-body">
    <!-- Stage/program complete banner — full width, above everything -->
    {#if $timerState.stageComplete}
      <div class="complete-banner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        {#if hasNextStage}
          {$t('stageComplete')}
        {:else}
          {$t('programComplete')}
        {/if}
        {#if nextStageName}
          <span class="next-stage-hint">→ {nextStageName}</span>
        {/if}
      </div>
    {/if}

    <!-- Phase banner — full width, above both columns -->
    {#if phase !== 'idle'}
      <div class="phase-banner">
        <span class="phase-rule"></span>
        <span class="phase-text">{$t(phase)}</span>
        <span class="phase-rule"></span>
      </div>
    {/if}

    <!-- Reshoot badge — full width, above both columns -->
    {#if $timerState.isReshoot && $timerState.reshootPeerName}
      <div class="reshoot-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
        {$t('reshootFor')} {$timerState.reshootPeerName}
      </div>
    {/if}

    <!-- Columns row -->
    <div class="display-cols">
    <!-- Timer column -->
    <div class="timer-col">
      <!-- Target indicator -->
      {#if phase === 'shooting'}
        <div class="target-indicator" class:up={isTargetUp}>
          {#if isTargetUp}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="6"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
            {$t('targetUp')}
          {:else}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-dasharray="3 3"/>
            </svg>
            {$t('targetDown')}
          {/if}
        </div>
      {:else if phase === 'idle'}
        <div class="waiting-text">{$t('waitingForHost')}</div>
      {/if}

      <!-- Countdown digits -->
      <div class="time" class:glow={isTargetUp} class:minsec={$preferences.countdownFormat !== 'seconds'}>
        {#if $preferences.countdownFormat === 'seconds'}
          <span class="digits">{$formattedTime.totalSeconds}</span>
        {:else}
          <span class="digits">{$formattedTime.minutes}</span>
          <span class="colon">:</span>
          <span class="digits">{$formattedTime.seconds}</span>
        {/if}
      </div>
    </div>

    <!-- Info column (visible in landscape) -->
    <div class="info-col">
      {#if program && stage && exercise}
        <div class="info-program">{getLocalizedName(program.name, lang)}</div>
        <div class="info-stage" class:trial={isTrialStage}>
          {getLocalizedName(stage.name, lang)}
        </div>
        {#if stage.exercises.length > 1}
          <div class="info-row">{$t('exercise')} {$timerState.exerciseIndex + 1} / {stage.exercises.length}</div>
        {/if}
        <div class="info-row">
          {$t('series')} {$timerState.seriesIndex + 1} / {exercise.seriesCount}
          {#if exercise.shotsPerSeries}
            &nbsp;· {exercise.shotsPerSeries}{lang === 'no' ? 'sk' : 'sh'}
          {/if}
        </div>
        {#if stage.type === 'duell' && exercise.targetVisibleTime && phase === 'shooting'}
          <div class="info-row duel">
            {$t('showing')} {$timerState.duelShowingIndex + 1} / {Math.ceil(exercise.shotsPerSeries / exercise.shotsPerShowing)}
          </div>
        {/if}
      {/if}

    </div>
    </div><!-- end display-cols -->
  </div>
</div>

<style>
  .display-view {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    transition: background 0.4s ease;
    overflow: hidden;
    padding: env(safe-area-inset-top, 0) env(safe-area-inset-right, 0)
             env(safe-area-inset-bottom, 0) env(safe-area-inset-left, 0);
  }

  /* Phase background tints */
  .phase-loading  { background: var(--phase-loading-bg); }
  .phase-shooting { background: var(--phase-shooting-bg); }
  .phase-paused   { background: var(--phase-paused-bg); }
  .phase-stopped  { background: var(--phase-stopped-bg); }
  .target-up      { background: rgba(0, 230, 118, 0.07); }
  .target-down    { background: rgba(244, 67, 54, 0.07); }

  /* ── Top bar ── */
  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 1rem;
    flex-shrink: 0;
    gap: 0.5rem;
  }

  .top-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .room-code {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 900;
    letter-spacing: 0.22em;
    color: var(--accent);
    opacity: 0.8;
  }

  .spectator-label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-secondary);
    opacity: 0.5;
  }

  .disconnect-btn {
    background: transparent;
    color: var(--text-secondary);
    font-size: 1rem;
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius);
    opacity: 0.35;
    transition: opacity 0.15s, color 0.15s;
    min-height: unset;
  }

  .disconnect-btn:hover {
    opacity: 1;
    color: var(--danger);
  }

  /* ── Main display body ── */
  .display-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 0;
    gap: 0.75rem;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  /* ── Columns row (timer + info side by side in landscape) ── */
  .display-cols {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 0;
    width: 100%;
  }

  /* ── Timer column ── */
  .timer-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    flex: 1;
    min-height: 0;
    width: 100%;
  }

  /* ── Phase banner ── */
  .phase-banner {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
  }

  .phase-rule {
    flex: 1;
    height: 1px;
    opacity: 0.4;
  }

  .phase-text {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.35em;
    text-transform: uppercase;
  }

  .phase-loading  .phase-rule { background: var(--phase-loading); }
  .phase-loading  .phase-text { color: var(--phase-loading); }
  .phase-shooting .phase-rule { background: var(--phase-shooting); }
  .phase-shooting .phase-text { color: var(--phase-shooting); }
  .phase-paused   .phase-rule { background: var(--phase-paused); }
  .phase-paused   .phase-text { color: var(--phase-paused); }
  .phase-stopped  .phase-rule { background: var(--phase-stopped); }
  .phase-stopped  .phase-text { color: var(--phase-stopped); }

  /* Trial stage: amber phase color */
  .trial.phase-loading  .phase-rule,
  .trial.phase-shooting .phase-rule,
  .trial.phase-stopped  .phase-rule,
  .trial.phase-paused   .phase-rule { background: var(--warning); }
  .trial.phase-loading  .phase-text,
  .trial.phase-shooting .phase-text,
  .trial.phase-stopped  .phase-text,
  .trial.phase-paused   .phase-text { color: var(--warning); }

  /* ── Reshoot badge ── */
  .reshoot-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: clamp(1rem, 2.5vw, 1.5rem);
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--warning);
    padding: 0.4rem 1.2rem;
    background: rgba(255, 181, 71, 0.1);
    border: 1px solid rgba(255, 181, 71, 0.25);
    border-radius: 100px;
  }

  .reshoot-badge svg {
    width: 1.1em;
    height: 1.1em;
    flex-shrink: 0;
  }

  /* ── Target indicator ── */
  .target-indicator {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: clamp(1.2rem, 3vw, 2.2rem);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.5rem 1.5rem;
    border-radius: 100px;
    background: rgba(244, 67, 54, 0.12);
    color: var(--target-down);
    border: 1px solid rgba(244, 67, 54, 0.25);
  }

  .target-indicator.up {
    background: rgba(0, 230, 118, 0.12);
    color: var(--target-up);
    border-color: rgba(0, 230, 118, 0.3);
  }

  .target-indicator svg {
    width: 1em;
    height: 1em;
    flex-shrink: 0;
  }

  /* ── Waiting text ── */
  .waiting-text {
    font-size: clamp(1rem, 2.5vw, 1.5rem);
    color: var(--text-secondary);
    letter-spacing: 0.06em;
  }

  /* ── Countdown digits ── */
  .time {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.02em;
    transition: color 0.4s ease;
  }

  .digits {
    font-family: var(--font-mono);
    font-size: clamp(10rem, 38vw, 35em);
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    color: var(--text-primary);
    transition: color 0.4s ease, text-shadow 0.4s ease;
  }

  .colon {
    font-family: var(--font-mono);
    font-size: clamp(6rem, 22vw, 24rem);
    font-weight: 900;
    line-height: 1;
    color: var(--text-secondary);
    align-self: baseline;
    margin-bottom: 0.03em;
    transition: color 0.4s ease;
  }

  /* Min:sec format: each span holds 2 chars so scale down proportionally */
  .time.minsec .digits { font-size: clamp(4rem, 20vw, 20rem); }
  .time.minsec .colon  { font-size: clamp(3rem, 13vw, 14rem); }

  /* Digit colors by phase */
  .phase-loading  .digits,
  .phase-loading  .colon  { color: var(--phase-loading); }
  .phase-shooting .digits { color: var(--phase-shooting); }
  .phase-shooting .colon  { color: var(--phase-shooting); opacity: 0.5; }
  .target-down    .digits { color: var(--target-down); }
  .target-down    .colon  { color: var(--target-down); opacity: 0.5; }
  .phase-paused   .digits { color: var(--phase-paused); }
  .phase-paused   .colon  { color: var(--phase-paused); opacity: 0.4; }
  .phase-stopped  .digits { color: var(--phase-stopped); }
  .phase-stopped  .colon  { color: var(--phase-stopped); }

  .time.glow .digits {
    color: var(--accent);
    animation: glow-green 2s ease-in-out infinite;
  }

  /* ── Info column ── */
  .info-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding-bottom: 0.5rem;
  }

  .complete-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 1.2rem;
    background: rgba(0, 230, 118, 0.08);
    color: var(--accent);
    font-weight: 700;
    font-size: clamp(0.9rem, 2vw, 1.4rem);
    border-radius: var(--radius);
    border: 1px solid rgba(0, 230, 118, 0.2);
    letter-spacing: 0.04em;
    width: 100%;
    justify-content: center;
  }

  .complete-banner svg {
    width: 1em;
    height: 1em;
    flex-shrink: 0;
  }

  .next-stage-hint {
    opacity: 0.65;
    font-weight: 500;
  }

  .info-program {
    font-size: clamp(2.6rem, 6.5vh, 7.5rem);
    font-weight: 700;
    color: var(--text-primary);
    text-align: center;
  }

  .info-stage {
    font-size: clamp(0.85rem, 2vw, 1.4rem);
    font-weight: 600;
    color: var(--accent);
    text-align: center;
    letter-spacing: 0.02em;
  }

  .info-stage.trial { color: var(--warning); }

  .info-row {
    font-size: clamp(0.8rem, 1.8vw, 1.2rem);
    font-weight: 500;
    color: var(--text-secondary);
    text-align: center;
    letter-spacing: 0.03em;
  }

  .info-row.duel { color: var(--warning); }

  /* Portrait-only element: hide in landscape */
  .portrait-only { display: flex; }

  /* ── Landscape layout: side-by-side ── */
  @media (orientation: landscape) {
    .display-body {
      justify-content: flex-start;
      gap: 0.5rem;
      padding: 0.5rem 1.5rem 1rem;
    }

    .display-cols {
      flex-direction: row;
      align-items: center;
      gap: 0;
      justify-content: center;
    }

    .timer-col {
      flex: 3;
    }

    .info-col {
      flex: 1;
      align-items: flex-start;
      justify-content: center;
      padding: 1rem 0.5rem 1rem 2rem;
      border-left: 1px solid rgba(255, 255, 255, 0.05);
      min-height: 0;
      align-self: stretch;
    }

    /* In landscape, hide portrait-only items */
    .portrait-only { display: none; }

    /* Slightly smaller digits in landscape since height is the constraint */
    .digits {
      font-size: clamp(6rem, 30vh, 28rem);
    }

    .colon {
      font-size: clamp(5rem, 24vh, 22rem);
    }

    .time.minsec .digits { font-size: clamp(4rem, 18vh, 18rem); }
    .time.minsec .colon  { font-size: clamp(3rem, 12vh, 12rem); }

    .target-indicator {
      font-size: clamp(1rem, 3vh, 2rem);
    }

    .reshoot-badge {
      font-size: clamp(0.9rem, 2.5vh, 1.4rem);
    }

    .info-col { gap: 0.9rem; }
    .info-program { font-size: clamp(1.6rem, 5.5vh, 3.5rem); text-align: left; line-height: 1.1; }
    .info-stage   { font-size: clamp(1.2rem, 4vh, 2.6rem); text-align: left; line-height: 1.15; }
    .info-row     { font-size: clamp(1rem, 3vh, 1.9rem); text-align: left; }
  }
</style>
