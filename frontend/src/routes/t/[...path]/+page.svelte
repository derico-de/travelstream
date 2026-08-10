<script lang="ts">
  import { page } from '$app/stores';
  import Timeline from '$lib/components/Timeline.svelte';
  import TripMap from '$lib/components/TripMap.svelte';

  const path = $derived($page.params.path ?? '');
  const view = $derived($page.url.searchParams.get('view') ?? 'timeline');
</script>

<div class="tabs">
  <a class:active={view === 'timeline'} href={`/t/${path}`}>Timeline</a>
  <a class:active={view === 'map'} href={`/t/${path}?view=map`}>Map</a>
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
</style>
