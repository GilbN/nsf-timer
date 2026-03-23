<script>
  import { get } from 'svelte/store'
  import { currentView, roomState, timerState, preferences } from '../lib/stores.js'
  import { t, getLocalizedName } from '../lib/i18n.js'
  import { getProgramById } from '../lib/programs/registry.js'
  import { saveTimerState, saveRoomState, savePreferences, clearTimerState, clearRoomState, addRoomToHistory, loadRoomState } from '../lib/storage.js'
  import { setSoundEnabled } from '../lib/audio.js'
  import { acquireWakeLock, releaseWakeLock } from '../lib/wakeLock.js'
  import TimerDisplay from '../components/TimerDisplay.svelte'
  import SeriesProgress from '../components/SeriesProgress.svelte'
  import ControlBar from '../components/ControlBar.svelte'
  import PeerList from '../components/PeerList.svelte'
  import RoomCode from '../components/RoomCode.svelte'
  import ConnectionStatus from '../components/ConnectionStatus.svelte'
  import LangToggle from '../components/LangToggle.svelte'
  import FontSizeToggle from '../components/FontSizeToggle.svelte'

  // Capture role at mount time so it's stable even if roomState changes on disconnect
  const initialIsHost = get(roomState).isHost
  const initialIsClient = !initialIsHost && (!!get(roomState).code || !!window.__opkClient)
  let isHost = $derived($roomState.isHost || initialIsHost)
  let program = $derived(getProgramById($timerState.programId))
  let stage = $derived(program?.stages[$timerState.stageIndex])
  let connectionStatus = $state('connected')

  // Persist timer state on changes (host only)
  $effect(() => {
    if (isHost && $timerState.phase !== 'idle') {
      saveTimerState($timerState)
    }
  })

  // Sync sound preference
  $effect(() => {
    setSoundEnabled($preferences.soundEnabled)
  })

  // Client connection status handling
  $effect(() => {
    const client = window.__opkClient
    if (client) {
      client.onStatusChange((status) => {
        if (status === 'connected') {
          connectionStatus = 'connected'
        } else if (status === 'reconnecting') {
          connectionStatus = 'reconnecting'
        } else if (status === 'roomClosed') {
          connectionStatus = 'disconnected'
        } else {
          connectionStatus = 'disconnected'
        }
      })
    }
  })

  function shouldHoldWakeLock() {
    const phase = $timerState.phase
    return $preferences.wakeLockEnabled || phase === 'loading' || phase === 'shooting'
  }

  // Effect: acquire/release based on phase or manual toggle
  $effect(() => {
    if (shouldHoldWakeLock()) {
      acquireWakeLock()
    } else {
      releaseWakeLock()
    }
  })

  // Effect: re-acquire after OS revocation (battery saver, interruption)
  $effect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && shouldHoldWakeLock()) {
        acquireWakeLock()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      releaseWakeLock()
    }
  })

  function toggleWakeLock() {
    preferences.update((p) => {
      const updated = { ...p, wakeLockEnabled: !p.wakeLockEnabled }
      savePreferences(updated)
      return updated
    })
  }

  function handleStart() { window.__opkScheduler?.startSeries() }
  function handlePause() { window.__opkScheduler?.pause() }
  function handleResume() { window.__opkScheduler?.resume() }
  function handleStop() { window.__opkScheduler?.stop() }
  function handleNext() { window.__opkScheduler?.nextExercise() }

  function handleReset() {
    if (!confirm(get(t)('confirmReset'))) return
    window.__opkScheduler?.reset()
    window.__opkHost?.resetAllJams()
    clearTimerState()
  }

  function handleReshoot(peer) {
    const host = window.__opkHost
    const scheduler = window.__opkScheduler
    if (!host || !scheduler) return

    const stageKey = scheduler.getCurrentStageKey()
    if (!host.canPeerDeclareJam(peer.peerId, stageKey)) return

    host.recordJam(peer.peerId, stageKey)
    const label = peer.name || `#${peer.lane}` || peer.peerId.slice(-4)
    scheduler.startReshoot(label)
  }

  function toggleSound() {
    preferences.update((p) => ({ ...p, soundEnabled: !p.soundEnabled }))
  }

  function changeProgram() {
    if (!confirm(get(t)('confirmChangeProgram'))) return
    if (window.__opkScheduler) {
      window.__opkScheduler.destroy()
      window.__opkScheduler = null
    }
    window.__opkHost?.resetAllJams()
    clearTimerState()
    saveRoomState({ code: $roomState.code, isHost: true })
    currentView.set('lobby')
  }

  function disconnect() {
    if (!confirm(get(t)('confirmDisconnect'))) return
    if ($roomState.code) {
      const savedRoom = loadRoomState()
      addRoomToHistory({
        code: $roomState.code,
        isHost: $roomState.isHost,
        programId: $timerState.programId,
        name: savedRoom?.name,
        lane: savedRoom?.lane,
      })
    }
    if (window.__opkScheduler) {
      window.__opkScheduler.destroy()
      window.__opkScheduler = null
    }
    if (window.__opkHost) {
      window.__opkHost.destroy()
      window.__opkHost = null
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

<div class="view timer-view">
  <!-- Top bar -->
  <div class="top-bar">
    {#if $roomState.code}
      <RoomCode code={$roomState.code} />
    {/if}
    {#if initialIsClient}
      <ConnectionStatus status={connectionStatus} variant="dot" />
    {/if}
    <div class="top-actions">
      <button class="icon-btn" class:active={$preferences.wakeLockEnabled} onclick={toggleWakeLock} title={$t('keepAwake')}>
        {#if $preferences.wakeLockEnabled}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        {/if}
      </button>
      <button class="icon-btn" onclick={toggleSound} title={$t('sound')}>
        {#if $preferences.soundEnabled}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        {/if}
      </button>
      <FontSizeToggle />
      <LangToggle />
    </div>
  </div>

  <!-- Connection status banner (clients only, non-connected states) -->
  {#if initialIsClient}
    <ConnectionStatus status={connectionStatus} variant="banner" />
  {/if}

  <!-- Reshoot banner -->
  {#if $timerState.isReshoot && $timerState.reshootPeerName}
    <div class="reshoot-banner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="reshoot-icon">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
      {$t('reshootFor')} {$timerState.reshootPeerName}
    </div>
  {/if}

  <!-- Timer centrepiece -->
  <div class="timer-area">
    <TimerDisplay />
  </div>

  <!-- Series info -->
  <SeriesProgress />

  <!-- Controls -->
  {#if isHost}
    <ControlBar
      onStart={handleStart}
      onPause={handlePause}
      onResume={handleResume}
      onStop={handleStop}
      onNext={handleNext}
      onReset={handleReset}
    />
    {#if $roomState.connectedPeers?.length > 0}
      <PeerList onReshoot={handleReshoot} />
    {/if}
  {:else if !initialIsClient}
    <ControlBar
      onStart={handleStart}
      onPause={handlePause}
      onResume={handleResume}
      onStop={handleStop}
      onNext={handleNext}
      onReset={handleReset}
    />
  {:else if $timerState.phase === 'idle'}
    <div class="client-hint">{$t('waitingForHost')}</div>
  {/if}

  <!-- Bottom utility actions -->
  <div class="bottom-actions">
    {#if isHost && ($timerState.phase === 'idle' || $timerState.phase === 'stopped')}
      <button class="btn-text" onclick={changeProgram}>{$t('changeProgram')}</button>
      <span class="sep">·</span>
    {/if}
    <button class="btn-text" onclick={() => window.location.reload()}>{$t('refresh')}</button>
    <span class="sep">·</span>
    <button class="btn-text danger" onclick={disconnect}>{$t('disconnect')}</button>
  </div>
</div>

<style>
  .timer-view {
    gap: 0.4rem;
  }

  /* ── Top bar ── */
  .top-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 40px;
  }

  .top-actions {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    margin-left: auto;
  }

  .icon-btn {
    background: var(--bg-surface);
    border: 1px solid rgba(255,255,255,0.06);
    padding: 0.4rem;
    min-width: 40px;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius);
  }

  .icon-btn svg {
    width: 18px;
    height: 18px;
    color: var(--text-secondary);
  }

  .icon-btn.active svg {
    color: var(--accent);
  }

  /* ── Reshoot banner ── */
  .reshoot-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.45rem 1rem;
    background: rgba(255, 181, 71, 0.1);
    color: var(--warning);
    font-weight: 700;
    font-size: 0.9rem;
    border-radius: var(--radius);
    letter-spacing: 0.04em;
    border: 1px solid rgba(255, 181, 71, 0.2);
  }

  .reshoot-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  /* ── Timer area ── */
  .timer-area {
    flex: 1;
    display: flex;
    align-items: stretch;
    min-height: 160px;
  }

  /* ── Client hint ── */
  .client-hint {
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.85rem;
    padding: 0.75rem;
  }

  /* ── Bottom actions ── */
  .bottom-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.25rem 0;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }

  .btn-text {
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.3rem 0.5rem;
    border-radius: var(--radius);
    opacity: 0.6;
    transition: opacity 0.15s, color 0.15s;
  }

  .btn-text:hover { opacity: 1; }
  .btn-text.danger { color: var(--danger); }
  .btn-text.danger:hover { opacity: 0.85; }

  .sep {
    font-size: 0.7rem;
    color: var(--text-secondary);
    opacity: 0.3;
  }
</style>
