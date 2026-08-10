<script lang="ts">
  import { goto } from '$app/navigation';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';

  import { api } from '$lib/session';
  import { contentPath } from '$lib/format';
  import { offlineStyle, onlineStyle } from '$lib/map/style';
  import { firstBundleBlob } from '$lib/map/offline';

  let { path }: { path: string } = $props();
  let container = $state<HTMLElement | null>(null);
  let error = $state('');

  let styleReady = $state<ReturnType<typeof onlineStyle> | null>(null);

  $effect(() => {
    (async () => {
      if (!navigator.onLine) {
        const bundle = await firstBundleBlob();
        if (bundle) {
          styleReady = offlineStyle(bundle, 'region');
          return;
        }
      }
      styleReady = onlineStyle();
    })();
  });

  $effect(() => {
    if (!container || !styleReady) return;
    const map = new maplibregl.Map({
      container,
      style: styleReady,
      center: [0, 20],
      zoom: 1.5,
      attributionControl: { compact: true }
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', async () => {
      let collection;
      try {
        collection = await api.geojson(`/${path}`);
      } catch {
        error = 'Could not load map data.';
        return;
      }

      map.addSource('entries', {
        type: 'geojson',
        data: collection as never,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 45
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'entries',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#1a3c5e',
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28],
          'circle-opacity': 0.85
        }
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'entries',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 13
        },
        paint: { 'text-color': '#ffffff' }
      });
      map.addLayer({
        id: 'points',
        type: 'circle',
        source: 'entries',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#e0703c',
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      map.on('click', 'clusters', async (event) => {
        const features = map.queryRenderedFeatures(event.point, { layers: ['clusters'] });
        const clusterId = features[0].properties.cluster_id;
        const source = map.getSource('entries') as maplibregl.GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const geometry = features[0].geometry as { coordinates: [number, number] };
        map.easeTo({ center: geometry.coordinates, zoom });
      });

      map.on('click', 'points', (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const id = feature.properties?.['@id'];
        if (id) goto(`/e/${contentPath(id)}`);
      });
      map.on('mouseenter', 'points', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'points', () => (map.getCanvas().style.cursor = ''));

      // Fit to the trip's entries.
      if (collection.features.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        for (const feature of collection.features) {
          bounds.extend(feature.geometry.coordinates as [number, number]);
        }
        map.fitBounds(bounds, { padding: 48, maxZoom: 12 });
      }
    });

    return () => map.remove();
  });
</script>

{#if error}<p class="error">{error}</p>{/if}
<div class="map" bind:this={container}></div>

<style>
  .map {
    height: min(70dvh, 34rem);
    border-radius: 10px;
    overflow: hidden;
  }
  .error { color: #b3261e; }
</style>
