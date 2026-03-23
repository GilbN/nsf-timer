<script>
  import { t } from '../lib/i18n.js'

  let { status = 'connected', variant = 'dot' } = $props()
</script>

{#if variant === 'dot'}
  <span class="dot" class:reconnecting={status === 'reconnecting'} class:disconnected={status === 'disconnected'}></span>
{:else if variant === 'banner' && (status === 'reconnecting' || status === 'disconnected')}
  <div class="status-banner" class:reconnecting={status === 'reconnecting'} class:disconnected={status === 'disconnected'}>
    <span class="banner-dot"></span>
    <span class="banner-label">
      {status === 'reconnecting' ? `${$t('reconnecting')}…` : $t('disconnected')}
    </span>
  </div>
{/if}

<style>
  /* ── Top-bar dot ── */
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
  }

  .dot.reconnecting {
    background: var(--warning);
    animation: pulse 1s ease-in-out infinite;
  }

  .dot.disconnected {
    background: var(--danger);
  }

  /* ── Banner ── */
  .status-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.45rem 1rem;
    border-radius: var(--radius);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    border: 1px solid;
  }

  .status-banner.reconnecting {
    background: rgba(255, 181, 71, 0.1);
    border-color: rgba(255, 181, 71, 0.2);
    color: var(--warning);
  }

  .status-banner.disconnected {
    background: rgba(255, 82, 82, 0.1);
    border-color: rgba(255, 82, 82, 0.2);
    color: var(--danger);
  }

  .banner-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  .reconnecting .banner-dot {
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.25; }
  }
</style>
