import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import ModalHost from './ModalHost.svelte'

// Browsers fire a dialog's 'close' event in a later task, not inside close().
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

describe('Modal', () => {
  let app
  beforeEach(deferDialogClose)
  afterEach(() => {
    HTMLElement.prototype.dispatchEvent = realDispatch
    if (app) unmount(app)
    app = null
    document.body.innerHTML = ''
  })

  it('does not call onClose for the close it causes when the parent removes it', async () => {
    let closes = 0
    const props = $state({ show: true, onClose: () => { closes++ } })
    app = mount(ModalHost, { target: document.body, props })
    flushSync()
    expect(document.querySelector('dialog')?.open).toBe(true)

    props.show = false
    flushSync()
    await new Promise((r) => setTimeout(r, 10))
    expect(closes).toBe(0)
  })

  it('calls onClose when the user closes it', async () => {
    let closes = 0
    app = mount(ModalHost, { target: document.body, props: { onClose: () => { closes++ } } })
    flushSync()
    document.querySelector('dialog')?.close()
    await new Promise((r) => setTimeout(r, 10))
    expect(closes).toBe(1)
  })
})
