/**
 * AgriDOST 4.0: Google Maps & Geospatial Integration Contracts
 *
 * Provides standardized contracts for:
 * 1. Map Providers ('google' | 'vector_svg')
 * 2. Display Styles ('satellite' | 'hybrid' | 'roadmap' | 'terrain')
 * 3. Health & Provenance conforming to IntegrationHealthResponse
 * 4. Coordinate, Overlay, and Loader contracts
 */

import { IntegrationHealthResponse } from './integrations';
import { Farm, FarmZone, GeoJSONPolygon, Position, BoundingBox } from './index';

/**
 * Supported Cadastre Map Providers
 */
export type MapProvider = 'google' | 'vector_svg';

/**
 * Google Maps Display Styles
 */
export type MapDisplayStyle = 'satellite' | 'hybrid' | 'roadmap' | 'terrain';

/**
 * Google Maps Loader States
 */
export type MapLoaderState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Standard WGS84 Geographic Coordinate in Google Maps {lat, lng} representation.
 * (Note: RFC 7946 GeoJSON positions are [longitude, latitude]).
 */
export interface GoogleLatLngLiteral {
  lat: number;
  lng: number;
}

/**
 * Google Maps LatLngBounds literal
 */
export interface GoogleMapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Optimal Center and Zoom for viewport fitting
 */
export interface MapCenterAndZoom {
  center: GoogleLatLngLiteral;
  zoom: number;
}

/**
 * Polygon Styling configuration
 */
export interface ZoneStyleOptions {
  strokeColor: string;
  strokeOpacity: number;
  strokeWeight: number;
  fillColor: string;
  fillOpacity: number;
  zIndex?: number;
  clickable?: boolean;
}

/**
 * Types of polygon overlays managed by AgriDOST
 */
export type OverlayType = 'farm_boundary' | 'crop' | 'disease' | 'spray';

/**
 * Overlay metadata attached to Google Maps Polygon instance
 */
export interface OverlayMetadata {
  id: string;
  type: OverlayType;
  name: string;
  zoneId?: string;
  farmId?: string;
  areaSqM?: number;
  areaAcres?: number;
  data?: Record<string, unknown>;
}

/**
 * Dynamic Script Loader Options
 */
export interface GoogleMapsLoaderOptions {
  apiKey?: string;
  version?: string;
  libraries?: string[];
  language?: string;
  region?: string;
  timeoutMs?: number;
}

/**
 * Google Maps Integration Health Status
 * Conforms to AgriDOST 4.0 standard IntegrationHealthResponse
 */
export interface MapHealthStatus extends IntegrationHealthResponse {
  category: 'geospatial';
  provider: 'google-maps';
  activeProvider: MapProvider;
  hasApiKey: boolean;
  keyFormatValid: boolean;
  scriptLoaded: boolean;
  cadastreFallbackAvailable: true;
}

/**
 * GoogleFarmMap Component Props
 */
export interface GoogleFarmMapProps {
  farm?: Farm | null;
  zones?: FarmZone[];
  selectedZoneId?: string | null;
  onSelectZone?: (zone: FarmZone | null) => void;
  initialStyle?: MapDisplayStyle;
  height?: number | string;
  className?: string;
  showStyleControls?: boolean;
  showLegend?: boolean;
  showStatsOverlay?: boolean;
  showProviderToggle?: boolean;
  readOnly?: boolean;
  apiKey?: string;
  onProviderChange?: (provider: MapProvider) => void;
  forceFallback?: boolean;
  allowDrawing?: boolean;
  onBoundaryChange?: (newBoundary: GeoJSONPolygon, areaSqM: number, areaAcres: number) => void;
}

/**
 * Ambient interfaces matching Google Maps JavaScript API objects
 * Provides strict TypeScript typing without requiring external @types/google.maps.
 */
export interface IGoogleMap {
  setCenter: (latLng: GoogleLatLngLiteral | { lat: () => number; lng: () => number }) => void;
  setZoom: (zoom: number) => void;
  setMapTypeId: (mapTypeId: string) => void;
  fitBounds: (
    bounds:
      | GoogleMapBounds
      | {
          getNorthEast: () => { lat: () => number; lng: () => number };
          getSouthWest: () => { lat: () => number; lng: () => number };
        },
    padding?: number | { top?: number; right?: number; bottom?: number; left?: number }
  ) => void;
  panTo: (latLng: GoogleLatLngLiteral) => void;
  getCenter: () => { lat: () => number; lng: () => number };
  getZoom: () => number;
  addListener: (event: string, handler: (...args: unknown[]) => void) => { remove: () => void };
}

export interface IGooglePolygon {
  setMap: (map: IGoogleMap | null) => void;
  setOptions: (options: Partial<ZoneStyleOptions>) => void;
  getPath: () => {
    getArray: () => Array<{ lat: () => number; lng: () => number }>;
  };
  setPath: (path: GoogleLatLngLiteral[] | Array<{ lat: number; lng: number }>) => void;
  addListener: (event: string, handler: (e?: unknown) => void) => { remove: () => void };
  setVisible: (visible: boolean) => void;
}

export interface IGoogleInfoWindow {
  open: (options: { map: IGoogleMap; anchor?: unknown; position?: GoogleLatLngLiteral }) => void;
  close: () => void;
  setContent: (content: string | HTMLElement) => void;
  setPosition: (position: GoogleLatLngLiteral) => void;
}

export interface IGoogleLatLngBounds {
  extend: (point: GoogleLatLngLiteral) => IGoogleLatLngBounds;
  getCenter: () => { lat: () => number; lng: () => number };
  getNorthEast: () => { lat: () => number; lng: () => number };
  getSouthWest: () => { lat: () => number; lng: () => number };
  isEmpty: () => boolean;
}
