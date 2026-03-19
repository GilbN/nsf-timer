<script>
  import { timerState, formattedTime } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'

  let { mode = 'precision' } = $props()
</script>

<div class="timer-display" class:target-up={$timerState.targetVisible && mode === 'duell'} class:target-down={!$timerState.targetVisible && mode === 'duell' && $timerState.phase === 'shooting'}>
  {#if mode === 'duell' && $timerState.phase === 'shooting'}
    <div class="target-indicator" class:visible={$timerState.targetVisible}>
      {$timerState.targetVisible ? $t('targetUp') : $t('targetDown')}
    </div>
  {/if}

  <div class="time">
    {#if mode === 'stopwatch'}
      <span class="digits">{$formattedTime.minutes}</span>
      <span class="separator">:</span>
      <span class="digits">{$formattedTime.seconds}</span>
    {:else if mode === 'duell' && $timerState.phase === 'shooting'}
      <span class="digits large">{$formattedTime.totalSeconds}</span>
    {:else}
      <span class="digits">{$formattedTime.minutes}</span>
      <span class="separator">:</span>
      <span class="digits">{$formattedTime.seconds}</span>
    {/if}
  </div>

  {#if $timerState.phase !== 'idle'}
    <div class="phase-label" class:loading={$timerState.phase === 'loading'} class:shooting={$timerState.phase === 'shooting'} class:paused={$timerState.phase === 'paused'} class:stopped={$timerState.phase === 'stopped'}>
      {$t($timerState.phase)}
    </div>
  {/if}
</div>

<style>
  .timer-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    flex: 1;
    transition: background 0.3s;
    border-radius: var(--radius-lg);
    padding: 1rem;
  }

  .target-up {
    background: rgba(0, 230, 118, 0.1);
  }

  .target-down {
    background: rgba(244, 67, 54, 0.1);
  }

  .target-indicator {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--target-down);
    padding: 0.3rem 1rem;
    border-radius: var(--radius);
    background: rgba(244, 67, 54, 0.15);
  }

  .target-indicator.visible {
    color: var(--target-up);
    background: rgba(0, 230, 118, 0.15);
  }

  .time {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.1em;
  }

  .digits {
    font-family: var(--font-mono);
    font-size: clamp(4rem, 15vw, 8rem);
    font-weight: 700;
    line-height: 1;
    color: var(--text-primary);
  }

  .digits.large {
    font-size: clamp(6rem, 22vw, 12rem);
  }

  .separator {
    font-family: var(--font-mono);
    font-size: clamp(3rem, 12vw, 7rem);
    font-weight: 700;
    color: var(--text-secondary);
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    50% { opacity: 0.3; }
  }

  .phase-label {
    font-size: 1rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius);
  }

  .phase-label.loading {
    color: var(--warning);
    background: rgba(255, 152, 0, 0.15);
  }

  .phase-label.shooting {
    color: var(--accent);
    background: rgba(0, 230, 118, 0.15);
  }

  .phase-label.paused {
    color: var(--warning);
    background: rgba(255, 152, 0, 0.15);
  }

  .phase-label.stopped {
    color: var(--text-secondary);
    background: rgba(160, 160, 176, 0.15);
  }
</style>
