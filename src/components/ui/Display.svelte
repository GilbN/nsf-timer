<script>
  /**
   * The recessed display with the range lamp along its top edge.
   * `lamp` is 'off' | 'red' | 'green'; `lit` turns the display white with
   * black text. Children decide the content; the display only frames it.
   */
  let { lamp = 'off', lit = false, class: className = '', children } = $props()
</script>

<div class="display {className}" class:lit data-lamp={lamp}>
  <span class="lamp" aria-hidden="true"></span>
  {@render children?.()}
</div>

<style>
  .display {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px 20px 18px;
    border-radius: var(--r-well);
    background: var(--well);
    box-shadow: var(--well-shadow);
    color: var(--fg);
    --sub: var(--muted);
    --meter-off: #232325;
    --meter-on: var(--fg);
    --meter-now: #5a5a5e;
    --chip-bg: #1a1a1c;
    --chip-fg: var(--fg);
    transition: background 0.12s, color 0.12s;
  }

  .display.lit {
    background: var(--fg);
    color: var(--ink);
    box-shadow: none;
    --sub: var(--ink-soft);
    --meter-off: #d6d6d6;
    --meter-on: var(--ink);
    --meter-now: #8a8a8a;
    --chip-bg: var(--ink);
    --chip-fg: #fff;
  }

  .lamp {
    position: absolute;
    top: 0;
    left: 22px;
    right: 22px;
    height: 6px;
    border-radius: 0 0 6px 6px;
    background: #1f1f21;
    transition: background 0.12s, box-shadow 0.12s;
  }

  .lit .lamp { background: #d6d6d6; }

  [data-lamp='red'] .lamp {
    background: var(--lamp-red);
    box-shadow: 0 0 18px 2px var(--lamp-red-glow);
  }

  [data-lamp='green'] .lamp {
    background: var(--lamp-green);
    box-shadow: 0 0 18px 2px var(--lamp-green-glow);
  }
</style>
