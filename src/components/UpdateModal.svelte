<script>
  import { updateAvailable, updateDismissed, applyUpdate } from '../lib/updateAvailable.js'
  import { timerState } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'

  let visible = $derived($updateAvailable && !$updateDismissed)
  let panelEl = $state(null)
  let matchInProgress = $derived(
    $timerState?.phase === 'loading' || $timerState?.phase === 'shooting'
  )

  function dismiss() {
    updateDismissed.set(true)
  }

  function reload() {
    applyUpdate()
  }

  $effect(() => {
    if (!visible) return
    const previouslyFocused = document.activeElement
    panelEl?.focus()
    function onKey(e) { if (e.key === 'Escape') dismiss() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  })
</script>

{#if visible}
  <div class="modal-backdrop" role="presentation" onclick={dismiss}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="modal-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-modal-title"
      tabindex="-1"
      bind:this={panelEl}
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <h2 id="update-modal-title" class="modal-title">{$t('updateAvailable')}</h2>
      </div>

      <p class="modal-body">{$t('updateAvailableBody')}</p>

      {#if matchInProgress}
        <p class="modal-warning">{$t('reloadDuringMatchWarning')}</p>
      {/if}

      <div class="modal-actions">
        <button class="btn-secondary" onclick={dismiss}>{$t('later')}</button>
        <button class="btn-primary" onclick={reload}>{$t('reloadNow')}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 300;
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
    width: min(90vw, 420px);
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

  .modal-body {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
    line-height: 1.45;
  }

  .modal-warning {
    margin: 0;
    padding: 0.6rem 0.75rem;
    font-size: 0.82rem;
    color: var(--warning);
    background: rgba(255, 181, 71, 0.12);
    border: 1px solid rgba(255, 181, 71, 0.3);
    border-radius: var(--radius);
    line-height: 1.4;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .btn-primary {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    font-weight: 700;
    background: var(--accent);
    color: var(--bg-primary);
    border: none;
    border-radius: var(--radius);
    letter-spacing: 0.04em;
  }

  .btn-primary:hover {
    filter: brightness(1.1);
  }

  .btn-secondary {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    background: var(--bg-surface);
    color: var(--text-secondary);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius);
  }

  .btn-secondary:hover {
    color: var(--text-primary);
    border-color: rgba(255, 255, 255, 0.15);
  }
</style>
