import { describe, it, expect } from 'vitest';
import * as turf from '@turf/turf';
import {
  SQ_METERS_PER_ACRE,
  SQ_METERS_PER_HECTARE,
  toTurfPolygon,
  calculateArea,
  calculatePerimeter,
  isPointInsidePolygon,
  checkZonesOverlap,
  findOverlappingZones,
  getBoundingBox,
  calculateCentroid,
  positionsToPolygon,
  polygonToPositions,
  projectLngLatToCanvas,
  canvasToLngLat,
  subdividePolygon,
  formatArea,
  formatPerimeter,
} from '../src/lib/geo/calculations';
import { GeoJSONPolygon, Position, FarmZone } from '../src/types';

describe('AgriDOST Deterministic Geospatial Engine (`calculations.ts`)', () => {
  // =========================================================================
  // Test Geometries & Known Reference Constants
  // =========================================================================

  // Nashik Farm boundary from real demo data (Maharashtra, India)
  const NASHIK_FARM_COORDS: Position[] = [
    [73.8100, 19.9950],
    [73.8160, 19.9955],
    [73.8170, 20.0010],
    [73.8115, 20.0020],
    [73.8095, 19.9985],
    [73.8100, 19.9950],
  ];

  const NASHIK_FARM_GEOJSON: GeoJSONPolygon = {
    type: 'Polygon',
    coordinates: [NASHIK_FARM_COORDS],
  };

  // Known 0.001-degree reference square near equator [0,0] to [0.001, 0.001]
  // In WGS84 geodesic spherical geometry: 0.001 deg at equator is ~111.19 meters per side.
  // Geodesic area = 12,364 sq meters (~3.06 acres, ~1.24 hectares).
  const EQUATOR_SQUARE_COORDS: Position[] = [
    [0.0, 0.0],
    [0.001, 0.0],
    [0.001, 0.001],
    [0.0, 0.001],
    [0.0, 0.0],
  ];

  const EQUATOR_SQUARE_GEOJSON: GeoJSONPolygon = {
    type: 'Polygon',
    coordinates: [EQUATOR_SQUARE_COORDS],
  };

  // 100m approx square in Nashik (~20 deg latitude)
  // 1 deg lat = ~110.7 km -> 100m = ~0.000903 deg lat
  // 1 deg lng = ~104.6 km -> 100m = ~0.000956 deg lng
  const NASHIK_100M_SQUARE_COORDS: Position[] = [
    [73.8100, 20.0000],
    [73.810956, 20.0000],
    [73.810956, 20.000903],
    [73.8100, 20.000903],
    [73.8100, 20.0000],
  ];

  // Axis-aligned rectangular farm plot
  const AXIS_ALIGNED_RECT_COORDS: Position[] = [
    [73.8100, 19.9900],
    [73.8200, 19.9900],
    [73.8200, 20.0000],
    [73.8100, 20.0000],
    [73.8100, 19.9900],
  ];

  const AXIS_ALIGNED_RECT_GEOJSON: GeoJSONPolygon = {
    type: 'Polygon',
    coordinates: [AXIS_ALIGNED_RECT_COORDS],
  };

  // =========================================================================
  // 1. Polygon Area Calculation (WGS84 Geodetic Precision)
  // =========================================================================
  describe('1. Polygon Area Calculation (calculateArea)', () => {
    it('should verify mathematical conversion constants', () => {
      expect(SQ_METERS_PER_ACRE).toBe(4046.8564224);
      expect(SQ_METERS_PER_HECTARE).toBe(10000);
    });

    it('should calculate geodesic WGS84 area for known Nashik farm boundary with exact precision', () => {
      const area = calculateArea(NASHIK_FARM_GEOJSON);

      // Independently verified Turf.js geodesic WGS84 calculation
      expect(area.sqM).toBe(472014);
      expect(area.acres).toBe(116.64);
      expect(area.hectares).toBe(47.20);

      // Verify mathematical relationship between sqM, acres, and hectares
      expect(area.acres).toBeCloseTo(area.sqM / SQ_METERS_PER_ACRE, 2);
      expect(area.hectares).toBeCloseTo(area.sqM / SQ_METERS_PER_HECTARE, 2);
    });

    it('should calculate identical area when provided raw Position[] vs GeoJSONPolygon', () => {
      const areaFromGeoJSON = calculateArea(NASHIK_FARM_GEOJSON);
      const areaFromPositions = calculateArea(NASHIK_FARM_COORDS);

      expect(areaFromPositions).toEqual(areaFromGeoJSON);
    });

    it('should calculate known equator reference square area accurately', () => {
      const area = calculateArea(EQUATOR_SQUARE_GEOJSON);

      // 0.001 deg at equator: side ~111.19m, geodesic area = 12,364 m²
      expect(area.sqM).toBe(12364);
      expect(area.acres).toBe(3.06);
      expect(area.hectares).toBe(1.24);
    });

    it('should provide deterministic anti-hallucination guarantee across repeated runs', () => {
      const run1 = calculateArea(NASHIK_FARM_GEOJSON);
      const run2 = calculateArea(NASHIK_FARM_GEOJSON);
      const run3 = calculateArea(NASHIK_FARM_GEOJSON);

      expect(run1).toEqual(run2);
      expect(run2).toEqual(run3);
    });
  });

  // =========================================================================
  // 2. Perimeter Calculation (meters & kilometers)
  // =========================================================================
  describe('2. Perimeter Calculation (calculatePerimeter)', () => {
    it('should calculate geodetic perimeter for Nashik farm with meter and kilometer precision', () => {
      const perimeter = calculatePerimeter(NASHIK_FARM_GEOJSON);

      // Independently verified: turf.length returns ~2.670 km -> 2670 meters
      expect(perimeter.kilometers).toBe(2.670);
      expect(perimeter.meters).toBe(2670);
      expect(perimeter.meters).toBe(Math.round(perimeter.kilometers * 1000));
    });

    it('should calculate perimeter for open Position[] by automatically closing the ring', () => {
      // Omit the final closing coordinate
      const openCoords = NASHIK_FARM_COORDS.slice(0, -1);
      expect(openCoords.length).toBe(5);

      const perimeter = calculatePerimeter(openCoords);
      expect(perimeter.meters).toBe(2670);
      expect(perimeter.kilometers).toBe(2.670);
    });

    it('should calculate perimeter for 100m reference square (~400.6 meters total perimeter)', () => {
      const perimeter = calculatePerimeter(NASHIK_100M_SQUARE_COORDS);

      // 4 sides of ~100.15 meters each = ~401 meters
      expect(perimeter.meters).toBe(401);
      expect(perimeter.kilometers).toBe(0.401);
    });

    it('should accept both GeoJSONPolygon and Position[] with identical results', () => {
      const fromPolygon = calculatePerimeter(NASHIK_FARM_GEOJSON);
      const fromArray = calculatePerimeter(NASHIK_FARM_COORDS);

      expect(fromArray).toEqual(fromPolygon);
    });
  });

  // =========================================================================
  // 3. Invalid Geometry Rejection & Defensive Fallbacks
  // =========================================================================
  describe('3. Invalid Geometry Rejection & Graceful Fallbacks', () => {
    it('should return null polygon and zero metrics for empty coordinate arrays', () => {
      expect(toTurfPolygon([])).toBeNull();
      expect(calculateArea([])).toEqual({ sqM: 0, acres: 0, hectares: 0 });
      expect(calculatePerimeter([])).toEqual({ meters: 0, kilometers: 0 });
    });

    it('should reject degenerate coordinates with fewer than 3 points', () => {
      const singlePoint: Position[] = [[73.81, 19.99]];
      const twoPoints: Position[] = [[73.81, 19.99], [73.82, 19.99]];

      expect(toTurfPolygon(singlePoint)).toBeNull();
      expect(toTurfPolygon(twoPoints)).toBeNull();

      expect(calculateArea(singlePoint)).toEqual({ sqM: 0, acres: 0, hectares: 0 });
      expect(calculateArea(twoPoints)).toEqual({ sqM: 0, acres: 0, hectares: 0 });

      expect(calculatePerimeter(singlePoint)).toEqual({ meters: 0, kilometers: 0 });
      expect(calculatePerimeter(twoPoints)).toEqual({ meters: 0, kilometers: 0 });
    });

    it('should reject malformed GeoJSON input missing type or coordinates', () => {
      const invalidGeo = { type: 'Point', coordinates: [73.81, 19.99] } as unknown as GeoJSONPolygon;
      expect(toTurfPolygon(invalidGeo)).toBeNull();
      expect(calculateArea(invalidGeo)).toEqual({ sqM: 0, acres: 0, hectares: 0 });

      const emptyGeo = { type: 'Polygon', coordinates: [] } as unknown as GeoJSONPolygon;
      expect(toTurfPolygon(emptyGeo)).toBeNull();
      expect(calculateArea(emptyGeo)).toEqual({ sqM: 0, acres: 0, hectares: 0 });
    });

    it('should handle collinear points gracefully (zero area)', () => {
      // 3 distinct points lying on a straight latitude line
      const collinear: Position[] = [
        [73.810, 19.990],
        [73.815, 19.990],
        [73.820, 19.990],
      ];

      const area = calculateArea(collinear);
      expect(area.sqM).toBe(0);
      expect(area.acres).toBe(0);
      expect(area.hectares).toBe(0);
    });

    it('should reject identical repeated points that collapse to a single point', () => {
      const identicalPoints: Position[] = [
        [73.81, 19.99],
        [73.81, 19.99],
        [73.81, 19.99],
      ];

      const area = calculateArea(identicalPoints);
      expect(area.sqM).toBe(0);
    });
  });

  // =========================================================================
  // 4. Automatic Polygon Closure in positionsToPolygon & polygonToPositions
  // =========================================================================
  describe('4. Automatic Polygon Closure & Coordinate Conversion', () => {
    it('should automatically close an unclosed position array when >= 3 points', () => {
      const unclosed: Position[] = [
        [73.81, 19.99],
        [73.82, 19.99],
        [73.82, 20.00],
      ];

      const polygon = positionsToPolygon(unclosed);
      expect(polygon.type).toBe('Polygon');
      expect(polygon.coordinates[0]).toHaveLength(4);

      // Verify that the first and last coordinates are identical
      const ring = polygon.coordinates[0];
      expect(ring[0]).toEqual(ring[3]);
      expect(ring[3]).toEqual([73.81, 19.99]);
    });

    it('should NOT append a redundant closing coordinate if already closed', () => {
      const alreadyClosed: Position[] = [
        [73.81, 19.99],
        [73.82, 19.99],
        [73.82, 20.00],
        [73.81, 19.99],
      ];

      const polygon = positionsToPolygon(alreadyClosed);
      expect(polygon.coordinates[0]).toHaveLength(4);
      expect(polygon.coordinates[0]).toEqual(alreadyClosed);
    });

    it('should return empty coordinates array for empty input to positionsToPolygon', () => {
      const polygon = positionsToPolygon([]);
      expect(polygon).toEqual({ type: 'Polygon', coordinates: [[]] });
    });

    it('should strip closing duplicate coordinate in polygonToPositions for clean UI editing', () => {
      const closedGeoJSON: GeoJSONPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [73.81, 19.99],
            [73.82, 19.99],
            [73.82, 20.00],
            [73.81, 19.99],
          ],
        ],
      };

      const unclosedPositions = polygonToPositions(closedGeoJSON);
      expect(unclosedPositions).toHaveLength(3);
      expect(unclosedPositions).toEqual([
        [73.81, 19.99],
        [73.82, 19.99],
        [73.82, 20.00],
      ]);
    });

    it('should maintain roundtrip consistency between positionsToPolygon and polygonToPositions', () => {
      const originalVertices: Position[] = [
        [73.810, 19.990],
        [73.820, 19.990],
        [73.820, 20.000],
        [73.810, 20.000],
      ];

      const polygon = positionsToPolygon(originalVertices);
      const extractedVertices = polygonToPositions(polygon);

      expect(extractedVertices).toEqual(originalVertices);
    });
  });

  // =========================================================================
  // 5. Point-in-Polygon Verification (isPointInsidePolygon)
  // =========================================================================
  describe('5. Point-in-Polygon Verification (isPointInsidePolygon)', () => {
    it('should confirm centroid and interior points are inside the Nashik farm polygon', () => {
      const centroid = calculateCentroid(NASHIK_FARM_GEOJSON);
      expect(isPointInsidePolygon(centroid, NASHIK_FARM_GEOJSON)).toBe(true);

      const knownInteriorPoint: Position = [73.8130, 19.9980];
      expect(isPointInsidePolygon(knownInteriorPoint, NASHIK_FARM_GEOJSON)).toBe(true);
    });

    it('should confirm exterior points far away and nearby are outside', () => {
      const exteriorPoint1: Position = [73.8000, 19.9900];
      const exteriorPoint2: Position = [73.8300, 20.0100];
      const equatorPoint: Position = [0.0, 0.0];

      expect(isPointInsidePolygon(exteriorPoint1, NASHIK_FARM_GEOJSON)).toBe(false);
      expect(isPointInsidePolygon(exteriorPoint2, NASHIK_FARM_GEOJSON)).toBe(false);
      expect(isPointInsidePolygon(equatorPoint, NASHIK_FARM_GEOJSON)).toBe(false);
    });

    it('should correctly evaluate points on boundary vertices and axis-aligned edges', () => {
      // Vertex point on boundary is inside
      const vertexPoint: Position = NASHIK_FARM_COORDS[0];
      expect(isPointInsidePolygon(vertexPoint, NASHIK_FARM_GEOJSON)).toBe(true);

      // Midpoint on bottom edge of axis-aligned rectangle [73.815, 19.990]
      const rectEdgeMidpoint: Position = [73.8150, 19.9900];
      expect(isPointInsidePolygon(rectEdgeMidpoint, AXIS_ALIGNED_RECT_GEOJSON)).toBe(true);

      // Midpoint on top edge of axis-aligned rectangle [73.815, 20.000]
      const rectTopMidpoint: Position = [73.8150, 20.0000];
      expect(isPointInsidePolygon(rectTopMidpoint, AXIS_ALIGNED_RECT_GEOJSON)).toBe(true);
    });

    it('should return false for invalid polygon or empty geometry', () => {
      const invalidPolygon = { type: 'Polygon', coordinates: [[]] } as GeoJSONPolygon;
      expect(isPointInsidePolygon([73.81, 19.99], invalidPolygon)).toBe(false);
    });
  });

  // =========================================================================
  // 6. Zone Overlap & Conflict Detection (checkZonesOverlap, findOverlappingZones)
  // =========================================================================
  describe('6. Zone Overlap & Conflict Detection', () => {
    const zoneAPolygon: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [73.810, 19.990],
          [73.815, 19.990],
          [73.815, 19.995],
          [73.810, 19.995],
          [73.810, 19.990],
        ],
      ],
    };

    // Disjoint from Zone A
    const disjointZonePolygon: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [73.820, 19.990],
          [73.825, 19.990],
          [73.825, 19.995],
          [73.820, 19.995],
          [73.820, 19.990],
        ],
      ],
    };

    // Overlaps Zone A between lng 73.814 and 73.815 (significant area > 1 m²)
    const overlappingZonePolygon: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [73.814, 19.990],
          [73.819, 19.990],
          [73.819, 19.995],
          [73.814, 19.995],
          [73.814, 19.990],
        ],
      ],
    };

    // Completely inside Zone A (concentric / hotspot)
    const containedZonePolygon: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [73.811, 19.991],
          [73.813, 19.991],
          [73.813, 19.993],
          [73.811, 19.993],
          [73.811, 19.991],
        ],
      ],
    };

    // Boundary-touching zone (shares common line segment at lng 73.815)
    const edgeTouchingZonePolygon: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [73.815, 19.990],
          [73.820, 19.990],
          [73.820, 19.995],
          [73.815, 19.995],
          [73.815, 19.990],
        ],
      ],
    };

    it('should return false for completely disjoint zones', () => {
      expect(checkZonesOverlap(zoneAPolygon, disjointZonePolygon)).toBe(false);
    });

    it('should return true for partially overlapping zones with area > 1 m²', () => {
      expect(checkZonesOverlap(zoneAPolygon, overlappingZonePolygon)).toBe(true);
    });

    it('should return true when one zone is completely contained inside another', () => {
      expect(checkZonesOverlap(zoneAPolygon, containedZonePolygon)).toBe(true);
    });

    it('should return true when zones are identical', () => {
      expect(checkZonesOverlap(zoneAPolygon, zoneAPolygon)).toBe(true);
    });

    it('should return false when one of the geometries is invalid', () => {
      const invalidGeo = { type: 'Polygon', coordinates: [] } as unknown as GeoJSONPolygon;
      expect(checkZonesOverlap(zoneAPolygon, invalidGeo)).toBe(false);
    });

    /**
     * DISCOVERED LIMITATION: Behavior of boundary-touching polygons
     *
     * In `calculations.ts` lines 125-135:
     *   if (turf.booleanOverlap(polyA, polyB)) return true;
     *   const intersection = turf.intersect(...);
     *   if (intersection && intersection.geometry) { return turf.area(intersection) > 1; }
     *
     * In Turf.js v7, `turf.booleanOverlap` evaluates to `true` when two polygons share
     * an exterior boundary segment. Consequently, execution short-circuits at line 125,
     * and the intended `turf.area(intersection) > 1` filter is bypassed.
     */
    it('should document that boundary-touching zones evaluate to true due to Turf booleanOverlap short-circuit', () => {
      // In Turf v7 booleanOverlap returns true for edge touches:
      expect(checkZonesOverlap(zoneAPolygon, edgeTouchingZonePolygon)).toBe(true);
    });

    it('should detect conflicting zones in findOverlappingZones with clear messages', () => {
      const farmZones: FarmZone[] = [
        {
          id: 'zone-cotton',
          farmId: 'farm-01',
          type: 'crop',
          name: 'Cotton Field North',
          geometry: zoneAPolygon,
        },
        {
          id: 'zone-soybean',
          farmId: 'farm-01',
          type: 'crop',
          name: 'Soybean Parcel East',
          geometry: overlappingZonePolygon,
        },
        {
          id: 'zone-wheat',
          farmId: 'farm-01',
          type: 'crop',
          name: 'Wheat Sector South',
          geometry: disjointZonePolygon,
        },
      ];

      const conflicts = findOverlappingZones(farmZones);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].zone1Id).toBe('zone-cotton');
      expect(conflicts[0].zone2Id).toBe('zone-soybean');
      expect(conflicts[0].zone1Name).toBe('Cotton Field North');
      expect(conflicts[0].zone2Name).toBe('Soybean Parcel East');
      expect(conflicts[0].message).toContain('overlaps with');
    });

    it('should return empty list when no farm zones overlap', () => {
      const nonOverlappingZones: FarmZone[] = [
        {
          id: 'zone-1',
          farmId: 'farm-01',
          type: 'crop',
          name: 'Parcel 1',
          geometry: zoneAPolygon,
        },
        {
          id: 'zone-2',
          farmId: 'farm-01',
          type: 'crop',
          name: 'Parcel 2',
          geometry: disjointZonePolygon,
        },
      ];

      const conflicts = findOverlappingZones(nonOverlappingZones);
      expect(conflicts).toEqual([]);
    });
  });

  // =========================================================================
  // 7. Concave Polygon Subdivision & MultiPolygon Clipping Limitation
  // =========================================================================
  describe('7. Concave Polygon Subdivision (subdividePolygon)', () => {
    it('should subdivide a convex rectangular farm into proportional parcels', () => {
      // 0.002 deg x 0.001 deg rectangle (wider along longitude)
      const rectGeoJSON: GeoJSONPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [73.810, 19.990],
            [73.812, 19.990],
            [73.812, 19.991],
            [73.810, 19.991],
            [73.810, 19.990],
          ],
        ],
      };

      const parentArea = calculateArea(rectGeoJSON).sqM;
      const parcels = subdividePolygon(rectGeoJSON, [0.6, 0.4]);

      expect(parcels).toHaveLength(2);
      const area1 = calculateArea(parcels[0]).sqM;
      const area2 = calculateArea(parcels[1]).sqM;

      // Sum of parcel areas should equal parent area
      expect(area1 + area2).toBeCloseTo(parentArea, -2);
      // Proportion check (60% / 40%)
      expect(area1 / parentArea).toBeCloseTo(0.6, 1);
      expect(area2 / parentArea).toBeCloseTo(0.4, 1);
    });

    it('should normalize unnormalized proportions (e.g. [50, 30, 20])', () => {
      const parcels = subdividePolygon(NASHIK_FARM_GEOJSON, [50, 30, 20]);
      expect(parcels).toHaveLength(3);
    });

    /**
     * CRITICAL TEST & DOCUMENTATION: MultiPolygon Clipping Limitation
     *
     * In concave or horseshoe/C-shaped geometries, a straight horizontal or vertical slice
     * intersects multiple separated prongs of the polygon, producing a GeoJSON MultiPolygon.
     *
     * In `calculations.ts` lines 421-430:
     * When intersection.geometry.type === 'MultiPolygon', the algorithm does:
     *   subdivided.push({ type: 'Polygon', coordinates: coords[0] });
     *
     * This creates three specific limitations:
     * 1. It only retains `coords[0]` (the first polygon component) and discards `coords[1]`, `coords[2]`, etc.
     * 2. This causes a significant loss of farm area (clipping). The sum of subdivided parcel areas
     *    is substantially LESS than the parent polygon area!
     * 3. It assumes `coords[0]` is the largest polygon without calculating and comparing individual sub-polygon areas.
     */
    it('should document and verify MultiPolygon clipping limitation on concave geometries', () => {
      // Concave C-shaped polygon
      // Bounding box: lng [73.810, 73.840] (span 0.030), lat [19.990, 20.020] (span 0.030)
      // Since lngSpan >= latSpan, subdividePolygon slices vertically along longitude.
      // Slicing across lng 73.825-73.840 cuts through BOTH top and bottom prongs of the "C".
      const cShapePolygon: GeoJSONPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [73.810, 19.990],
            [73.840, 19.990],
            [73.840, 20.000],
            [73.820, 20.000],
            [73.820, 20.010],
            [73.840, 20.010],
            [73.840, 20.020],
            [73.810, 20.020],
            [73.810, 19.990],
          ],
        ],
      };

      const parentArea = turf.area(toTurfPolygon(cShapePolygon)!);

      // Subdivide into two 50% vertical slices
      const slices = subdividePolygon(cShapePolygon, [0.5, 0.5]);
      expect(slices).toHaveLength(2);

      // All returned items are forced to type 'Polygon'
      expect(slices[0].type).toBe('Polygon');
      expect(slices[1].type).toBe('Polygon');

      const slice0Area = turf.area(toTurfPolygon(slices[0])!);
      const slice1Area = turf.area(toTurfPolygon(slices[1])!);
      const totalSubdividedArea = slice0Area + slice1Area;

      // DEMONSTRATION OF LIMITATION:
      // Slice 1 encountered a MultiPolygon with 2 sub-polygons (the top and bottom arms).
      // Because `coords[0]` was selected and `coords[1]` dropped, total subdivided area
      // is significantly LESS than the parent polygon area.
      const lostArea = parentArea - totalSubdividedArea;
      const percentLost = (lostArea / parentArea) * 100;

      // Over 20% of the farm area is clipped away due to MultiPolygon degradation
      expect(lostArea).toBeGreaterThan(1_000_000); // > 1,000,000 sqM lost
      expect(percentLost).toBeGreaterThan(20);      // > 20% area loss
      expect(totalSubdividedArea).toBeLessThan(parentArea * 0.85);
    });

    it('should fallback to returning [parentPolygon] when geometry is invalid', () => {
      const invalidGeo = { type: 'Polygon', coordinates: [] } as unknown as GeoJSONPolygon;
      const result = subdividePolygon(invalidGeo, [0.5, 0.5]);
      expect(result).toEqual([invalidGeo]);
    });
  });

  // =========================================================================
  // 8. Boundary Tree Spacing & Count Calculations (turf.along along perimeter)
  // =========================================================================
  describe('8. Boundary Tree Spacing and Count Calculations', () => {
    // Replicate the deterministic algorithm used in BoundaryTreePlanner.tsx
    function calculateBoundaryTrees(
      polygon: GeoJSONPolygon,
      spacingMeters: number
    ): {
      perimeterMeters: number;
      treeCount: number;
      positions: Position[];
    } {
      const ring = polygon.coordinates[0];
      if (!ring || ring.length < 4) {
        return { perimeterMeters: 0, treeCount: 0, positions: [] };
      }

      const boundaryLine = turf.lineString(ring);
      const perimeterMeters = turf.length(boundaryLine, { units: 'meters' });
      const count = Math.max(1, Math.floor(perimeterMeters / spacingMeters));

      const positions: Position[] = [];
      for (let i = 0; i < count; i++) {
        const dist = i * spacingMeters;
        if (dist < perimeterMeters) {
          const pt = turf.along(boundaryLine, dist, { units: 'meters' });
          positions.push(pt.geometry.coordinates as Position);
        }
      }

      return {
        perimeterMeters: Math.round(perimeterMeters),
        treeCount: count,
        positions,
      };
    }

    it('should calculate exact tree counts based on perimeter and spacing intervals', () => {
      // 100m square has perimeter of ~401m
      const result20m = calculateBoundaryTrees(
        { type: 'Polygon', coordinates: [NASHIK_100M_SQUARE_COORDS] },
        20
      );
      expect(result20m.perimeterMeters).toBe(401);
      expect(result20m.treeCount).toBe(20); // Math.floor(400.6 / 20) = 20
      expect(result20m.positions).toHaveLength(20);

      const result10m = calculateBoundaryTrees(
        { type: 'Polygon', coordinates: [NASHIK_100M_SQUARE_COORDS] },
        10
      );
      expect(result10m.treeCount).toBe(40); // Math.floor(400.6 / 10) = 40
      expect(result10m.positions).toHaveLength(40);
    });

    it('should calculate realistic tree counts for Nashik farm (unrounded perimeter ~2669.61m)', () => {
      // Teak (Tectona grandis) @ 4m spacing
      const teakPlan = calculateBoundaryTrees(NASHIK_FARM_GEOJSON, 4);
      expect(teakPlan.perimeterMeters).toBe(2670);
      expect(teakPlan.treeCount).toBe(667); // Math.floor(2669.61 / 4) = 667
      expect(teakPlan.positions).toHaveLength(667);

      // Malabar Neem (Melia dubia) @ 3m spacing
      const neemPlan = calculateBoundaryTrees(NASHIK_FARM_GEOJSON, 3);
      expect(neemPlan.treeCount).toBe(889); // Math.floor(2669.61 / 3) = 889
      expect(neemPlan.positions).toHaveLength(889);
    });

    it('should verify every generated tree position lies strictly on the farm boundary line', () => {
      const boundaryLine = turf.lineString(NASHIK_100M_SQUARE_COORDS);
      const { positions } = calculateBoundaryTrees(
        { type: 'Polygon', coordinates: [NASHIK_100M_SQUARE_COORDS] },
        25
      );

      positions.forEach((pos) => {
        const pt = turf.point(pos);
        // Distance from tree spot to boundary line should be zero (< 0.05 meters floating point tolerance)
        const distToLine = turf.pointToLineDistance(pt, boundaryLine, { units: 'meters' });
        expect(distToLine).toBeLessThan(0.05);
      });
    });

    it('should verify the first tree is placed at origin (dist = 0)', () => {
      const { positions } = calculateBoundaryTrees(
        { type: 'Polygon', coordinates: [NASHIK_100M_SQUARE_COORDS] },
        15
      );

      expect(positions[0]).toEqual(NASHIK_100M_SQUARE_COORDS[0]);
    });

    it('should yield at least 1 tree spot if spacing exceeds entire farm perimeter', () => {
      const result = calculateBoundaryTrees(
        { type: 'Polygon', coordinates: [NASHIK_100M_SQUARE_COORDS] },
        1000 // 1000m spacing on a 401m perimeter
      );

      expect(result.treeCount).toBe(1);
      expect(result.positions).toHaveLength(1);
      expect(result.positions[0]).toEqual(NASHIK_100M_SQUARE_COORDS[0]);
    });
  });

  // =========================================================================
  // 9. Unit Conversion and Formatting Helpers (formatArea, formatPerimeter)
  // =========================================================================
  describe('9. Unit Conversion and Formatting Helpers', () => {
    it('should format area badge with Indian numbering (en-IN) and 2 decimal places', () => {
      expect(formatArea(0, 0)).toBe('0.00 Acres (0 m²)');
      expect(formatArea(472014, 116.64)).toBe('116.64 Acres (4,72,014 m²)');
      expect(formatArea(10000, 2.47)).toBe('2.47 Acres (10,000 m²)');
      expect(formatArea(1000000, 247.1)).toBe('247.10 Acres (10,00,000 m²)');
    });

    it('should format perimeter badge correctly for zero, meters, and kilometers', () => {
      expect(formatPerimeter(0)).toBe('0 m');
      expect(formatPerimeter(450)).toBe('450 m');
      expect(formatPerimeter(999)).toBe('999 m');
      expect(formatPerimeter(1000)).toBe('1,000 m (1.00 km)');
      expect(formatPerimeter(2670)).toBe('2,670 m (2.67 km)');
      expect(formatPerimeter(100000)).toBe('1,00,000 m (100.00 km)');
    });
  });

  // =========================================================================
  // 10. Bounding Box, Centroid, and SVG Canvas Projection
  // =========================================================================
  describe('10. Bounding Box, Centroid, and Canvas Projection', () => {
    it('should compute bounding box and center correctly for Nashik farm', () => {
      const bbox = getBoundingBox(NASHIK_FARM_GEOJSON);

      expect(bbox.minLng).toBeCloseTo(73.8095, 4);
      expect(bbox.maxLng).toBeCloseTo(73.8170, 4);
      expect(bbox.minLat).toBeCloseTo(19.9950, 4);
      expect(bbox.maxLat).toBeCloseTo(20.0020, 4);

      expect(bbox.centerLng).toBeCloseTo((bbox.minLng + bbox.maxLng) / 2, 6);
      expect(bbox.centerLat).toBeCloseTo((bbox.minLat + bbox.maxLat) / 2, 6);
    });

    it('should calculate centroid of a symmetric square at exact geographic center', () => {
      const square = EQUATOR_SQUARE_GEOJSON;
      const centroid = calculateCentroid(square);

      expect(centroid[0]).toBeCloseTo(0.0005, 5);
      expect(centroid[1]).toBeCloseTo(0.0005, 5);
    });

    it('should provide bijective round-trip projection between geographic space and canvas pixels', () => {
      const bbox = getBoundingBox(NASHIK_FARM_GEOJSON);
      const width = 800;
      const height = 600;
      const padding = 40;

      const testPoints: Position[] = [
        [bbox.centerLng, bbox.centerLat],
        [bbox.minLng, bbox.minLat],
        [bbox.maxLng, bbox.maxLat],
        [73.8124, 19.9975],
      ];

      testPoints.forEach((point) => {
        const canvasCoords = projectLngLatToCanvas(point, bbox, width, height, padding);
        const recoveredLngLat = canvasToLngLat(canvasCoords.x, canvasCoords.y, bbox, width, height, padding);

        // Precision within 10^-5 degrees (~1 meter on ground)
        expect(recoveredLngLat[0]).toBeCloseTo(point[0], 5);
        expect(recoveredLngLat[1]).toBeCloseTo(point[1], 5);
      });
    });

    it('should properly invert the Y-axis for SVG coordinate space (higher latitude = lower Y)', () => {
      const bbox = getBoundingBox(NASHIK_FARM_GEOJSON);
      const width = 800;
      const height = 600;

      const southPoint: Position = [bbox.centerLng, bbox.minLat];
      const northPoint: Position = [bbox.centerLng, bbox.maxLat];

      const southCanvas = projectLngLatToCanvas(southPoint, bbox, width, height);
      const northCanvas = projectLngLatToCanvas(northPoint, bbox, width, height);

      // In SVG space, North (higher latitude) must have smaller Y coordinate
      expect(northCanvas.y).toBeLessThan(southCanvas.y);
    });
  });
});
