import { describe, it, expect } from 'vitest'
import { signalFor } from '../../src/lib/signal.js'

describe('signalFor', () => {
  it('keeps the lamp off and the display dark while idle', () => {
    expect(signalFor({ phase: 'idle', targetVisible: false })).toEqual({ lamp: 'off', lit: false })
  })

  it('shows green and lights the display only while targets face the shooters', () => {
    expect(signalFor({ phase: 'shooting', targetVisible: true })).toEqual({ lamp: 'green', lit: true })
  })

  it.each([
    ['loading', false],
    ['shooting', false],
    ['paused', true],
    ['stopped', false],
  ])('shows red during %s (targetVisible %s)', (phase, targetVisible) => {
    expect(signalFor({ phase, targetVisible })).toEqual({ lamp: 'red', lit: false })
  })
})

describe('onNextUpdate', () => {
  it('waits for the next change, not the current value', async () => {
    const { writable } = await import('svelte/store')
    const { onNextUpdate } = await import('../../src/lib/signal.js')
    const store = writable(1)
    let calls = 0
    onNextUpdate(store, () => { calls++ })
    expect(calls).toBe(0)
    store.set(2)
    expect(calls).toBe(1)
    store.set(3)
    expect(calls).toBe(1)
  })

  it('can be cancelled before anything arrives', async () => {
    const { writable } = await import('svelte/store')
    const { onNextUpdate } = await import('../../src/lib/signal.js')
    const store = writable(1)
    let calls = 0
    const stop = onNextUpdate(store, () => { calls++ })
    stop()
    store.set(2)
    expect(calls).toBe(0)
  })
})
