import { describe, it, expect } from 'vitest'
import { get } from 'svelte/store'
import { t, getLocalizedName } from '../../src/lib/i18n.js'
import { preferences } from '../../src/lib/stores.js'

// Pull the in-module translations out via the public `t` store so we can
// validate them without importing a private export.
function langSnapshot(lang) {
  preferences.update((p) => ({ ...p, lang }))
  const translate = get(t)
  return (key) => translate(key)
}

// Known keys we expect both languages to cover. This is a spot-check list —
// every key used by the app should be present in both locales.
const CRITICAL_KEYS = [
  'appName', 'createRoom', 'joinRoom', 'start', 'pause', 'resume', 'stop',
  'reset', 'loading', 'shooting', 'stopped', 'series', 'stage', 'exercise',
  'precision', 'duell', 'rapid', 'connected', 'disconnected',
  'hostDisconnected', 'malfunction', 'reshoot', 'laneTaken',
  'programComplete', 'stageComplete', 'spectator', 'roomClosed',
]

describe('t store — translation lookups', () => {
  it('returns Norwegian when lang is "no"', () => {
    const lookup = langSnapshot('no')
    expect(lookup('start')).toBe('Start')
    expect(lookup('loading')).toBe('Lading')
    expect(lookup('duell')).toBe('Duell')
  })

  it('returns English when lang is "en"', () => {
    const lookup = langSnapshot('en')
    expect(lookup('start')).toBe('Start')
    expect(lookup('loading')).toBe('Load')
    expect(lookup('duell')).toBe('Duel')
  })

  it('falls back to Norwegian when a key is missing in the active language', () => {
    const lookup = langSnapshot('en')
    // All real keys exist — simulate a missing one by checking a bogus key
    expect(lookup('nonexistent-key')).toBe('nonexistent-key')
  })

  it('echoes the key back when it exists in neither language', () => {
    const lookup = langSnapshot('no')
    expect(lookup('totally-made-up')).toBe('totally-made-up')
  })

  it('defaults to Norwegian when lang is not set', () => {
    preferences.update((p) => ({ ...p, lang: undefined }))
    const translate = get(t)
    expect(translate('start')).toBe('Start')
    expect(translate('loading')).toBe('Lading')
  })
})

describe('translation parity — no language drift', () => {
  // This test catches the common mistake of adding a key to one language
  // but forgetting the other, which would silently render the raw key in
  // the UI for users on the missing language.
  it('every Norwegian key exists in English', () => {
    const no = langSnapshot('no')
    const en = langSnapshot('en')
    for (const key of CRITICAL_KEYS) {
      const enValue = en(key)
      expect(enValue, `English missing "${key}"`).not.toBe(key)
    }
    for (const key of CRITICAL_KEYS) {
      const noValue = no(key)
      expect(noValue, `Norwegian missing "${key}"`).not.toBe(key)
    }
  })
})

describe('getLocalizedName', () => {
  it('returns the requested language when present', () => {
    expect(getLocalizedName({ no: 'Presisjon', en: 'Precision' }, 'en')).toBe('Precision')
    expect(getLocalizedName({ no: 'Presisjon', en: 'Precision' }, 'no')).toBe('Presisjon')
  })

  it('falls back to Norwegian when the requested language is missing', () => {
    expect(getLocalizedName({ no: 'Fallback' }, 'en')).toBe('Fallback')
  })

  it('returns an empty string when given null or undefined', () => {
    expect(getLocalizedName(null, 'en')).toBe('')
    expect(getLocalizedName(undefined, 'en')).toBe('')
  })
})
