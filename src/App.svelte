<script>
  import { currentView, preferences, roomState, timerState } from './lib/stores.js'
  import { loadPreferences, loadRoomState, loadTimerState, clearRoomState, clearTimerState } from './lib/storage.js'
  import { PeerHost } from './lib/peer/PeerHost.js'
  import { PeerClient } from './lib/peer/PeerClient.js'
  import { TimerScheduler } from './lib/timer/TimerScheduler.js'
  import HomeView from './views/HomeView.svelte'
  import LobbyView from './views/LobbyView.svelte'
  import TimerView from './views/TimerView.svelte'
  import StopwatchView from './views/StopwatchView.svelte'

  // Restore preferences on load
  const savedPrefs = loadPreferences()
  if (savedPrefs) {
    preferences.set(savedPrefs)
  }

  // Attempt session restore on page load
  restoreSession()

  async function restoreSession() {
    const savedRoom = loadRoomState()
    if (!savedRoom?.code) return

    try {
      if (savedRoom.isHost) {
        // Host reload: reclaim the same room code
        const host = new PeerHost()
        await host.createRoom(savedRoom.code)
        window.__opkHost = host

        // Restore timer state if a program was active
        const savedTimer = loadTimerState()
        if (savedTimer?.programId || savedRoom.programId) {
          const scheduler = new TimerScheduler()
          window.__opkScheduler = scheduler

          // Wire up broadcasting before loading so initial state is sent
          scheduler.onStateChange((state) => {
            host.broadcastState(state)
          })

          if (savedTimer?.programId) {
            scheduler.loadProgram(savedTimer.programId)
            scheduler.restoreState(savedTimer)
          } else {
            scheduler.loadProgram(savedRoom.programId)
          }

          currentView.set('timer')
        } else {
          // Host was in lobby (no program selected yet)
          currentView.set('lobby')
        }
      } else {
        // Client reload: reconnect to the same room
        const client = new PeerClient()
        window.__opkClient = client
        await client.joinRoom(savedRoom.code, { name: savedRoom.name || '', lane: savedRoom.lane || '' })
        currentView.set('timer')
      }
    } catch {
      // Reconnection failed — clean up and go home
      clearRoomState()
      clearTimerState()
      window.__opkHost = null
      window.__opkClient = null
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
{/if}
