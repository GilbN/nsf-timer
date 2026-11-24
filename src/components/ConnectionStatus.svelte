<script>
  import { t } from '../lib/i18n.js'
  import Icon from './ui/Icon.svelte'

  /**
   * variant 'pill': status light and a short label for top bars.
   * variant 'banner': white notice, shown only when something is wrong.
   */
  let { status = 'connected', variant = 'pill' } = $props()

  let ok = $derived(status === 'connected')
  let busy = $derived(status === 'reconnecting' || status === 'connecting' || status === 'hostDisconnected')

  let label = $derived.by(() => {
    if (status === 'connected') return $t('connected')
    if (status === 'connecting') return $t('connecting')
    if (status === 'reconnecting') return $t('reconnecting')
    if (status === 'hostDisconnected') return $t('hostDisconnected')
    if (status === 'roomClosed') return $t('roomClosed')
    return $t('disconnected')
  })

  // One line under the banner title on what happens next
  let hint = $derived.by(() => {
    if (status === 'roomClosed') return ''
    if (busy) return $t('waitingForHost')
    return $t('lostConnection')
  })
</script>

{#if variant === 'pill'}
  <span class="pill" class:dim={!ok} role="status">
    {#if busy}
      <span class="spinner small" aria-hidden="true"></span>
    {:else}
      <span class="led" class:red={!ok}></span>
    {/if}
    <span class="label">{label}</span>
  </span>
{:else if variant === 'banner' && !ok}
  <div class="banner" role="alert">
    <Icon name="wifi-off" />
    <div>
      {label}{busy ? '…' : ''}
      {#if hint}<small>{hint}</small>{/if}
    </div>
  </div>
{/if}

<style>
  /* Narrow phones: the room code, share and menu need the room; keep the light */
  @media (max-width: 379px) {
    .label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  }

  .pill.dim { color: var(--muted); }

  .spinner.small {
    width: 12px;
    height: 12px;
    border-width: 1.5px;
  }

  .banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 20px;
    background: var(--fg);
    color: var(--ink);
    font-size: 0.9375rem;
    font-weight: 800;
  }

  .banner :global(svg) { width: 20px; height: 20px; flex: none; stroke-width: 2.25; }
  .banner small { display: block; font-size: 0.75rem; font-weight: 600; color: var(--ink-soft); }
</style>
