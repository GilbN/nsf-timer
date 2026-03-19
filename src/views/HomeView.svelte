<script>
  import { currentView, roomState } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'
  import { PeerHost } from '../lib/peer/PeerHost.js'
  import { PeerClient } from '../lib/peer/PeerClient.js'
  import { TimerScheduler } from '../lib/timer/TimerScheduler.js'
  import { unlockAudio } from '../lib/audio.js'
  import { saveRoomState, loadRoomHistory, clearRoomHistory } from '../lib/storage.js'
  import LangToggle from '../components/LangToggle.svelte'

  let joinCode = $state('')
  let joinName = $state('')
  let joinLane = $state('')
  let error = $state('')
  let connecting = $state(false)
  let recentRooms = $state(loadRoomHistory())

  async function createRoom() {
    unlockAudio()
    error = ''
    connecting = true
    try {
      const host = new PeerHost()
      const code = await host.createRoom()
      window.__opkHost = host
      saveRoomState({ code, isHost: true })
      currentView.set('lobby')
    } catch (e) {
      error = e.message || 'Failed to create room'
    } finally {
      connecting = false
    }
  }

  async function joinRoom() {
    if (!joinCode.trim() || joinCode.trim().length < 4) {
      error = 'Enter a 4-character room code'
      return
    }
    if (!joinName.trim()) {
      error = $t('nameRequired')
      return
    }
    if (!joinLane.trim()) {
      error = $t('laneRequired')
      return
    }
    unlockAudio()
    error = ''
    connecting = true
    try {
      const client = new PeerClient()
      window.__opkClient = client
      let laneRejected = false
      client.onStatusChange((status) => {
        if (status === 'laneRejected') {
          laneRejected = true
          error = $t('laneTaken')
          connecting = false
          client.destroy()
          window.__opkClient = null
        }
      })
      const code = await client.joinRoom(joinCode.trim(), { name: joinName.trim(), lane: joinLane.trim() })
      if (laneRejected) return
      saveRoomState({ code, isHost: false, name: joinName.trim(), lane: joinLane.trim() })
      currentView.set('timer')
    } catch (e) {
      error = e.message || 'Failed to join room'
      window.__opkClient = null
    } finally {
      connecting = false
    }
  }

  async function rejoinRoom(room) {
    unlockAudio()
    error = ''
    connecting = true
    try {
      if (room.isHost) {
        const host = new PeerHost()
        await host.createRoom(room.code)
        window.__opkHost = host
        saveRoomState({ code: room.code, isHost: true, programId: room.programId })
        if (room.programId) {
          const scheduler = new TimerScheduler()
          scheduler.loadProgram(room.programId)
          window.__opkScheduler = scheduler
          scheduler.onStateChange((state) => {
            host.broadcastState(state)
          })
        }
        currentView.set(room.programId ? 'timer' : 'lobby')
      } else {
        const client = new PeerClient()
        window.__opkClient = client
        await client.joinRoom(room.code, { name: room.name || '', lane: room.lane || '' })
        saveRoomState({ code: room.code, isHost: false, name: room.name, lane: room.lane })
        currentView.set('timer')
      }
    } catch (e) {
      error = e.message || 'Failed to rejoin room'
      window.__opkHost = null
      window.__opkClient = null
    } finally {
      connecting = false
    }
  }

  function handleClearHistory() {
    clearRoomHistory()
    recentRooms = []
  }

  function openStopwatch() {
    unlockAudio()
    currentView.set('stopwatch')
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts
    const min = Math.floor(diff / 60000)
    if (min < 1) return $t('language') === 'Språk' ? 'Akkurat nå' : 'Just now'
    if (min < 60) return `${min}m`
    const hrs = Math.floor(min / 60)
    if (hrs < 24) return `${hrs}h`
    const days = Math.floor(hrs / 24)
    return `${days}d`
  }
</script>

<div class="view home-view">
  <div class="header">
    <h1>{$t('appName')}</h1>
    <LangToggle />
  </div>

  <div class="hero">
    <div class="logo">T</div>
    <p class="subtitle">NSF 25m Competition Timer</p>
  </div>

  <div class="actions">
    <button class="btn-primary btn-large" onclick={createRoom} disabled={connecting}>
      {$t('createRoom')}
    </button>

    <div class="join-section">
      <div class="join-row">
        <input
          type="text"
          bind:value={joinCode}
          placeholder={$t('enterCode')}
          maxlength="4"
          class="join-input"
          onkeydown={(e) => e.key === 'Enter' && joinRoom()}
          style="text-transform: uppercase"
        />
        <button class="btn-secondary btn-large" onclick={joinRoom} disabled={connecting}>
          {$t('join')}
        </button>
      </div>
      <div class="join-details">
        <input
          type="text"
          bind:value={joinName}
          placeholder={$t('yourName')}
          class="join-detail-input"
        />
        <input
          type="text"
          bind:value={joinLane}
          placeholder={$t('laneNumber')}
          maxlength="3"
          class="join-detail-input lane-input"
          inputmode="numeric"
        />
      </div>
    </div>

    <button class="btn-secondary btn-large stopwatch-btn" onclick={openStopwatch}>
      {$t('stopwatch')}
    </button>
  </div>

  {#if recentRooms.length > 0}
    <div class="recent-rooms">
      <div class="recent-header">
        <h3>{$t('recentRooms')}</h3>
        <button class="btn-clear" onclick={handleClearHistory}>{$t('clear')}</button>
      </div>
      <div class="recent-list">
        {#each recentRooms as room}
          <button class="recent-room-card" onclick={() => rejoinRoom(room)} disabled={connecting}>
            <span class="recent-code">{room.code}</span>
            <span class="recent-meta">
              {room.isHost ? $t('host') : $t('client')}
              {#if room.joinedAt}
                — {timeAgo(room.joinedAt)}
              {/if}
            </span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if error}
    <div class="error">{error}</div>
  {/if}

  {#if connecting}
    <div class="connecting">{$t('connecting')}...</div>
  {/if}
</div>

<style>
  .home-view {
    justify-content: center;
    gap: 1.5rem;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .hero {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .logo {
    font-family: var(--font-mono);
    font-size: 4rem;
    font-weight: 900;
    color: var(--accent);
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid var(--accent);
    border-radius: var(--radius-lg);
  }

  .subtitle {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .join-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .join-row {
    display: flex;
    gap: 0.5rem;
    min-width: 0;
  }

  .join-row .btn-secondary {
    flex-shrink: 0;
    white-space: nowrap;
  }

  .join-input {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: 1.1rem;
    text-align: center;
    letter-spacing: 0.2em;
    font-weight: 700;
  }

  .join-details {
    display: flex;
    gap: 0.5rem;
    min-width: 0;
  }

  .join-detail-input {
    flex: 1;
    min-width: 0;
    font-size: 0.9rem;
    padding: 0.5rem 0.75rem;
  }

  .lane-input {
    flex: 0 0 80px;
    text-align: center;
    font-family: var(--font-mono);
    font-weight: 700;
  }

  .stopwatch-btn {
    opacity: 0.8;
  }

  .recent-rooms {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .recent-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .recent-header h3 {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .btn-clear {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: transparent;
    color: var(--text-secondary);
    opacity: 0.7;
  }

  .btn-clear:hover {
    color: var(--danger);
    opacity: 1;
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .recent-room-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.7rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--bg-surface);
    border-radius: var(--radius);
    transition: border-color 0.15s;
  }

  .recent-room-card:hover {
    border-color: var(--accent);
  }

  .recent-code {
    font-family: var(--font-mono);
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    color: var(--accent);
  }

  .recent-meta {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .error {
    color: var(--danger);
    text-align: center;
    font-size: 0.9rem;
  }

  .connecting {
    color: var(--warning);
    text-align: center;
    font-size: 0.9rem;
  }
</style>
