<script>
  import Modal from '../../../src/components/Modal.svelte'

  let { show = true, onClose, variant = undefined } = $props()
</script>

{#if show}
  <Modal {onClose} {variant}>
    <p>content</p>
  </Modal>
{/if}
