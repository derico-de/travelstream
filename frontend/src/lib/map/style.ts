/**
 * Map style: online OSM raster tiles by default; ticket 18 swaps in
 * offline PMTiles bundles when a region is downloaded.
 */

import type { StyleSpecification } from 'maplibre-gl';

export function mapStyle(): StyleSpecification {
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
