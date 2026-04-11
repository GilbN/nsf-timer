<script>
  import { onMount } from 'svelte'
  import { currentView, roomState } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'
  import { SocketHost } from '../lib/peer/SocketHost.js'
  import { SocketClient } from '../lib/peer/SocketClient.js'
  import { TimerScheduler } from '../lib/timer/TimerScheduler.js'
  import { unlockAudio } from '../lib/audio.js'
  import { saveRoomState, loadRoomHistory, clearRoomHistory } from '../lib/storage.js'
  import SettingsMenu from '../components/SettingsMenu.svelte'

  let joinCodeInput
  let joinCode = $state('')
  let joinName = $state('')
  let joinLane = $state('')
  let error = $state('')
  let connecting = $state(false)
  let recentRooms = $state(loadRoomHistory())
  let showDisplayForm = $state(false)
  let displayCode = $state('')

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    !!window.navigator.standalone

  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

  let showInstallCard = $state(false)

  async function createRoom() {
    unlockAudio()
    error = ''
    connecting = true
    try {
      const host = new SocketHost()
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
      const client = new SocketClient()
      window.__opkClient = client
      const code = await client.joinRoom(joinCode.trim(), { name: joinName.trim(), lane: joinLane.trim() })
      saveRoomState({ code, isHost: false, name: joinName.trim(), lane: joinLane.trim() })
      currentView.set('timer')
    } catch (e) {
      if (e.message === 'laneRejected') {
        error = $t('laneTaken')
      } else {
        error = e.message || 'Failed to join room'
      }
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
        const host = new SocketHost()
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
      } else if (room.isSpectator) {
        const client = new SocketClient()
        window.__opkClient = client
        await client.joinRoom(room.code, { role: 'spectator' })
        saveRoomState({ code: room.code, isHost: false, isSpectator: true })
        currentView.set('display')
      } else {
        const client = new SocketClient()
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

  async function joinDisplay() {
    const code = displayCode.trim().toUpperCase()
    if (!code || code.length < 4) {
      error = 'Enter a 4-character room code'
      return
    }
    unlockAudio()
    error = ''
    connecting = true
    try {
      const client = new SocketClient()
      window.__opkClient = client
      await client.joinRoom(code, { role: 'spectator' })
      saveRoomState({ code, isHost: false, isSpectator: true })
      currentView.set('display')
    } catch (e) {
      error = e.message || 'Failed to join room'
      window.__opkClient = null
    } finally {
      connecting = false
    }
  }

  function handleClearHistory() {
    clearRoomHistory()
    recentRooms = []
  }

  onMount(() => {
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room')
    if (room) {
      joinCode = room.toUpperCase().slice(0, 4)
      history.replaceState({}, '', window.location.pathname)
      setTimeout(() => joinCodeInput?.focus(), 50)
    }

    if (!isStandalone && (window.__pwaInstallPrompt || isIos)) {
      showInstallCard = true
    }
  })

  async function installApp() {
    const prompt = window.__pwaInstallPrompt
    if (!prompt) return
    await prompt.prompt()
    await prompt.userChoice
    showInstallCard = false
    window.__pwaInstallPrompt = null
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
    <div class="wordmark">
      <!-- Target ring icon -->
      <svg class="wordmark-icon" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
        <circle cx="16" cy="16" r="9" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>
        <circle cx="16" cy="16" r="4" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
      </svg>
      <span class="wordmark-text">{$t('appName')}</span>
    </div>
    <div class="header-actions">
      <SettingsMenu />
    </div>
  </div>

  <p class="tagline">NSF 25m Competition Timer</p>

  <div class="actions">
    <button class="btn-primary btn-large btn-create" onclick={createRoom} disabled={connecting}>
      {$t('createRoom')}
    </button>

    <div class="divider-row">
      <span class="divider-line"></span>
      <span class="divider-label">{$t('join')}</span>
      <span class="divider-line"></span>
    </div>

    <div class="join-section">
      <div class="join-row">
        <input
          type="text"
          bind:this={joinCodeInput}
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
          autocomplete="name"
        />
        <input
          type="text"
          bind:value={joinLane}
          placeholder={$t('laneNumber')}
          maxlength="3"
          class="join-detail-input lane-input"
          inputmode="numeric"
          autocomplete="off"
        />
      </div>
    </div>

    <button class="btn-ghost stopwatch-btn" onclick={openStopwatch}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="13" r="8"/>
        <polyline points="12 9 12 13 14.5 15"/>
        <path d="M9 3h6M12 3v2"/>
      </svg>
      {$t('stopwatch')}
    </button>

    <button class="btn-ghost display-btn" onclick={() => { showDisplayForm = !showDisplayForm; error = '' }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
      {$t('spectatorScreen')}
    </button>

    {#if showDisplayForm}
      <div class="display-form">
        <div class="display-hint">{$t('watchDisplayHint')}</div>
        <div class="join-row">
          <input
            type="text"
            bind:value={displayCode}
            placeholder={$t('enterCode')}
            maxlength="4"
            class="join-input"
            onkeydown={(e) => e.key === 'Enter' && joinDisplay()}
            style="text-transform: uppercase"
          />
          <button class="btn-secondary btn-large" onclick={joinDisplay} disabled={connecting}>
            {$t('watchDisplay')}
          </button>
        </div>
      </div>
    {/if}

    {#if showInstallCard}
      <div class="install-card">
        {#if isIos}
          <div class="install-header">
            <svg class="install-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v13M7 11l5 5 5-5"/>
              <path d="M3 18h18v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2z"/>
            </svg>
            <span class="install-text">{$t('installApp')}</span>
            <button class="btn-ghost-sm install-close" onclick={() => showInstallCard = false}>✕</button>
          </div>
          <div class="install-ios-row">
            <span class="install-hint">
              <svg class="safari-share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              {$t('installIosHint')}
            </span>
          </div>
        {:else}
          <div class="install-header">
            <svg class="install-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v13M7 11l5 5 5-5"/>
              <path d="M3 18h18v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2z"/>
            </svg>
            <span class="install-text">{$t('installApp')}</span>
            <button class="btn-primary btn-install" onclick={installApp}>
              {$t('installApp')}
            </button>
            <button class="btn-ghost-sm install-close" onclick={() => showInstallCard = false}>✕</button>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if recentRooms.length > 0}
    <div class="recent-rooms">
      <div class="recent-header">
        <span class="recent-label">{$t('recentRooms')}</span>
        <button class="btn-ghost-sm" onclick={handleClearHistory}>{$t('clear')}</button>
      </div>
      <div class="recent-list">
        {#each recentRooms as room}
          <button class="recent-room-card" onclick={() => rejoinRoom(room)} disabled={connecting}>
            <span class="recent-code">{room.code}</span>
            <span class="recent-meta">
              {room.isHost ? $t('host') : room.isSpectator ? $t('spectator') : $t('client')}
              {#if room.joinedAt}· {timeAgo(room.joinedAt)}{/if}
            </span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if error}
    <div class="status-msg error">{error}</div>
  {/if}

  {#if connecting}
    <div class="status-msg connecting">
      <span class="spinner"></span>
      {$t('connecting')}…
    </div>
  {/if}
</div>

<style>
  .home-view {
    justify-content: center;
    gap: 1.25rem;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* ── Header ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-actions {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .wordmark {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .wordmark-icon {
    width: 28px;
    height: 28px;
    color: var(--accent);
    flex-shrink: 0;
  }

  .wordmark-text {
    font-family: var(--font-mono);
    font-size: 1.15rem;
    font-weight: 900;
    letter-spacing: 0.04em;
    color: var(--text-primary);
  }

  .tagline {
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-secondary);
    text-align: center;
    margin-top: -0.75rem;
  }

  /* ── Actions ── */
  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .btn-create {
    width: 100%;
    font-size: 1rem;
    letter-spacing: 0.06em;
  }

  .divider-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0.1rem 0;
  }

  .divider-line {
    flex: 1;
    height: 1px;
    background: var(--bg-surface);
  }

  .divider-label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-secondary);
    opacity: 0.5;
  }

  .join-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .join-row {
    display: flex;
    gap: 0.4rem;
    min-width: 0;
  }

  .join-row .btn-secondary {
    flex-shrink: 0;
    white-space: nowrap;
    font-size: 0.95rem;
  }

  .join-input {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: 1.3rem;
    text-align: center;
    letter-spacing: 0.25em;
    font-weight: 900;
  }

  .join-details {
    display: flex;
    gap: 0.4rem;
    min-width: 0;
  }

  .join-detail-input {
    flex: 1;
    min-width: 0;
    font-size: 0.9rem;
    padding: 0.6rem 0.75rem;
  }

  .lane-input {
    flex: 0 0 76px;
    text-align: center;
    font-family: var(--font-mono);
    font-weight: 700;
  }

  .btn-ghost {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: var(--radius);
    padding: 0.6rem 1.25rem;
    font-size: 0.85rem;
    font-weight: 600;
    width: 100%;
    transition: color 0.15s, border-color 0.15s;
  }

  .btn-ghost svg {
    width: 1.1em;
    height: 1.1em;
    flex-shrink: 0;
  }

  .btn-ghost:hover {
    color: var(--text-primary);
    border-color: rgba(255,255,255,0.15);
  }

  /* ── Recent rooms ── */
  .recent-rooms {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .recent-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .recent-label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-secondary);
    opacity: 0.6;
  }

  .btn-ghost-sm {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    background: transparent;
    color: var(--text-secondary);
    opacity: 0.5;
    border-radius: var(--radius);
    transition: opacity 0.15s, color 0.15s;
  }

  .btn-ghost-sm:hover {
    color: var(--danger);
    opacity: 1;
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .recent-room-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.85rem;
    background: var(--bg-secondary);
    border: 1px solid rgba(255,255,255,0.04);
    border-left: 2px solid transparent;
    border-radius: 0 var(--radius) var(--radius) 0;
    transition: border-color 0.15s;
  }

  .recent-room-card:hover {
    border-left-color: var(--accent);
    border-color: rgba(255,255,255,0.07);
    border-left-color: var(--accent);
  }

  .recent-code {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: var(--accent);
  }

  .recent-meta {
    font-size: 0.72rem;
    color: var(--text-secondary);
  }

  /* ── Status messages ── */
  .status-msg {
    text-align: center;
    font-size: 0.85rem;
  }

  .error { color: var(--danger); }

  .connecting {
    color: var(--warning);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 181, 71, 0.25);
    border-top-color: var(--warning);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .install-card {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.75rem 1rem;
    background: rgba(0, 230, 118, 0.06);
    border: 1px solid rgba(0, 230, 118, 0.2);
    border-radius: var(--radius);
  }

  .install-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .install-icon {
    width: 20px;
    height: 20px;
    color: var(--accent);
    flex-shrink: 0;
  }

  .install-text {
    flex: 1;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .install-close {
    flex-shrink: 0;
  }

  .install-ios-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding-left: calc(20px + 0.5rem);
  }

  .install-hint {
    flex: 1;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .safari-share-icon {
    display: inline-block;
    vertical-align: middle;
    width: 1.1em;
    height: 1.1em;
    margin-right: 0.2em;
    color: var(--accent);
  }

  .btn-install {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    padding: 0.4rem 0.9rem;
    min-height: unset;
    flex-shrink: 0;
  }

  .btn-icon {
    width: 1em;
    height: 1em;
    flex-shrink: 0;
  }

  /* ── Display screen ── */
  .display-btn {
    border-color: rgba(91, 141, 217, 0.2);
    color: var(--phase-paused);
  }

  .display-btn:hover {
    color: var(--phase-paused);
    border-color: rgba(91, 141, 217, 0.4);
  }

  .display-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: rgba(91, 141, 217, 0.05);
    border: 1px solid rgba(91, 141, 217, 0.15);
    border-radius: var(--radius);
  }

  .display-hint {
    font-size: 0.72rem;
    color: var(--text-secondary);
    letter-spacing: 0.01em;
  }
</style>
