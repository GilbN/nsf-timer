<script>
  import { timerState } from '../lib/stores.js'
  import { t } from '../lib/i18n.js'

  let { onStart, onPause, onResume, onStop, onNext, onReset } = $props()
</script>

<div class="control-bar">
  {#if $timerState.phase === 'idle' || $timerState.phase === 'stopped'}
    <button class="btn-primary btn-large" onclick={onStart}>
      {$t('start')}
    </button>
    {#if $timerState.phase === 'stopped'}
      <button class="btn-secondary btn-large" onclick={onNext}>
        {$t('nextExercise')}
      </button>
    {/if}
  {:else if $timerState.phase === 'loading' || $timerState.phase === 'shooting'}
    <button class="btn-secondary btn-large" onclick={onPause}>
      {$t('pause')}
    </button>
    <button class="btn-danger btn-large" onclick={onStop}>
      {$t('stop')}
    </button>
  {:else if $timerState.phase === 'paused'}
    <button class="btn-primary btn-large" onclick={onResume}>
      {$t('resume')}
    </button>
    <button class="btn-danger btn-large" onclick={onStop}>
      {$t('stop')}
    </button>
  {/if}

  <button class="btn-secondary btn-reset" onclick={onReset}>
    {$t('reset')}
  </button>
</div>

<style>
  .control-bar {
    display: flex;
    gap: 0.75rem;
    padding: 1rem 0;
    flex-wrap: wrap;
    justify-content: center;
  }

  .btn-large {
    flex: 1;
    min-width: 120px;
    max-width: 200px;
  }

  .btn-reset {
    flex-basis: 100%;
    max-width: 200px;
    margin: 0 auto;
    font-size: 0.9rem;
    padding: 0.5rem 1rem;
    opacity: 0.7;
  }
</style>
