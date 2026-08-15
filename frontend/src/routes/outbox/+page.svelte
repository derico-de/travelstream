<script lang="ts">
  import { outbox, outboxItems } from '$lib/outbox';
  import { api } from '$lib/session';
  import { contentPath } from '$lib/format';
  import type { Trip } from '$lib/api/types';
  import type { OutboxItem } from '$lib/outbox/types';

  let trips = $state<Trip[]>([]);

  $effect(() => {
    api.listTrips().then((items) => (trips = items)).catch(() => (trips = []));
  });

  async function attach(id: string, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    await outbox.attachFile(id, file, file.name, file.type || 'video/mp4');
    if (navigator.onLine) void outbox.drain();
  }

  async function assign(id: string, tripPath: string) {
    if (!tripPath) return;
    await outbox.assignTrip(id, tripPath);
    if (navigator.onLine) void outbox.drain();
  }

  function needsTrip(item: OutboxItem): boolean {
    return !item.tripPath && item.state !== 'done';
  }

  const stateLabels: Record<string, string> = {
    staged: 'In review',
    captured: 'Waiting for its file',
    queued: 'Waiting to upload',
    uploading: 'Uploading',
    done: 'Uploaded',
    failed: 'Upload failed'
  };

  function stateLabel(item: OutboxItem): string {
    // Staged items say "In review" even without a trip: review comes first.
    if (needsTrip(item) && item.state !== 'failed' && item.state !== 'staged')
      return 'Needs a trip';
    return stateLabels[item.state];
  }
</script>

<h1>Outbox</h1>

{#if $outboxItems.length === 0}
  <p>Nothing waiting. Captures land here and upload when you're online.</p>
{:else}
  <div class="toolbar">
    {#if $outboxItems.some((i) => i.state === 'failed')}
      <button onclick={() => outbox.retryAll()}>Retry all failed</button>
    {/if}
    {#if $outboxItems.some((i) => i.state === 'done')}
      <button onclick={() => outbox.clearDone()}>Clear uploaded</button>
    {/if}
  </div>
  <ul class="outbox">
    {#each $outboxItems as item (item.id)}
      <li class={item.state}>
        <div class="row">
          <span class="kind">{item.kind}</span>
          <strong>{item.title}</strong>
          <span class="state">{stateLabel(item)}</span>
        </div>
        {#if needsTrip(item)}
          <label class="assign">
            Trip
            {#if trips.length > 0}
              <select onchange={(e) => assign(item.id, e.currentTarget.value)}>
                <option value="">Pick a trip…</option>
                {#each trips as trip (trip['@id'])}
                  <option value={contentPath(trip['@id'])}>{trip.title}</option>
                {/each}
              </select>
            {:else}
              <span class="assign-hint">Trips can't load right now — this stays safe here and uploads once you pick a trip.</span>
            {/if}
          </label>
        {/if}
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
        {#if item.state === 'staged'}
          <p class="staged-hint">
            Not queued yet — <a href="/capture/review">finish reviewing</a> to
            start the upload.
          </p>
        {/if}
        {#if item.state === 'captured' && item.pendingAttachment}
          <label class="attach">
            Attach video file
            <input
              type="file"
              accept="video/*"
              onchange={(e) => attach(item.id, e.currentTarget.files)}
            />
          </label>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  h1 {
    margin: 0 0 1rem;
  }
  .toolbar {
    display: flex;
    gap: 0.6rem;
    margin-bottom: 1rem;
  }
  .outbox {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.6rem;
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
  .error { color: #b3261e; font-size: 0.85rem; margin: 0.3rem 0; }
  .actions { display: flex; gap: 0.6rem; }
  button {
    font: inherit;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
    background: white;
    cursor: pointer;
    min-height: 2.75rem;
  }
  .danger { color: #b3261e; }
  .attach {
    position: relative;
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    min-height: 2.75rem;
    margin-top: 0.6rem;
    padding: 0.5rem 1rem;
    border: 1px dashed var(--primary);
    border-radius: 6px;
    color: var(--primary);
    cursor: pointer;
    font-size: 0.85rem;
  }
  /* Same rule as capture: keep the input in the tab order. */
  .attach input {
    position: absolute;
    width: 1px;
    height: 1px;
    min-height: 0;
    padding: 0;
    border: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .attach:has(input:focus-visible) {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
  .assign {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.6rem;
    font-size: 0.85rem;
    color: #5a6676;
  }
  .assign select {
    font: inherit;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
    min-height: 2.75rem;
    flex: 1;
    min-width: 0;
  }
  .assign-hint { color: #5a6676; }
  .staged-hint {
    margin: 0.3rem 0 0;
    font-size: 0.85rem;
    color: #5a6676;
  }
  .staged-hint a { color: var(--primary); }
</style>
