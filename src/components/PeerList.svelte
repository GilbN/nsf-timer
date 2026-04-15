<script>
  import { roomState, timerState } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'

  let { onReshoot, onClose } = $props()

  let peers = $derived($roomState.connectedPeers || [])
  let canReshoot = $derived($timerState.phase === 'stopped' || $timerState.phase === 'idle')
  let panelEl = $state(null)

  $effect(() => {
    const previouslyFocused = document.activeElement
    panelEl?.focus()
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  })
</script>

<div class="modal-backdrop" role="presentation" onclick={onClose}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="peer-list-title" tabindex="-1" bind:this={panelEl} onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2 id="peer-list-title" class="modal-title">{$t('shooters')}</h2>
      <span class="peer-count">{peers.length}</span>
    </div>

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

    <div class="modal-actions">
      <button class="btn-close" onclick={onClose}>{$t('back')}</button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-panel {
    background: var(--bg-secondary);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg, var(--radius));
    padding: 1.25rem;
    width: min(90vw, 380px);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: 0.04em;
  }

  .peer-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 100px;
    background: var(--bg-surface);
    color: var(--accent);
    font-size: 0.72rem;
    font-weight: 700;
  }

  .peer-items {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: var(--radius);
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
    gap: 0.5rem;
    padding: 0.55rem 0.75rem;
  }

  .peer-item + .peer-item {
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
    padding: 0.3rem 0.7rem;
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

  .modal-actions {
    display: flex;
    justify-content: flex-end;
  }

  .btn-close {
    padding: 0.45rem 1rem;
    font-size: 0.82rem;
    font-weight: 600;
    background: var(--bg-surface);
    color: var(--text-secondary);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: var(--radius);
  }

  .btn-close:hover {
    color: var(--text-primary);
    border-color: rgba(255,255,255,0.15);
  }
</style>
