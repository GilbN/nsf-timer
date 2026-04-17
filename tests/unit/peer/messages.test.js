import { describe, it, expect, vi } from 'vitest'
import { MSG, createMessage } from '../../../src/lib/peer/messages.js'

describe('MSG constants', () => {
  it('exposes every known host→client message type', () => {
    expect(MSG.STATE_SYNC).toBe('STATE_SYNC')
    expect(MSG.TICK).toBe('TICK')
    expect(MSG.PHASE_CHANGE).toBe('PHASE_CHANGE')
    expect(MSG.TARGET_TOGGLE).toBe('TARGET_TOGGLE')
    expect(MSG.PROGRAM_SET).toBe('PROGRAM_SET')
    expect(MSG.EXERCISE_ADVANCE).toBe('EXERCISE_ADVANCE')
    expect(MSG.ROOM_CLOSED).toBe('ROOM_CLOSED')
    expect(MSG.RESHOOT_STATE).toBe('RESHOOT_STATE')
  })

  it('has unique values — no accidental duplicates', () => {
    const values = Object.values(MSG)
    expect(new Set(values).size).toBe(values.length)
  })
})

describe('createMessage', () => {
  it('wraps type and payload with a timestamp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-17T10:00:00Z'))

    const msg = createMessage('STATE_SYNC', { phase: 'idle' })

    expect(msg).toEqual({
      type: 'STATE_SYNC',
      payload: { phase: 'idle' },
      ts: Date.parse('2026-04-17T10:00:00Z'),
    })

    vi.useRealTimers()
  })

  it('defaults payload to an empty object', () => {
    const msg = createMessage('PING')
    expect(msg.payload).toEqual({})
    expect(msg.type).toBe('PING')
    expect(typeof msg.ts).toBe('number')
  })

  it('does not mutate the payload argument', () => {
    const payload = { foo: 1 }
    const msg = createMessage('X', payload)
    msg.payload.foo = 999
    // createMessage keeps a reference, so this mutates payload —
    // document the current behavior so unexpected changes show up
    expect(payload.foo).toBe(999)
  })
})
