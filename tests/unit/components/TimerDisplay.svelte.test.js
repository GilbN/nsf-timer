import { describe, it, expect, afterEach } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import TimerDisplay from '../../../src/components/TimerDisplay.svelte'
import { timerState } from '../../../src/lib/stores.js'

const firing = {
  phase: 'shooting', programId: 'standard', stageIndex: 2, exerciseIndex: 0, seriesIndex: 1,
  remainingMs: 14000, totalMs: 20000, targetVisible: true, duelShowingIndex: 0, phaseStartedAt: null,
  isReshoot: false, reshootPeerName: null, stageComplete: false, stoppedReason: null,
}

describe('TimerDisplay', () => {
  let app
  afterEach(() => {
    if (app) unmount(app)
    app = null
    document.body.innerHTML = ''
  })

  it('lights the display and turns the lamp green while targets face the shooters', () => {
    timerState.set(firing)
    app = mount(TimerDisplay, { target: document.body, props: { live: true } })
    flushSync()
    const display = document.querySelector('.display')
    expect(display?.classList.contains('lit')).toBe(true)
    expect(display?.getAttribute('data-lamp')).toBe('green')
  })

  it('never shows a stale Ild while the connection is down', () => {
    timerState.set(firing)
    app = mount(TimerDisplay, { target: document.body, props: { live: false } })
    flushSync()
    const display = document.querySelector('.display')
    expect(display?.classList.contains('lit')).toBe(false)
    expect(display?.getAttribute('data-lamp')).toBe('off')
  })
})
