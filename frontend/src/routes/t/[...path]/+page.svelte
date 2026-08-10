<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Timeline from '$lib/components/Timeline.svelte';
  import TripMap from '$lib/components/TripMap.svelte';
  import { api } from '$lib/session';
  import { contentPath } from '$lib/format';

  const path = $derived($page.params.path ?? '');
  const view = $derived($page.url.searchParams.get('view') ?? 'timeline');

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
  <a class:active={view === 'timeline'} href={`/t/${path}`}>Timeline</a>
  <a class:active={view === 'map'} href={`/t/${path}?view=map`}>Map</a>
  <button class="new-article" onclick={newArticle}>+ Article</button>
</div>

{#if view === 'map'}
  <TripMap {path} />
{:else}
  <Timeline {path} />
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
    background: #1a3c5e;
    color: white;
  }
  .new-article {
    margin-left: auto;
    font: inherit;
    padding: 0.4rem 1rem;
    border-radius: 999px;
    border: 1px dashed #1a3c5e;
    background: white;
    color: #1a3c5e;
    cursor: pointer;
  }
</style>
