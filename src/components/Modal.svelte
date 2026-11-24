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
    if (e.pointerType !== 'touch' && e.button === 0) dragStart(e.clientY, e.target)
  }

  /** @param {PointerEvent} e */
  function onPointerMove(e) {
    if (e.pointerType === 'touch' || !drag) return
    // The release can happen outside the window before the drag captured it
    if (!(e.buttons & 1)) return dragEnd(e.timeStamp, true)
    if (dragMove(e.clientY, e.timeStamp) && !dialog?.hasPointerCapture(e.pointerId)) {
      dialog?.setPointerCapture(e.pointerId)
    }
  }

  /** @param {PointerEvent} e */
  function onPointerUp(e) {
    releasedOnBackdrop = isOutside(e)
    if (e.pointerType !== 'touch') dragEnd(e.timeStamp)
  }

  // A sheet follows a downward drag and closes if it was pulled far or
  // flicked. Touch uses touch events, because on a scrollable panel the browser
  // would claim a pointer drag as a pan and cancel it. Drags only start
  // when nothing under the finger is scrolled down, so the panel still
  // scrolls back up first.
  const SLOP = 8
  const DISMISS_FRACTION = 0.3
  const DISMISS_SPEED = 0.5 // px/ms

  /** @type {{ startY: number, lastY: number, lastT: number, speed: number, offset: number, dragging: boolean } | null} */
  let drag = null

  /**
   * @param {number} y
   * @param {EventTarget | null} target
   */
  function dragStart(y, target) {
    drag = null
    if (variant !== 'sheet' || !dialog || target === dialog || !(target instanceof Element)) return
    for (let el = /** @type {Element | null} */ (target); el && el !== dialog; el = el.parentElement) {
      if (el.scrollTop > 0) return
    }
    drag = { startY: y, lastY: y, lastT: 0, speed: 0, offset: 0, dragging: false }
  }

  /**
   * @param {number} y
   * @param {number} t event timestamp in ms
   * @returns {boolean} whether this move is part of a drag
   */
  function dragMove(y, t) {
    const d = drag
    if (!d || !dialog) return false
    const dy = y - d.startY
    if (!d.dragging) {
      if (dy < -SLOP) drag = null
      if (dy <= SLOP) return false
      d.dragging = true
      dialog.getAnimations?.().forEach(a => a.cancel())
    }
    if (d.lastT && t > d.lastT) d.speed = (y - d.lastY) / (t - d.lastT)
    d.lastY = y
    d.lastT = t
    d.offset = Math.max(0, dy - SLOP)
    dialog.style.transform = `translateY(${d.offset}px)`
    return true
  }

  /**
   * @param {number} t event timestamp in ms
   * @param {boolean} [cancelled] the browser took the gesture, so only snap back
   */
  function dragEnd(t, cancelled = false) {
    const d = drag
    drag = null
    if (!d?.dragging || !dialog) return
    // A flick only counts if the finger was still moving when it lifted
    const flicked = t - d.lastT < 100 && d.speed > DISMISS_SPEED
    const el = dialog
    const from = `translateY(${d.offset}px)`
    el.style.transform = ''
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!cancelled && (d.offset > el.offsetHeight * DISMISS_FRACTION || flicked)) {
      if (reduce || !el.animate) return el.close()
      el.animate([{ transform: from }, { transform: 'translateY(100%)' }], { duration: 160, easing: 'ease-in', fill: 'forwards' })
        .finished.then(() => { if (el.open) el.close() }, () => {})
    } else if (!reduce && el.animate) {
      el.animate([{ transform: from }, { transform: 'none' }], { duration: 160, easing: 'ease-out' })
    }
  }

  $effect(() => {
    if (!dialog || variant !== 'sheet') return
    const el = dialog
    /** @param {TouchEvent} e */
    const start = (e) => {
      if (e.touches.length === 1) dragStart(e.touches[0].clientY, e.target)
      else drag = null
    }
    /** @param {TouchEvent} e */
    const move = (e) => {
      if (drag && e.touches.length === 1 && dragMove(e.touches[0].clientY, e.timeStamp) && e.cancelable) e.preventDefault()
    }
    /** @param {TouchEvent} e */
    const end = (e) => dragEnd(e.timeStamp)
    /** @param {TouchEvent} e */
    const cancel = (e) => dragEnd(e.timeStamp, true)
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', cancel)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', cancel)
    }
  })

  /** @param {MouseEvent} e */
  function onBackdropClick(e) {
    if (pressedOnBackdrop && releasedOnBackdrop && e.target === dialog) dialog?.close()
    pressedOnBackdrop = false
    releasedOnBackdrop = false
  }
</script>

<dialog bind:this={dialog} class:sheet={variant === 'sheet'} aria-labelledby={labelledby} onclose={() => { if (!unmounted) onClose?.() }} onpointerdown={onPointerDown} onpointermove={onPointerMove} onpointerup={onPointerUp} onpointercancel={(e) => { if (e.pointerType !== 'touch') dragEnd(e.timeStamp, true) }} onclick={onBackdropClick}>
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
