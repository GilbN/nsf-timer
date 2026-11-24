<script>
  import { get } from 'svelte/store'
  import { currentView, roomState, timerState, preferences } from '../lib/stores.js'
  import { t, getLocalizedName } from '../lib/i18n.js'
  import { confirmAction } from '../lib/confirm.js'
  import { getProgramById } from '../lib/programs/registry.js'
  import { saveTimerState, saveRoomState, clearTimerState, loadRoomState } from '../lib/storage.js'
  import { session, stopScheduler, rememberRoom, endSession } from '../lib/session.js'
  import { setSoundEnabled, beepStart, beepStop, beepTargetUp, beepTargetDown } from '../lib/audio.js'
  import { acquireWakeLock, releaseWakeLock } from '../lib/wakeLock.js'
  import TimerDisplay from '../components/TimerDisplay.svelte'
  import ControlBar from '../components/ControlBar.svelte'
  import PeerList from '../components/PeerList.svelte'
  import RoomCode from '../components/RoomCode.svelte'
  import ConnectionStatus from '../components/ConnectionStatus.svelte'
  import SettingsMenu from '../components/SettingsMenu.svelte'
  import JumpToModal from '../components/JumpToModal.svelte'
  import Icon from '../components/ui/Icon.svelte'
  import { contextFor } from '../lib/timer/progress.js'

  // Capture role at mount time so it's stable even if roomState changes on disconnect
  const initialIsHost = get(roomState).isHost
  const initialIsClient = !initialIsHost && (!!get(roomState).code || !!session.client)
  let isHost = $derived($roomState.isHost || initialIsHost)
  let program = $derived(getProgramById($timerState.programId))
  let hasNextStage = $derived(program && $timerState.stageIndex < program.stages.length - 1)
  let connectionStatus = $state('connected')

  // Persist timer state on changes (host only)
  $effect(() => {
    if (isHost && $timerState.programId) {
      saveTimerState($timerState)
    }
  })

  // Sync sound preference
  $effect(() => {
    setSoundEnabled($preferences.soundEnabled)
  })

  // Client-side audio: mirror the beeps that the host fires via TimerScheduler
  if (initialIsClient) {
    let prevPhase = get(timerState).phase
    let prevTargetVisible = get(timerState).targetVisible

    $effect(() => {
      const { phase, targetVisible } = $timerState

      if (phase !== prevPhase) {
        if (phase === 'loading' || phase === 'shooting') beepStart()
        else if (phase === 'stopped' && (prevPhase === 'loading' || prevPhase === 'shooting')) beepStop()
      }

      if (phase === 'shooting' && targetVisible !== prevTargetVisible) {
        if (targetVisible) beepTargetUp()
        else beepTargetDown()
      }

      prevPhase = phase
      prevTargetVisible = targetVisible
    })
  }

  // Client connection status handling
  $effect(() => {
    const client = session.client
    if (client) {
      client.onStatusChange((status) => {
        if (status === 'connected') {
          connectionStatus = 'connected'
        } else if (status === 'reconnecting') {
          connectionStatus = 'reconnecting'
        } else if (status === 'roomClosed') {
          connectionStatus = 'roomClosed'
        } else {
          connectionStatus = 'disconnected'
        }
      })
    }
  })

  // Derived so the effects below only re-run when the answer changes,
  // not on every timer update.
  let holdWakeLock = $derived(
    $preferences.wakeLockEnabled || $timerState.phase === 'loading' || $timerState.phase === 'shooting'
  )

  // Effect: acquire/release based on phase or manual toggle
  $effect(() => {
    if (holdWakeLock) {
      acquireWakeLock()
    } else {
      releaseWakeLock()
    }
  })

  // Effect: re-acquire after OS revocation (battery saver, interruption)
  $effect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && holdWakeLock) {
        acquireWakeLock()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      releaseWakeLock()
    }
  })

  function handleStart() { session.scheduler?.startSeries() }
  function handleRestart() { session.scheduler?.restartSeries() }
  function handleNextSeries() { session.scheduler?.nextSeries() }
  function handlePause() { session.scheduler?.pause() }
  function handleResume() { session.scheduler?.resume() }
  function handleStop() { session.scheduler?.stop() }
  function handleNext() { session.scheduler?.nextExercise() }

  let showJumpModal = $state(false)
  let showPeerModal = $state(false)

  async function handleReset() {
    if (!(await confirmAction(get(t)('confirmReset'), get(t)('reset')))) return
    session.scheduler?.reset()
    session.host?.resetAllJams()
    clearTimerState()
  }

  function handleReshoot(peer) {
    const host = session.host
    const scheduler = session.scheduler
    if (!host || !scheduler) return

    const stageKey = scheduler.getCurrentStageKey()
    if (!host.canPeerDeclareJam(peer.peerId, stageKey)) return

    host.recordJam(peer.peerId, stageKey)
    const label = peer.name || `#${peer.lane}` || peer.peerId.slice(-4)
    scheduler.startReshoot(label)
  }

  async function changeProgram() {
    if (!(await confirmAction(get(t)('confirmChangeProgram'), get(t)('changeProgram')))) return
    stopScheduler()
    session.host?.resetAllJams()
    clearTimerState()
    saveRoomState({ code: $roomState.code, isHost: true, isSolo: $roomState.isSolo, hostToken: session.host?.hostToken })
    currentView.set('lobby')
  }

  // What this shooter joined as, for the info tiles
  const me = initialIsClient ? (loadRoomState() ?? {}) : {}
  let ctx = $derived(contextFor(program, $timerState))
  let showingText = $derived.by(() => {
    const ex = ctx.exercise
    if (ctx.stage?.type !== 'duell' || !ex?.targetVisibleTime) return null
    const total = Math.ceil(ex.shotsPerSeries / (ex.shotsPerShowing || 1))
    return `${Math.min($timerState.duelShowingIndex + 1, total)}/${total}`
  })
  let nextStageName = $derived.by(() => {
    const next = program?.stages[$timerState.stageIndex + 1]
    return next ? getLocalizedName(next.name, $preferences.lang) : null
  })
  let canChangeCourse = $derived($timerState.phase === 'idle' || $timerState.phase === 'stopped')

  // Utilities live in the ⋯ menu so the screen only holds match controls
  let menuActions = $derived([
    ...(isHost && canChangeCourse ? [
      { id: 'change', label: $t('changeProgram'), icon: 'list', onSelect: changeProgram },
      { id: 'jump', label: $t('jumpToPosition'), icon: 'jump', onSelect: () => (showJumpModal = true) },
    ] : []),
    { id: 'refresh', label: $t('refresh'), icon: 'refresh', onSelect: () => window.location.reload() },
    { id: 'disconnect', label: $t('disconnect'), icon: 'logout', onSelect: disconnect, danger: true },
  ])

  async function disconnect() {
    if (!(await confirmAction(get(t)('confirmDisconnect'), get(t)('disconnect')))) return
    rememberRoom({ programId: $timerState.programId })
    endSession()
  }
</script>

<div class="view timer-view">
  <div class="top-bar">
    <div class="cluster">
      {#if $roomState.isSolo}
        <span class="pill">{$t('soloMode')}</span>
      {:else if $roomState.code}
        <RoomCode code={$roomState.code ?? ''} />
      {/if}
      {#if initialIsClient}
        <ConnectionStatus status={connectionStatus} variant="pill" />
      {/if}
    </div>
    <div class="cluster">
      {#if isHost && !$roomState.isSolo}
        <span class="pill tnum" aria-label="{$roomState.connectedPeers.length} {$t('peers')}">
          <span class="led" class:off={$roomState.connectedPeers.length === 0}></span>{$roomState.connectedPeers.length}
          <Icon name="users" />
        </span>
      {/if}
      <SettingsMenu actions={menuActions} />
    </div>
  </div>

  <div class="notices">
    {#if initialIsClient}
      <ConnectionStatus status={connectionStatus} variant="banner" />
    {/if}
    {#if $timerState.isReshoot && $timerState.reshootPeerName}
      <div class="notice" role="status">
        <Icon name="reset" />
        <div>{$t('reshootFor')} {$timerState.reshootPeerName}</div>
      </div>
    {/if}
    {#if $timerState.stageComplete}
      <div class="notice" role="status">
        <Icon name="check" />
        <div>
          {hasNextStage ? $t('stageComplete') : $t('programComplete')}
          {#if hasNextStage && nextStageName}<small>{$t('nextStageLabel')}: {nextStageName}</small>{/if}
        </div>
      </div>
    {/if}
  </div>

  <div class="body">
    <TimerDisplay {isHost} />

    <div class="panel">
      {#if isHost}
        <ControlBar
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          onRestart={handleRestart}
          onNextSeries={handleNextSeries}
          onNext={handleNext}
          onReset={handleReset}
          onShooters={$roomState.isSolo ? undefined : () => (showPeerModal = true)}
          peerCount={$roomState.connectedPeers?.length ?? 0}
          onJump={$roomState.isSolo ? () => (showJumpModal = true) : undefined}
        />
      {:else}
        <!-- Shooters can't control the timer: flat tiles answer what they ask between series -->
        <div class="tiles">
          <div class="tile"><small>{$t('shooter')}</small><b>{me.name || $t('anonymous')}</b></div>
          <div class="tile"><small>{$t('lane')}</small><b class="tnum">{me.lane || '–'}</b></div>
          {#if showingText}
            <div class="tile"><small>{$t('showing')}</small><b class="tnum">{showingText}</b></div>
          {:else}
            <div class="tile"><small>{$t('series')}</small><b class="tnum">{ctx.exercise ? `${Math.min($timerState.seriesIndex + 1, ctx.exercise.seriesCount)}/${ctx.exercise.seriesCount}` : '–'}</b></div>
          {/if}
          <div class="tile"><small>{$t('program')}</small><b>{program ? getLocalizedName(program.name, $preferences.lang) : '–'}</b></div>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if showJumpModal && program}
  <JumpToModal {program} onClose={() => (showJumpModal = false)} />
{/if}

{#if showPeerModal}
  <PeerList onReshoot={handleReshoot} onClose={() => (showPeerModal = false)} />
{/if}

<style>
  .notices {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 var(--pad-x);
  }

  .notices:not(:empty) { margin-bottom: 10px; }

  .notice {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 20px;
    background: var(--fg);
    color: var(--ink);
    font-size: 0.9375rem;
    font-weight: 800;
  }

  .notice :global(svg) { width: 20px; height: 20px; flex: none; }
  .notice small { display: block; font-size: 0.75rem; font-weight: 600; color: var(--ink-soft); }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 var(--pad-x);
  }

  .panel { flex: none; }

  .tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-auto-rows: minmax(68px, 1fr);
    gap: 8px;
    height: clamp(150px, 26dvh, 210px);
  }

  /* Landscape tablets: display on the left, keys on the right */
  @media (orientation: landscape) and (min-width: 700px) {
    .timer-view { max-width: 1100px; }
    .body { flex-direction: row; align-items: stretch; }
    .panel { width: min(44%, 440px); display: flex; flex-direction: column; justify-content: flex-end; }
    .tiles { height: auto; flex: 1; }
  }

  /* Short landscape phones: keep the keys compact */
  @media (orientation: landscape) and (max-height: 500px) {
    .body { flex-direction: row; }
    .panel { width: 46%; display: flex; flex-direction: column; justify-content: flex-end; }
  }
</style>
