let sentinel = null
let pending = null
let wanted = false

/**
 * Keep the screen on. Safe to call repeatedly: it holds at most one lock and
 * only asks the browser again after the OS released the previous one (for
 * example when the tab was hidden).
 */
export async function acquireWakeLock() {
  wanted = true
  if (!('wakeLock' in navigator)) return
  if (sentinel && !sentinel.released) return
  if (pending) return pending

  pending = navigator.wakeLock.request('screen')
    .then((lock) => {
      if (wanted) {
        sentinel = lock
      } else {
        // Released while the request was in flight.
        lock.release().catch(() => {})
      }
    })
    .catch(() => {
      // Denied or not available; ignore
    })
    .finally(() => {
      pending = null
    })
  return pending
}

export function releaseWakeLock() {
  wanted = false
  if (sentinel) {
    sentinel.release().catch(() => {})
    sentinel = null
  }
}
