<script lang="ts">
  import {
    deleteBundle,
    downloadBundle,
    listBundles,
    type MapBundle
  } from '$lib/map/offline';
  import { formatBytes } from '$lib/capture/storage';

  let bundles = $state<Omit<MapBundle, 'blob'>[]>([]);
  let url = $state('');
  let name = $state('');
  let progress = $state<number | null>(null);
  let received = $state(0);
  let error = $state('');

  async function refresh() {
    bundles = await listBundles();
  }

  $effect(() => {
    refresh();
  });

  async function download(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    progress = 0;
    try {
      await downloadBundle(url, name || url.split('/').pop() || 'region', (f, r) => {
        progress = f;
        received = r;
      });
      url = '';
      name = '';
      await refresh();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Download failed.';
    } finally {
      progress = null;
    }
  }

  async function remove(id: string) {
    await deleteBundle(id);
    await refresh();
  }
</script>

<h1>Offline maps</h1>

<p class="hint">
  Download a PMTiles region bundle before a trip (e.g. built with
  <code>pmtiles extract</code> from a Protomaps build) and the map keeps
  working in the field without connectivity.
</p>

<form onsubmit={download}>
  <input placeholder="https://…/region.pmtiles" bind:value={url} required />
  <input placeholder="Region name (optional)" bind:value={name} />
  <button disabled={progress !== null}>
    {progress === null ? 'Download' : `Downloading… ${formatBytes(received)}`}
  </button>
  {#if progress !== null && progress > 0}
    <progress value={progress} max="1"></progress>
  {/if}
  {#if error}<p class="error">{error}</p>{/if}
</form>

{#if bundles.length === 0}
  <p>No offline regions yet.</p>
{:else}
  <ul class="bundles">
    {#each bundles as bundle (bundle.id)}
      <li>
        <strong>{bundle.name}</strong>
        <span>{formatBytes(bundle.sizeBytes)}</span>
        <button class="danger" onclick={() => remove(bundle.id)}>Delete</button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .hint { color: #5a6676; font-size: 0.9rem; }
  form { display: flex; flex-direction: column; gap: 0.6rem; max-width: 28rem; }
  input, button {
    font: inherit;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
  }
  button { background: #1a3c5e; color: white; border: none; cursor: pointer; }
  .bundles { list-style: none; padding: 0; display: grid; gap: 0.6rem; margin-top: 1rem; }
  .bundles li {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    background: white;
    border-radius: 8px;
    padding: 0.6rem 0.9rem;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
  }
  .bundles span { color: #5a6676; margin-left: auto; }
  .danger { background: white; color: #b3261e; border: 1px solid #b8c0cc; }
  .error { color: #b3261e; }
</style>
