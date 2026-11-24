<script>
  import { roomState, timerState } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'
  import Modal from './Modal.svelte'
  import Icon from './ui/Icon.svelte'

  let { onReshoot, onClose } = $props()

  let peers = $derived($roomState.connectedPeers || [])
  let canReshoot = $derived($timerState.phase === 'stopped' || $timerState.phase === 'idle')
</script>

<Modal variant="sheet" {onClose} labelledby="peer-list-title">
  <div class="sheet-panel">
    <div class="sheet-head">
      <h2 id="peer-list-title">{$t('shooters')}</h2>
      <span class="count tnum">{peers.length}</span>
    </div>

    {#if peers.length === 0}
      <div class="empty well">{$t('noPeers')}</div>
    {:else}
      <ul class="peers">
        {#each peers as peer (peer.peerId)}
          <li class="peer">
            <span class="lane well tnum">{peer.lane || '–'}</span>
            <span class="name" class:muted={!peer.name}>{peer.name || $t('anonymous')}</span>
            <span class="jams" role="img" aria-label="{$t('malfunction')} {peer.jamsUsed}/2">
              <i class:used={peer.jamsUsed >= 1}></i><i class:used={peer.jamsUsed >= 2}></i>
            </span>
            {#if canReshoot && peer.canJam}
              <button class="btn btn-white reshoot" onclick={() => onReshoot(peer)}>{$t('reshoot')}</button>
            {:else if canReshoot}
              <!-- No button: either both malfunctions are used, or one was used in this stage -->
              <span class="reshoot none tnum">{peer.jamsUsed >= 2 ? `0 ${$t('jamsRemaining')}` : $t('usedThisStage')}</span>
            {/if}
          </li>
        {/each}
      </ul>
      <p class="legend"><span class="jams" aria-hidden="true"><i class="used"></i><i></i></span>{$t('malfunction')}. {$t('malfunctionLimit')}</p>
    {/if}

    <button class="key key-row key-center back" onclick={onClose}>
      <Icon name="arrow-left" />{$t('back')}
    </button>
  </div>
</Modal>

<style>
  .count {
    display: inline-grid;
    place-items: center;
    min-width: 30px;
    height: 30px;
    padding: 0 8px;
    border-radius: 999px;
    background: var(--key);
    font-size: 0.8125rem;
    font-weight: 800;
    color: var(--fg);
  }

  .empty {
    padding: 22px 18px;
    text-align: center;
    color: var(--muted);
    font-weight: 600;
  }

  .peers { list-style: none; display: flex; flex-direction: column; gap: 8px; }

  .peer {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 60px;
    padding: 8px 8px 8px 8px;
    border-radius: 20px;
    background: var(--key);
    box-shadow: var(--key-shadow);
  }

  .lane {
    width: 42px;
    height: 42px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    font-size: 1rem;
    font-weight: 800;
    flex: none;
  }

  .name {
    flex: 1;
    min-width: 0;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .jams { display: inline-flex; gap: 4px; flex: none; }
  .jams i { width: 9px; height: 9px; border-radius: 3px; box-shadow: inset 0 0 0 1.5px #6e6e73; }
  .jams i.used { background: var(--fg); box-shadow: none; }

  .reshoot { height: 40px; border-radius: 12px; padding: 0 12px; }
  .reshoot.none {
    display: inline-flex;
    align-items: center;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--muted);
    padding: 0 8px;
    min-width: 86px;
    justify-content: flex-end;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 6px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted);
  }

  .back { min-height: 56px; }
</style>
