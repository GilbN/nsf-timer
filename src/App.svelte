<script>
  import { currentView, preferences, roomState, timerState } from './lib/stores.js'
  import { loadPreferences, loadRoomState, loadTimerState, clearRoomState, clearTimerState } from './lib/storage.js'
  import { SocketHost } from './lib/peer/SocketHost.js'
  import { SocketClient } from './lib/peer/SocketClient.js'
  import { TimerScheduler } from './lib/timer/TimerScheduler.js'
  import HomeView from './views/HomeView.svelte'
  import LobbyView from './views/LobbyView.svelte'
  import TimerView from './views/TimerView.svelte'
  import StopwatchView from './views/StopwatchView.svelte'
  import DisplayView from './views/DisplayView.svelte'

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

  async function restoreSession() {
    const savedRoom = loadRoomState()
    if (!savedRoom?.code && !savedRoom?.isSolo) return

    try {
      if (savedRoom.isSolo) {
        // Solo mode: restore without any WebSocket
        roomState.set({ code: null, isHost: true, isSolo: true, connectedPeers: [] })
        const savedTimer = loadTimerState()
        if (savedTimer?.programId || savedRoom.programId) {
          const scheduler = new TimerScheduler()
          window.__nsfScheduler = scheduler
          if (savedTimer?.programId) {
            scheduler.loadProgram(savedTimer.programId)
            scheduler.restoreState(savedTimer)
          } else {
            scheduler.loadProgram(savedRoom.programId)
          }
          currentView.set('timer')
        } else {
          currentView.set('lobby')
        }
      } else if (savedRoom.isHost) {
        // Host reload: reclaim the same room code
        const host = new SocketHost()
        await host.createRoom(savedRoom.code)
        window.__nsfHost = host

        // Restore timer state if a program was active
        const savedTimer = loadTimerState()
        if (savedTimer?.programId || savedRoom.programId) {
          const scheduler = new TimerScheduler()
          window.__nsfScheduler = scheduler

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
      } else if (savedRoom.isSpectator) {
        // Display/spectator reload: reconnect as spectator
        const client = new SocketClient()
        window.__nsfClient = client
        await client.joinRoom(savedRoom.code, { role: 'spectator' })
        currentView.set('display')
      } else {
        // Client reload: reconnect to the same room
        const client = new SocketClient()
        window.__nsfClient = client
        await client.joinRoom(savedRoom.code, { name: savedRoom.name || '', lane: savedRoom.lane || '' })
        currentView.set('timer')
      }
    } catch {
      // Reconnection failed — clean up and go home
      clearRoomState()
      clearTimerState()
      window.__nsfHost = null
      window.__nsfClient = null
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
