<script>
  import Modal from '../../../src/components/Modal.svelte'

  let { show = true, onClose } = $props()
</script>

{#if show}
  <Modal {onClose}>
    <p>content</p>
  </Modal>
{/if}
