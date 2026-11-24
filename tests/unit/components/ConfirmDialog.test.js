import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, unmount, flushSync, tick } from 'svelte'
import { get } from 'svelte/store'
import ConfirmDialog from '../../../src/components/ConfirmDialog.svelte'
import { confirmAction, confirmRequest } from '../../../src/lib/confirm.js'

// Browsers fire a dialog's 'close' event in a later task, not inside
// close(). Make the test DOM do the same.
const realDispatch = HTMLElement.prototype.dispatchEvent
const deferred = new WeakSet()
function deferDialogClose() {
  HTMLElement.prototype.dispatchEvent = function (event) {
    if (this instanceof HTMLDialogElement && event.type === 'close' && !deferred.has(event)) {
      deferred.add(event)
      setTimeout(() => this.dispatchEvent(event))
      return true
    }
    return realDispatch.call(this, event)
  }
}

describe('ConfirmDialog', () => {
  let app
  beforeEach(deferDialogClose)
  afterEach(() => {
    HTMLElement.prototype.dispatchEvent = realDispatch
    if (app) unmount(app)
    app = null
    confirmRequest.set(null)
    document.body.innerHTML = ''
  })

  it('keeps a confirm that replaces one still on screen', async () => {
    app = mount(ConfirmDialog, { target: document.body })
    const first = confirmAction('First?', 'OK')
    flushSync()

    // A second confirm arrives while the first dialog is still open. The
    // first answers false and its dialog unmounts, firing a late close.
    let secondAnswer = 'pending'
    confirmAction('Second?', 'OK').then((ok) => { secondAnswer = ok })
    flushSync()
    await expect(first).resolves.toBe(false)
    await new Promise((r) => setTimeout(r, 20))
    await tick()

    expect(secondAnswer).toBe('pending')
    expect(get(confirmRequest)?.message).toBe('Second?')
    expect(document.querySelector('dialog')?.open).toBe(true)
  })

  it('answers false when the dialog is closed with Escape', async () => {
    app = mount(ConfirmDialog, { target: document.body })
    const answer = confirmAction('Sure?', 'OK')
    flushSync()
    const dialog = document.querySelector('dialog')
    dialog.close() // what Escape does
    await new Promise((r) => setTimeout(r, 10))
    await expect(answer).resolves.toBe(false)
  })
})
