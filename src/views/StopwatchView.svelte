<script>
  import { currentView, timerState, preferences } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'
  import { TimerEngine } from '../lib/timer/TimerEngine.js'
  import SettingsMenu from '../components/SettingsMenu.svelte'
  import Display from '../components/ui/Display.svelte'
  import Icon from '../components/ui/Icon.svelte'
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
  let mainText    = $derived(
    $preferences.stopwatchFormat === 'seconds'
      ? String(Math.floor(displayMs / 1000))
      : `${display.min}:${display.sec}`
  )
  let canEdit     = $derived(!running && elapsed === 0)
  let toggleLabel = $derived(running ? $t('pause') : elapsed > 0 ? $t('resume') : $t('start'))

  /** @param {number} n */
  const pad2 = (n) => String(n).padStart(2, '0')

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
  <div class="top-bar">
    <div class="cluster">
      <button class="btn" onclick={goBack}><Icon name="arrow-left" />{$t('back')}</button>
      <h1 class="title">{$t('stopwatch')}</h1>
    </div>
    <SettingsMenu />
  </div>

  <Display class="sw-display">
    <div class="line">
      <span class="chip">
        <Icon name={isCountdown ? 'clock' : 'stopwatch'} />
        {#if isCountdown}{pad2(inputMin)}:{pad2(inputSec)}{:else}{$t('stopwatch')}{/if}
      </span>
    </div>

    {#if editing}
      <div class="editor">
        <label class="field">
          <input
            class="editor-input digits"
            type="number"
            min="0"
            max="99"
            inputmode="numeric"
            bind:value={inputMin}
            onfocus={(e) => e.currentTarget.select()}
            oninput={(e) => { inputMin = Math.min(99, Math.max(0, parseInt(e.currentTarget.value) || 0)) }}
          />
          <span class="unit">{$t('countdownMinLabel')}</span>
        </label>
        <span class="colon digits">:</span>
        <label class="field">
          <input
            class="editor-input digits"
            type="number"
            min="0"
            max="59"
            inputmode="numeric"
            bind:value={inputSec}
            onfocus={(e) => e.currentTarget.select()}
            oninput={(e) => { inputSec = Math.min(59, Math.max(0, parseInt(e.currentTarget.value) || 0)) }}
          />
          <span class="unit">{$t('countdownSecondsLabel')}</span>
        </label>
      </div>
    {:else}
      <button
        class="time"
        class:editable={canEdit}
        class:running
        class:paused={!running && elapsed > 0}
        onclick={() => { if (elapsed === 0) editing = !editing }}
        disabled={!canEdit}
        aria-label={canEdit ? `${$t('countdownMinLabel')} / ${$t('countdownSecondsLabel')}` : undefined}
      >
        <span class="digits sw-digits" style="--chars: {mainText.length + 1}">{mainText}<span class="hund">.{display.ms}</span></span>
      </button>
    {/if}

    {#if canEdit && !editing}
      <div class="line"><span class="sub tap"><Icon name="edit" />{$t('countdownHint')}</span></div>
    {/if}
  </Display>

  <div class="pad" class:editing>
    {#if editing}
      <div class="adjust">
        <button class="key key-row key-center" onclick={() => changeMin(-1)} aria-label="- {$t('countdownMinLabel')}"><Icon name="minus" />{$t('countdownMinLabel')}</button>
        <button class="key key-row key-center" onclick={() => changeMin(1)} aria-label="+ {$t('countdownMinLabel')}"><Icon name="plus" />{$t('countdownMinLabel')}</button>
        <button class="key key-row key-center" onclick={() => changeSec(-1)} aria-label="- {$t('countdownSecondsLabel')}"><Icon name="minus" />{$t('countdownSecondsLabel')}</button>
        <button class="key key-row key-center" onclick={() => changeSec(1)} aria-label="+ {$t('countdownSecondsLabel')}"><Icon name="plus" />{$t('countdownSecondsLabel')}</button>
      </div>
    {/if}
    <div class="main">
      <button class="key key-white" onclick={toggle}>
        <Icon name={running ? 'pause' : 'play'} filled />
        <span>{toggleLabel}</span>
      </button>
      <button class="key" onclick={reset}>
        <Icon name="reset" />
        <span>{$t('reset')}</span>
      </button>
    </div>
  </div>
</div>

<style>
  .title { font-size: 1rem; font-weight: 800; letter-spacing: -0.01em; }

  :global(.sw-display) {
    flex: 1;
    min-height: 0;
    margin: 6px var(--pad-x) 0;
  }

  .line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    font-size: 0.875rem;
    font-weight: 700;
    flex: none;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 30px;
    padding: 0 13px;
    border-radius: 999px;
    background: var(--chip-bg);
    color: var(--chip-fg);
    font-size: 0.8125rem;
    font-weight: 800;
  }

  .chip :global(svg) { width: 16px; height: 16px; }
  .sub { color: var(--sub); font-weight: 600; }
  .tap { display: inline-flex; align-items: center; gap: 6px; }
  .tap :global(svg) { width: 14px; height: 14px; }

  /* The digits fill whatever room the display has */
  .time {
    flex: 1;
    min-height: 0;
    width: 100%;
    container-type: size;
    display: flex;
    align-items: flex-end;
    text-align: left;
    color: var(--faint);
  }

  .time:disabled { cursor: default; }
  .time.running { color: #e4e4e7; }
  .time.paused { color: var(--muted); }
  .time.editable { color: var(--fg); }

  .sw-digits {
    font-size: min(calc(100cqw / (var(--chars) * 0.58)), 80cqh);
    white-space: nowrap;
  }

  .hund { font-size: 0.42em; color: var(--muted); letter-spacing: -0.02em; margin-left: 0.04em; }

  .editor {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .field { display: flex; flex-direction: column; align-items: center; gap: 8px; }

  .editor-input {
    width: 2.4ch;
    font-size: clamp(4rem, 22vw, 7rem);
    background: none;
    border: 0;
    border-bottom: 3px solid var(--key-2);
    text-align: center;
    color: var(--fg);
    padding: 0;
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .editor-input:focus-visible { outline: none; border-bottom-color: var(--fg); }
  .editor-input::-webkit-outer-spin-button,
  .editor-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

  .colon { font-size: clamp(3rem, 16vw, 5rem); color: var(--faint); padding-bottom: 28px; }
  .unit { font-size: 0.75rem; font-weight: 700; color: var(--muted); }

  .pad {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px var(--pad-x) 0;
  }

  .adjust {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .adjust .key { min-height: 56px; padding: 10px 14px; }

  .pad .main {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    height: clamp(128px, 24dvh, 190px);
  }

  .pad.editing .main { height: clamp(104px, 17dvh, 150px); }

  @media (orientation: landscape) and (max-height: 500px) {
    .stopwatch-view { max-width: 1000px; }
  }
</style>
