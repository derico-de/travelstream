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

  async function newArticle() {
    const title = window.prompt('Article title');
    if (!title) return;
    const settings = await api.settings();
    const created = await api.post<{ '@id': string }>(`/${path}`, {
      '@type': settings.article_type,
      title,
      prosemirror_doc: { type: 'doc', content: [] }
    });
    goto(`/a/${contentPath(created['@id'])}`);
  }
</script>

<div class="tabs">
  <a class:active={view === 'articles'} href={`/t/${path}?view=articles`}>Articles</a>
  <a class:active={view === 'stream'} href={`/t/${path}?view=stream`}>Stream</a>
  <a class:active={view === 'map'} href={`/t/${path}?view=map`}>Map</a>
  <a class="edit-trip" href={`/trips/edit/${path}`} aria-label="Edit trip">✎ Edit</a>
  <button class="new-article" onclick={newArticle}>+ Article</button>
</div>

{#if view === 'map'}
  <TripMap {path} />
{:else if view === 'stream'}
  <Timeline {path} />
{:else}
  <Timeline {path} fixedKind="article" />
{/if}

<style>
  .tabs {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 1rem;
  }
  .tabs a {
    padding: 0.4rem 1rem;
    border-radius: 999px;
    text-decoration: none;
    color: #1c2430;
    background: #e4e8ee;
  }
  .tabs a.active {
    background: var(--primary);
    color: white;
  }
  .edit-trip {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    padding: 0.4rem 0.8rem;
    border-radius: 999px;
    border: 1px solid #b8c0cc;
    background: white;
    color: #42555b;
    text-decoration: none;
    font-size: 0.9rem;
  }
  .new-article {
    font: inherit;
    padding: 0.4rem 1rem;
    border-radius: 999px;
    border: 1px dashed var(--primary);
    background: white;
    color: var(--primary);
    cursor: pointer;
  }
</style>
