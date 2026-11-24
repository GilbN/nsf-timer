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
  </button>
  <!-- The checkmark is the visible feedback; this tells screen readers
       without widening the pill into the share button -->
  <span class="sr-only" role="status">{copied ? $t('copied') : ''}</span>
  {#if canShare}
    <button class="pill share" onclick={shareCode} aria-label={$t('share')} title={$t('share')}>
      <Icon name="share" />
    </button>
  {/if}
</span>

<style>
  .room-code { display: inline-flex; gap: 12px; min-width: 0; }
  .code { font-size: 0.9375rem; font-weight: 800; letter-spacing: 0.04em; }
  .code :global(svg) { color: var(--muted); }
  .share { width: 30px; flex: none; padding: 0; justify-content: center; }

  /* The pills stay 30px tall but take taps across a 44px area */
  .code, .share { position: relative; }
  .code::after { content: ""; position: absolute; inset: -7px -5px; }
  .share::after { content: ""; position: absolute; inset: -7px; }
  .share :global(svg) { color: var(--muted); }
</style>
