<script>
  import { updateAvailable, updateDismissed, applyUpdate } from '../lib/updateAvailable.js'
  import { timerState } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'
  import Modal from './Modal.svelte'
  import Icon from './ui/Icon.svelte'

  let visible = $derived($updateAvailable && !$updateDismissed)
  let matchInProgress = $derived(
    $timerState?.phase === 'loading' || $timerState?.phase === 'shooting'
  )

  function dismiss() {
    updateDismissed.set(true)
  }

  function reload() {
    applyUpdate()
  }
</script>

{#if visible}
  <Modal variant="sheet" onClose={dismiss} labelledby="update-modal-title">
    <div class="sheet-panel">
      <div class="sheet-head">
        <h2 id="update-modal-title">{$t('updateAvailable')}</h2>
      </div>

      <p class="body">{$t('updateAvailableBody')}</p>

      {#if matchInProgress}
        <p class="warning well">{$t('reloadDuringMatchWarning')}</p>
      {/if}

      <div class="key-grid foot">
        <button class="key" onclick={dismiss}>
          <Icon name="x" /><span>{$t('later')}</span>
        </button>
        <button class="key key-white" onclick={reload}>
          <Icon name="download" /><span>{$t('reloadNow')}</span>
        </button>
      </div>
    </div>
  </Modal>
{/if}

<style>
  .body {
    padding: 0 4px;
    font-size: 0.9375rem;
    font-weight: 500;
    line-height: 1.45;
    color: var(--muted);
  }

  .warning {
    padding: 14px 16px;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.45;
  }

  .foot .key { min-height: 96px; }
</style>
