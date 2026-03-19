<script>
  import { roomState } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'

  let { status = 'connected' } = $props()
</script>

<div class="connection-status" class:connected={status === 'connected'} class:reconnecting={status === 'reconnecting'} class:disconnected={status === 'disconnected'}>
  <span class="dot"></span>
  <span class="label">
    {#if status === 'connected'}
      {$t('connected')}
      {#if $roomState.isHost && $roomState.connectedPeers.length > 0}
        ({$roomState.connectedPeers.length} {$t('peers')})
      {/if}
    {:else if status === 'connecting'}
      {$t('connecting')}...
    {:else if status === 'reconnecting'}
      {$t('reconnecting')}...
    {:else}
      {$t('disconnected')}
    {/if}
  </span>
</div>

<style>
  .connection-status {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-secondary);
  }

  .connected .dot {
    background: var(--accent);
  }

  .reconnecting .dot {
    background: var(--warning);
    animation: pulse 1s ease-in-out infinite;
  }

  .disconnected .dot {
    background: var(--danger);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
</style>
