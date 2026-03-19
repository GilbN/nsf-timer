<script>
  import { currentView, timerState, formattedTime } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'
  import { TimerEngine } from '../lib/timer/TimerEngine.js'
  import LangToggle from '../components/LangToggle.svelte'

  let engine = new TimerEngine()
  let running = $state(false)
  let elapsed = $state(0)

  function toggle() {
    if (!running) {
      if (elapsed === 0) {
        engine.startCountup((ms) => {
          elapsed = ms
          timerState.update((s) => ({
            ...s,
            phase: 'shooting',
            remainingMs: ms,
          }))
        })
      } else {
        engine.resume()
      }
      running = true
    } else {
      engine.pause()
      running = false
    }
  }

  function reset() {
    engine.stop()
    running = false
    elapsed = 0
    timerState.update((s) => ({
      ...s,
      phase: 'idle',
      remainingMs: 0,
    }))
  }

  function goBack() {
    engine.stop()
    timerState.update((s) => ({
      ...s,
      phase: 'idle',
      remainingMs: 0,
    }))
    currentView.set('home')
  }

  function formatMs(ms) {
    const totalSec = Math.floor(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    const hundredths = Math.floor((ms % 1000) / 10)
    return {
      min: String(min).padStart(2, '0'),
      sec: String(sec).padStart(2, '0'),
      ms: String(hundredths).padStart(2, '0'),
    }
  }

  let display = $derived(formatMs(elapsed))
</script>

<div class="view stopwatch-view">
  <div class="header">
    <h2>{$t('stopwatch')}</h2>
    <LangToggle />
  </div>

  <div class="display-area">
    <div class="time">
      <span class="digits">{display.min}</span>
      <span class="separator">:</span>
      <span class="digits">{display.sec}</span>
      <span class="separator small">.</span>
      <span class="digits small">{display.ms}</span>
    </div>
  </div>

  <div class="controls">
    <button class="btn-large" class:btn-primary={!running} class:btn-secondary={running} onclick={toggle}>
      {running ? $t('pause') : (elapsed > 0 ? $t('resume') : $t('start'))}
    </button>
    <button class="btn-secondary btn-large" onclick={reset}>
      {$t('reset')}
    </button>
  </div>

  <button class="btn-secondary back-btn" onclick={goBack}>
    {$t('back')}
  </button>
</div>

<style>
  .stopwatch-view {
    justify-content: center;
    gap: 2rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h2 {
    font-size: 1.3rem;
  }

  .display-area {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    max-height: 300px;
  }

  .time {
    display: flex;
    align-items: baseline;
    gap: 0.05em;
  }

  .digits {
    font-family: var(--font-mono);
    font-size: clamp(4rem, 15vw, 8rem);
    font-weight: 700;
    line-height: 1;
  }

  .digits.small {
    font-size: clamp(2rem, 8vw, 4rem);
    color: var(--text-secondary);
  }

  .separator {
    font-family: var(--font-mono);
    font-size: clamp(3rem, 12vw, 7rem);
    font-weight: 700;
    color: var(--text-secondary);
  }

  .separator.small {
    font-size: clamp(2rem, 8vw, 4rem);
  }

  .controls {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }

  .controls button {
    flex: 1;
    max-width: 180px;
  }

  .back-btn {
    align-self: center;
    opacity: 0.6;
    font-size: 0.85rem;
  }
</style>
