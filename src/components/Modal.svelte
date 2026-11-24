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

  // The browser sends clicks on ::backdrop to the <dialog> itself. Only close
  // when the press also started there, so a drag out of the panel doesn't.
  let pressedOnBackdrop = false

  /** @param {PointerEvent} e */
  function onPointerDown(e) {
    pressedOnBackdrop = e.target === dialog
  }

  /** @param {MouseEvent} e */
  function onBackdropClick(e) {
    if (pressedOnBackdrop && e.target === dialog) dialog?.close()
    pressedOnBackdrop = false
  }
</script>

<dialog bind:this={dialog} aria-labelledby={labelledby} onclose={() => onClose?.()} onpointerdown={onPointerDown} onclick={onBackdropClick}>
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
