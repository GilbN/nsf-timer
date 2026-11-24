import { writable } from 'svelte/store'

/**
 * The confirmation currently on screen, if any. ConfirmDialog renders it.
 * @type {import('svelte/store').Writable<{ message: string, confirmLabel?: string, resolve: (ok: boolean) => void } | null>}
 */
export const confirmRequest = writable(null)

/**
 * In-app replacement for window.confirm().
 * @param {string} message
 * @param {string} [confirmLabel] label for the confirm button
 * @returns {Promise<boolean>}
 */
export function confirmAction(message, confirmLabel) {
  return new Promise((resolve) => {
    confirmRequest.update((previous) => {
      previous?.resolve(false)
      return { message, confirmLabel, resolve }
    })
  })
}
