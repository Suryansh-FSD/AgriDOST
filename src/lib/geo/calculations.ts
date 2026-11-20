import * as turf from '@turf/turf';
import { GeoJSONPolygon, Position, BoundingBox, FarmZone } from '@/types';

/**
 * 1 acre = 4046.8564224 square meters
 */
export const SQ_METERS_PER_ACRE = 4046.8564224;
export const SQ_METERS_PER_HECTARE = 10000;

export type TurfPolygonFeature = ReturnType<typeof turf.polygon>;

/**
 * Converts Position[] or GeoJSONPolygon into a closed Turf.js Polygon Feature.
 * Returns null if points are insufficient (needs at least 3 distinct points).
 */
export function toTurfPolygon(input: GeoJSONPolygon | Position[]): TurfPolygonFeature | null {
  try {
    let coords: Position[];
    if (Array.isArray(input)) {
      coords = [...input];
    } else if (input && input.type === 'Polygon' && Array.isArray(input.coordinates) && input.coordinates[0]) {
      coords = [...input.coordinates[0]];
    } else {
      return null;
    }

    if (coords.length < 3) return null;

    // Ensure polygon is closed (first coord equals last coord)
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push([first[0], first[1]]);
    }

    if (coords.length < 4) return null;

    const turfCoords: [number, number][] = coords.map((c) => [c[0], c[1]]);
    return turf.polygon([turfCoords]);
  } catch (err) {
    console.warn('[AgriDOST Geo] toTurfPolygon error:', err);
    return null;
  }
}

/**
 * Deterministically calculates area in square meters, acres, and hectares.
 * Anti-hallucination guarantee: Uses Turf.js area algorithm (geodesic WGS84).
 */
export function calculateArea(geometry: GeoJSONPolygon | Position[]): {
  sqM: number;
  acres: number;
  hectares: number;
} {
  const poly = toTurfPolygon(geometry);
  if (!poly) {
    return { sqM: 0, acres: 0, hectares: 0 };
  }

  try {
    const sqM = Math.max(0, turf.area(poly));
    const acres = Number((sqM / SQ_METERS_PER_ACRE).toFixed(2));
    const hectares = Number((sqM / SQ_METERS_PER_HECTARE).toFixed(2));

    return {
      sqM: Math.round(sqM),
      acres,
      hectares,
    };
  } catch (err) {
    console.error('[AgriDOST Geo] calculateArea error:', err);
    return { sqM: 0, acres: 0, hectares: 0 };
  }
}

/**
 * Deterministically calculates perimeter in meters and kilometers.
 */
export function calculatePerimeter(geometry: GeoJSONPolygon | Position[]): {
  meters: number;
  kilometers: number;
} {
  const poly = toTurfPolygon(geometry);
  if (!poly) {
    return { meters: 0, kilometers: 0 };
  }

  try {
    const km = turf.length(poly, { units: 'kilometers' });
    const meters = Math.round(km * 1000);
    const kilometers = Number(km.toFixed(3));

    return { meters, kilometers };
  } catch (err) {
    console.error('[AgriDOST Geo] calculatePerimeter error:', err);
    return { meters: 0, kilometers: 0 };
  }
}

/**
 * Checks whether a given [longitude, latitude] point is inside a polygon.
 */
export function isPointInsidePolygon(point: Position, polygon: GeoJSONPolygon): boolean {
  const poly = toTurfPolygon(polygon);
  if (!poly) return false;

  try {
    const pt = turf.point([point[0], point[1]]);
    return turf.booleanPointInPolygon(pt, poly);
  } catch (err) {
    console.warn('[AgriDOST Geo] isPointInsidePolygon error:', err);
    return false;
  }
}

/**
 * Detects whether two GeoJSON polygons overlap or intersect.
 */
export function checkZonesOverlap(zoneA: GeoJSONPolygon, zoneB: GeoJSONPolygon): boolean {
  const polyA = toTurfPolygon(zoneA);
  const polyB = toTurfPolygon(zoneB);
  if (!polyA || !polyB) return false;

  try {
    if (turf.booleanOverlap(polyA, polyB)) return true;
    
    // Check if one contains the other or they share an intersection area
    const intersection = turf.intersect(turf.featureCollection([polyA, polyB]));
    if (intersection && intersection.geometry) {
      const area = turf.area(intersection);
      // Ignore negligible numeric floating touches (< 1 sq meter)
      return area > 1;
    }
    return false;
  } catch {
    return false;
  }
}

export interface ZoneOverlapResult {
  zone1Id: string;
  zone2Id: string;
  zone1Name: string;
  zone2Name: string;
  message: string;
}

/**
 * Checks an array of FarmZones for overlapping polygons.
 */
export function findOverlappingZones(zones: FarmZone[]): ZoneOverlapResult[] {
  const overlaps: ZoneOverlapResult[] = [];

  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const z1 = zones[i];
      const z2 = zones[j];
      if (checkZonesOverlap(z1.geometry, z2.geometry)) {
        overlaps.push({
          zone1Id: z1.id,
          zone2Id: z2.id,
          zone1Name: z1.name,
          zone2Name: z2.name,
          message: `Zone "${z1.name}" overlaps with "${z2.name}". Consider adjusting boundaries.`,
        });
      }
    }
  }

  return overlaps;
}

/**
 * Calculates bounding box and geographic center of a polygon or points.
 */
export function getBoundingBox(geometry: GeoJSONPolygon | Position[]): BoundingBox {
  const poly = toTurfPolygon(geometry);
  const fallback: BoundingBox = {
    minLng: 73.81,
    minLat: 19.99,
    maxLng: 73.82,
    maxLat: 20.00,
    centerLng: 73.815,
    centerLat: 19.995,
  };

  if (!poly) {
    if (Array.isArray(geometry) && geometry.length > 0) {
      const lngs = geometry.map((p) => p[0]);
      const lats = geometry.map((p) => p[1]);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      return {
        minLng,
        minLat,
        maxLng,
        maxLat,
        centerLng: (minLng + maxLng) / 2,
        centerLat: (minLat + maxLat) / 2,
      };
    }
    return fallback;
  }

  try {
    const [minLng, minLat, maxLng, maxLat] = turf.bbox(poly);
    return {
      minLng,
      minLat,
      maxLng,
      maxLat,
      centerLng: (minLng + maxLng) / 2,
      centerLat: (minLat + maxLat) / 2,
    };
  } catch {
    return fallback;
  }
}

/**
 * Calculates centroid of a polygon.
 */
export function calculateCentroid(geometry: GeoJSONPolygon | Position[]): Position {
  const poly = toTurfPolygon(geometry);
  if (!poly) {
    const bbox = getBoundingBox(geometry);
    return [bbox.centerLng, bbox.centerLat];
  }

  try {
    const centroidFeature = turf.centroid(poly);
    return centroidFeature.geometry.coordinates as Position;
  } catch {
    const bbox = getBoundingBox(geometry);
    return [bbox.centerLng, bbox.centerLat];
  }
}

/**
 * Ensures coordinate list conforms to RFC 7946 Polygon format:
 * - Coordinates: Position[][], where [0] is exterior ring
 * - First and last coordinates must be identical
 */
export function positionsToPolygon(positions: Position[]): GeoJSONPolygon {
  if (positions.length === 0) {
    return { type: 'Polygon', coordinates: [[]] };
  }

  const coords = [...positions];
  const first = coords[0];
  const last = coords[coords.length - 1];

  if (coords.length >= 3 && (first[0] !== last[0] || first[1] !== last[1])) {
    coords.push([first[0], first[1]]);
  }

  return {
    type: 'Polygon',
    coordinates: [coords],
  };
}

/**
 * Converts a GeoJSON Polygon into an unclosed array of unique vertex positions
 * (ideal for UI rendering and vertex dragging without duplicate ending point).
 */
export function polygonToPositions(polygon: GeoJSONPolygon): Position[] {
  if (!polygon || !polygon.coordinates || !polygon.coordinates[0]) {
    return [];
  }

  const ring = polygon.coordinates[0];
  if (ring.length <= 1) return [...ring];

  const first = ring[0];
  const last = ring[ring.length - 1];

  if (first[0] === last[0] && first[1] === last[1]) {
    return ring.slice(0, -1);
  }

  return [...ring];
}

/**
 * Projects a [longitude, latitude] point to 2D SVG canvas coordinate space (x, y).
 */
export function projectLngLatToCanvas(
  point: Position,
  bbox: BoundingBox,
  width: number,
  height: number,
  padding: number = 40
): { x: number; y: number } {
  const lngSpan = Math.max(0.0001, bbox.maxLng - bbox.minLng);
  const latSpan = Math.max(0.0001, bbox.maxLat - bbox.minLat);

  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;

  // Preserve aspect ratio
  // In India (lat ~ 15-30 deg), 1 deg lat is ~ 111km, 1 deg lng is ~ 111km * cos(lat)
  const centerLatRad = ((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180);
  const cosLat = Math.cos(centerLatRad) || 0.95;

  const geoWidth = lngSpan * cosLat;
  const geoHeight = latSpan;

  const scale = Math.min(drawWidth / geoWidth, drawHeight / geoHeight);

  const offsetX = (drawWidth - geoWidth * scale) / 2 + padding;
  const offsetY = (drawHeight - geoHeight * scale) / 2 + padding;

  const x = offsetX + (point[0] - bbox.minLng) * cosLat * scale;
  // Invert Y because SVG coordinates increase downwards, whereas latitude increases upwards
  const y = offsetY + (bbox.maxLat - point[1]) * scale;

  return { x, y };
}

/**
 * Inverse transforms 2D SVG canvas coordinate (x, y) back into [longitude, latitude].
 */
export function canvasToLngLat(
  canvasX: number,
  canvasY: number,
  bbox: BoundingBox,
  width: number,
  height: number,
  padding: number = 40
): Position {
  const lngSpan = Math.max(0.0001, bbox.maxLng - bbox.minLng);
  const latSpan = Math.max(0.0001, bbox.maxLat - bbox.minLat);

  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;

  const centerLatRad = ((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180);
  const cosLat = Math.cos(centerLatRad) || 0.95;

  const geoWidth = lngSpan * cosLat;
  const geoHeight = latSpan;

  const scale = Math.min(drawWidth / geoWidth, drawHeight / geoHeight);

  const offsetX = (drawWidth - geoWidth * scale) / 2 + padding;
  const offsetY = (drawHeight - geoHeight * scale) / 2 + padding;

  const lng = bbox.minLng + (canvasX - offsetX) / (cosLat * scale);
  const lat = bbox.maxLat - (canvasY - offsetY) / scale;

  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
}

/**
 * Subdivides a parent farm polygon into realistic visual parcel zones
 * based on percentage proportions (e.g. [0.5, 0.3, 0.2]).
 * Used for instant visual mapping when creating crop plans.
 */
export function subdividePolygon(
  parentPolygon: GeoJSONPolygon,
  proportions: number[]
): GeoJSONPolygon[] {
  const poly = toTurfPolygon(parentPolygon);
  if (!poly) return [parentPolygon];

  try {
    const bbox = turf.bbox(poly);
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const lngSpan = maxLng - minLng;
    const latSpan = maxLat - minLat;

    // Normalize proportions so they sum to 1
    const total = proportions.reduce((acc, p) => acc + p, 0);
    const normalized = proportions.map((p) => p / (total || 1));

    const subdivided: GeoJSONPolygon[] = [];
    const isWider = lngSpan >= latSpan;

    let currentStart = 0;

    for (let i = 0; i < normalized.length; i++) {
      const sliceProp = normalized[i];
      const currentEnd = currentStart + sliceProp;

      let sliceBox: TurfPolygonFeature;
      if (isWider) {
        // Slice along longitude (vertically)
        const sLng = minLng + lngSpan * currentStart;
        const eLng = minLng + lngSpan * currentEnd;
        sliceBox = turf.polygon([
          [
            [sLng, minLat - 0.0005],
            [eLng, minLat - 0.0005],
            [eLng, maxLat + 0.0005],
            [sLng, maxLat + 0.0005],
            [sLng, minLat - 0.0005],
          ],
        ]);
      } else {
        // Slice along latitude (horizontally)
        const sLat = minLat + latSpan * currentStart;
        const eLat = minLat + latSpan * currentEnd;
        sliceBox = turf.polygon([
          [
            [minLng - 0.0005, sLat],
            [maxLng + 0.0005, sLat],
            [maxLng + 0.0005, eLat],
            [minLng - 0.0005, eLat],
            [minLng - 0.0005, sLat],
          ],
        ]);
      }

      const intersection = turf.intersect(turf.featureCollection([poly, sliceBox]));
      if (intersection && intersection.geometry) {
        if (intersection.geometry.type === 'Polygon') {
          subdivided.push(intersection.geometry as GeoJSONPolygon);
        } else if (intersection.geometry.type === 'MultiPolygon') {
          // Take the largest polygon from the multipolygon
          const coords = (intersection.geometry as unknown as { coordinates: Position[][][] }).coordinates;
          if (coords.length > 0) {
            subdivided.push({
              type: 'Polygon',
              coordinates: coords[0],
            });
          }
        }
      }

      currentStart = currentEnd;
    }

    if (subdivided.length > 0) {
      return subdivided;
    }
  } catch (err) {
    console.warn('[AgriDOST Geo] subdividePolygon fallback:', err);
  }

  return [parentPolygon];
}

/**
 * Format helper for area badge.
 */
export function formatArea(sqM: number, acres: number): string {
  if (!acres && !sqM) return '0.00 Acres (0 m²)';
  return `${acres.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Acres (${sqM.toLocaleString('en-IN')} m²)`;
}

/**
 * Format helper for perimeter badge.
 */
export function formatPerimeter(meters: number): string {
  if (!meters) return '0 m';
  if (meters >= 1000) {
    return `${meters.toLocaleString('en-IN')} m (${(meters / 1000).toFixed(2)} km)`;
  }
  return `${meters.toLocaleString('en-IN')} m`;
}
