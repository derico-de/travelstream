<script lang="ts">
  import { api } from '$lib/session';
  import { itemThumbnail } from '$lib/format';
  import type { TimelineItem } from '$lib/api/types';

  let {
    path,
    onpick,
    onclose
  }: {
    path: string;
    onpick: (item: TimelineItem) => void;
    onclose: () => void;
  } = $props();

  let items = $state<TimelineItem[]>([]);
  let error = $state('');

  $effect(() => {
    api
      .timeline(`/${path}`, { kind: ['photo', 'video'], b_size: 100 })
      .then((response) => (items = response.items))
      .catch(() => (error = 'Could not load the trip timeline.'));
  });
</script>

<div
  class="backdrop"
  role="presentation"
  onclick={(event) => {
    if (event.target === event.currentTarget) onclose();
  }}
>
  <div class="picker" role="dialog" aria-label="Pick media to embed">
    <header>
      <strong>Embed from this trip</strong>
      <button onclick={() => onclose()}>✕</button>
    </header>
    {#if error}
      <p class="error">{error}</p>
    {:else}
      <div class="grid">
        {#each items as item (item['@id'])}
          <button class="cell" onclick={() => onpick(item)}>
            {#if itemThumbnail(item)}
              <img src={itemThumbnail(item)} alt={item.title} loading="lazy" />
            {:else}
              <span class="video-mark">🎬</span>
            {/if}
            <span class="title">{item.title}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 16, 24, 0.55);
    display: grid;
    place-items: center;
    z-index: 50;
  }
  .picker {
    background: white;
    border-radius: 12px;
    width: min(92vw, 38rem);
    max-height: 80dvh;
    overflow: auto;
    padding: 1rem;
  }
  header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.8rem;
  }
  header button {
    border: none;
    background: none;
    font-size: 1.1rem;
    cursor: pointer;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
    gap: 0.6rem;
  }
  .cell {
    border: 1px solid #dfe3ea;
    border-radius: 8px;
    background: white;
    padding: 0.3rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .cell img {
    width: 100%;
    height: 5.5rem;
    object-fit: cover;
    border-radius: 6px;
  }
  .video-mark {
    display: grid;
    place-items: center;
    height: 5.5rem;
    font-size: 2rem;
    background: #e4e8ee;
    border-radius: 6px;
  }
  .title {
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .error { color: #b3261e; }
</style>
