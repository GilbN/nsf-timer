<script>
  import { roomState, timerState } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'

  let { onReshoot } = $props()

  let peers = $derived($roomState.connectedPeers || [])
  let canReshoot = $derived($timerState.phase === 'stopped' || $timerState.phase === 'idle')
  let expanded = $state(true)
</script>

<div class="peer-list">
  <button class="peer-list-header" onclick={() => expanded = !expanded}>
    <span>{$t('shooters')} ({peers.length})</span>
    <span class="chevron" class:open={expanded}></span>
  </button>

  {#if expanded}
    <div class="peer-items">
      {#if peers.length === 0}
        <div class="empty">{$t('noPeers')}</div>
      {/if}

      {#each peers as peer}
        <div class="peer-item">
          <div class="peer-info">
            <span class="peer-lane">
              {#if peer.lane}
                #{peer.lane}
              {:else}
                --
              {/if}
            </span>
            <span class="peer-name">{peer.name || $t('anonymous')}</span>
          </div>

          <div class="peer-actions">
            <span class="jam-count" class:warning={peer.jamsUsed >= 1} class:maxed={peer.jamsUsed >= 2}>
              {$t('malfunctionShort')} {peer.jamsUsed}/2
            </span>
            {#if canReshoot && peer.jamsUsed < 2}
              <button
                class="btn-reshoot"
                onclick={() => onReshoot(peer)}
                title={$t('reshoot')}
              >
                {$t('reshoot')}
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .peer-list {
    border: 1px solid var(--bg-surface);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .peer-list-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0.8rem;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 0.85rem;
    font-weight: 600;
    border-radius: 0;
  }

  .chevron {
    display: inline-block;
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 5px solid var(--text-secondary);
    transition: transform 0.15s;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .peer-items {
    display: flex;
    flex-direction: column;
  }

  .empty {
    padding: 0.75rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .peer-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.8rem;
    border-top: 1px solid var(--bg-surface);
    gap: 0.5rem;
  }

  .peer-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .peer-lane {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--accent);
    min-width: 2.5rem;
  }

  .peer-name {
    font-size: 0.9rem;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .peer-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .jam-count {
    font-size: 0.75rem;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .jam-count.warning {
    color: var(--warning);
  }

  .jam-count.maxed {
    color: var(--danger);
  }

  .btn-reshoot {
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
    font-weight: 600;
    background: var(--warning);
    color: var(--bg-primary);
    border-radius: var(--radius);
    white-space: nowrap;
  }

  .btn-reshoot:hover {
    background: #e68900;
  }
</style>
