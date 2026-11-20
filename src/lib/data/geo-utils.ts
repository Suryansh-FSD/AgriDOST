import { GeoJSONPolygon, Position, BoundingBox } from '@/types/geojson';

/**
 * Calculates the bounding box of a GeoJSON Polygon
 */
export function calculateBoundingBox(polygon: GeoJSONPolygon): BoundingBox {
  const ring = polygon.coordinates[0] || [];
  if (ring.length === 0) {
    return { minLng: 0, minLat: 0, maxLng: 1, maxLat: 1, centerLng: 0.5, centerLat: 0.5 };
  }

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }

  return {
    minLng,
    minLat,
    maxLng,
    maxLat,
    centerLng: (minLng + maxLng) / 2,
    centerLat: (minLat + maxLat) / 2,
  };
}

/**
 * Normalizes GeoJSON coordinates into SVG path coordinates
 * fitting within specified viewBox width and height.
 */
export function polygonToSvgPoints(
  polygon: GeoJSONPolygon,
  width: number,
  height: number,
  bbox: BoundingBox,
  padding = 30
): string {
  const ring = polygon.coordinates[0] || [];
  if (ring.length === 0) return '';

  const lngSpan = bbox.maxLng - bbox.minLng || 0.001;
  const latSpan = bbox.maxLat - bbox.minLat || 0.001;

  const drawableWidth = width - padding * 2;
  const drawableHeight = height - padding * 2;

  // Preserve aspect ratio
  const scale = Math.min(drawableWidth / lngSpan, drawableHeight / latSpan);
  const offsetX = padding + (drawableWidth - lngSpan * scale) / 2;
  const offsetY = padding + (drawableHeight - latSpan * scale) / 2;

  const points = ring.map(([lng, lat]) => {
    const x = offsetX + (lng - bbox.minLng) * scale;
    // Invert Y because latitude increases upward while SVG Y increases downward
    const y = height - (offsetY + (lat - bbox.minLat) * scale);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return points.join(' ');
}

/**
 * Formats acres and square meters into readable strings
 */
export function formatArea(areaAcres: number, areaSqM?: number): string {
  if (areaSqM) {
    return `${areaAcres.toFixed(2)} Acres (${Math.round(areaSqM).toLocaleString('en-IN')} m²)`;
  }
  return `${areaAcres.toFixed(2)} Acres`;
}
