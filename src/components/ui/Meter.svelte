<script>
  /**
   * One segment per series: finished ones filled, the current one grey.
   * Colours come from the surrounding Display (--meter-*).
   */
  let { count, done = 0, current = -1, label = undefined } = $props()
</script>

<div class="meter" role={label ? 'img' : undefined} aria-label={label}>
  {#each { length: count } as _, i (i)}
    <i class:on={i < done} class:now={i === current && i >= done}></i>
  {/each}
</div>

<style>
  .meter { display: flex; gap: 4px; flex: none; }
  i { flex: 1; height: 6px; border-radius: 3px; background: var(--meter-off, #232325); }
  i.on { background: var(--meter-on, var(--fg)); }
  i.now { background: var(--meter-now, #5a5a5e); }
</style>
