<script lang="ts">
  import { outbox, outboxItems } from '$lib/outbox';

  const stateLabels: Record<string, string> = {
    captured: 'Waiting for file',
    queued: 'Queued',
    uploading: 'Uploading',
    done: 'Done',
    failed: 'Failed'
  };
</script>

<h1>Outbox</h1>

{#if $outboxItems.length === 0}
  <p>Nothing queued. Captures land here and upload when you are online.</p>
{:else}
  <ul class="outbox">
    {#each $outboxItems as item (item.id)}
      <li class={item.state}>
        <div class="row">
          <span class="kind">{item.kind}</span>
          <strong>{item.title}</strong>
          <span class="state">{stateLabels[item.state]}</span>
        </div>
        {#if item.state === 'uploading'}
          <progress value={item.progress} max="1"></progress>
        {/if}
        {#if item.state === 'failed'}
          <p class="error">{item.error}</p>
          <div class="actions">
            <button onclick={() => outbox.retry(item.id)}>Retry</button>
            <button class="danger" onclick={() => outbox.delete(item.id)}>Delete</button>
          </div>
        {/if}
        {#if item.state === 'done' && item.remoteUrl}
          <span class="done-mark">✓ uploaded</span>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .outbox {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.7rem;
  }
  li {
    background: white;
    border-radius: 8px;
    padding: 0.7rem 0.9rem;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
  }
  .row {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
  }
  .kind {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: #5a6676;
  }
  .state { margin-left: auto; font-size: 0.85rem; color: #5a6676; }
  li.failed .state { color: #b3261e; }
  li.done .state { color: #14691b; }
  progress { width: 100%; }
  .error { color: #b3261e; font-size: 0.85rem; margin: 0.4rem 0; }
  .actions { display: flex; gap: 0.6rem; }
  button {
    font: inherit;
    padding: 0.3rem 0.8rem;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
    background: white;
    cursor: pointer;
  }
  .danger { color: #b3261e; }
  .done-mark { font-size: 0.85rem; color: #14691b; }
</style>
