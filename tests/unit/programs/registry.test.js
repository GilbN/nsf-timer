import { describe, it, expect, beforeEach } from 'vitest'
import { programs, getProgramById, getAllPrograms } from '../../../src/lib/programs/registry.js'
import { saveCustomPrograms } from '../../../src/lib/storage.js'

const BUILTIN_IDS = ['fingrov', 'standard', 'silhuett', 'nais', 'hurtigpistol']

describe('built-in program registry', () => {
  it('exposes every expected NSF program', () => {
    const ids = programs.map(p => p.id)
    for (const id of BUILTIN_IDS) {
      expect(ids).toContain(id)
    }
  })

  it('getAllPrograms returns the same list as `programs`', () => {
    expect(getAllPrograms()).toBe(programs)
  })

  describe('shape validation', () => {
    for (const program of programs) {
      describe(program.id, () => {
        it('has bilingual name', () => {
          expect(program.name).toHaveProperty('no')
          expect(program.name).toHaveProperty('en')
          expect(typeof program.name.no).toBe('string')
          expect(typeof program.name.en).toBe('string')
        })

        it('declares a distance', () => {
          expect(program.distance).toBe('25m')
        })

        it('has at least one stage', () => {
          expect(Array.isArray(program.stages)).toBe(true)
          expect(program.stages.length).toBeGreaterThan(0)
        })

        it('has a totalCompetitionShots count', () => {
          expect(typeof program.totalCompetitionShots).toBe('number')
          expect(program.totalCompetitionShots).toBeGreaterThan(0)
        })

        it.each(program.stages)('stage $id has a known type', (stage) => {
          expect(['precision', 'rapid', 'duell']).toContain(stage.type)
        })

        it.each(program.stages)('stage $id has at least one exercise', (stage) => {
          expect(Array.isArray(stage.exercises)).toBe(true)
          expect(stage.exercises.length).toBeGreaterThan(0)
        })

        it.each(program.stages.flatMap((s, sIdx) =>
          s.exercises.map((e, eIdx) => ({
            stageIdx: sIdx, exerciseIdx: eIdx, type: s.type, exercise: e,
          }))
        ))('exercise [$stageIdx,$exerciseIdx] has valid parameters', ({ type, exercise }) => {
          expect(exercise.seriesCount).toBeGreaterThan(0)
          expect(exercise.shotsPerSeries).toBeGreaterThan(0)
          expect(exercise.loadingTime).toBeGreaterThan(0)

          if (type === 'precision') {
            expect(exercise.timePerSeries).toBeGreaterThan(0)
          }
          if (type === 'rapid') {
            expect(exercise.timePerSeries).toBeGreaterThan(0)
            expect(exercise.targetHiddenTime).toBeGreaterThan(0)
          }
          if (type === 'duell') {
            expect(exercise.targetVisibleTime).toBeGreaterThan(0)
            expect(exercise.targetHiddenTime).toBeGreaterThan(0)
            expect(exercise.shotsPerShowing).toBeGreaterThan(0)
          }
        })
      })
    }
  })
})

describe('NSF rule spot-checks', () => {
  it('fingrov (Fine/Heavy Pistol): 6 precision + 6 duel competition series', () => {
    const p = getProgramById('fingrov')
    const ds1 = p.stages.find(s => s.id === 'ds1')
    const ds2 = p.stages.find(s => s.id === 'ds2')
    expect(ds1.exercises[0].seriesCount).toBe(6)
    expect(ds1.exercises[0].shotsPerSeries).toBe(5)
    expect(ds1.type).toBe('precision')
    expect(ds2.exercises[0].seriesCount).toBe(6)
    expect(ds2.type).toBe('duell')
    expect(ds2.exercises[0].shotsPerShowing).toBe(1)
  })

  it('standardpistol: 150s, 20s, 10s stages with 4 series each', () => {
    const p = getProgramById('standard')
    const [trial, ds1, ds2, ds3] = p.stages
    expect(trial.isTrialStage).toBe(true)
    expect(ds1.exercises[0].timePerSeries).toBe(150)
    expect(ds2.exercises[0].timePerSeries).toBe(20)
    expect(ds3.exercises[0].timePerSeries).toBe(10)
    for (const stage of [ds1, ds2, ds3]) {
      expect(stage.exercises[0].seriesCount).toBe(4)
      expect(stage.exercises[0].shotsPerSeries).toBe(5)
    }
  })

  it('silhouette: three-exercise rapid stages with 8/6/4 second times', () => {
    const p = getProgramById('silhuett')
    const ds1 = p.stages.find(s => s.id === 'ds1')
    expect(ds1.type).toBe('rapid')
    expect(ds1.exercises).toHaveLength(3)
    const times = ds1.exercises.map(e => e.timePerSeries)
    expect(times).toEqual([8, 6, 4])
  })

  it('duel visible time includes the 0.29s target transition offset', () => {
    const p = getProgramById('fingrov')
    const duelStage = p.stages.find(s => s.type === 'duell')
    // 3 seconds for the duel + 0.29 for target transition
    expect(duelStage.exercises[0].targetVisibleTime).toBeCloseTo(3.29, 2)
  })

  it('hurtigpistol: 10s, 8s, 6s stages with 4 series each', () => {
    const p = getProgramById('hurtigpistol')
    const stages = p.stages.filter(s => !s.isTrialStage)
    const times = stages.map(s => s.exercises[0].timePerSeries)
    expect(times).toEqual([10, 8, 6])
  })
})

describe('getProgramById', () => {
  it('returns the matching built-in program', () => {
    const p = getProgramById('standard')
    expect(p.id).toBe('standard')
    expect(p.name.no).toBe('Standardpistol')
  })

  it('returns null for unknown ids', () => {
    expect(getProgramById('not-a-real-program')).toBeNull()
  })

  it('returns null when called with empty/null id', () => {
    expect(getProgramById('')).toBeNull()
    expect(getProgramById(null)).toBeNull()
  })

  describe('custom programs', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('finds a custom program stored in localStorage', () => {
      const custom = { id: 'custom-x', name: { no: 'Mitt program', en: 'My program' }, stages: [] }
      saveCustomPrograms([custom])
      expect(getProgramById('custom-x')).toEqual(custom)
    })

    it('returns null when custom storage is corrupt', () => {
      localStorage.setItem('nsf-timer-custom-programs', '{broken')
      expect(getProgramById('some-id')).toBeNull()
    })

    it('prefers the built-in when a custom program shares its id', () => {
      saveCustomPrograms([{ id: 'standard', name: { no: 'Hijacked', en: 'Hijacked' } }])
      const p = getProgramById('standard')
      expect(p.name.no).toBe('Standardpistol')
    })
  })
})
