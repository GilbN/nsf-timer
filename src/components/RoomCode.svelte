<script>
  import { get } from 'svelte/store'
  import { t } from '../lib/i18n.js'

  let { code = '' } = $props()
  let copied = $state(false)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      copied = true
      setTimeout(() => (copied = false), 2000)
    } catch {
      // fallback: select text
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
      // User cancelled or share failed — ignore
    }
  }
</script>

<div class="room-code-row">
  <button class="room-code" class:copied onclick={copyCode} title={$t('copy')}>
    <span class="code">{code}</span>
    {#if copied}
      <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    {:else}
      <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    {/if}
  </button>

  {#if canShare}
    <button class="share-btn" onclick={shareCode} title="Share">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
    </button>
  {/if}
</div>

<style>
  .room-code-row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .room-code {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    cursor: pointer;
    padding: 0.35rem 0.7rem;
    border-radius: var(--radius);
    background: var(--bg-surface);
    border: 1px solid rgba(255,255,255,0.06);
    transition: border-color 0.15s;
    -webkit-tap-highlight-color: transparent;
  }

  .room-code:hover {
    border-color: rgba(0, 230, 118, 0.3);
  }

  .room-code.copied {
    border-color: rgba(0, 230, 118, 0.5);
  }

  .code {
    font-family: var(--font-mono);
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: var(--accent);
  }

  .copy-icon,
  .check-icon {
    width: 14px;
    height: 14px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .check-icon {
    color: var(--accent);
  }

  .share-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.55rem 0.75rem;
    border-radius: var(--radius);
    background: var(--bg-surface);
    border: 1px solid rgba(255,255,255,0.06);
    color: var(--text-secondary);
    transition: border-color 0.15s, color 0.15s;
  }

  .share-btn:hover {
    border-color: rgba(0, 230, 118, 0.3);
    color: var(--accent);
  }

  .share-btn svg {
    width: 20px;
    height: 20px;
  }
</style>
