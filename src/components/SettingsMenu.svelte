<script>
  import { tick } from 'svelte'
  import { preferences } from '../lib/stores.js'
  import { savePreferences } from '../lib/storage.js'
  import { t } from '../lib/i18n.js'
  import { updateAvailable, updateDismissed } from '../lib/updateAvailable.js'
  import Modal from './Modal.svelte'
  import Icon from './ui/Icon.svelte'

  /**
   * The ⋯ button and its sheet: preferences as toggle keys, then the
   * view's own actions. A green light on a key means the setting is on.
   * @type {{ actions?: { id: string, label: string, icon: string, onSelect: () => void | Promise<void>, danger?: boolean }[] }}
   */
  let { actions = [] } = $props()

  let open = $state(false)
  const appVersion = __APP_VERSION__
  const SCALES = [1, 1.2, 1.4]
  /** @type {Record<string, string>} */
  const SCALE_LABELS = { 1: '100%', 1.2: '120%', 1.4: '140%' }

  let ordered = $derived([...actions.filter(a => !a.danger), ...actions.filter(a => a.danger)])

  /** @param {'soundEnabled' | 'wakeLockEnabled'} key */
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

  function openUpdateModal() {
    updateDismissed.set(false)
    open = false
  }

  /** Close the sheet first so a confirm opened by the action isn't stacked on it */
  async function run(action) {
    open = false
    await tick()
    await action.onSelect()
  }
</script>

<button class="btn btn-icon trigger" onclick={() => (open = true)} aria-label={$t('more')} aria-haspopup="dialog" aria-expanded={open}>
  <Icon name="more" />
  {#if $updateAvailable}<span class="update-dot" aria-hidden="true"></span>{/if}
</button>

{#if open}
  <Modal variant="sheet" onClose={() => (open = false)} labelledby="settings-title">
    <div class="sheet-panel">
      <div class="sheet-head">
        <h2 id="settings-title">{$t('settings')}</h2>
        <span class="aside tnum">{$t('version')} {appVersion}</span>
      </div>

      {#if $updateAvailable}
        <button class="key key-white key-row" onclick={openUpdateModal}>
          <Icon name="download" />{$t('updateAvailableReload')}
        </button>
      {/if}

      <div class="key-grid prefs">
        <button class="key pref" onclick={() => toggle('soundEnabled')} aria-pressed={$preferences.soundEnabled}>
          <span class="head"><Icon name={$preferences.soundEnabled ? 'sound' : 'mute'} /><span class="led" class:off={!$preferences.soundEnabled}></span></span>
          <span>{$t('sound')}</span>
        </button>
        <button class="key pref" onclick={() => toggle('wakeLockEnabled')} aria-pressed={$preferences.wakeLockEnabled}>
          <span class="head"><Icon name="sun" /><span class="led" class:off={!$preferences.wakeLockEnabled}></span></span>
          <span>{$t('keepAwake')}</span>
        </button>
        <button class="key pref" onclick={cycleScale}>
          <span class="head"><Icon name="type" /></span>
          <span>{$t('textSize')}<small class="tnum">{SCALE_LABELS[$preferences.textScale ?? 1]}</small></span>
        </button>
        <button class="key pref" onclick={cycleLang}>
          <span class="head"><Icon name="globe" /></span>
          <span>{$t('language')}<small>{$preferences.lang === 'no' ? 'Norsk' : 'English'}</small></span>
        </button>
        <button class="key pref" onclick={cycleCountdownFormat}>
          <span class="head"><Icon name="clock" /></span>
          <span>{$t('countdownFormat')}<small>{$preferences.countdownFormat === 'seconds' ? $t('countdownSeconds') : $t('countdownMinSec')}</small></span>
        </button>
        <button class="key pref" onclick={cycleStopwatchFormat}>
          <span class="head"><Icon name="stopwatch" /></span>
          <span>{$t('stopwatchFormat')}<small>{$preferences.stopwatchFormat === 'mmss' ? $t('countdownMinSec') : $t('countdownSeconds')}</small></span>
        </button>
      </div>

      {#if ordered.length}
        <div class="key-grid actions">
          {#each ordered as action (action.id)}
            <button class="key key-row" class:key-line={action.danger} onclick={() => run(action)}>
              <Icon name={action.icon} />{action.label}
            </button>
          {/each}
        </div>
      {/if}

      <div class="about">
        <a class="btn btn-ghost" href="https://github.com/GilbN/nsf-timer" target="_blank" rel="noopener"><Icon name="github" />{$t('sourceCode')}</a>
        <a class="btn btn-ghost" href="https://github.com/GilbN/nsf-timer/issues" target="_blank" rel="noopener"><Icon name="bug" />{$t('reportBug')}</a>
        <span class="licence">{$t('license')} MIT</span>
      </div>
    </div>
  </Modal>
{/if}

<style>
  .trigger { position: relative; }

  .update-dot {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--lamp-green);
    box-shadow: 0 0 6px var(--lamp-green-glow);
  }

  .pref {
    min-height: 104px;
    padding: 14px 16px;
    font-size: 0.9375rem;
  }

  .pref .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .pref :global(svg) { width: 22px; height: 22px; }

  .actions .key:last-child:nth-child(odd) { grid-column: span 2; }
  .actions .key { min-height: 56px; }

  .about {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    padding-top: 2px;
  }

  .about a { color: var(--muted); text-decoration: none; height: 40px; padding: 0 10px; }
  .licence { margin-left: auto; padding-right: 8px; font-size: 0.8125rem; font-weight: 600; color: var(--muted); }
</style>
