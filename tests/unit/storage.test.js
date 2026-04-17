import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveTimerState, loadTimerState, clearTimerState,
  savePreferences, loadPreferences,
  saveRoomState, loadRoomState, clearRoomState,
  saveCustomPrograms, loadCustomPrograms, updateCustomProgram, deleteCustomProgram,
  addRoomToHistory, loadRoomHistory, clearRoomHistory,
} from '../../src/lib/storage.js'

describe('timer state', () => {
  it('round-trips an object via localStorage', () => {
    const state = { phase: 'shooting', programId: 'fingrov', remainingMs: 12_000 }
    saveTimerState(state)
    expect(loadTimerState()).toEqual(state)
  })

  it('returns null when nothing is stored', () => {
    expect(loadTimerState()).toBeNull()
  })

  it('returns null when the stored value is corrupt JSON', () => {
    localStorage.setItem('nsf-timer-state', '{not-json')
    expect(loadTimerState()).toBeNull()
  })

  it('clearTimerState removes the entry', () => {
    saveTimerState({ phase: 'idle' })
    clearTimerState()
    expect(loadTimerState()).toBeNull()
  })
})

describe('preferences', () => {
  it('round-trips preferences', () => {
    const prefs = { lang: 'en', soundEnabled: false, textScale: 1.4 }
    savePreferences(prefs)
    expect(loadPreferences()).toEqual(prefs)
  })

  it('returns null when preferences are not set', () => {
    expect(loadPreferences()).toBeNull()
  })
})

describe('room state', () => {
  it('saves and loads a room entry', () => {
    const room = { code: 'ABCD', isHost: true }
    saveRoomState(room)
    expect(loadRoomState()).toEqual(room)
  })

  it('clearRoomState removes the entry', () => {
    saveRoomState({ code: 'ABCD' })
    clearRoomState()
    expect(loadRoomState()).toBeNull()
  })
})

describe('custom programs', () => {
  it('returns an empty array by default (never null)', () => {
    expect(loadCustomPrograms()).toEqual([])
  })

  it('returns an empty array when stored value is corrupt', () => {
    localStorage.setItem('nsf-timer-custom-programs', '{bad')
    expect(loadCustomPrograms()).toEqual([])
  })

  it('save/load round trip preserves program list', () => {
    const list = [{ id: 'p1', name: { no: 'A', en: 'A' }, stages: [] }]
    saveCustomPrograms(list)
    expect(loadCustomPrograms()).toEqual(list)
  })

  describe('updateCustomProgram', () => {
    it('appends a new program when id is unknown', () => {
      updateCustomProgram({ id: 'new', name: 'N' })
      expect(loadCustomPrograms()).toEqual([{ id: 'new', name: 'N' }])
    })

    it('replaces an existing program when id matches', () => {
      saveCustomPrograms([
        { id: 'a', v: 1 },
        { id: 'b', v: 1 },
      ])
      updateCustomProgram({ id: 'a', v: 2 })
      expect(loadCustomPrograms()).toEqual([
        { id: 'a', v: 2 },
        { id: 'b', v: 1 },
      ])
    })

    it('preserves order when updating', () => {
      saveCustomPrograms([
        { id: 'a' }, { id: 'b' }, { id: 'c' },
      ])
      updateCustomProgram({ id: 'b', updated: true })
      const ids = loadCustomPrograms().map(p => p.id)
      expect(ids).toEqual(['a', 'b', 'c'])
    })
  })

  describe('deleteCustomProgram', () => {
    it('removes the matching program and leaves the rest intact', () => {
      saveCustomPrograms([
        { id: 'a' }, { id: 'b' }, { id: 'c' },
      ])
      deleteCustomProgram('b')
      expect(loadCustomPrograms().map(p => p.id)).toEqual(['a', 'c'])
    })

    it('is a no-op when id is not present', () => {
      saveCustomPrograms([{ id: 'a' }])
      deleteCustomProgram('missing')
      expect(loadCustomPrograms()).toEqual([{ id: 'a' }])
    })
  })
})

describe('room history', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-17T10:00:00Z'))
  })

  it('returns an empty list when history is untouched', () => {
    expect(loadRoomHistory()).toEqual([])
  })

  it('prepends new entries so the most recent is first', () => {
    addRoomToHistory({ code: 'AAAA', isHost: true })
    vi.advanceTimersByTime(1000)
    addRoomToHistory({ code: 'BBBB', isHost: false })

    const history = loadRoomHistory()
    expect(history.map(r => r.code)).toEqual(['BBBB', 'AAAA'])
  })

  it('deduplicates when a code is revisited, moving it to the front', () => {
    addRoomToHistory({ code: 'AAAA', isHost: true })
    addRoomToHistory({ code: 'BBBB', isHost: false })
    vi.advanceTimersByTime(1000)
    addRoomToHistory({ code: 'AAAA', isHost: true })

    const history = loadRoomHistory()
    expect(history.map(r => r.code)).toEqual(['AAAA', 'BBBB'])
    expect(history.length).toBe(2)
  })

  it('caps history at 10 entries', () => {
    for (let i = 0; i < 15; i++) {
      addRoomToHistory({ code: `R${i.toString().padStart(3, '0')}` })
      vi.advanceTimersByTime(1)
    }
    const history = loadRoomHistory()
    expect(history.length).toBe(10)
    // Most recent is first
    expect(history[0].code).toBe('R014')
    expect(history[9].code).toBe('R005')
  })

  it('stamps each entry with joinedAt = Date.now()', () => {
    addRoomToHistory({ code: 'AAAA' })
    const [entry] = loadRoomHistory()
    expect(entry.joinedAt).toBe(Date.parse('2026-04-17T10:00:00Z'))
  })

  it('clearRoomHistory empties the list', () => {
    addRoomToHistory({ code: 'AAAA' })
    clearRoomHistory()
    expect(loadRoomHistory()).toEqual([])
  })
})

describe('storage resilience', () => {
  it('swallows errors when localStorage.setItem throws (quota exceeded)', () => {
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new Error('QuotaExceeded') }
    try {
      // Should not throw
      expect(() => saveTimerState({ phase: 'idle' })).not.toThrow()
    } finally {
      Storage.prototype.setItem = originalSetItem
    }
  })
})
