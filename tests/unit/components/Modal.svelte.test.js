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

  describe('sheet drag to dismiss', () => {
    /** @param {string} type @param {Element} target @param {number} y @param {number} t */
    function touch(type, target, y, t) {
      const touches = type === 'touchend' ? [] : [new Touch({ identifier: 1, target, clientX: 10, clientY: y })]
      const e = new TouchEvent(type, { bubbles: true, cancelable: true, touches })
      Object.defineProperty(e, 'timeStamp', { value: t })
      target.dispatchEvent(e)
      return e
    }

    /** @param {number[]} ys */
    function swipe(target, ys, dt = 50) {
      touch('touchstart', target, ys[0], 0)
      const moves = ys.slice(1).map((y, i) => touch('touchmove', target, y, (i + 1) * dt))
      touch('touchend', target, ys.at(-1), ys.length * dt)
      return moves
    }

    async function closesAfter(gesture) {
      let closes = 0
      app = mount(ModalHost, { target: document.body, props: { variant: 'sheet', onClose: () => { closes++ } } })
      flushSync()
      Object.defineProperty(document.querySelector('dialog'), 'offsetHeight', { value: 400 })
      gesture(/** @type {Element} */ (document.querySelector('dialog p')))
      await new Promise((r) => setTimeout(r, 300))
      return closes
    }

    it('closes when the sheet is pulled down', async () => {
      expect(await closesAfter((p) => {
        const moves = swipe(p, [100, 140, 220, 320], 200)
        expect(moves.every(e => e.defaultPrevented)).toBe(true)
      })).toBe(1)
    })

    it('snaps back from a short slow pull', async () => {
      expect(await closesAfter((p) => { swipe(p, [100, 115, 130, 145], 50) })).toBe(0)
    })

    it('closes on a short flick, even with one move', async () => {
      expect(await closesAfter((p) => { swipe(p, [100, 160], 30) })).toBe(1)
    })

    it('closes on a flick after holding the press', async () => {
      expect(await closesAfter((p) => {
        touch('touchstart', p, 100, 0)
        touch('touchmove', p, 105, 500)
        touch('touchmove', p, 165, 530)
        touch('touchend', p, 165, 560)
      })).toBe(1)
    })

    it('leaves a tap and an upward scroll alone', async () => {
      expect(await closesAfter((p) => {
        const moves = [...swipe(p, [100, 104]), ...swipe(p, [300, 250, 150, 400])]
        expect(moves.some(e => e.defaultPrevented)).toBe(false)
      })).toBe(0)
    })

    it('scrolls a scrolled-down panel instead of dragging it', async () => {
      expect(await closesAfter((p) => {
        Object.defineProperty(p, 'scrollTop', { value: 40 })
        swipe(p, [100, 200, 300])
      })).toBe(0)
    })

    it('follows a mouse drag too', async () => {
      expect(await closesAfter((p) => {
        const opts = { bubbles: true, pointerType: 'mouse', pointerId: 1, button: 0 }
        p.dispatchEvent(new PointerEvent('pointerdown', { ...opts, buttons: 1, clientY: 100 }))
        p.dispatchEvent(new PointerEvent('pointermove', { ...opts, buttons: 1, clientY: 400 }))
        p.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0, clientY: 400 }))
      })).toBe(1)
    })
  })
})
