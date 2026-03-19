<script>
  import { get } from 'svelte/store'
  import { currentView, roomState, timerState } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'
  import { TimerScheduler } from '../lib/timer/TimerScheduler.js'
  import { saveRoomState, clearRoomState, addRoomToHistory } from '../lib/storage.js'
  import RoomCode from '../components/RoomCode.svelte'
  import ConnectionStatus from '../components/ConnectionStatus.svelte'
  import ProgramPicker from '../components/ProgramPicker.svelte'
  import ProgramEditor from '../components/ProgramEditor.svelte'
  import LangToggle from '../components/LangToggle.svelte'

  let showEditor = $state(false)

  function selectProgram(programId) {
    const scheduler = new TimerScheduler()
    window.__opkScheduler = scheduler

    // Set up broadcasting before loadProgram so initial state is sent
    const host = window.__opkHost
    if (host) {
      scheduler.onStateChange((state) => {
        host.broadcastState(state)
      })
    }

    scheduler.loadProgram(programId)

    // Update saved room state with programId
    saveRoomState({ code: $roomState.code, isHost: true, programId })
    currentView.set('timer')
  }

  function handleCustomSave(program) {
    showEditor = false
    selectProgram(program.id)
  }

  function disconnect() {
    if (!confirm(get(t)('confirmDisconnect'))) return
    if ($roomState.code) {
      addRoomToHistory({ code: $roomState.code, isHost: true })
    }
    if (window.__opkHost) {
      window.__opkHost.destroy()
      window.__opkHost = null
    }
    clearRoomState()
    currentView.set('home')
  }
</script>

<div class="view lobby-view">
  <div class="top-bar">
    <RoomCode code={$roomState.code} />
    <ConnectionStatus status="connected" />
    <LangToggle />
  </div>

  <div class="peer-count">
    {$roomState.connectedPeers.length} {$t('peers')}
  </div>

  <div class="content">
    {#if showEditor}
      <ProgramEditor onSave={handleCustomSave} onCancel={() => (showEditor = false)} />
    {:else}
      <ProgramPicker onSelect={selectProgram} onCustom={() => (showEditor = true)} />
    {/if}
  </div>

  <button class="btn-danger back-btn" onclick={disconnect}>
    {$t('disconnect')}
  </button>
</div>

<style>
  .lobby-view {
    gap: 1rem;
  }

  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .peer-count {
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .content {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .back-btn {
    align-self: center;
    opacity: 0.7;
  }
</style>
