<script>
  import { onMount, tick } from 'svelte'
  import { currentView, roomState } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'
  import { hostRoom, joinRoom as joinSessionRoom, startScheduler } from '../lib/session.js'
  import { unlockAudio } from '../lib/audio.js'
  import { saveRoomState, loadRoomHistory, clearRoomHistory } from '../lib/storage.js'
  import SettingsMenu from '../components/SettingsMenu.svelte'
  import Modal from '../components/Modal.svelte'
  import Icon from '../components/ui/Icon.svelte'

  /** @type {HTMLInputElement | undefined} */
  let joinCodeInput = $state()
  let joinCode = $state('')
  let joinName = $state('')
  let joinLane = $state('')
  let error = $state('')
  let connecting = $state(false)
  let recentRooms = $state(loadRoomHistory())
  let displayCode = $state('')

  /**
   * 'home' shows the ways in. 'join' and 'display' are the two code forms,
   * joining as a shooter or opening the spectator screen.
   * @type {'home' | 'join' | 'display'}
   */
  let mode = $state('home')

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    !!window.navigator.standalone

  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

  let showInstallCard = $state(false)
  let showInstallSheet = $state(false)

  /** @param {'home' | 'join' | 'display'} next */
  async function openMode(next) {
    error = ''
    mode = next
    if (next !== 'home') {
      await tick()
      joinCodeInput?.focus()
    }
  }

  async function createRoom() {
    unlockAudio()
    error = ''
    connecting = true
    try {
      const host = await hostRoom()
      saveRoomState({ code: host.code, isHost: true, hostToken: host.hostToken })
      currentView.set('lobby')
    } catch (e) {
      error = e.message || 'Failed to create room'
    } finally {
      connecting = false
    }
  }

  async function joinRoom() {
    if (!joinCode.trim() || joinCode.trim().length < 4) {
      error = $t('enterCodeError')
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
      const client = await joinSessionRoom(joinCode.trim(), { name: joinName.trim(), lane: joinLane.trim() })
      saveRoomState({ code: client.code, isHost: false, name: joinName.trim(), lane: joinLane.trim() })
      currentView.set('timer')
    } catch (e) {
      if (e.message === 'laneRejected') {
        error = $t('laneTaken')
      } else {
        error = e.message || 'Failed to join room'
      }
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
        const host = await hostRoom(room.code, room.hostToken ?? null)
        saveRoomState({ code: room.code, isHost: true, hostToken: host.hostToken, programId: room.programId })
        if (room.programId) {
          const savedTimer = room.timer?.programId === room.programId ? room.timer : null
          startScheduler(room.programId, savedTimer)
        }
        currentView.set(room.programId ? 'timer' : 'lobby')
      } else if (room.isSpectator) {
        await joinSessionRoom(room.code, { role: 'spectator' })
        saveRoomState({ code: room.code, isHost: false, isSpectator: true })
        currentView.set('display')
      } else {
        await joinSessionRoom(room.code, { name: room.name || '', lane: room.lane || '' })
        saveRoomState({ code: room.code, isHost: false, name: room.name, lane: room.lane })
        currentView.set('timer')
      }
    } catch (e) {
      error = e.message || 'Failed to rejoin room'
    } finally {
      connecting = false
    }
  }

  async function joinDisplay() {
    const code = displayCode.trim().toUpperCase()
    if (!code || code.length < 4) {
      error = $t('enterCodeError')
      return
    }
    unlockAudio()
    error = ''
    connecting = true
    try {
      await joinSessionRoom(code, { role: 'spectator' })
      saveRoomState({ code, isHost: false, isSpectator: true })
      currentView.set('display')
    } catch (e) {
      error = e.message || 'Failed to join room'
    } finally {
      connecting = false
    }
  }

  function submit() {
    // Enter can fire while a join is still in flight; a second join for the
    // same lane would be rejected and its cleanup could undo the first
    if (connecting) return
    if (mode === 'display') joinDisplay()
    else joinRoom()
  }

  function handleClearHistory() {
    clearRoomHistory()
    recentRooms = []
  }

  onMount(() => {
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room')
    if (room) {
      joinCode = cleanCode(room)
      history.replaceState({}, '', window.location.pathname)
      mode = 'join'
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
    showInstallSheet = false
    window.__pwaInstallPrompt = null
  }

  function dismissInstall() {
    showInstallSheet = false
    showInstallCard = false
  }

  function openStopwatch() {
    unlockAudio()
    currentView.set('stopwatch')
  }

  function startSolo() {
    unlockAudio()
    roomState.set({ code: null, isHost: true, isSolo: true, connectedPeers: [] })
    saveRoomState({ isSolo: true, isHost: true })
    currentView.set('lobby')
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

  /** Code inputs keep only letters and digits, upper case. */
  function cleanCode(value) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
  }
</script>

<div class="view home-view">
  <!-- Live regions stay mounted so screen readers hear each change; the
       visible status lines below are for sighted users only -->
  <div class="sr-only" role="status">{connecting ? `${$t('connecting')}…` : ''}</div>
  <div class="sr-only" role="alert">{!connecting && error ? error : ''}</div>

  {#if mode === 'home'}
    <div class="top-bar">
      <div class="cluster">
        {#if showInstallCard}
          <button class="pill install-pill" onclick={() => (showInstallSheet = true)}>
            <Icon name="download" />{$t('installApp')}
          </button>
        {/if}
      </div>
      <SettingsMenu />
    </div>

    <div class="lcd well">
      <div class="brand">
        <svg class="mark" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="16" cy="16" r="13" opacity=".4" />
          <circle cx="16" cy="16" r="8" opacity=".7" />
          <circle cx="16" cy="16" r="3" fill="currentColor" stroke="none" />
        </svg>
        <h1>{$t('appName')}</h1>
      </div>
      <p class="tagline muted">{$t('tagline')}</p>

      <div class="recent">
        <div class="recent-head">
          <span class="muted">{$t('recentRooms')}</span>
          {#if recentRooms.length > 0}
            <button class="clear muted" onclick={handleClearHistory}>{$t('clear')}</button>
          {/if}
        </div>
        {#if recentRooms.length > 0}
          <div class="recent-list">
            {#each recentRooms as room (room.code + (room.joinedAt ?? ''))}
              <button class="recent-row" onclick={() => rejoinRoom(room)} disabled={connecting}>
                <span class="code tnum">{room.code}</span>
                <span class="who">{room.isHost ? $t('host') : room.isSpectator ? $t('spectator') : $t('client')}</span>
                {#if room.joinedAt}<span class="ago muted tnum">{timeAgo(room.joinedAt)}</span>{/if}
                <Icon name="chevron-right" />
              </button>
            {/each}
          </div>
        {:else}
          <p class="empty muted">{$t('noRecentRooms')}</p>
        {/if}
      </div>
    </div>

    <!-- Layout only: a column of its own in landscape, invisible in portrait -->
    <div class="keys-col">
      {#if connecting || error}
        {#if connecting}
          <div class="status" aria-hidden="true"><span class="spinner"></span>{$t('connecting')}…</div>
        {:else}
          <div class="status" aria-hidden="true"><span class="led red"></span><span class="err">{error}</span></div>
        {/if}
      {/if}

      <div class="pad">
        <button class="key key-white" onclick={createRoom} disabled={connecting}>
          <Icon name="plus" />
          <span>{$t('createRoom')}<small>{$t('createRoomHint')}</small></span>
        </button>
        <button class="key" onclick={() => openMode('join')} disabled={connecting}>
          <Icon name="arrow-right" />
          <span>{$t('join')}<small>{$t('roomCode')}</small></span>
        </button>
        <button class="key" onclick={startSolo} disabled={connecting}>
          <Icon name="user" />
          <span>{$t('soloMode')}</span>
        </button>
        <button class="key" onclick={openStopwatch} disabled={connecting}>
          <Icon name="stopwatch" />
          <span>{$t('stopwatch')}</span>
        </button>
        <button class="key key-row span-2" onclick={() => openMode('display')} disabled={connecting}>
          <Icon name="screen" />{$t('spectatorScreen')}
        </button>
      </div>
    </div>
  {:else}
    <div class="top-bar">
      <button class="btn" onclick={() => openMode('home')} disabled={connecting}>
        <Icon name="arrow-left" />{$t('back')}
      </button>
      <SettingsMenu />
    </div>

    <form class="form well" onsubmit={(e) => { e.preventDefault(); submit() }} novalidate>
      <div class="seg" role="group" aria-label={$t('joinRoom')}>
        <button type="button" aria-pressed={mode === 'join'} class:on={mode === 'join'} disabled={connecting} onclick={() => openMode('join')}>
          {$t('join')}
        </button>
        <button type="button" aria-pressed={mode === 'display'} class:on={mode === 'display'} disabled={connecting} onclick={() => openMode('display')}>
          {$t('spectator')}
        </button>
      </div>

      <div>
        <label class="field-label" for="room-code">{$t('roomCode')}</label>
        {#if mode === 'join'}
          <input
            id="room-code"
            class="input code-input tnum"
            type="text"
            bind:this={joinCodeInput}
            value={joinCode}
            oninput={(e) => { joinCode = cleanCode(e.currentTarget.value); e.currentTarget.value = joinCode }}
            placeholder={$t('enterCode')}
            maxlength="4"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            aria-invalid={!!error && joinCode.trim().length < 4}
          />
        {:else}
          <input
            id="room-code"
            class="input code-input tnum"
            type="text"
            bind:this={joinCodeInput}
            value={displayCode}
            oninput={(e) => { displayCode = cleanCode(e.currentTarget.value); e.currentTarget.value = displayCode }}
            placeholder={$t('enterCode')}
            maxlength="4"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            aria-invalid={!!error && displayCode.trim().length < 4}
          />
        {/if}
      </div>

      {#if mode === 'join'}
        <div class="two">
          <div>
            <label class="field-label" for="join-name">{$t('yourName')}</label>
            <input
              id="join-name"
              class="input"
              type="text"
              bind:value={joinName}
              placeholder={$t('name')}
              autocomplete="name"
              aria-invalid={!!error && !joinName.trim() && joinCode.trim().length === 4}
            />
          </div>
          <div>
            <label class="field-label" for="join-lane">{$t('laneNumber')}</label>
            <input
              id="join-lane"
              class="input tnum"
              type="text"
              bind:value={joinLane}
              placeholder="–"
              maxlength="3"
              inputmode="numeric"
              autocomplete="off"
              aria-invalid={!!error && !!joinName.trim() && !joinLane.trim()}
            />
          </div>
        </div>
      {:else}
        <p class="hint muted">{$t('watchDisplayHint')}</p>
      {/if}

      {#if connecting}
        <p class="form-status" aria-hidden="true"><span class="spinner"></span>{$t('connecting')}…</p>
      {:else if error}
        <p class="form-status" aria-hidden="true"><span class="led red"></span>{error}</p>
      {/if}

      <!-- Lets Enter/Go submit; not display:none, which some browsers skip -->
      <button type="submit" class="sr-only" aria-hidden="true" tabindex="-1"></button>
    </form>

    <div class="form-keys">
      <button class="key key-white" onclick={submit} disabled={connecting}>
        <Icon name={mode === 'display' ? 'screen' : 'arrow-right'} />
        <span>
          {mode === 'display' ? $t('watchDisplay') : $t('join')}
          {#if mode === 'join' && (joinName.trim() || joinLane.trim())}
            <small>{[joinLane.trim() && `${$t('lane')} ${joinLane.trim()}`, joinName.trim()].filter(Boolean).join(', ')}</small>
          {:else}
            <small>{mode === 'display' ? $t('spectatorScreen') : $t('joinRoom')}</small>
          {/if}
        </span>
      </button>
    </div>
  {/if}
</div>

{#if showInstallSheet}
  <Modal variant="sheet" onClose={() => (showInstallSheet = false)} labelledby="install-title">
    <div class="sheet-panel">
      <div class="sheet-head"><h2 id="install-title">{$t('installApp')}</h2></div>
      {#if isIos}
        <p class="install-hint">
          <Icon name="share" />{$t('installIosHint')}
        </p>
      {/if}
      <div class="key-grid">
        <button class="key key-row" onclick={dismissInstall}><Icon name="x" />{$t('later')}</button>
        {#if isIos}
          <button class="key key-row key-white" onclick={() => (showInstallSheet = false)}><Icon name="check" />OK</button>
        {:else}
          <button class="key key-row key-white" onclick={installApp}><Icon name="download" />{$t('installApp')}</button>
        {/if}
      </div>
    </div>
  </Modal>
{/if}

<style>
  /* ── Home ── */
  .lcd {
    margin: 6px var(--pad-x) 0;
    padding: 18px 20px 12px;
    display: flex;
    flex-direction: column;
    flex: 0 1 auto;
    min-height: 0;
    max-height: 340px;
    overflow: hidden;
  }

  .brand { display: flex; align-items: center; gap: 10px; }
  .mark { width: 28px; height: 28px; flex: none; }
  .brand h1 { font-size: 1.25rem; font-weight: 800; letter-spacing: -0.02em; }
  .tagline { font-size: 0.8125rem; font-weight: 600; margin: 4px 0 14px; }

  .recent { display: flex; flex-direction: column; min-height: 0; }

  .recent-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
    font-weight: 700;
    padding-bottom: 6px;
  }

  .clear { font-size: 0.75rem; font-weight: 700; padding: 6px 0 6px 12px; min-height: 44px; }

  .recent-list { overflow-y: auto; min-height: 0; }

  .recent-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    height: 46px;
    border-top: 1px solid var(--line);
    font-size: 0.875rem;
    font-weight: 600;
    text-align: left;
  }

  .recent-row .code { font-size: 1.0625rem; font-weight: 800; letter-spacing: 0.04em; width: 58px; flex: none; }
  .recent-row .who { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .recent-row :global(svg) { width: 16px; height: 16px; color: var(--faint); flex: none; }
  .recent-row:disabled { opacity: 0.5; }

  .empty { font-size: 0.8125rem; font-weight: 600; padding: 10px 0; border-top: 1px solid var(--line); }

  .status {
    margin: 10px var(--pad-x) 0;
    min-height: 44px;
    padding: 10px 16px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--muted);
    background: var(--well);
    box-shadow: var(--well-shadow);
    flex: none;
  }

  .status .err { color: var(--fg); }

  .pad {
    flex: 1 1 340px;
    min-height: 300px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1.3fr 1fr minmax(60px, auto);
    gap: 10px;
    padding: 12px var(--pad-x) 0;
  }

  .keys-col { display: contents; }

  .pad .span-2 { grid-column: span 2; }
  .pad .key span { display: block; }

  .install-pill { cursor: pointer; }

  /* ── Join and spectator form ── */
  .form {
    margin: 6px var(--pad-x) 0;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .seg {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 4px;
    border-radius: 16px;
    background: #000;
  }

  .seg button {
    height: 40px;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--muted);
  }

  .seg button.on { background: var(--key); color: var(--fg); box-shadow: var(--key-shadow); }

  .code-input {
    height: 76px;
    text-align: center;
    font-size: 2.25rem;
    font-weight: 800;
    letter-spacing: 0.4em;
    padding-left: calc(18px + 0.4em);
    text-transform: uppercase;
  }

  .code-input::placeholder { font-size: 1rem; letter-spacing: 0; font-weight: 600; }

  .two { display: grid; grid-template-columns: 1fr 96px; gap: 8px; }

  .hint { font-size: 0.875rem; font-weight: 600; line-height: 1.45; padding: 0 4px; }

  .form-status {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.875rem;
    font-weight: 700;
    padding: 0 4px;
  }

  .form-keys {
    margin-top: auto;
    padding: 12px var(--pad-x) 0;
    display: grid;
  }

  .form-keys .key { min-height: clamp(96px, 16dvh, 140px); }
  .form-keys .key span { display: block; }

  /* ── Install sheet ── */
  .install-hint {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 4px 4px 8px;
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.45;
    color: var(--muted);
  }

  .install-hint :global(svg) { width: 22px; height: 22px; flex: none; color: var(--fg); }

  @media (max-height: 640px) {
    .lcd { max-height: 220px; padding-top: 14px; }
    .tagline { margin-bottom: 8px; }
    .pad { min-height: 260px; grid-template-rows: 1.2fr 1fr minmax(52px, auto); }
  }

  /*
   * Landscape: the display panel on the left, the keypad on the right.
   * The spacer rows above and below centre the pair once the keypad row
   * reaches its cap, so keys never stretch into tall pillars.
   */
  @media (orientation: landscape) and (min-width: 640px) {
    .home-view {
      max-width: 1180px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
      grid-template-rows: auto minmax(0, 1fr) minmax(min-content, 680px) minmax(0, 1fr);
      grid-template-areas:
        'bar bar'
        '. .'
        'lcd keys'
        '. .';
    }

    .top-bar { grid-area: bar; }

    .lcd {
      grid-area: lcd;
      margin: 6px 0 0 var(--pad-x);
      max-height: none;
      padding: 26px 26px 14px;
    }

    .mark { width: 36px; height: 36px; }
    .brand { gap: 12px; }
    .brand h1 { font-size: 1.625rem; }
    .tagline { font-size: 0.875rem; margin: 6px 0 18px; }

    /* The list sits at the foot of the panel, under the brand */
    .recent { margin-top: auto; }

    .keys-col {
      grid-area: keys;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .status { margin: 6px var(--pad-x) 0 12px; }

    .pad {
      min-height: 240px;
      padding: 6px var(--pad-x) 0 12px;
      grid-template-rows: 1.3fr 1fr minmax(60px, auto);
    }

    /* Join and spectator: the form on the left, its key beside it */
    .home-view:has(> .form) {
      max-width: 920px;
      grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr) auto minmax(0, 1.4fr);
      grid-template-areas:
        'bar bar'
        '. .'
        'form keys'
        '. .';
    }

    .form { grid-area: form; margin: 6px 0 0 var(--pad-x); }

    .form-keys {
      grid-area: keys;
      margin-top: 0;
      padding: 6px var(--pad-x) 0 12px;
    }

    .form-keys .key { min-height: 140px; }
  }

  @media (orientation: landscape) and (min-width: 640px) and (max-height: 640px) {
    .lcd { padding: 16px 20px 8px; }
    .mark { width: 28px; height: 28px; }
    .brand h1 { font-size: 1.25rem; }
    .tagline { font-size: 0.8125rem; margin: 4px 0 8px; }
    .recent-row { height: 42px; }
    .pad { grid-template-rows: 1.2fr 1fr minmax(52px, auto); }
    .form { gap: 12px; padding: 12px; }
    .code-input { height: 60px; font-size: 1.875rem; }
  }
</style>
