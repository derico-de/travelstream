/**
 * Map styles: online OSM raster tiles when connected; a downloaded
 * PMTiles region bundle (Protomaps vector schema) when offline or
 * preferred. The pmtiles protocol is registered once per app.
 */

import maplibregl from 'maplibre-gl';
import { FileSource, PMTiles, Protocol } from 'pmtiles';
import layers from 'protomaps-themes-base';
import type { StyleSpecification } from 'maplibre-gl';

let protocol: Protocol | null = null;

function ensureProtocol(): Protocol {
  if (!protocol) {
    protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
  }
  return protocol;
}

export function onlineStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors'
      }
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#dfe8ef' } },
      { id: 'osm', type: 'raster', source: 'osm' }
    ]
  };
}

/** Style backed by a locally stored PMTiles bundle (offline regions). */
export function offlineStyle(bundle: Blob, bundleId: string): StyleSpecification {
  const pmtiles = new PMTiles(new FileSource(new File([bundle], `${bundleId}.pmtiles`)));
  ensureProtocol().add(pmtiles);
  return {
    version: 8,
    glyphs:
      'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${bundleId}.pmtiles`,
        attribution: '© OpenStreetMap contributors, Protomaps'
      }
    },
    layers: layers('protomaps', 'light', 'en')
  };
}

/** Backwards-compatible default used by TripMap. */
export function mapStyle(): StyleSpecification {
  return onlineStyle();
}
