<script lang="ts" module>
  // Session-lived title cache so returning to a trip never flashes an
  // empty heading while the fetch is in flight.
  const tripTitles = new Map<string, string>();
</script>

<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Timeline from '$lib/components/Timeline.svelte';
  import TripMap from '$lib/components/TripMap.svelte';
  import { api } from '$lib/session';
  import { contentPath } from '$lib/format';

  const path = $derived($page.params.path ?? '');

  // The last selected tab is remembered for the session so "← Trip" from
  // an article or entry returns to the view the user actually came from.
  const VIEW_KEY = 'travelstream.tripView';
  const VIEWS = ['articles', 'stream', 'map'];

  const view = $derived.by(() => {
    const param = $page.url.searchParams.get('view');
    if (param === 'timeline') return 'stream'; // pre-rename bookmarks
    if (param && VIEWS.includes(param)) return param;
    if (browser) {
      const remembered = sessionStorage.getItem(VIEW_KEY);
      if (remembered && VIEWS.includes(remembered)) return remembered;
    }
    return 'articles';
  });

  $effect(() => {
    if (browser) sessionStorage.setItem(VIEW_KEY, view);
  });

  // Offline fallback: the trip's slug, de-dashed, beats a blank heading.
  const slugTitle = $derived.by(() => {
    const segment = path.replace(/\/$/, '').split('/').filter(Boolean).pop() ?? '';
    const words = segment.replace(/-/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  });

  let tripTitle = $state('');

  $effect(() => {
    const key = path.replace(/\/$/, '');
    if (!key) {
      tripTitle = '';
      return;
    }
    const cached = tripTitles.get(key);
    if (cached !== undefined) {
      tripTitle = cached;
      return;
    }
    tripTitle = '';
    api
      .get<{ title?: string }>(`/${key}`)
      .then((data) => {
        const title = data.title ?? '';
        tripTitles.set(key, title);
        if (path.replace(/\/$/, '') === key) tripTitle = title;
      })
      .catch(() => {
        if (path.replace(/\/$/, '') === key && !tripTitle) tripTitle = slugTitle;
      });
  });

  let creating = $state(false);

  async function newArticle() {
    const title = window.prompt('Article title');
    if (!title || creating) return;
    creating = true;
    try {
      const settings = await api.settings();
      const created = await api.post<{ '@id': string }>(`/${path}`, {
        '@type': settings.article_type,
        title,
        prosemirror_doc: { type: 'doc', content: [] }
      });
      goto(`/a/${contentPath(created['@id'])}`);
    } finally {
      creating = false;
    }
  }
</script>

<header class="trip-header">
  <h1>{tripTitle}</h1>
  <a class="edit-trip" href={`/trips/edit/${path}`} aria-label="Edit trip">
    <span aria-hidden="true">✎</span>
  </a>
</header>

<nav class="tabs" aria-label="Trip views">
  <a class:active={view === 'articles'} href={`/t/${path}?view=articles`}>Articles</a>
  <a class:active={view === 'stream'} href={`/t/${path}?view=stream`}>Stream</a>
  <a class:active={view === 'map'} href={`/t/${path}?view=map`}>Map</a>
</nav>

{#if view === 'map'}
  <TripMap {path} />
{:else if view === 'stream'}
  <Timeline {path} />
{:else}
  <button class="new-article" onclick={newArticle} disabled={creating}>
    {creating ? 'Creating…' : '＋ New article'}
  </button>
  <Timeline {path} fixedKind="article" />
{/if}

<style>
  .trip-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    margin: 0.2rem 0 1rem;
  }
  h1 {
    margin: 0;
    font-size: 2rem;
    font-weight: 700;
    line-height: 1.2;
    text-wrap: balance;
    overflow-wrap: anywhere;
    min-height: 1.2em;
  }
  .edit-trip {
    flex: none;
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    box-sizing: border-box;
    /* Optically centered on the heading's first line (2.4rem cap height
       vs the 2.75rem touch target). */
    margin-top: -0.175rem;
    border: 1px solid #b8c0cc;
    border-radius: 8px;
    background: white;
    color: #42555b;
    font-size: 1.15rem;
    text-decoration: none;
    transition: background-color 150ms ease-out;
  }
  @media (hover: hover) {
    .edit-trip:hover {
      background: var(--primary-tint-hover);
    }
  }
  .edit-trip:active {
    background: var(--primary-tint-active);
  }
  .edit-trip:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .tabs a {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
    box-sizing: border-box;
    padding: 0.5rem 1.1rem;
    border-radius: 999px;
    text-decoration: none;
    color: #1c2430;
    background: #e4e8ee;
    transition: background-color 150ms ease-out;
  }
  @media (hover: hover) {
    .tabs a:not(.active):hover {
      background: #d8dee6;
    }
  }
  .tabs a:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
  .tabs a.active {
    background: var(--primary);
    color: white;
    font-weight: 600;
  }
  .new-article {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
    box-sizing: border-box;
    margin-bottom: 1rem;
    padding: 0.5rem 1.1rem;
    border: none;
    border-radius: 6px;
    background: var(--primary);
    color: white;
    font: inherit;
    cursor: pointer;
    transition: background-color 150ms ease-out;
  }
  @media (hover: hover) {
    .new-article:hover {
      background: var(--primary-soft);
    }
  }
  .new-article:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .edit-trip,
    .tabs a,
    .new-article {
      transition: none;
    }
  }
</style>
