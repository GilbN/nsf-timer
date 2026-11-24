<script>
  /**
   * Native <dialog> shown as a modal while this component is mounted.
   * The browser handles focus trapping, Escape, the inert background and
   * returning focus on close. Clicking the backdrop closes it too.
   */
  let { onClose, labelledby = undefined, variant = 'dialog', children } = $props()

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
  // drag between the panel and the backdrop also lands there. Touch input
  // captures the pointer, so the release target can't be trusted either.
  // Only close when the press and the release were both outside the
  // dialog's box, which is the panel's box.
  let pressedOnBackdrop = false
  let releasedOnBackdrop = false

  /** @param {PointerEvent} e */
  function isOutside(e) {
    if (!dialog) return false
    const r = dialog.getBoundingClientRect()
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
  }

  /** @param {PointerEvent} e */
  function onPointerDown(e) {
    pressedOnBackdrop = e.target === dialog && isOutside(e)
  }

  /** @param {PointerEvent} e */
  function onPointerUp(e) {
    releasedOnBackdrop = isOutside(e)
  }

  /** @param {MouseEvent} e */
  function onBackdropClick(e) {
    if (pressedOnBackdrop && releasedOnBackdrop && e.target === dialog) dialog?.close()
    pressedOnBackdrop = false
    releasedOnBackdrop = false
  }
</script>

<dialog bind:this={dialog} class:sheet={variant === 'sheet'} aria-labelledby={labelledby} onclose={() => { if (!unmounted) onClose?.() }} onpointerdown={onPointerDown} onpointerup={onPointerUp} onclick={onBackdropClick}>
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
    background: rgba(0, 0, 0, 0.66);
  }

  /* Bottom sheet: pinned to the bottom edge, within thumb reach */
  dialog.sheet {
    margin: auto auto 0;
    width: 100%;
    max-width: 560px;
  }

  @media (prefers-reduced-motion: no-preference) {
    dialog.sheet[open] { animation: sheet-in 0.18s ease-out; }
    dialog:not(.sheet)[open] { animation: dialog-in 0.14s ease-out; }
  }

  @keyframes sheet-in { from { transform: translateY(24px); opacity: 0.6; } }
  @keyframes dialog-in { from { transform: scale(0.97); opacity: 0; } }
</style>
