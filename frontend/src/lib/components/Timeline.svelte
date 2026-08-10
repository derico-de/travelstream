<script lang="ts">
  import { api } from '$lib/session';
  import { contentPath, formatCaptureTime, itemThumbnail } from '$lib/format';
  import type { EntryKind, TimelineItem } from '$lib/api/types';

  let { path }: { path: string } = $props();

  let items = $state<TimelineItem[]>([]);
  let nextUrl = $state<string | null>(null);
  let total = $state(0);
  let loading = $state(false);
  let error = $state('');
  let kind = $state<EntryKind | ''>('');
  let after = $state('');
  let before = $state('');
  let sentinel = $state<HTMLElement | null>(null);

  async function loadFirstPage() {
    loading = true;
    error = '';
    try {
      const response = await api.timeline(`/${path}`, {
        kind: kind || undefined,
        captured_after: after ? `${after}T00:00:00` : undefined,
        captured_before: before ? `${before}T23:59:59` : undefined,
        b_size: 25
      });
      items = response.items;
      total = response.items_total;
      nextUrl = response.batching?.next ?? null;
    } catch {
      error = 'Could not load the timeline.';
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (!nextUrl || loading) return;
    loading = true;
    try {
      const response = await api.timelinePage(nextUrl);
      items = [...items, ...response.items];
      nextUrl = response.batching?.next ?? null;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    // Reload when path or filters change.
    void path;
    void kind;
    void after;
    void before;
    loadFirstPage();
  });

  $effect(() => {
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMore();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  const kindIcons: Record<string, string> = {
    photo: '📷',
    video: '🎬',
    note: '📝',
    article: '📰'
  };
</script>

<div class="filters">
  <select bind:value={kind}>
    <option value="">All kinds</option>
    <option value="photo">Photos</option>
    <option value="video">Videos</option>
    <option value="note">Notes</option>
  </select>
  <input type="date" bind:value={after} title="From" />
  <input type="date" bind:value={before} title="Until" />
</div>

{#if error}
  <p class="error">{error}</p>
{:else}
  <p class="count">{total} entries</p>
  <ul class="timeline">
    {#each items as item (item['@id'])}
      <li>
        <a href={`/e/${contentPath(item['@id'])}`}>
          {#if itemThumbnail(item)}
            <img src={itemThumbnail(item)} alt="" loading="lazy" />
          {:else}
            <div class="note-preview">{kindIcons[item.kind ?? 'note']}</div>
          {/if}
          <div class="meta">
            <strong>{item.title}</strong>
            <span>
              {kindIcons[item.kind ?? 'note']}
              {formatCaptureTime(item.captured_at)}
            </span>
          </div>
        </a>
      </li>
    {/each}
  </ul>
  {#if nextUrl}
    <div class="sentinel" bind:this={sentinel}>
      {loading ? 'Loading more...' : ''}
    </div>
  {/if}
{/if}

<style>
  .filters {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.8rem;
    flex-wrap: wrap;
  }
  .filters select, .filters input {
    font: inherit;
    padding: 0.35rem 0.5rem;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
  }
  .count { color: #5a6676; font-size: 0.85rem; }
  .timeline {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.8rem;
  }
  .timeline a {
    display: flex;
    gap: 0.8rem;
    background: white;
    border-radius: 10px;
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
    align-items: center;
  }
  .timeline img, .note-preview {
    width: 6rem;
    height: 6rem;
    object-fit: cover;
    flex-shrink: 0;
  }
  .note-preview {
    display: grid;
    place-items: center;
    font-size: 2rem;
    background: #e4e8ee;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.4rem 0.6rem 0.4rem 0;
  }
  .meta span { color: #5a6676; font-size: 0.85rem; }
  .sentinel { min-height: 2rem; text-align: center; color: #5a6676; }
  .error { color: #b3261e; }
</style>
