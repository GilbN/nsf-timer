<script>
  import { get } from 'svelte/store'
  import { currentView, roomState } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'
  import { confirmAction } from '../lib/confirm.js'
  import { saveRoomState } from '../lib/storage.js'
  import { session, startScheduler, rememberRoom, endSession } from '../lib/session.js'
  import RoomCode from '../components/RoomCode.svelte'
  import ConnectionStatus from '../components/ConnectionStatus.svelte'
  import ProgramPicker from '../components/ProgramPicker.svelte'
  import ProgramEditor from '../components/ProgramEditor.svelte'
  import SettingsMenu from '../components/SettingsMenu.svelte'

  let showEditor = $state(false)
  let editingProgram = $state(null)

  let peerCount = $derived($roomState.connectedPeers.length)

  function selectProgram(programId) {
    startScheduler(programId)
    saveRoomState({
      code: $roomState.code,
      isHost: true,
      isSolo: $roomState.isSolo,
      hostToken: session.host?.hostToken,
      programId,
    })
    currentView.set('timer')
  }

  function handleCustomSave(program) {
    const wasEditing = editingProgram !== null
    showEditor = false
    editingProgram = null
    if (!wasEditing) {
      selectProgram(program.id)
    }
  }

  function handleEdit(program) {
    editingProgram = JSON.parse(JSON.stringify(program))
    showEditor = true
  }

  async function disconnect() {
    if (!(await confirmAction(get(t)('confirmDisconnect'), get(t)('disconnect')))) return
    rememberRoom()
    endSession()
  }

  // Koble fra lives in the menu, away from the program keys
  let menuActions = $derived([
    { id: 'disconnect', label: $t('disconnect'), icon: 'logout', onSelect: disconnect, danger: true },
  ])
</script>

<div class="view lobby-view">
  <div class="top-bar">
    <div class="cluster">
      {#if $roomState.isSolo}
        <span class="pill">{$t('soloMode')}</span>
      {:else}
        <RoomCode code={$roomState.code ?? ''} />
        <ConnectionStatus status="connected" variant="pill" />
      {/if}
    </div>
    <SettingsMenu actions={menuActions} />
  </div>

  {#if !showEditor && !$roomState.isSolo}
    <!-- The code is set large so shooters can read it off the host's phone -->
    <div class="room well">
      <span class="label muted">{$t('roomCode')}</span>
      <span class="code tnum">{$roomState.code ?? ''}</span>
      <span class="peers">
        <span class="led" class:off={peerCount === 0}></span>
        {#if peerCount > 0}
          <span class="tnum">{peerCount}</span> {$t('peers').toLowerCase()}
        {:else}
          <span class="muted">{$t('noPeers')}</span>
        {/if}
      </span>
    </div>
  {/if}

  <div class="content">
    {#if showEditor}
      <ProgramEditor onSave={handleCustomSave} onCancel={() => { showEditor = false; editingProgram = null }} editProgram={editingProgram} />
    {:else}
      <ProgramPicker onSelect={selectProgram} onCustom={() => (showEditor = true)} onEdit={handleEdit} />
    {/if}
  </div>
</div>

<style>
  .room {
    margin: 4px var(--pad-x) 14px;
    padding: 16px 20px 18px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: none;
  }

  .label { font-size: 0.75rem; font-weight: 700; }

  .code {
    font-size: 3.25rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    line-height: 1.05;
  }

  .peers {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    font-size: 0.875rem;
    font-weight: 700;
  }

  .content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 var(--pad-x) 4px;
    -webkit-overflow-scrolling: touch;
  }
</style>
