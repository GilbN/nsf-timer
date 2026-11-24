<script>
  /**
   * Native <dialog> shown as a modal while this component is mounted.
   * The browser handles focus trapping, Escape, the inert background and
   * returning focus on close. Clicking the backdrop closes it too.
   */
  let { onClose, labelledby = undefined, children } = $props()

  /** @type {HTMLDialogElement | undefined} */
  let dialog = $state()

  $effect(() => {
    if (!dialog) return
    const el = dialog
    if (!el.open) el.showModal()
    return () => {
      if (el.open) el.close()
    }
  })

  /** @param {MouseEvent} e */
  function onBackdropClick(e) {
    // Clicks on ::backdrop are dispatched to the <dialog> itself.
    if (e.target === dialog) dialog.close()
  }
</script>

<dialog bind:this={dialog} aria-labelledby={labelledby} onclose={() => onClose?.()} onclick={onBackdropClick}>
  {@render children()}
</dialog>

<style>
  dialog {
    /* global.css resets margins; auto margins centre the modal */
    margin: auto;
    padding: 0;
    border: none;
    background: transparent;
    max-width: none;
    max-height: none;
    overflow: visible;
    color: inherit;
  }

  dialog::backdrop {
    background: rgba(0, 0, 0, 0.6);
  }
</style>
