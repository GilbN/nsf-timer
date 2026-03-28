<script>
  import { currentView, timerState, formattedTime, preferences } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'
  import { TimerEngine } from '../lib/timer/TimerEngine.js'
  import SettingsMenu from '../components/SettingsMenu.svelte'
  import { acquireWakeLock, releaseWakeLock } from '../lib/wakeLock.js'
  import { beepStop } from '../lib/audio.js'

  let engine = new TimerEngine()
  let running = $state(false)
  let elapsed = $state(0)
  let inputMin = $state(0)   // 0–99
  let inputSec = $state(0)   // 0–59
  let editing  = $state(false)

  function changeMin(delta) {
    inputMin = Math.min(99, Math.max(0, inputMin + delta))
  }

  function changeSec(delta) {
    inputSec = Math.min(59, Math.max(0, inputSec + delta))
  }

  function toggle() {
    if (!running) {
      editing = false
      if (elapsed === 0) {
        engine.startCountup((ms) => {
          elapsed = ms
          if (isCountdown && ms >= targetMs) {
            elapsed = targetMs
            engine.stop()
            running = false
            beepStop()
            timerState.update((s) => ({ ...s, phase: 'idle', remainingMs: 0 }))
          } else {
            timerState.update((s) => ({
              ...s,
              phase: 'shooting',
              remainingMs: isCountdown ? Math.max(0, targetMs - ms) : ms,
            }))
          }
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
    timerState.update((s) => ({ ...s, phase: 'idle', remainingMs: 0 }))
    // inputMin and inputSec are intentionally kept so the same countdown can be re-run
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

  let targetMs    = $derived(inputMin * 60_000 + inputSec * 1_000)
  let isCountdown = $derived(targetMs > 0)
  let displayMs   = $derived(isCountdown ? Math.max(0, targetMs - elapsed) : elapsed)
  let display     = $derived(formatMs(displayMs))

  $effect(() => {
    if (running && $preferences.wakeLockEnabled) {
      acquireWakeLock()
      return () => releaseWakeLock()
    }
  })

  $effect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && running && $preferences.wakeLockEnabled) {
        acquireWakeLock()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      releaseWakeLock()
    }
  })
</script>

<div class="view stopwatch-view">
  <div class="header">
    <div class="title-row">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="header-icon">
        <circle cx="12" cy="13" r="8"/>
        <polyline points="12 9 12 13 14.5 15"/>
        <path d="M9 3h6M12 3v2"/>
      </svg>
      <h2>{$t('stopwatch')}</h2>
    </div>
    <SettingsMenu />
  </div>

  <div class="display-area">
    {#if editing}
      <div class="editor-wrapper">
        <div class="editor">
          <div class="editor-field">
            <button class="editor-btn" onclick={() => changeMin(1)}>▲</button>
            <input
              class="editor-input"
              type="number"
              min="0"
              max="99"
              bind:value={inputMin}
              onfocus={(e) => e.target.select()}
              oninput={(e) => { inputMin = Math.min(99, Math.max(0, parseInt(e.target.value) || 0)) }}
            />
            <button class="editor-btn" onclick={() => changeMin(-1)}>▼</button>
          </div>
          <span class="editor-colon">:</span>
          <div class="editor-field">
            <button class="editor-btn" onclick={() => changeSec(1)}>▲</button>
            <input
              class="editor-input"
              type="number"
              min="0"
              max="59"
              bind:value={inputSec}
              onfocus={(e) => e.target.select()}
              oninput={(e) => { inputSec = Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) }}
            />
            <button class="editor-btn" onclick={() => changeSec(-1)}>▼</button>
          </div>
        </div>
        <div class="editor-labels">
          <span class="editor-label">{$t('countdownMinLabel')}</span>
          <span class="editor-label">{$t('countdownSecondsLabel')}</span>
        </div>
      </div>
    {:else if running}
      <div class="time running">
        {#if $preferences.stopwatchFormat === 'seconds'}
          <span class="digits">{Math.floor(displayMs / 1000)}</span>
            <span class="colon small">.</span>
            <span class="digits sub">{display.ms}</span>
        {:else}
          <span class="digits">{display.min}</span>
          <span class="colon">:</span>
          <span class="digits">{display.sec}</span>
            <span class="colon small">.</span>
            <span class="digits sub">{display.ms}</span>
        {/if}
      </div>
    {:else}
      <button class="time-display-btn" onclick={() => { if (elapsed === 0) editing = !editing }}
        class:editable={elapsed === 0}>
        <div class="time">
          {#if $preferences.stopwatchFormat === 'seconds'}
            <span class="digits">{Math.floor(displayMs / 1000)}</span>
              <span class="colon small">.</span>
              <span class="digits sub">{display.ms}</span>
          {:else}
            <span class="digits">{display.min}</span>
            <span class="colon">:</span>
            <span class="digits">{display.sec}</span>
              <span class="colon small">.</span>
              <span class="digits sub">{display.ms}</span>
          {/if}
        </div>
      </button>
    {/if}
  </div>

  <div class="controls">
    <button
      class="btn-toggle"
      class:btn-start={!running}
      class:btn-pause={running}
      onclick={toggle}
    >
      {#if running}
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        {$t('pause')}
      {:else}
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        {elapsed > 0 ? $t('resume') : $t('start')}
      {/if}
    </button>
    <button class="btn-secondary btn-large" onclick={reset}>
      {$t('reset')}
    </button>
  </div>

  <button class="btn-back" onclick={goBack}>
    ← {$t('back')}
  </button>
</div>

<style>
  .stopwatch-view {
    justify-content: center;
    gap: 1.75rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header-icon {
    width: 20px;
    height: 20px;
    color: var(--text-secondary);
  }

  h2 {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
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
    gap: 0.02em;
    transition: color 0.3s;
  }

  .time.running .digits { color: var(--accent); }
  .time.running .colon { color: var(--accent); opacity: 0.5; }

  .digits {
    font-family: var(--font-mono);
    font-size: clamp(4.5rem, 20vw, 10rem);
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    transition: color 0.3s;
  }

  .digits.sub {
    font-size: clamp(2.25rem, 9vw, 4.5rem);
    color: var(--text-secondary);
  }

  .colon {
    font-family: var(--font-mono);
    font-size: clamp(3.5rem, 14vw, 7.5rem);
    font-weight: 900;
    color: var(--text-secondary);
    align-self: baseline;
    margin-bottom: 0.04em;
    transition: color 0.3s;
  }

  .colon.small {
    font-size: clamp(2rem, 8vw, 4rem);
  }

  .controls {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }

  .controls button {
    flex: 1;
    max-width: 180px;
  }

  .btn-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 52px;
    font-size: 1rem;
    font-weight: 700;
    border-radius: var(--radius);
  }

  .btn-toggle svg {
    width: 1.2em;
    height: 1.2em;
    flex-shrink: 0;
  }

  .btn-start {
    background: var(--accent);
    color: #0d0d1a;
  }

  .btn-start:hover { background: var(--accent-dim); }

  .btn-pause {
    background: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid rgba(255,255,255,0.08);
  }

  .btn-pause:hover { background: #252550; }

  .btn-back {
    align-self: center;
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.3rem 0.75rem;
    border-radius: var(--radius);
    opacity: 0.5;
    transition: opacity 0.15s;
  }

  .btn-back:hover { opacity: 0.9; }

  /* ── Time display button (tappable when stopped) ── */
  .time-display-btn {
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .time-display-btn:hover .digits { opacity: 0.75; }

  .time-display-btn:not(.editable) { cursor: default; }

  /* ── Segmented countdown editor ── */
  .editor-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
  }

  .editor {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .editor-field {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
  }

  .editor-input {
    font-family: var(--font-mono);
    font-size: clamp(3.5rem, 14vw, 7.5rem);
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    width: 3ch;
    background: transparent;
    color: var(--text-primary);
    text-align: center;
    -moz-appearance: textfield;
  }

  .editor-input::-webkit-outer-spin-button,
  .editor-input::-webkit-inner-spin-button { -webkit-appearance: none; }

  .editor-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 1.5rem;
    line-height: 1;
    padding: 0.2rem 0.6rem;
    border-radius: var(--radius);
    cursor: pointer;
    transition: color 0.15s;
  }

  .editor-btn:hover { color: var(--text-primary); }

  .editor-colon {
    font-family: var(--font-mono);
    font-size: clamp(4.5rem, 20vw, 10rem);
    font-weight: 900;
    color: var(--text-secondary);
    align-self: center;
    margin-bottom: 0.04em;
  }

  .editor-labels {
    display: flex;
    gap: 3.5rem;
  }

  .editor-label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-secondary);
    opacity: 0.5;
  }
</style>
