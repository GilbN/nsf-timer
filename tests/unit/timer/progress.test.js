import { describe, it, expect } from 'vitest'
import { forwardOptions, seriesProgress, seriesLabel, exerciseFacts, upNextText, fmtSec, clockText } from '../../../src/lib/timer/progress.js'

const t = (k) => ({ series: 'Serie', exercise: 'Øvelse', metaLoading: 'lading', metaHidden: 'skjult', metaVisible: 'synlig', metaPerSeries: 'per serie', shotsShort: 'skudd' })[k] ?? k

const program = {
  stages: [
    { name: { no: 'Presisjon', en: 'Precision' }, type: 'precision', exercises: [
      { seriesCount: 4, shotsPerSeries: 5, timePerSeries: 150, loadingTime: 60 },
      { seriesCount: 2, shotsPerSeries: 5, timePerSeries: 20, loadingTime: 60 },
    ] },
    { name: { no: 'Duell', en: 'Duel' }, type: 'duell', exercises: [
      { seriesCount: 6, shotsPerSeries: 5, shotsPerShowing: 1, targetVisibleTime: 3.29, targetHiddenTime: 7, loadingTime: 60 },
    ] },
  ],
}

const base = { phase: 'stopped', stageIndex: 0, exerciseIndex: 0, seriesIndex: 0, stoppedReason: null }

describe('forwardOptions', () => {
  it('makes Next series primary after a series finishes with more left', () => {
    const f = forwardOptions(program, { ...base, seriesIndex: 2, stoppedReason: 'seriesComplete' }, t, 'no')
    expect(f).toMatchObject({ showNextSeries: true, nextSeriesNumber: 3, primary: 'nextSeries' })
    expect(f.slot3).toEqual({ kind: 'exercise', name: 'Øvelse 2' })
  })

  it('offers the series after an aborted one', () => {
    const f = forwardOptions(program, { ...base, seriesIndex: 1, stoppedReason: 'aborted' }, t, 'no')
    expect(f.nextSeriesNumber).toBe(3)
    expect(f.primary).toBe('nextSeries')
  })

  it('moves to the next exercise when the exercise is done', () => {
    const f = forwardOptions(program, { ...base, seriesIndex: 3, stoppedReason: 'exerciseComplete' }, t, 'no')
    expect(f).toMatchObject({ showNextSeries: false, primary: 'slot3', slot3: { kind: 'exercise', name: 'Øvelse 2' } })
  })

  it('names the next stage when the stage is done', () => {
    const f = forwardOptions(program, { ...base, exerciseIndex: 1, seriesIndex: 1, stoppedReason: 'stageComplete' }, t, 'en')
    expect(f.slot3).toEqual({ kind: 'stage', name: 'Duel' })
    expect(f.primary).toBe('slot3')
  })

  it('offers the unshot series after a reshoot run from idle', () => {
    const f = forwardOptions(program, { ...base, seriesIndex: 1, stoppedReason: null }, t, 'no')
    expect(f).toMatchObject({ showNextSeries: true, nextSeriesNumber: 2, primary: 'nextSeries' })
  })

  it('offers nothing when the program is complete', () => {
    const f = forwardOptions(program, { ...base, stageIndex: 1, stoppedReason: 'programComplete' }, t, 'no')
    expect(f).toEqual({ showNextSeries: false, nextSeriesNumber: 0, slot3: null, primary: null })
  })
})

describe('seriesProgress', () => {
  const ex = program.stages[0].exercises[0]
  it('marks the running series as current', () => {
    expect(seriesProgress(ex, { phase: 'shooting', seriesIndex: 1 })).toEqual({ count: 4, done: 1, current: 1 })
  })
  it('fills every segment once the exercise is done', () => {
    expect(seriesProgress(ex, { phase: 'stopped', seriesIndex: 3, stoppedReason: 'exerciseComplete' })).toEqual({ count: 4, done: 4, current: -1 })
  })
  it('counts finished series while stopped between series', () => {
    expect(seriesProgress(ex, { phase: 'stopped', seriesIndex: 2, stoppedReason: 'seriesComplete' })).toEqual({ count: 4, done: 2, current: -1 })
  })
})

describe('labels', () => {
  it('formats seconds with one decimal when needed', () => {
    expect(fmtSec(60)).toBe('60 s')
    expect(fmtSec(3.29)).toBe('3.3 s')
  })
  it('never counts past the last series', () => {
    expect(seriesLabel(program.stages[0].exercises[0], { seriesIndex: 9 }, t)).toBe('Serie 4/4')
  })
  it('lists duel facts in the order the phases run', () => {
    expect(exerciseFacts(program.stages[1], program.stages[1].exercises[0], t)).toEqual(['60 s lading', '7 s skjult', '3.3 s synlig', '5 skudd'])
  })
  it('describes the first series before the host starts', () => {
    expect(upNextText(program, { ...base, phase: 'idle' }, t, 'no')).toBe('Serie 1/4, 60 s lading')
  })
  it('names the series the host jumped to', () => {
    expect(upNextText(program, { ...base, phase: 'idle', seriesIndex: 2 }, t, 'no')).toBe('Serie 3/4, 60 s lading')
  })
  it('says nothing while a series runs', () => {
    expect(upNextText(program, { ...base, phase: 'shooting' }, t, 'no')).toBeNull()
  })
})

describe('clockText', () => {
  const ex = { loadingTime: 60, timePerSeries: 20 }
  it('previews the loading time before the host starts', () => {
    expect(clockText({ phase: 'idle', remainingMs: 0 }, ex, 'seconds')).toBe('60')
    expect(clockText({ phase: 'idle', remainingMs: 0 }, ex, 'mmss')).toBe('1:00')
  })
  it('previews 60 s of loading when loading time is 0, like the scheduler', () => {
    expect(clockText({ phase: 'idle', remainingMs: 0 }, { loadingTime: 0, timePerSeries: 150 }, 'mmss')).toBe('1:00')
  })
  it('rounds the remaining time up to whole seconds while running', () => {
    expect(clockText({ phase: 'shooting', remainingMs: 13200 }, ex, 'seconds')).toBe('14')
    expect(clockText({ phase: 'stopped', remainingMs: 0 }, ex, 'mmss')).toBe('0:00')
  })
})
