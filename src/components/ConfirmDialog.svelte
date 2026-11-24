<script>
  import { confirmRequest } from '../lib/confirm.js'
  import { t } from '../lib/i18n.js'
  import Modal from './Modal.svelte'

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
    <Modal onClose={() => answer(false, request)} labelledby="confirm-dialog-message">
      <div class="modal-panel">
        <p id="confirm-dialog-message" class="modal-body">{request.message}</p>
        <div class="modal-actions">
          <!-- Every confirm guards a destructive action, so Enter means Cancel -->
          <!-- svelte-ignore a11y_autofocus -->
          <button class="btn-secondary" autofocus onclick={() => answer(false, request)}>{$t('cancel')}</button>
          <button class="btn-primary" onclick={() => answer(true, request)}>
            {request.confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </Modal>
  {/key}
{/if}

<style>
  .modal-panel {
    background: var(--bg-secondary);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg, var(--radius));
    padding: 1.25rem;
    width: min(90vw, 380px);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .modal-body {
    margin: 0;
    font-size: 0.95rem;
    color: var(--text-primary);
    line-height: 1.45;
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
