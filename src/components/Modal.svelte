<script>
  /**
   * Native <dialog> shown as a modal while this component is mounted.
   * The browser handles focus trapping, Escape, the inert background and
   * returning focus on close. Clicking the backdrop closes it too.
   */
  let { onClose, labelledby = undefined, children } = $props()

  /** @type {HTMLDialogElement | undefined} */
  let dialog = $state()

  // Set when the parent removes the modal. Closing the dialog then queues a
  // 'close' event that must not reach onClose, or it could answer whatever
  // the parent shows next.
  let unmounted = false

  $effect(() => {
    if (!dialog) return
    const el = dialog
    if (!el.open) el.showModal()
    return () => {
      unmounted = true
      if (el.open) el.close()
    }
  })

  // The browser sends clicks on ::backdrop to the <dialog> itself, and a
  // drag between the panel and the backdrop also lands there. Only close
  // when both the press and the release were on the backdrop.
  let pressedOnBackdrop = false
  let releasedOnBackdrop = false

  /** @param {PointerEvent} e */
  function onPointerDown(e) {
    pressedOnBackdrop = e.target === dialog
  }

  /** @param {PointerEvent} e */
  function onPointerUp(e) {
    releasedOnBackdrop = e.target === dialog
  }

  /** @param {MouseEvent} e */
  function onBackdropClick(e) {
    if (pressedOnBackdrop && releasedOnBackdrop && e.target === dialog) dialog?.close()
    pressedOnBackdrop = false
    releasedOnBackdrop = false
  }
</script>

<dialog bind:this={dialog} aria-labelledby={labelledby} onclose={() => { if (!unmounted) onClose?.() }} onpointerdown={onPointerDown} onpointerup={onPointerUp} onclick={onBackdropClick}>
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
