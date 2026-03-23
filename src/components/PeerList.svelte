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
    <span class="header-label">{$t('shooters')} <span class="peer-count">{peers.length}</span></span>
    <span class="chevron" class:open={expanded}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </span>
  </button>

  {#if expanded}
    <div class="peer-items">
      {#if peers.length === 0}
        <div class="empty">{$t('noPeers')}</div>
      {/if}

      {#each peers as peer}
        <div class="peer-item">
          <span class="peer-lane">{peer.lane ? `#${peer.lane}` : '--'}</span>
          <span class="peer-name">{peer.name || $t('anonymous')}</span>
          <div class="peer-actions">
            <span class="jam-count" class:warning={peer.jamsUsed >= 1} class:maxed={peer.jamsUsed >= 2}>
              {peer.jamsUsed}/2
            </span>
            {#if canReshoot && peer.canJam}
              <button class="btn-reshoot" onclick={() => onReshoot(peer)}>
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
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .peer-list-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary);
    border-radius: 0;
  }

  .header-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-secondary);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .peer-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: 100px;
    background: var(--bg-surface);
    color: var(--accent);
    font-size: 0.7rem;
    font-weight: 700;
  }

  .chevron {
    display: flex;
    align-items: center;
    width: 16px;
    height: 16px;
    color: var(--text-secondary);
    transition: transform 0.15s;
    opacity: 0.6;
  }

  .chevron svg { width: 100%; height: 100%; }

  .chevron.open {
    transform: rotate(180deg);
  }

  .peer-items {
    display: flex;
    flex-direction: column;
  }

  .empty {
    padding: 0.6rem 0.75rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.8rem;
  }

  .peer-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.75rem;
    border-top: 1px solid rgba(255,255,255,0.04);
  }

  .peer-lane {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--accent);
    min-width: 2.25rem;
    flex-shrink: 0;
  }

  .peer-name {
    font-size: 0.85rem;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .peer-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  .jam-count {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--text-secondary);
    white-space: nowrap;
    background: var(--bg-surface);
    padding: 0.1rem 0.4rem;
    border-radius: 100px;
  }

  .jam-count.warning { color: var(--warning); }
  .jam-count.maxed   { color: var(--danger); }

  .btn-reshoot {
    padding: 0.25rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 700;
    background: rgba(255, 181, 71, 0.12);
    color: var(--warning);
    border: 1px solid rgba(255, 181, 71, 0.3);
    border-radius: var(--radius);
    white-space: nowrap;
    letter-spacing: 0.04em;
  }

  .btn-reshoot:hover {
    background: rgba(255, 181, 71, 0.22);
  }
</style>
