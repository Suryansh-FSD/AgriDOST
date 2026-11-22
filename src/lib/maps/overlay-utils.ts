/**
 * AgriDOST 4.0: Google Maps Overlay Utilities
 *
 * Provides functions for:
 * 1. GeoJSON to Google Maps coordinate & path conversion ([lng, lat] -> {lat, lng})
 * 2. Turf.js-backed bounds, centroid, and area calculations
 * 3. Color-coded zone & boundary polygon styling (Crop, Disease, Spray)
 * 4. Google Maps polygon overlay creation, lifecycle management, and click synchronization
 */

import {
  Farm,
  FarmZone,
  GeoJSONPolygon,
  Position,
  BoundingBox,
} from '@/types';
import {
  calculateArea,
  calculatePerimeter,
  calculateCentroid,
  getBoundingBox,
  polygonToPositions,
} from '@/lib/geo/calculations';
import {
  GoogleLatLngLiteral,
  GoogleMapBounds,
  ZoneStyleOptions,
  OverlayMetadata,
  IGoogleMap,
  IGooglePolygon,
} from '@/types/maps';

// Visual Style Constants
export const MAP_COLORS = {
  FARM_BOUNDARY_STROKE: '#173F2B',
  FARM_BOUNDARY_FILL: '#DCE8D3',
  CROP_DEFAULT_STROKE: '#2D6A4F',
  CROP_DEFAULT_FILL: '#52B788',
  DISEASE_STROKE: '#DC2626',
  DISEASE_FILL: '#EF4444',
  SPRAY_STROKE: '#0284C7',
  SPRAY_FILL: '#06B6D4',
  SELECTED_ACCENT: '#F59E0B',
};

/**
 * Converts a list of RFC 7946 Position [longitude, latitude] into Google Maps LatLngLiterals {lat, lng}.
 */
export function geoJsonCoordsToGoogleLatLng(coords: Position[]): GoogleLatLngLiteral[] {
  if (!Array.isArray(coords)) return [];
  return coords
    .filter((pos) => Array.isArray(pos) && pos.length >= 2 && typeof pos[0] === 'number' && typeof pos[1] === 'number')
    .map((pos) => ({
      lat: pos[1],
      lng: pos[0],
    }));
}

/**
 * Converts a GeoJSON Polygon into Google Maps paths (array of array of LatLngLiterals for exterior ring and interior holes).
 */
export function geoJsonPolygonToGooglePaths(polygon: GeoJSONPolygon | null | undefined): GoogleLatLngLiteral[][] {
  if (!polygon || polygon.type !== 'Polygon' || !Array.isArray(polygon.coordinates)) {
    return [];
  }

  return polygon.coordinates
    .filter((ring) => Array.isArray(ring) && ring.length >= 3)
    .map((ring) => geoJsonCoordsToGoogleLatLng(ring));
}

/**
 * Computes Google Maps LatLngBounds literal {north, south, east, west} using Turf.js calculation.
 */
export function calculateFarmBounds(geometry: GeoJSONPolygon | Position[]): GoogleMapBounds {
  const bbox: BoundingBox = getBoundingBox(geometry);
  return {
    north: bbox.maxLat,
    south: bbox.minLat,
    east: bbox.maxLng,
    west: bbox.minLng,
  };
}

/**
 * Computes polygon centroid using Turf.js and returns Google Maps {lat, lng}.
 */
export function calculateFarmCentroid(geometry: GeoJSONPolygon | Position[]): GoogleLatLngLiteral {
  const centroidPos = calculateCentroid(geometry);
  return {
    lat: centroidPos[1],
    lng: centroidPos[0],
  };
}

/**
 * Generates styling configuration for the outer Farm boundary.
 */
export function getFarmBoundaryStyle(isSelected: boolean = false): ZoneStyleOptions {
  return {
    strokeColor: isSelected ? MAP_COLORS.SELECTED_ACCENT : MAP_COLORS.FARM_BOUNDARY_STROKE,
    strokeOpacity: 0.95,
    strokeWeight: isSelected ? 4.5 : 3.5,
    fillColor: MAP_COLORS.FARM_BOUNDARY_FILL,
    fillOpacity: isSelected ? 0.25 : 0.12,
    zIndex: isSelected ? 40 : 10,
    clickable: true,
  };
}

/**
 * Generates styling configuration for farm zones (crop, disease, spray) with selection states.
 */
export function getZoneStyle(zone: FarmZone, isSelected: boolean = false): ZoneStyleOptions {
  switch (zone.type) {
    case 'crop':
      return {
        strokeColor: isSelected ? MAP_COLORS.SELECTED_ACCENT : (zone.color || MAP_COLORS.CROP_DEFAULT_STROKE),
        strokeOpacity: 0.9,
        strokeWeight: isSelected ? 4 : 2,
        fillColor: zone.color || MAP_COLORS.CROP_DEFAULT_FILL,
        fillOpacity: isSelected ? 0.55 : 0.35,
        zIndex: isSelected ? 50 : 20,
        clickable: true,
      };

    case 'disease':
      return {
        strokeColor: isSelected ? MAP_COLORS.SELECTED_ACCENT : MAP_COLORS.DISEASE_STROKE,
        strokeOpacity: 1.0,
        strokeWeight: isSelected ? 4.5 : 2.5,
        fillColor: MAP_COLORS.DISEASE_FILL,
        fillOpacity: isSelected ? 0.65 : 0.45,
        zIndex: isSelected ? 60 : 30,
        clickable: true,
      };

    case 'spray':
      return {
        strokeColor: isSelected ? MAP_COLORS.SELECTED_ACCENT : MAP_COLORS.SPRAY_STROKE,
        strokeOpacity: 0.95,
        strokeWeight: isSelected ? 4 : 2,
        fillColor: MAP_COLORS.SPRAY_FILL,
        fillOpacity: isSelected ? 0.55 : 0.35,
        zIndex: isSelected ? 55 : 25,
        clickable: true,
      };

    default:
      return {
        strokeColor: isSelected ? MAP_COLORS.SELECTED_ACCENT : '#4B5563',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#9CA3AF',
        fillOpacity: 0.3,
        zIndex: isSelected ? 50 : 15,
        clickable: true,
      };
  }
}

/**
 * Creates a Google Maps Polygon overlay instance with standard options.
 */
export function createGooglePolygon(
  map: unknown,
  paths: GoogleLatLngLiteral[][] | GoogleLatLngLiteral[],
  options: ZoneStyleOptions
): IGooglePolygon | null {
  const win = typeof window !== 'undefined' ? (window as unknown as { google?: { maps?: { Polygon: new (opts: unknown) => IGooglePolygon } } }) : null;
  if (!win?.google?.maps?.Polygon) return null;

  try {
    const polygon = new win.google.maps.Polygon({
      paths,
      strokeColor: options.strokeColor,
      strokeOpacity: options.strokeOpacity,
      strokeWeight: options.strokeWeight,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
      zIndex: options.zIndex ?? 1,
      clickable: options.clickable ?? true,
      map,
    });
    return polygon;
  } catch (err) {
    console.warn('[AgriDOST Google Maps] Failed to create Polygon overlay:', err);
    return null;
  }
}

/**
 * Safely removes a list of overlays from the map.
 */
export function clearOverlays(overlays: Array<IGooglePolygon | { setMap: (m: null) => void }>): void {
  for (const overlay of overlays) {
    if (overlay && typeof overlay.setMap === 'function') {
      try {
        overlay.setMap(null);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Fits the Google Map viewport to encapsulate the given geometry with responsive padding.
 */
export function fitMapToBounds(
  map: unknown,
  geometry: GeoJSONPolygon | Position[],
  padding: number = 40
): boolean {
  if (!map) return false;
  const win = typeof window !== 'undefined' ? (window as unknown as { google?: { maps?: { LatLngBounds: new () => { extend: (p: GoogleLatLngLiteral) => void } } } }) : null;
  
  const gMap = map as IGoogleMap;
  const positions = Array.isArray(geometry) ? geometry : polygonToPositions(geometry);
  if (!positions || positions.length === 0) return false;

  if (win?.google?.maps?.LatLngBounds) {
    try {
      const bounds = new win.google.maps.LatLngBounds();
      const latLngs = geoJsonCoordsToGoogleLatLng(positions);
      for (const pt of latLngs) {
        bounds.extend(pt);
      }
      gMap.fitBounds(bounds as unknown as GoogleMapBounds, padding);
      return true;
    } catch {
      // Fallback to literal bounds
    }
  }

  try {
    const literalBounds = calculateFarmBounds(positions);
    gMap.fitBounds(literalBounds, padding);
    return true;
  } catch {
    const center = calculateFarmCentroid(positions);
    gMap.setCenter(center);
    gMap.setZoom(16);
    return false;
  }
}

export interface RenderFarmOverlaysOptions {
  selectedZoneId?: string | null;
  onSelectZone?: (zone: FarmZone | null) => void;
  showBoundary?: boolean;
  showZones?: boolean;
}

export interface RenderFarmOverlaysResult {
  boundaryPolygon: IGooglePolygon | null;
  zonePolygons: Map<string, IGooglePolygon>;
  cleanup: () => void;
}

/**
 * High-level orchestration function to render farm boundary and internal zones onto a Google Map.
 * Attaches click event listeners and returns clean cleanup handler.
 */
export function renderFarmOverlays(
  map: unknown,
  farm: Farm | null | undefined,
  zones: FarmZone[] = [],
  options: RenderFarmOverlaysOptions = {}
): RenderFarmOverlaysResult {
  const {
    selectedZoneId = null,
    onSelectZone,
    showBoundary = true,
    showZones = true,
  } = options;

  const createdPolygons: IGooglePolygon[] = [];
  const zonePolygons = new Map<string, IGooglePolygon>();
  let boundaryPolygon: IGooglePolygon | null = null;

  // 1. Render Farm Boundary
  if (showBoundary && farm?.boundary) {
    const boundaryPaths = geoJsonPolygonToGooglePaths(farm.boundary);
    if (boundaryPaths.length > 0) {
      const isSelected = selectedZoneId === 'farm-boundary';
      const boundaryStyle = getFarmBoundaryStyle(isSelected);
      boundaryPolygon = createGooglePolygon(map, boundaryPaths, boundaryStyle);

      if (boundaryPolygon) {
        createdPolygons.push(boundaryPolygon);
        if (onSelectZone) {
          boundaryPolygon.addListener('click', () => {
            // Deselect active zone or select whole boundary
            onSelectZone(null);
          });
        }
      }
    }
  }

  // 2. Render Farm Zones
  if (showZones && Array.isArray(zones)) {
    for (const zone of zones) {
      if (!zone.geometry) continue;
      const zonePaths = geoJsonPolygonToGooglePaths(zone.geometry);
      if (zonePaths.length === 0) continue;

      const isSelected = zone.id === selectedZoneId;
      const zoneStyle = getZoneStyle(zone, isSelected);
      const polygon = createGooglePolygon(map, zonePaths, zoneStyle);

      if (polygon) {
        createdPolygons.push(polygon);
        zonePolygons.set(zone.id, polygon);

        if (onSelectZone) {
          polygon.addListener('click', () => {
            onSelectZone(zone);
          });
        }
      }
    }
  }

  const cleanup = () => {
    clearOverlays(createdPolygons);
    zonePolygons.clear();
  };

  return {
    boundaryPolygon,
    zonePolygons,
    cleanup,
  };
}
