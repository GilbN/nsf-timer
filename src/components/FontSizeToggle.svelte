<script>
  import { preferences } from '../lib/stores.js'
  import { savePreferences } from '../lib/storage.js'

  const SCALES = [1, 1.2, 1.4]

  function cycle() {
    preferences.update(p => {
      const next = SCALES[(SCALES.indexOf(p.textScale ?? 1) + 1) % SCALES.length]
      const updated = { ...p, textScale: next }
      savePreferences(updated)
      return updated
    })
  }
</script>

<button class="font-size-toggle" onclick={cycle} title="Text size">
  {#if ($preferences.textScale ?? 1) >= 1.4}A+{:else if ($preferences.textScale ?? 1) >= 1.2}A{:else}aA{/if}
</button>

<style>
  .font-size-toggle {
    background: var(--bg-surface);
    color: var(--text-secondary);
    border: 1px solid rgba(255,255,255,0.06);
    padding: 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    border-radius: var(--radius);
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, border-color 0.15s;
  }

  .font-size-toggle:hover {
    color: var(--text-primary);
    border-color: rgba(255,255,255,0.15);
  }
</style>
