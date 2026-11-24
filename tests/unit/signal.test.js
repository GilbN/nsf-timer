import { describe, it, expect } from 'vitest'
import { signalFor, mayBeStaleSignal } from '../../src/lib/signal.js'

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

describe('mayBeStaleSignal', () => {
  it('flags a series in progress', () => {
    expect(mayBeStaleSignal({ programId: 'standard', phase: 'shooting' })).toBe(true)
    expect(mayBeStaleSignal({ programId: 'standard', phase: 'loading' })).toBe(true)
    expect(mayBeStaleSignal({ programId: 'standard', phase: 'paused' })).toBe(true)
  })

  it('leaves the lobby and a resting program alone', () => {
    expect(mayBeStaleSignal({ programId: null, phase: 'idle' })).toBe(false)
    expect(mayBeStaleSignal({ programId: 'standard', phase: 'idle' })).toBe(false)
    expect(mayBeStaleSignal({ programId: 'standard', phase: 'stopped' })).toBe(false)
  })
})
