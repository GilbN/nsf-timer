<script>
  import { currentView, preferences, roomState } from './lib/stores.js'
  import { loadPreferences, loadRoomState, loadTimerState, clearRoomState, clearTimerState } from './lib/storage.js'
  import { session, hostRoom, joinRoom, startScheduler } from './lib/session.js'
  import { registerUpdateHandler } from './lib/updateAvailable.js'
  import HomeView from './views/HomeView.svelte'
  import LobbyView from './views/LobbyView.svelte'
  import TimerView from './views/TimerView.svelte'
  import StopwatchView from './views/StopwatchView.svelte'
  import DisplayView from './views/DisplayView.svelte'
  import UpdateModal from './components/UpdateModal.svelte'
  import ConfirmDialog from './components/ConfirmDialog.svelte'

  // Restore preferences on load
  const savedPrefs = loadPreferences()
  if (savedPrefs) {
    preferences.update(defaults => ({ ...defaults, ...savedPrefs }))
  }

  // Apply font scale to html element whenever preferences change
  $effect(() => {
    const scale = $preferences.textScale ?? 1
    document.documentElement.style.fontSize = (scale * 100) + '%'
  })

  // Attempt session restore on page load
  restoreSession()

  // Start listening for service-worker updates
  registerUpdateHandler()

  async function restoreSession() {
    const savedRoom = loadRoomState()
    if (!savedRoom?.code && !savedRoom?.isSolo) return

    try {
      if (savedRoom.isSolo || savedRoom.isHost) {
        if (savedRoom.isSolo) {
          // Solo mode: restore without any WebSocket
          roomState.set({ code: null, isHost: true, isSolo: true, connectedPeers: [] })
        } else {
          // Host reload: reclaim the same room code
          await hostRoom(savedRoom.code, savedRoom.hostToken ?? null)
        }
        // Restore timer state if a program was active
        const savedTimer = loadTimerState()
        if (savedTimer?.programId || savedRoom.programId) {
          startScheduler(savedRoom.programId, savedTimer)
          currentView.set('timer')
        } else {
          currentView.set('lobby')
        }
      } else if (savedRoom.isSpectator) {
        // Display/spectator reload: reconnect as spectator
        await joinRoom(savedRoom.code, { role: 'spectator' })
        currentView.set('display')
      } else {
        // Client reload: reconnect to the same room
        await joinRoom(savedRoom.code, { name: savedRoom.name || '', lane: savedRoom.lane || '' })
        currentView.set('timer')
      }
    } catch {
      // Reconnection failed: clean up and go home
      clearRoomState()
      clearTimerState()
      session.host = null
      session.client = null
    }
  }
</script>

{#if $currentView === 'home'}
  <HomeView />
{:else if $currentView === 'lobby'}
  <LobbyView />
{:else if $currentView === 'timer'}
  <TimerView />
{:else if $currentView === 'stopwatch'}
  <StopwatchView />
{:else if $currentView === 'display'}
  <DisplayView />
{/if}

<UpdateModal />
<ConfirmDialog />
