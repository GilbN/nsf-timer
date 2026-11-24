/**
 * What the range lamp and the display show for a timer state.
 *
 * lamp: 'off' when nothing runs, 'red' while shooters must not fire
 *       (loading, targets turned away, paused, stopped), 'green' while
 *       targets face the shooters.
 * lit:  true when the display turns white. Only while targets face the
 *       shooters, so the signal still reads without colour.
 *
 * @param {{ phase: string, targetVisible: boolean }} state
 * @returns {{ lamp: 'off' | 'red' | 'green', lit: boolean }}
 */
export function signalFor(state) {
  const { phase, targetVisible } = state
  if (phase === 'idle') return { lamp: 'off', lit: false }
  if (phase === 'shooting' && targetVisible) return { lamp: 'green', lit: true }
  return { lamp: 'red', lit: false }
}

/**
 * Call `onUpdate` once, the next time `store` changes, and stop listening.
 * Used after a reconnect: the state on screen is from before the drop, so
 * the signal stays dark until the host's fresh state arrives.
 * @param {{ subscribe: (fn: (value: any) => void) => () => void }} store
 * @param {() => void} onUpdate
 * @returns {() => void} stops waiting
 */
export function onNextUpdate(store, onUpdate) {
  let initial = true
  let done = false
  /** @type {(() => void) | undefined} */
  let unsubscribe
  unsubscribe = store.subscribe(() => {
    // subscribe() calls back once at once with the current value; skip that
    if (initial) return
    if (done) return
    done = true
    onUpdate()
    unsubscribe?.()
  })
  initial = false
  return () => { done = true; unsubscribe?.() }
}
