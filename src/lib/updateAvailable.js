import { writable } from 'svelte/store'

/**
 * Whether a newer service worker version is installed and waiting.
 * Flips to true once vite-plugin-pwa's onNeedRefresh fires.
 */
export const updateAvailable = writable(false)

/**
 * Whether the user has dismissed the update modal in this session.
 * Session-only — not persisted. A full page reload clears this.
 */
export const updateDismissed = writable(false)

let _updateSW = null

/**
 * Wire up the service worker update lifecycle. Call once on app startup.
 * Safe to call in environments without service-worker support — the
 * dynamic import is guarded and failures are ignored.
 */
export async function registerUpdateHandler() {
  try {
    const { registerSW } = await import('virtual:pwa-register')
    _updateSW = registerSW({
      onNeedRefresh() {
        updateAvailable.set(true)
      },
      onOfflineReady() {
        // No-op — we don't show offline-ready UI in this app.
      },
    })
  } catch (err) {
    // Module may be unavailable in dev mode or non-SW environments.
    console.debug('[updateAvailable] SW registration skipped:', err)
  }
}

/**
 * Activate the waiting service worker and reload the page.
 * If the SW hook isn't available or fails, fall back to a plain reload —
 * the user clicked "Reload now" so their intent is clear.
 */
export async function applyUpdate() {
  try {
    if (_updateSW) {
      // Ask the waiting SW to skip waiting. vite-plugin-pwa's updateSW also
      // installs a `controllerchange` listener that reloads on activation,
      // but that path can silently no-op if the waiting SW has already been
      // activated (e.g. via DevTools). We reload explicitly below in any case.
      await _updateSW(false)
    }
  } catch (err) {
    console.error('[updateAvailable] applyUpdate failed:', err)
  } finally {
    window.location.reload()
  }
}
