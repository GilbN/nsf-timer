<script>
  import { timerState } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'

  let { onStart, onPause, onResume, onStop, onNext, onReset } = $props()
</script>

<div class="control-bar">
  <div class="main-actions">
    {#if $timerState.phase === 'idle' || $timerState.phase === 'stopped'}
      <button class="btn-action btn-start" onclick={onStart}>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        {$timerState.phase === 'stopped' ? $t('startNextSeries') : $t('start')}
      </button>
      {#if $timerState.phase === 'stopped'}
        <button class="btn-action btn-next" onclick={onNext}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/></svg>
          {$t('nextExercise')}
        </button>
      {/if}
    {:else if $timerState.phase === 'loading' || $timerState.phase === 'shooting'}
      <button class="btn-action btn-pause" onclick={onPause}>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        {$t('pause')}
      </button>
      <button class="btn-action btn-stop" onclick={onStop}>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
        {$t('stop')}
      </button>
    {:else if $timerState.phase === 'paused'}
      <button class="btn-action btn-start" onclick={onResume}>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        {$t('resume')}
      </button>
      <button class="btn-action btn-stop" onclick={onStop}>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
        {$t('stop')}
      </button>
    {/if}
  </div>

  <button class="btn-reset" onclick={onReset}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    </svg>
    {$t('reset')}
  </button>
</div>

<style>
  .control-bar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem 0 0;
  }

  .main-actions {
    display: flex;
    gap: 0.6rem;
  }

  .btn-action {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 54px;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    border-radius: var(--radius);
  }

  .btn-action svg {
    width: 1.25em;
    height: 1.25em;
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

  .btn-stop {
    background: rgba(244, 67, 54, 0.15);
    color: var(--danger);
    border: 1px solid rgba(244, 67, 54, 0.3);
  }

  .btn-stop:hover { background: rgba(244, 67, 54, 0.25); }

  .btn-next {
    background: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid rgba(255,255,255,0.08);
  }

  .btn-next:hover { background: #252550; }

  .btn-reset {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    align-self: center;
    padding: 0.4rem 1.25rem;
    min-height: 36px;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: var(--radius);
  }

  .btn-reset svg {
    width: 1em;
    height: 1em;
    flex-shrink: 0;
  }

  .btn-reset:hover {
    color: var(--text-primary);
    border-color: rgba(255,255,255,0.15);
  }
</style>
