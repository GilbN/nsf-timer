<script>
  import { get } from 'svelte/store'
  import { t } from '../lib/i18n.js'
  import Icon from './ui/Icon.svelte'

  let { code = '' } = $props()
  let copied = $state(false)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      copied = true
      setTimeout(() => (copied = false), 2000)
    } catch {
      // Clipboard blocked: the code is on screen to read out
    }
  }

  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  async function shareCode() {
    const shareUrl = window.location.origin + window.location.pathname + '?room=' + code
    const shareText = get(t)('shareRoomPrefix') + ' ' + code
    try {
      await navigator.share({
        title: get(t)('appName'),
        text: shareText,
        url: shareUrl,
      })
    } catch {
      // User cancelled or share failed
    }
  }
</script>

<span class="room-code">
  <button class="pill code" onclick={copyCode} aria-label="{$t('copy')} {code}" title={$t('copy')}>
    <span class="tnum">{code}</span>
    <Icon name={copied ? 'check' : 'copy'} />
    {#if copied}<span class="copied" role="status">{$t('copied')}</span>{/if}
  </button>
  {#if canShare}
    <button class="pill share" onclick={shareCode} aria-label={$t('share')} title={$t('share')}>
      <Icon name="share" />
    </button>
  {/if}
</span>

<style>
  .room-code { display: inline-flex; gap: 6px; min-width: 0; }
  .code { font-size: 0.9375rem; font-weight: 800; letter-spacing: 0.04em; }
  .code :global(svg) { color: var(--muted); }
  .copied { font-size: 0.75rem; font-weight: 700; color: var(--muted); letter-spacing: 0; }
  .share { width: 30px; padding: 0; justify-content: center; }

  /* The pills stay 30px tall but take taps across a 44px area */
  .room-code { gap: 10px; }
  .code, .share { position: relative; }
  .code::after, .share::after { content: ""; position: absolute; inset: -7px -5px; }
  .share :global(svg) { color: var(--muted); }
</style>
