/**
 * NSF 25m shooting programs
 * All times in seconds.
 *
 * Reference: "SKYTEPROGRAMMER 25 METER NSF (BANE & FELT)"
 */

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
        id: 'ds1',
        name: { no: 'Presisjon', en: 'Precision' },
        type: 'precision',
        exercises: [{
          seriesCount: 6,
          shotsPerSeries: 5,
          timePerSeries: 300,
          loadingTime: 60,
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
          targetVisibleTime: 3,
          targetHiddenTime: 7,
          loadingTime: 60,
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
        id: 'ds1',
        name: { no: '150 sekunder', en: '150 seconds' },
        type: 'precision',
        exercises: [{
          seriesCount: 4,
          shotsPerSeries: 5,
          timePerSeries: 150,
          loadingTime: 60,
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
          loadingTime: 60,
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
          loadingTime: 60,
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
        id: 'ds1',
        name: { no: 'Delserie 1', en: 'Stage 1' },
        type: 'precision',
        exercises: [
          { seriesCount: 2, shotsPerSeries: 5, timePerSeries: 8, loadingTime: 60 },
          { seriesCount: 2, shotsPerSeries: 5, timePerSeries: 6, loadingTime: 60 },
          { seriesCount: 2, shotsPerSeries: 5, timePerSeries: 4, loadingTime: 60 },
        ],
      },
      {
        id: 'ds2',
        name: { no: 'Delserie 2', en: 'Stage 2' },
        type: 'precision',
        exercises: [
          { seriesCount: 2, shotsPerSeries: 5, timePerSeries: 8, loadingTime: 60 },
          { seriesCount: 2, shotsPerSeries: 5, timePerSeries: 6, loadingTime: 60 },
          { seriesCount: 2, shotsPerSeries: 5, timePerSeries: 4, loadingTime: 60 },
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
        id: 'ds1',
        name: { no: 'Presisjon', en: 'Precision' },
        type: 'precision',
        exercises: [{
          seriesCount: 2,
          shotsPerSeries: 5,
          timePerSeries: 150,
          loadingTime: 60,
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
          targetVisibleTime: 3,
          targetHiddenTime: 7,
          loadingTime: 60,
        }],
      },
      {
        id: 'ds3',
        name: { no: 'Hurtig', en: 'Rapid' },
        type: 'precision',
        exercises: [
          { seriesCount: 1, shotsPerSeries: 5, timePerSeries: 20, loadingTime: 60 },
          { seriesCount: 1, shotsPerSeries: 5, timePerSeries: 10, loadingTime: 60 },
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
        id: 'ds1',
        name: { no: '10 sekunder', en: '10 seconds' },
        type: 'precision',
        exercises: [{
          seriesCount: 4,
          shotsPerSeries: 5,
          timePerSeries: 10,
          loadingTime: 60,
        }],
      },
      {
        id: 'ds2',
        name: { no: '8 sekunder', en: '8 seconds' },
        type: 'precision',
        exercises: [{
          seriesCount: 4,
          shotsPerSeries: 5,
          timePerSeries: 8,
          loadingTime: 60,
        }],
      },
      {
        id: 'ds3',
        name: { no: '6 sekunder', en: '6 seconds' },
        type: 'precision',
        exercises: [{
          seriesCount: 4,
          shotsPerSeries: 5,
          timePerSeries: 6,
          loadingTime: 60,
        }],
      },
    ],
  },
]

export function getProgramById(id) {
  const builtin = programs.find((p) => p.id === id)
  if (builtin) return builtin
  // Check custom programs in localStorage
  try {
    const custom = JSON.parse(localStorage.getItem('opk-timer-custom-programs') || '[]')
    return custom.find((p) => p.id === id) || null
  } catch {
    return null
  }
}

export function getAllPrograms() {
  return programs
}
