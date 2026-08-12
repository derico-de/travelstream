<script lang="ts">
  import { api } from '$lib/session';
  import { contentPath, formatCaptureTime, itemCover, itemThumbnail } from '$lib/format';
  import { primeMediaCache } from '$lib/media';
  import type { EntryKind, TimelineItem } from '$lib/api/types';

  let { path, fixedKind }: { path: string; fixedKind?: EntryKind } = $props();

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
        kind: fixedKind ?? (kind || undefined),
        captured_after: after ? `${after}T00:00:00` : undefined,
        captured_before: before ? `${before}T23:59:59` : undefined,
        b_size: 25
      });
      items = response.items;
      total = response.items_total;
      nextUrl = response.batching?.next ?? null;
      primeMediaCache(response.items);
    } catch {
      error = 'Could not load the stream.';
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (!nextUrl || loading) return;
    loading = true;
    try {
      const response = await api.timelinePage(nextUrl);
      // Never append an item twice — a duplicate key crashes the keyed
      // {#each} and freezes the list mid-"Loading more".
      const known = new Set(items.map((i) => i['@id']));
      items = [...items, ...response.items.filter((i) => !known.has(i['@id']))];
      nextUrl = response.batching?.next ?? null;
      primeMediaCache(response.items);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    // Reload when path or filters change.
    void path;
    void fixedKind;
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
  {#if !fixedKind}
    <select bind:value={kind}>
      <option value="">All kinds</option>
      <option value="photo">Photos</option>
      <option value="video">Videos</option>
      <option value="note">Notes</option>
      <option value="article">Articles</option>
    </select>
  {/if}
  <input type="date" bind:value={after} title="From" />
  <input type="date" bind:value={before} title="Until" />
</div>

{#if error}
  <p class="error">{error}</p>
{:else}
  <p class="count">{total} {fixedKind ? `${fixedKind}s` : 'entries'}</p>
  {#if fixedKind === 'article'}
    <!-- Trip-style cards: full-width cover, title, teaser, date. -->
    <ul class="articles">
      {#each items as item (item['@id'])}
        <li>
          <a href={`/a/${contentPath(item['@id'])}`}>
            {#if itemCover(item)}
              <img src={itemCover(item)} alt="" loading="lazy" />
            {:else}
              <div class="placeholder"></div>
            {/if}
            <div class="meta">
              <strong>{item.title}</strong>
              {#if item.description}
                <p class="teaser">{item.description}</p>
              {/if}
              <span>
                {formatCaptureTime(item.captured_at)}
                {#if item.review_state === 'published'}· published{/if}
              </span>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {:else}
  <ul class="timeline">
    {#each items as item (item['@id'])}
      <li>
        <a
          href={`/${item.kind === 'article' ? 'a' : 'e'}/${contentPath(item['@id'])}`}
        >
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
  {/if}
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
  /* Article cards mirror the trips list. */
  .articles {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 1rem;
  }
  .articles a {
    display: block;
    background: white;
    border-radius: 10px;
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
  }
  .articles img, .placeholder {
    width: 100%;
    height: 9rem;
    object-fit: cover;
    display: block;
    background: linear-gradient(120deg, var(--primary-soft), var(--primary));
  }
  .articles .meta {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.7rem 0.9rem;
  }
  .teaser {
    margin: 0;
    color: #5a6676;
    font-size: 0.9rem;
  }
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
