<script>
  import { timerState, formattedTime } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'
  import { getProgramById } from '../lib/programs/registry.js'

  let phase = $derived($timerState.phase)
  let isTargetUp = $derived($timerState.targetVisible && phase === 'shooting')
  let isTargetDown = $derived(!$timerState.targetVisible && phase === 'shooting')
  let program = $derived(getProgramById($timerState.programId))
  let isTrialStage = $derived(program?.stages[$timerState.stageIndex]?.isTrialStage ?? false)
</script>

<div
  class="timer-display"
  class:phase-loading={phase === 'loading'}
  class:phase-shooting={phase === 'shooting'}
  class:phase-paused={phase === 'paused'}
  class:phase-stopped={phase === 'stopped'}
  class:target-up={isTargetUp}
  class:target-down={isTargetDown}
  class:trial={isTrialStage}
>
  <!-- Trial indicator -->
  {#if isTrialStage}
    <div class="trial-indicator">
      <svg class="trial-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
        <line x1="4" y1="22" x2="4" y2="15"/>
      </svg>
      {$t('trial')}
    </div>
  {/if}

  <!-- Phase banner strip -->
  {#if phase !== 'idle'}
    <div class="phase-banner">
      <span class="phase-rule"></span>
      <span class="phase-text">{$t(phase)}</span>
      <span class="phase-rule"></span>
    </div>
  {/if}

  <!-- Target indicator -->
  {#if phase === 'shooting'}
    <div class="target-indicator" class:up={isTargetUp}>
      {#if isTargetUp}
        <svg class="target-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="6"/>
          <circle cx="12" cy="12" r="2"/>
        </svg>
        {$t('targetUp')}
      {:else}
        <svg class="target-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-dasharray="3 3"/>
        </svg>
        {$t('targetDown')}
      {/if}
    </div>
  {/if}

  <!-- Main time digits -->
  <div class="time" class:glow={isTargetUp}>
    {#if phase === 'shooting'}
      <span class="digits super">{$formattedTime.totalSeconds}</span>
    {:else}
      <span class="digits">{$formattedTime.minutes}</span>
      <span class="colon">:</span>
      <span class="digits">{$formattedTime.seconds}</span>
    {/if}
  </div>
</div>

<style>
  .timer-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    flex: 1;
    width: 100%;
    transition: background 0.4s ease;
    border-radius: var(--radius-lg);
    overflow: hidden;
    position: relative;
  }

  /* Phase background tints */
  .phase-loading  { background: var(--phase-loading-bg); }
  .phase-shooting { background: var(--phase-shooting-bg); }
  .phase-paused   { background: var(--phase-paused-bg); }
  .phase-stopped  { background: var(--phase-stopped-bg); }
  .target-up      { background: rgba(0, 230, 118, 0.07); }
  .target-down    { background: rgba(244, 67, 54, 0.07); }

  /* ── Phase banner ── */
  .phase-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0 1.5rem;
  }

  .phase-rule {
    flex: 1;
    height: 1px;
    opacity: 0.4;
  }

  .phase-text {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.3em;
    text-transform: uppercase;
  }

  /* Phase banner colors */
  .phase-loading  .phase-rule { background: var(--phase-loading); }
  .phase-loading  .phase-text { color: var(--phase-loading); }
  .phase-shooting .phase-rule { background: var(--phase-shooting); }
  .phase-shooting .phase-text { color: var(--phase-shooting); }
  .phase-paused   .phase-rule { background: var(--phase-paused); }
  .phase-paused   .phase-text { color: var(--phase-paused); }
  .phase-stopped  .phase-rule { background: var(--phase-stopped); }
  .phase-stopped  .phase-text { color: var(--phase-stopped); }

  /* ── Target indicator ── */
  .target-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 0.4rem 1.2rem;
    border-radius: 100px;
    background: rgba(244, 67, 54, 0.12);
    color: var(--target-down);
    border: 1px solid rgba(244, 67, 54, 0.25);
  }

  .target-indicator.up {
    background: rgba(0, 230, 118, 0.12);
    color: var(--target-up);
    border-color: rgba(0, 230, 118, 0.3);
  }

  .target-icon {
    width: 1.1em;
    height: 1.1em;
    flex-shrink: 0;
  }

  /* ── Time digits ── */
  .time {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.02em;
    transition: color 0.4s ease;
  }

  .digits {
    font-family: var(--font-mono);
    font-size: clamp(5rem, 24vw, 10rem);
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    transition: color 0.4s ease, text-shadow 0.4s ease;
    color: var(--text-primary);
  }

  .digits.super {
    font-size: clamp(7rem, 34vw, 15rem);
  }

  .colon {
    font-family: var(--font-mono);
    font-size: clamp(4rem, 20vw, 8.5rem);
    font-weight: 900;
    line-height: 1;
    color: var(--text-secondary);
    align-self: baseline;
    margin-bottom: 0.03em;
    transition: color 0.4s ease;
  }

  /* ── Digit colors by phase ── */
  .phase-loading .digits,
  .phase-loading .colon  { color: var(--phase-loading); }

  .phase-shooting .digits { color: #ffffff; }
  .phase-shooting .colon  { color: var(--phase-shooting); }

  .phase-paused .digits   { color: var(--phase-paused); }
  .phase-paused .colon    { color: var(--phase-paused); opacity: 0.4; }

  .phase-stopped .digits  { color: var(--phase-stopped); }
  .phase-stopped .colon   { color: var(--phase-stopped); }

  /* Duel target-up glow */
  .time.glow .digits {
    color: var(--accent);
    animation: glow-green 2s ease-in-out infinite;
  }

  /* ── Trial indicator ── */
  .trial-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 0.4rem 1.2rem;
    border-radius: 100px;
    background: rgba(255, 181, 71, 0.12);
    color: var(--warning);
    border: 1px solid rgba(255, 181, 71, 0.25);
  }

  .trial-icon {
    width: 1.1em;
    height: 1.1em;
    flex-shrink: 0;
  }

  /* ── Trial stage: phase banner amber ── */
  .trial.phase-loading .phase-rule,
  .trial.phase-shooting .phase-rule,
  .trial.phase-stopped .phase-rule,
  .trial.phase-paused .phase-rule  { background: var(--warning); }

  .trial.phase-loading .phase-text,
  .trial.phase-shooting .phase-text,
  .trial.phase-stopped .phase-text,
  .trial.phase-paused .phase-text  { color: var(--warning); }
</style>
