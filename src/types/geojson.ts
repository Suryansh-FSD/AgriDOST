/**
 * GeoJSON standard type definitions for AgriDOST
 * Strict adherence to RFC 7946 GeoJSON format
 */

export type Position = [number, number] | [number, number, number];

export interface GeoJSONPolygon {
  type: 'Polygon';
  /**
   * LinearRing coordinate arrays.
   * First ring is the exterior boundary. Subsequent rings are interior holes.
   */
  coordinates: Position[][];
}

export interface GeoJSONMultiPolygon {
  type: 'MultiPolygon';
  coordinates: Position[][][];
}

export type GeoJSONGeometry = GeoJSONPolygon | GeoJSONMultiPolygon;

export interface GeoJSONFeature<G = GeoJSONGeometry, P = Record<string, unknown>> {
  type: 'Feature';
  id?: string | number;
  geometry: G;
  properties: P;
}

export interface GeoJSONFeatureCollection<G = GeoJSONGeometry, P = Record<string, unknown>> {
  type: 'FeatureCollection';
  features: Array<GeoJSONFeature<G, P>>;
}

export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  centerLng: number;
  centerLat: number;
}
