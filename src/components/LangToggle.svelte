<script>
  import { preferences } from '../lib/stores.js'
  import { savePreferences } from '../lib/storage.js'

  function toggle() {
    preferences.update((p) => {
      const updated = { ...p, lang: p.lang === 'no' ? 'en' : 'no' }
      savePreferences(updated)
      return updated
    })
  }
</script>

<button class="lang-toggle" onclick={toggle}>
  {$preferences.lang === 'no' ? 'EN' : 'NO'}
</button>

<style>
  .lang-toggle {
    background: var(--bg-surface);
    color: var(--text-primary);
    padding: 0.4rem 0.8rem;
    font-size: 0.85rem;
    font-weight: 700;
    border-radius: var(--radius);
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
