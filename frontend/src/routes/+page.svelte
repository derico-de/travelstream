<script lang="ts">
  import { api } from '$lib/session';
  import type { Trip } from '$lib/api/types';
  import { contentPath, tripCoverUrl, formatDateRange } from '$lib/format';

  let trips = $state<Trip[] | null>(null);
  let error = $state('');

  $effect(() => {
    api
      .listTrips()
      .then((items) => (trips = items))
      .catch(() => (error = 'Could not load trips.'));
  });
</script>

<h1>Trips</h1>

{#if error}
  <p class="error">{error}</p>
{:else if trips === null}
  <p>Loading trips...</p>
{:else if trips.length === 0}
  <p>No trips yet. Create one in Plone to get started.</p>
{:else}
  <ul class="trips">
    {#each trips as trip (trip['@id'])}
      <li>
        <a href={`/t/${contentPath(trip['@id'])}`}>
          {#if tripCoverUrl(trip)}
            <img src={tripCoverUrl(trip)} alt="" loading="lazy" />
          {:else}
            <div class="placeholder"></div>
          {/if}
          <div class="meta">
            <strong>{trip.title}</strong>
            <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
          </div>
        </a>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .trips {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 1rem;
  }
  .trips a {
    display: block;
    background: white;
    border-radius: 10px;
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
  }
  .trips img, .placeholder {
    width: 100%;
    height: 9rem;
    object-fit: cover;
    display: block;
    background: linear-gradient(120deg, #35608c, #1a3c5e);
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.7rem 0.9rem;
  }
  .meta span {
    color: #5a6676;
    font-size: 0.85rem;
  }
  .error { color: #b3261e; }
</style>
