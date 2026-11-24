/**
 * Pure helpers that describe where a program run stands and what the host
 * can do next. Views pass in the translator `t` and the language so these
 * stay free of Svelte stores and easy to test.
 */
import { getLocalizedName } from '../i18n.js'

/** @typedef {(key: string) => string} Translate */

/**
 * @param {any} program
 * @param {{ stageIndex: number, exerciseIndex: number }} ts
 */
export function contextFor(program, ts) {
  const stage = program?.stages?.[ts.stageIndex] ?? null
  const exercise = stage?.exercises?.[ts.exerciseIndex] ?? null
  return { stage, exercise }
}

/** Seconds as "60 s", keeping one decimal for times like 3.29 s. */
export function fmtSec(s) {
  if (s == null) return ''
  return Number.isInteger(s) ? `${s} s` : `${Math.round(s * 10) / 10} s`
}

/**
 * Series the meter shows as finished, and the one in progress.
 * After a natural finish the scheduler has already moved seriesIndex on.
 * @param {any} exercise
 * @param {{ phase: string, seriesIndex: number, stoppedReason?: string | null }} ts
 */
export function seriesProgress(exercise, ts) {
  const count = exercise?.seriesCount ?? 0
  const reason = ts.stoppedReason
  if (ts.phase === 'stopped' && (reason === 'exerciseComplete' || reason === 'stageComplete' || reason === 'programComplete')) {
    return { count, done: count, current: -1 }
  }
  if (ts.phase === 'stopped') {
    return { count, done: Math.min(ts.seriesIndex, count), current: -1 }
  }
  return { count, done: Math.min(ts.seriesIndex, count), current: ts.seriesIndex }
}

/**
 * "Serie 2/4". After a natural finish this names the upcoming series,
 * matching the Next series key.
 * @param {any} exercise
 * @param {{ seriesIndex: number }} ts
 * @param {Translate} t
 */
export function seriesLabel(exercise, ts, t) {
  if (!exercise) return ''
  const n = Math.min(ts.seriesIndex + 1, exercise.seriesCount)
  return `${t('series')} ${n}/${exercise.seriesCount}`
}

/**
 * Short facts about the current exercise, in the order the phases run:
 * loading, then hidden/visible or time per series, then shots.
 * @param {any} stage
 * @param {any} exercise
 * @param {Translate} t
 * @returns {string[]}
 */
export function exerciseFacts(stage, exercise, t) {
  if (!stage || !exercise) return []
  const parts = []
  if (exercise.loadingTime) parts.push(`${fmtSec(exercise.loadingTime)} ${t('metaLoading')}`)
  if (stage.type === 'duell' && exercise.targetVisibleTime && exercise.targetHiddenTime) {
    parts.push(`${fmtSec(exercise.targetHiddenTime)} ${t('metaHidden')}`)
    parts.push(`${fmtSec(exercise.targetVisibleTime)} ${t('metaVisible')}`)
  } else if (exercise.targetHiddenTime && exercise.timePerSeries) {
    parts.push(`${fmtSec(exercise.targetHiddenTime)} ${t('metaHidden')}`)
    parts.push(`${fmtSec(exercise.timePerSeries)} ${t('metaVisible')}`)
  } else if (exercise.timePerSeries) {
    parts.push(`${fmtSec(exercise.timePerSeries)} ${t('metaPerSeries')}`)
  }
  if (exercise.shotsPerSeries) parts.push(`${exercise.shotsPerSeries} ${t('shotsShort')}`)
  return parts
}

/**
 * The host's forward options while stopped.
 * slot3 is the next exercise or stage; primary says which key is white.
 * @param {any} program
 * @param {{ phase: string, stageIndex: number, exerciseIndex: number, seriesIndex: number, stoppedReason?: string | null }} ts
 * @param {Translate} t
 * @param {string} lang
 */
export function forwardOptions(program, ts, t, lang) {
  const { stage, exercise } = contextFor(program, ts)
  const reason = ts.stoppedReason ?? null
  const none = { showNextSeries: false, nextSeriesNumber: 0, slot3: null, primary: null }
  if (!program || !stage || !exercise) return none

  let nextSeriesNumber = 0
  if (reason === 'seriesComplete' && ts.seriesIndex < exercise.seriesCount) nextSeriesNumber = ts.seriesIndex + 1
  if (reason === 'aborted' && ts.seriesIndex + 1 < exercise.seriesCount) nextSeriesNumber = ts.seriesIndex + 2
  const showNextSeries = nextSeriesNumber > 0

  /** @type {{ kind: 'stage' | 'exercise', name: string } | null} */
  let slot3 = null
  if (reason !== 'programComplete') {
    const nextStage = program.stages[ts.stageIndex + 1]
    if (reason === 'stageComplete') {
      if (nextStage) slot3 = { kind: 'stage', name: getLocalizedName(nextStage.name, lang) ?? '' }
    } else if (stage.exercises[ts.exerciseIndex + 1]) {
      slot3 = { kind: 'exercise', name: `${t('exercise')} ${ts.exerciseIndex + 2}` }
    } else if (nextStage) {
      slot3 = { kind: 'stage', name: getLocalizedName(nextStage.name, lang) ?? '' }
    }
  }

  /** @type {'nextSeries' | 'slot3' | null} */
  let primary = null
  if (reason !== 'programComplete') {
    if (reason === 'stageComplete' || reason === 'exerciseComplete') primary = slot3 ? 'slot3' : null
    else if (showNextSeries) primary = 'nextSeries'
    else if (slot3) primary = 'slot3'
  }

  return { showNextSeries, nextSeriesNumber, slot3, primary }
}

/**
 * One line on what the next forward step starts, or null when nothing
 * is queued (running, paused, program finished).
 * @param {any} program
 * @param {any} ts
 * @param {Translate} t
 * @param {string} lang
 * @returns {string | null}
 */
export function upNextText(program, ts, t, lang) {
  const { stage, exercise } = contextFor(program, ts)
  if (!program || !stage || !exercise) return null

  if (ts.phase === 'idle') {
    return `${t('series')} 1/${exercise.seriesCount}${exercise.loadingTime ? `, ${fmtSec(exercise.loadingTime)} ${t('metaLoading')}` : ''}`
  }
  if (ts.phase !== 'stopped') return null

  const f = forwardOptions(program, ts, t, lang)
  if (f.primary === 'nextSeries') {
    return `${t('series')} ${f.nextSeriesNumber}/${exercise.seriesCount}`
  }
  if (f.slot3) return f.slot3.name
  return null
}

/**
 * The digits to show. Before the host starts, preview the time that will
 * count down first (loading, or the series time when there is no loading)
 * instead of a bare 0.
 * @param {{ phase: string, remainingMs: number }} ts
 * @param {any} exercise
 * @param {'seconds' | 'mmss' | string} format
 */
export function clockText(ts, exercise, format) {
  let ms = ts.remainingMs
  if (ts.phase === 'idle' && exercise) ms = (exercise.loadingTime || exercise.timePerSeries || 0) * 1000
  const total = Math.max(0, Math.ceil(ms / 1000))
  if (format === 'seconds') return String(total)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
