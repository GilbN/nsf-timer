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
 * Whether a state left on screen across a connection drop could show a
 * live signal that is no longer true. Only a series in progress can:
 * the lobby and an idle or stopped program never light the display.
 * @param {{ programId?: string | null, phase: string }} state
 */
export function mayBeStaleSignal(state) {
  return !!state.programId && (state.phase === 'loading' || state.phase === 'shooting' || state.phase === 'paused')
}
