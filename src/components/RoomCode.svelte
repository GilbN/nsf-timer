<script>
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
</script>

<button class="room-code" onclick={copyCode}>
  <span class="code">{code}</span>
  <span class="copy-hint">{copied ? $t('copied') : $t('copy')}</span>
</button>

<style>
  .room-code {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    padding: 0.3rem 0.6rem;
    border-radius: var(--radius);
    background: var(--bg-surface);
    -webkit-tap-highlight-color: transparent;
  }

  .code {
    font-family: var(--font-mono);
    font-size: 1.2rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    color: var(--accent);
  }

  .copy-hint {
    font-size: 0.7rem;
    color: var(--text-secondary);
  }
</style>
