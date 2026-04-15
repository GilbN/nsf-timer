/**
 * NSF 25m shooting programs
 * All times in seconds.
 *
 * Reference: "SKYTEPROGRAMMER 25 METER NSF (BANE & FELT)"
 */

import { loadCustomPrograms } from '../storage'

const DEFAULT_LOADING_TIME = 60
const DEFAULT_TARGET_HIDDEN_TIME = 7
const DEFAULT_TARGET_VISIBLE_TIME_DUEL = 3
const TARGET_DISPLAY_TIME_OFFSET_DUEL = 0.29 // At the range the target uses .29 seconds to transition between hidden and visible, so this needs to be added to the visible time to get the correct timing for when the target is fully visible

export const programs = [
  {
    id: 'fingrov',
    name: { no: 'Fin/Grov Pistol', en: 'Fine/Heavy Pistol' },
    distance: '25m',
    calibers: ['Fin: .22LR', 'Grov: .30-.38'],
    startPosition: { no: 'Delserie 2, 45 grader', en: 'Stage 2, 45 degrees' },
    weaponGroups: null,
    totalCompetitionShots: 60,
    trialShots: 5,
    stages: [
      {
        id: 'trial-ds1',
        name: { no: 'Prøveserie 1', en: 'Sighting Series 1' },
        isTrialStage: true,
        type: 'precision',
        exercises: [{
          seriesCount: 1,
          shotsPerSeries: 5,
          timePerSeries: 300,
          targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME,
          loadingTime: DEFAULT_LOADING_TIME,
        }],
      },
      {
        id: 'ds1',
        name: { no: 'Presisjon', en: 'Precision' },
        type: 'precision',
        exercises: [{
          seriesCount: 6,
          shotsPerSeries: 5,
          timePerSeries: 300,
          targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME,
          loadingTime: DEFAULT_LOADING_TIME,
        }],
      },
      {
        id: 'trial-ds2',
        name: { no: 'Prøveserie 2', en: 'Sighting Series 2' },
        isTrialStage: true,
        type: 'precision',
        exercises: [{
          seriesCount: 1,
          shotsPerSeries: 5,
          timePerSeries: 300,
          targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME,
          loadingTime: DEFAULT_LOADING_TIME,
        }],
      },
      {
        id: 'ds2',
        name: { no: 'Duell', en: 'Duel' },
        type: 'duell',
        exercises: [{
          seriesCount: 6,
          shotsPerSeries: 5,
          shotsPerShowing: 1,
          targetVisibleTime: DEFAULT_TARGET_VISIBLE_TIME_DUEL + TARGET_DISPLAY_TIME_OFFSET_DUEL,
          targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME,
          loadingTime: DEFAULT_LOADING_TIME,
        }],
      },
    ],
  },
  {
    id: 'standard',
    name: { no: 'Standardpistol', en: 'Standard Pistol' },
    distance: '25m',
    calibers: ['.22LR'],
    startPosition: { no: 'Delserie 2 & 3, 45 grader', en: 'Stage 2 & 3, 45 degrees' },
    weaponGroups: null,
    totalCompetitionShots: 60,
    trialShots: 5,
    stages: [
      {
        id: 'trial',
        name: { no: 'Prøveserie', en: 'Sighting Series' },
        isTrialStage: true,
        type: 'precision',
        exercises: [{
          seriesCount: 1,
          shotsPerSeries: 5,
          timePerSeries: 150,
          targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME,
          loadingTime: DEFAULT_LOADING_TIME,
        }],
      },
      {
        id: 'ds1',
        name: { no: '150 sekunder', en: '150 seconds' },
        type: 'precision',
        exercises: [{
          seriesCount: 4,
          shotsPerSeries: 5,
          timePerSeries: 150,
          targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME,
          loadingTime: DEFAULT_LOADING_TIME,
        }],
      },
      {
        id: 'ds2',
        name: { no: '20 sekunder', en: '20 seconds' },
        type: 'precision',
        exercises: [{
          seriesCount: 4,
          shotsPerSeries: 5,
          timePerSeries: 20,
          targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME,
          loadingTime: DEFAULT_LOADING_TIME,
        }],
      },
      {
        id: 'ds3',
        name: { no: '10 sekunder', en: '10 seconds' },
        type: 'precision',
        exercises: [{
          seriesCount: 4,
          shotsPerSeries: 5,
          timePerSeries: 10,
          targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME,
          loadingTime: DEFAULT_LOADING_TIME,
        }],
      },
    ],
  },
  {
    id: 'silhuett',
    name: { no: 'Silhuett', en: 'Silhouette' },
    distance: '25m',
    calibers: ['.22LR'],
    startPosition: { no: '45 grader', en: '45 degrees' },
    weaponGroups: null,
    totalCompetitionShots: 60,
    trialShots: 5,
    stages: [
      {
        id: 'trial-ds1',
        name: { no: 'Prøveserie 1', en: 'Sighting Series 1' },
        isTrialStage: true,
        type: 'rapid',
        exercises: [{
          seriesCount: 1,
          shotsPerSeries: 5,
          timePerSeries: 8,
          targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME,
          loadingTime: DEFAULT_LOADING_TIME,
        }],
      },
      {
        id: 'ds1',
        name: { no: 'Delserie 1', en: 'Stage 1' },
        type: 'rapid',
        exercises: [
          { seriesCount: 2, shotsPerSeries: 5, timePerSeries: 8, targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME, loadingTime: DEFAULT_LOADING_TIME },
          { seriesCount: 2, shotsPerSeries: 5, timePerSeries: 6, targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME, loadingTime: DEFAULT_LOADING_TIME },
          { seriesCount: 2, shotsPerSeries: 5, timePerSeries: 4, targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME, loadingTime: DEFAULT_LOADING_TIME },
        ],
      },
      {
        id: 'trial-ds2',
        name: { no: 'Prøveserie 2', en: 'Sighting Series 2' },
        isTrialStage: true,
        type: 'rapid',
        exercises: [{
          seriesCount: 1,
          shotsPerSeries: 5,
          timePerSeries: 8,
          targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME,
          loadingTime: DEFAULT_LOADING_TIME,
        }],
      },
      {
        id: 'ds2',
        name: { no: 'Delserie 2', en: 'Stage 2' },
        type: 'rapid',
        exercises: [
          { seriesCount: 2, shotsPerSeries: 5, timePerSeries: 8, targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME, loadingTime: DEFAULT_LOADING_TIME },
          { seriesCount: 2, shotsPerSeries: 5, timePerSeries: 6, targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME, loadingTime: DEFAULT_LOADING_TIME },
          { seriesCount: 2, shotsPerSeries: 5, timePerSeries: 4, targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME, loadingTime: DEFAULT_LOADING_TIME },
        ],
      },
    ],
  },
  {
    id: 'nais',
    name: { no: 'NAIS', en: 'NAIS' },
    distance: '25m',
    calibers: ['Fin: .22LR-.32cal', 'Grov: 9mm-.45cal'],
    startPosition: { no: 'Delserie 2 & 3, 45 grader', en: 'Stage 2 & 3, 45 degrees' },
    weaponGroups: null,
    totalCompetitionShots: 30,
    trialShots: 5,
    stages: [
      {
        id: 'trial',
        name: { no: 'Prøveserie', en: 'Sighting Series' },
        isTrialStage: true,
        type: 'precision',
        exercises: [{
          seriesCount: 1,
          shotsPerSeries: 5,
          timePerSeries: 150,
          loadingTime: DEFAULT_LOADING_TIME,
          targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME,
        }],
      },
      {
        id: 'ds1',
        name: { no: 'Presisjon', en: 'Precision' },
        type: 'precision',
        exercises: [{
          seriesCount: 2,
          shotsPerSeries: 5,
          timePerSeries: 150,
          loadingTime: DEFAULT_LOADING_TIME,
          targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME,
        }],
      },
      {
        id: 'ds2',
        name: { no: 'Duell', en: 'Duel' },
        type: 'duell',
        exercises: [{
          seriesCount: 2,
          shotsPerSeries: 5,
          shotsPerShowing: 1,
          targetVisibleTime: DEFAULT_TARGET_VISIBLE_TIME_DUEL + TARGET_DISPLAY_TIME_OFFSET_DUEL,
          targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME,
          loadingTime: DEFAULT_LOADING_TIME,
        }],
      },
      {
        id: 'ds3',
        name: { no: 'Hurtig', en: 'Rapid' },
        type: 'rapid',
        exercises: [
          { seriesCount: 1, shotsPerSeries: 5, timePerSeries: 20, targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME, loadingTime: DEFAULT_LOADING_TIME },
          { seriesCount: 1, shotsPerSeries: 5, timePerSeries: 10, targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME, loadingTime: DEFAULT_LOADING_TIME },
        ],
      },
    ],
  },
  {
    id: 'hurtigpistol',
    name: { no: 'Hurtigpistol', en: 'Rapid Fire Pistol' },
    distance: '25m',
    calibers: ['.22LR'],
    startPosition: { no: '45 grader', en: '45 degrees' },
    weaponGroups: {
      no: [
        'Fin: .22LR (pistol & revolver)',
        'Grov: .30-.38 (pistol & revolver)',
        'Militær: 9mm-.45cal (kun pistol)',
        'Revolver: 9mm-.45cal (kun revolver)',
        'Spesialpistol: .22LR-.45cal',
        'Spesialrevolver: .22LR-.45cal',
      ],
      en: [
        'Fine: .22LR (pistol & revolver)',
        'Gross: .30-.38 (pistol & revolver)',
        'Military: 9mm-.45cal (pistol only)',
        'Revolver: 9mm-.45cal (revolver only)',
        'Special pistol: .22LR-.45cal',
        'Special revolver: .22LR-.45cal',
      ],
    },
    totalCompetitionShots: 60,
    trialShots: 5,
    stages: [
      {
        id: 'trial',
        name: { no: 'Prøveserie', en: 'Sighting Series' },
        isTrialStage: true,
        type: 'rapid',
        exercises: [{
          seriesCount: 1,
          shotsPerSeries: 5,
          timePerSeries: 10,
          targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME,
          loadingTime: DEFAULT_LOADING_TIME,
        }],
      },
      {
        id: 'ds1',
        name: { no: '10 sekunder', en: '10 seconds' },
        type: 'rapid',
        exercises: [{
          seriesCount: 4,
          shotsPerSeries: 5,
          timePerSeries: 10,
          targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME,
          loadingTime: DEFAULT_LOADING_TIME,
        }],
      },
      {
        id: 'ds2',
        name: { no: '8 sekunder', en: '8 seconds' },
        type: 'rapid',
        exercises: [{
          seriesCount: 4,
          shotsPerSeries: 5,
          timePerSeries: 8,
          targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME,
          loadingTime: DEFAULT_LOADING_TIME,
        }],
      },
      {
        id: 'ds3',
        name: { no: '6 sekunder', en: '6 seconds' },
        type: 'rapid',
        exercises: [{
          seriesCount: 4,
          shotsPerSeries: 5,
          timePerSeries: 6,
          targetHiddenTime: DEFAULT_TARGET_HIDDEN_TIME,
          loadingTime: DEFAULT_LOADING_TIME,
        }],
      },
    ],
  },
]

export function getProgramById(id) {
  const builtin = programs.find((p) => p.id === id)
  if (builtin) return builtin
  // Check custom programs via shared storage helper
  try {
    const custom = loadCustomPrograms()
    return custom.find((p) => p.id === id) || null
  } catch {
    return null
  }
}

export function getAllPrograms() {
  return programs
}
