<script>
  import { preferences } from '../lib/stores.js'
  import { savePreferences } from '../lib/storage.js'
  import { t } from '../lib/i18n.js'
  import { updateAvailable, updateDismissed } from '../lib/updateAvailable.js'

  let open = $state(false)
  let showAbout = $state(false)
  const appVersion = __APP_VERSION__
  const SCALES = [1, 1.2, 1.4]
  const SCALE_LABELS = { 1: '100%', 1.2: '120%', 1.4: '140%' }

  function toggle(key) {
    preferences.update(p => {
      const updated = { ...p, [key]: !p[key] }
      savePreferences(updated)
      return updated
    })
  }

  function cycleScale() {
    preferences.update(p => {
      const next = SCALES[(SCALES.indexOf(p.textScale ?? 1) + 1) % SCALES.length]
      const updated = { ...p, textScale: next }
      savePreferences(updated)
      return updated
    })
  }

  function cycleLang() {
    preferences.update(p => {
      const updated = { ...p, lang: p.lang === 'no' ? 'en' : 'no' }
      savePreferences(updated)
      return updated
    })
  }

  function cycleCountdownFormat() {
    preferences.update(p => {
      const updated = { ...p, countdownFormat: p.countdownFormat === 'seconds' ? 'mmss' : 'seconds' }
      savePreferences(updated)
      return updated
    })
  }

  function cycleStopwatchFormat() {
    preferences.update(p => {
      const updated = { ...p, stopwatchFormat: p.stopwatchFormat === 'mmss' ? 'seconds' : 'mmss' }
      savePreferences(updated)
      return updated
    })
  }

  function handleOutside(e) {
    if (!e.target.closest('.settings-menu')) close()
  }

  function handleKey(e) {
    if (e.key === 'Escape') close()
  }

  function close() {
    open = false
  }

  function openUpdateModal() {
    updateDismissed.set(false)
    close()
  }

  $effect(() => {
    if (open) {
      document.addEventListener('click', handleOutside)
      document.addEventListener('keydown', handleKey)
      return () => {
        document.removeEventListener('click', handleOutside)
        document.removeEventListener('keydown', handleKey)
      }
    }
  })
</script>

<div class="settings-menu">
  <button
    class="icon-btn"
    class:open
    onclick={(e) => { e.stopPropagation(); open = !open }}
    title="Settings"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="4" y1="6" x2="20" y2="6"/>
      <line x1="4" y1="12" x2="20" y2="12"/>
      <line x1="4" y1="18" x2="20" y2="18"/>
    </svg>
    {#if $updateAvailable}
      <span class="update-dot" aria-hidden="true"></span>
    {/if}
  </button>

  {#if open}
    <div class="panel" role="menu">

      {#if $updateAvailable}
        <button class="row row-update" onclick={openUpdateModal} role="menuitem">
          <span class="row-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15A9 9 0 1 1 18 6.3L23 10"/>
            </svg>
          </span>
          <span class="row-label">
            {$t('updateAvailableReload')}
            <span class="update-dot update-dot-inline" aria-hidden="true"></span>
          </span>
        </button>
        <div class="divider"></div>
      {/if}

      <!-- Wake lock -->
      <button class="row" onclick={() => toggle('wakeLockEnabled')} role="menuitem">
        <span class="row-icon">
          {#if $preferences.wakeLockEnabled}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          {/if}
        </span>
        <span class="row-label">{$t('keepAwake')}</span>
        <span class="row-value" class:on={$preferences.wakeLockEnabled}>
          {$preferences.wakeLockEnabled ? 'ON' : 'OFF'}
        </span>
      </button>

      <!-- Sound -->
      <button class="row" onclick={() => toggle('soundEnabled')} role="menuitem">
        <span class="row-icon">
          {#if $preferences.soundEnabled}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          {/if}
        </span>
        <span class="row-label">{$t('sound')}</span>
        <span class="row-value" class:on={$preferences.soundEnabled}>
          {$preferences.soundEnabled ? 'ON' : 'OFF'}
        </span>
      </button>

      <div class="divider"></div>

      <!-- Countdown format -->
      <button class="row" onclick={cycleCountdownFormat} role="menuitem">
        <span class="row-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </span>
        <span class="row-label">{$t('countdownFormat')}</span>
        <span class="row-value on">
          {$preferences.countdownFormat === 'seconds' ? $t('countdownSeconds') : $t('countdownMinSec')}
        </span>
      </button>

      <!-- Stopwatch format -->
      <button class="row" onclick={cycleStopwatchFormat} role="menuitem">
        <span class="row-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="13" r="8"/>
            <polyline points="12 9 12 13 14.5 15"/>
            <path d="M9 3h6M12 3v2"/>
          </svg>
        </span>
        <span class="row-label">{$t('stopwatchFormat')}</span>
        <span class="row-value on">
          {$preferences.stopwatchFormat === 'mmss' ? $t('countdownMinSec') : $t('countdownSeconds')}
        </span>
      </button>

      <!-- Text size -->
      <button class="row" onclick={cycleScale} role="menuitem">
        <span class="row-icon text-icon">aA</span>
        <span class="row-label">{$t('textSize')}</span>
        <span class="row-value on">{SCALE_LABELS[$preferences.textScale ?? 1]}</span>
      </button>

      <!-- Language -->
      <button class="row" onclick={cycleLang} role="menuitem">
        <span class="row-icon text-icon">
          {$preferences.lang === 'no' ? 'NO' : 'EN'}
        </span>
        <span class="row-label">{$t('language')}</span>
        <span class="row-value on">{$preferences.lang === 'no' ? 'EN →' : 'NO →'}</span>
      </button>

      <div class="divider"></div>

      <!-- About -->
      <button class="row" onclick={() => showAbout = !showAbout} role="menuitem">
        <span class="row-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </span>
        <span class="row-label">{$t('about')}</span>
        <span class="row-value on">{showAbout ? '▲' : '▼'}</span>
      </button>

      {#if showAbout}
        <div class="about-section">
          <div class="about-row">
            <span class="about-label">{$t('version')}</span>
            <span class="about-value">{appVersion}</span>
          </div>
          <div class="about-row">
            <span class="about-label">{$t('sourceCode')}</span>
            <a class="about-link" href="https://github.com/GilbN/nsf-timer" target="_blank" rel="noopener">GitHub</a>
          </div>
          <div class="about-row">
            <span class="about-label">{$t('license')}</span>
            <span class="about-value">MIT</span>
          </div>
          <div class="about-row">
            <span class="about-label">{$t('reportBug')}</span>
            <a class="about-link" href="https://github.com/GilbN/nsf-timer/issues" target="_blank" rel="noopener">GitHub Issues</a>
          </div>
        </div>
      {/if}

    </div>
  {/if}
</div>

<style>
  .settings-menu {
    position: relative;
  }

  /* icon-btn is defined in TimerView — replicate here for portability */
  .icon-btn {
    position: relative;
    background: var(--bg-surface);
    border: 1px solid rgba(255,255,255,0.06);
    padding: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius);
    transition: border-color 0.15s;
  }

  .icon-btn svg {
    width: 18px;
    height: 18px;
    color: var(--text-secondary);
  }

  .icon-btn.open,
  .icon-btn:hover {
    border-color: rgba(255,255,255,0.15);
  }

  .icon-btn.open svg {
    color: var(--text-primary);
  }

  .update-dot {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--warning);
    box-shadow: 0 0 0 2px var(--bg-primary);
    animation: update-dot-pulse 1.6s ease-in-out infinite;
  }

  @keyframes update-dot-pulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 0 rgba(255, 181, 71, 0.55);
    }
    50% {
      transform: scale(1.15);
      box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 6px rgba(255, 181, 71, 0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .update-dot {
      animation: none;
    }
  }

  .row-update {
    color: var(--accent);
  }

  .row-update .row-label {
    color: var(--accent);
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .update-dot-inline {
    position: static;
    box-shadow: 0 0 0 0 rgba(255, 181, 71, 0.55);
  }

  /* ── Panel ── */
  .panel {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 220px;
    background: var(--bg-secondary);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    overflow: hidden;
    z-index: 100;
    font-size: 0.8125rem;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 14px;
    background: transparent;
    border: none;
    border-radius: 0;
    color: var(--text-primary);
    font-size: 0.8125rem;
    font-weight: 500;
    text-align: left;
    transition: background 0.12s;
    cursor: pointer;
  }

  .row:hover {
    background: rgba(255,255,255,0.05);
  }

  .row-icon {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--text-secondary);
  }

  .row-icon svg {
    width: 16px;
    height: 16px;
  }

  .text-icon {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--text-secondary);
    letter-spacing: 0.04em;
  }

  .row-label {
    flex: 1;
    color: var(--text-secondary);
  }

  .row-value {
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
    opacity: 0.5;
  }

  .row-value.on {
    color: var(--accent);
    opacity: 1;
  }

  .divider {
    height: 1px;
    background: rgba(255,255,255,0.06);
    margin: 2px 0;
  }

  .about-section {
    padding: 6px 14px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .about-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
  }

  .about-label {
    color: var(--text-secondary);
  }

  .about-value {
    color: var(--text-primary);
    font-weight: 600;
    font-size: 0.6875rem;
    letter-spacing: 0.04em;
  }

  .about-link {
    color: var(--accent);
    text-decoration: none;
    font-weight: 600;
    font-size: 0.6875rem;
  }

  .about-link:hover {
    text-decoration: underline;
  }
</style>
