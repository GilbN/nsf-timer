let wakeLock = null

export async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return
  try {
    wakeLock = await navigator.wakeLock.request('screen')
  } catch {
    // Denied or not available — ignore
  }
}

export function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {})
    wakeLock = null
  }
}
