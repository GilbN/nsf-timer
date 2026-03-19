<script>
  import { get } from 'svelte/store'
  import { currentView, roomState, timerState, preferences } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'
  import { getProgramById } from '../lib/programs/registry.js'
  import { saveTimerState, saveRoomState, clearTimerState, clearRoomState, addRoomToHistory } from '../lib/storage.js'
  import { setSoundEnabled } from '../lib/audio.js'
  import TimerDisplay from '../components/TimerDisplay.svelte'
  import SeriesProgress from '../components/SeriesProgress.svelte'
  import ControlBar from '../components/ControlBar.svelte'
  import PeerList from '../components/PeerList.svelte'
  import RoomCode from '../components/RoomCode.svelte'
  import ConnectionStatus from '../components/ConnectionStatus.svelte'
  import LangToggle from '../components/LangToggle.svelte'

  // Capture role at mount time so it's stable even if roomState changes on disconnect
  const initialIsHost = get(roomState).isHost
  const initialIsClient = !initialIsHost && (!!get(roomState).code || !!window.__opkClient)
  let isHost = $derived($roomState.isHost || initialIsHost)
  let program = $derived(getProgramById($timerState.programId))
  let stage = $derived(program?.stages[$timerState.stageIndex])
  let displayMode = $derived(
    stage?.type === 'duell' && stage?.exercises[$timerState.exerciseIndex]?.targetVisibleTime
      ? 'duell'
      : 'precision'
  )

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

  function handleStart() {
    window.__opkScheduler?.startSeries()
  }

  function handlePause() {
    window.__opkScheduler?.pause()
  }

  function handleResume() {
    window.__opkScheduler?.resume()
  }

  function handleStop() {
    window.__opkScheduler?.stop()
  }

  function handleNext() {
    window.__opkScheduler?.nextExercise()
  }

  function handleReset() {
    if (!confirm(get(t)('confirmReset'))) return
    window.__opkScheduler?.reset()
    // Also reset jam counters on host
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
      addRoomToHistory({
        code: $roomState.code,
        isHost: $roomState.isHost,
        programId: $timerState.programId,
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
  <div class="top-bar">
    {#if $roomState.code}
      <RoomCode code={$roomState.code} />
      <ConnectionStatus status={connectionStatus} />
    {/if}
    <div class="top-actions">
      <button class="icon-btn" onclick={toggleSound} title={$t('sound')}>
        {$preferences.soundEnabled ? '🔊' : '🔇'}
      </button>
      <LangToggle />
    </div>
  </div>

  {#if $timerState.isReshoot && $timerState.reshootPeerName}
    <div class="reshoot-banner">
      {$t('reshootFor')} {$timerState.reshootPeerName}
    </div>
  {/if}

  <div class="timer-area">
    <TimerDisplay mode={displayMode} />
  </div>

  <SeriesProgress />

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
  {:else}
    <div class="client-hint">{$t('waitingForHost')}</div>
  {/if}

  <div class="bottom-actions">
    {#if isHost && ($timerState.phase === 'idle' || $timerState.phase === 'stopped')}
      <button class="btn-secondary change-program-btn" onclick={changeProgram}>
        {$t('changeProgram')}
      </button>
    {/if}
    <button class="btn-danger leave-btn" onclick={disconnect}>
      {$t('disconnect')}
    </button>
  </div>
</div>

<style>
  .timer-view {
    gap: 0.5rem;
  }

  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
    min-height: 44px;
  }

  .top-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-left: auto;
  }

  .icon-btn {
    background: var(--bg-surface);
    padding: 0.4rem;
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius);
    font-size: 1.2rem;
  }

  .reshoot-banner {
    text-align: center;
    padding: 0.5rem 1rem;
    background: rgba(255, 152, 0, 0.15);
    color: var(--warning);
    font-weight: 700;
    font-size: 1rem;
    border-radius: var(--radius);
    letter-spacing: 0.05em;
  }

  .timer-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
  }

  .client-hint {
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.9rem;
    padding: 1rem;
  }

  .bottom-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .change-program-btn {
    font-size: 0.85rem;
    padding: 0.4rem 1rem;
    opacity: 0.8;
  }

  .leave-btn {
    opacity: 0.6;
    font-size: 0.85rem;
    padding: 0.4rem 1rem;
  }
</style>
