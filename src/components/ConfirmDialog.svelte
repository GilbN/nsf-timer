<script>
  import { confirmRequest } from '../lib/confirm.js'
  import { t } from '../lib/i18n.js'
  import Modal from './Modal.svelte'
  import Icon from './ui/Icon.svelte'

  /**
   * @param {boolean} ok
   * @param {any} request the request this answer is for
   */
  function answer(ok, request) {
    // The dialog's close event fires a task after it unmounts. Ignore it
    // if a newer request has replaced this one by then.
    if (!request || $confirmRequest !== request) return
    confirmRequest.set(null)
    request.resolve(ok)
  }
</script>

{#if $confirmRequest}
  {@const request = $confirmRequest}
  {#key request}
    <Modal variant="sheet" onClose={() => answer(false, request)} labelledby="confirm-dialog-message">
      <div class="sheet-panel">
        <p id="confirm-dialog-message" class="message">{request.message}</p>
        <div class="key-grid">
          <!-- Every confirm guards a destructive action, so Enter means Cancel -->
          <!-- svelte-ignore a11y_autofocus -->
          <button class="key" autofocus onclick={() => answer(false, request)}>
            <Icon name="x" /><span>{$t('cancel')}</span>
          </button>
          <button class="key key-white" onclick={() => answer(true, request)}>
            <Icon name="check" /><span>{request.confirmLabel ?? 'OK'}</span>
          </button>
        </div>
      </div>
    </Modal>
  {/key}
{/if}

<style>
  .message {
    padding: 4px 4px 2px;
    font-size: 1.125rem;
    font-weight: 700;
    line-height: 1.4;
    letter-spacing: -0.01em;
  }

  .key { min-height: 104px; }
</style>
