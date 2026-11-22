/**
 * AgriDOST 4.0: Google Maps & Geospatial Integration Test Suite
 *
 * Comprehensive tests covering:
 * 1. Google Maps Script Loader singleton pattern & duplicate tag prevention
 * 2. GeoJSON [lng, lat] to Google Maps {lat, lng} coordinate & path conversions
 * 3. Turf.js geospatial bounding box & centroid calculations
 * 4. Error handling: missing key, placeholder key, network timeout, gm_authFailure
 * 5. Visual styling & color coding for Boundary, Crop, Disease, and Spray overlays
 * 6. Integration Health Check (/api/maps/health & getMapsHealth)
 * 7. Graceful offline fallback to Vector SVG cadastre
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isValidGoogleMapsKeyFormat,
  getGoogleMapsApiKey,
  hasValidGoogleMapsKey,
  isGoogleMapsLoaded,
  loadGoogleMapsScript,
  resetGoogleMapsLoaderForTesting,
} from '@/lib/maps/loader';
import {
  geoJsonCoordsToGoogleLatLng,
  geoJsonPolygonToGooglePaths,
  calculateFarmBounds,
  calculateFarmCentroid,
  getFarmBoundaryStyle,
  getZoneStyle,
  fitMapToBounds,
  clearOverlays,
  renderFarmOverlays,
  MAP_COLORS,
} from '@/lib/maps/overlay-utils';
import { getMapsHealth } from '@/lib/maps/health';
import { GET as getMapsHealthRoute } from '@/app/api/maps/health/route';
import { Farm, FarmZone, GeoJSONPolygon, Position } from '@/types';

// ============================================================================
// TEST FIXTURES: Real Cadastre Coordinates (Nashik, Maharashtra)
// ============================================================================
const NASHIK_BOUNDARY_COORDS: Position[] = [
  [73.8100, 19.9950],
  [73.8160, 19.9955],
  [73.8170, 20.0010],
  [73.8115, 20.0020],
  [73.8095, 19.9985],
  [73.8100, 19.9950],
];

const NASHIK_FARM_GEOJSON: GeoJSONPolygon = {
  type: 'Polygon',
  coordinates: [NASHIK_BOUNDARY_COORDS],
};

const MOCK_FARM: Farm = {
  id: 'farm-nashik-001',
  name: 'Nashik Grape & Pomegranate Estate',
  boundary: NASHIK_FARM_GEOJSON,
  areaSqM: 42000,
  areaAcres: 10.38,
  surveyNumber: '142/3A',
  createdAt: '2026-11-22T00:00:00Z',
  updatedAt: '2026-11-22T00:00:00Z',
};

const MOCK_ZONES: FarmZone[] = [
  {
    id: 'zone-crop-1',
    farmId: 'farm-nashik-001',
    type: 'crop',
    name: 'Export Grapes (Thompson Seedless)',
    cropName: 'Grapes',
    color: '#10B981',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [73.8105, 19.9955],
          [73.8130, 19.9958],
          [73.8130, 19.9985],
          [73.8105, 19.9985],
          [73.8105, 19.9955],
        ],
      ],
    },
  },
  {
    id: 'zone-disease-1',
    farmId: 'farm-nashik-001',
    type: 'disease',
    name: 'Downy Mildew Hotspot',
    diseaseName: 'Downy Mildew',
    severity: 'high',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [73.8135, 19.9960],
          [73.8155, 19.9962],
          [73.8155, 19.9980],
          [73.8135, 19.9978],
          [73.8135, 19.9960],
        ],
      ],
    },
  },
  {
    id: 'zone-spray-1',
    farmId: 'farm-nashik-001',
    type: 'spray',
    name: 'Drone Precision Spray Corridor',
    chemicalName: 'Copper Oxychloride 50 WP',
    sprayStatus: 'scheduled',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [73.8140, 19.9985],
          [73.8165, 19.9988],
          [73.8165, 20.0005],
          [73.8140, 20.0002],
          [73.8140, 19.9985],
        ],
      ],
    },
  },
];

describe('AgriDOST 4.0: Google Maps Integration Test Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Ensure clean global window / document before each test
    delete (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).document;
    resetGoogleMapsLoaderForTesting();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetGoogleMapsLoaderForTesting();
    // Clean any mocked global window or document
    delete (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).document;
  });

  // ==========================================================================
  // 1. API Key Format Validation & Retrieval
  // ==========================================================================
  describe('1. API Key Format Validation & Retrieval', () => {
    it('should validate standard Google Maps API keys (starts with AIza or length >= 15)', () => {
      expect(isValidGoogleMapsKeyFormat('AIzaSyD-73948293482394823948239482394')).toBe(true);
      expect(isValidGoogleMapsKeyFormat('AIzaFakeValidLengthKey1234567890123')).toBe(true);
    });

    it('should reject null, empty, or placeholder keys', () => {
      expect(isValidGoogleMapsKeyFormat(null)).toBe(false);
      expect(isValidGoogleMapsKeyFormat(undefined)).toBe(false);
      expect(isValidGoogleMapsKeyFormat('')).toBe(false);
      expect(isValidGoogleMapsKeyFormat('   ')).toBe(false);
      expect(isValidGoogleMapsKeyFormat('short')).toBe(false);
      expect(isValidGoogleMapsKeyFormat('YOUR_GOOGLE_MAPS_API_KEY')).toBe(false);
      expect(isValidGoogleMapsKeyFormat('PLACEHOLDER_KEY')).toBe(false);
    });

    it('should retrieve key from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY environment variable', () => {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'AIzaTestingEnvKey1234567890';
      expect(getGoogleMapsApiKey()).toBe('AIzaTestingEnvKey1234567890');
      expect(hasValidGoogleMapsKey()).toBe(true);
    });

    it('should prioritize custom passed key over environment key', () => {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'AIzaEnvKey111111111111';
      expect(getGoogleMapsApiKey('AIzaCustomKey222222222222')).toBe('AIzaCustomKey222222222222');
    });

    it('should report false for hasValidGoogleMapsKey when key is missing or dummy', () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      delete process.env.GOOGLE_MAPS_API_KEY;
      expect(hasValidGoogleMapsKey()).toBe(false);

      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';
      expect(hasValidGoogleMapsKey()).toBe(false);
    });
  });

  // ==========================================================================
  // 2. Google Maps Script Loader & Singleton Behavior
  // ==========================================================================
  describe('2. Google Maps Script Loader Singleton Pattern', () => {
    it('should reject with descriptive error in SSR (node) when window is undefined', async () => {
      await expect(loadGoogleMapsScript({ apiKey: 'AIzaValidTestKey123456' })).rejects.toThrow(
        /browser environment/
      );
    });

    it('should reject when API key is missing in browser environment', async () => {
      // Simulate browser window & document
      (globalThis as Record<string, unknown>).window = {};
      (globalThis as Record<string, unknown>).document = {
        getElementById: vi.fn(() => null),
      };

      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      await expect(loadGoogleMapsScript()).rejects.toThrow(/API key is missing/);
    });

    it('should inject script tag with correct query parameters and prevent duplicate script tags', async () => {
      const appendedScripts: Array<{
        id: string;
        src: string;
        async: boolean;
        defer: boolean;
        addEventListener: (event: string, handler: (e?: unknown) => void) => void;
      }> = [];

      const mockDocument = {
        getElementById: vi.fn((id: string) => appendedScripts.find((s) => s.id === id) || null),
        querySelector: vi.fn(() => null),
        head: {
          appendChild: vi.fn((el: unknown) => {
            appendedScripts.push(el as (typeof appendedScripts)[0]);
          }),
        },
        createElement: vi.fn((tag: string) => {
          const listeners: Record<string, Array<(e?: unknown) => void>> = {};
          return {
            tagName: tag.toUpperCase(),
            id: '',
            src: '',
            async: false,
            defer: false,
            addEventListener: (event: string, handler: (e?: unknown) => void) => {
              listeners[event] = listeners[event] || [];
              listeners[event].push(handler);
            },
            trigger: (event: string, data?: unknown) => {
              (listeners[event] || []).forEach((fn) => fn(data));
            },
          };
        }),
      };

      const mockWindow = {
        google: undefined as unknown,
        gm_authFailure: undefined as unknown,
      };

      (global as unknown as { window: unknown }).window = mockWindow;
      (global as unknown as { document: unknown }).document = mockDocument;

      const apiKey = 'AIzaValidMockGoogleKeyForTests123456';

      // Start first loader call
      const loadPromise1 = loadGoogleMapsScript({ apiKey });

      // Start second concurrent loader call with same key
      const loadPromise2 = loadGoogleMapsScript({ apiKey });

      // Verify that EXACTLY 1 script tag was appended
      expect(mockDocument.head.appendChild).toHaveBeenCalledTimes(1);
      expect(appendedScripts.length).toBe(1);

      const injectedScript = appendedScripts[0];
      expect(injectedScript.id).toBe('google-maps-js-api-agridost');
      expect(injectedScript.src).toContain('https://maps.googleapis.com/maps/api/js?');
      expect(injectedScript.src).toContain(`key=${apiKey}`);
      expect(injectedScript.src).toContain('libraries=geometry%2Cplaces');
      expect(injectedScript.src).toContain('loading=async');

      // Simulate successful script load event and window.google.maps initialization
      const mockMapsNamespace = { Map: vi.fn(), Polygon: vi.fn() };
      mockWindow.google = { maps: mockMapsNamespace };

      (injectedScript as unknown as { trigger: (e: string) => void }).trigger('load');

      const result1 = await loadPromise1;
      const result2 = await loadPromise2;

      // Both promises should resolve to the exact same google.maps instance
      expect(result1).toBe(mockMapsNamespace);
      expect(result2).toBe(mockMapsNamespace);

      // Third call should return resolved instance immediately without re-appending
      const loadPromise3 = await loadGoogleMapsScript({ apiKey });
      expect(loadPromise3).toBe(mockMapsNamespace);
      expect(mockDocument.head.appendChild).toHaveBeenCalledTimes(1);
    });

    it('should catch window.gm_authFailure and reject with auth error', async () => {
      const appendedScripts: Array<{
        id: string;
        addEventListener: (event: string, handler: (e?: unknown) => void) => void;
      }> = [];

      const mockWindow: {
        google?: unknown;
        gm_authFailure?: () => void;
      } = {};

      const mockDocument = {
        getElementById: vi.fn(() => null),
        querySelector: vi.fn(() => null),
        head: {
          appendChild: vi.fn((el: unknown) => {
            appendedScripts.push(el as (typeof appendedScripts)[0]);
          }),
        },
        createElement: vi.fn(() => ({
          id: '',
          src: '',
          addEventListener: vi.fn(),
        })),
      };

      (global as unknown as { window: unknown }).window = mockWindow;
      (global as unknown as { document: unknown }).document = mockDocument;

      const loadPromise = loadGoogleMapsScript({ apiKey: 'AIzaInvalidAuthKey123456789' });

      // Google Maps invokes window.gm_authFailure when billing is inactive or key is invalid
      expect(typeof mockWindow.gm_authFailure).toBe('function');
      mockWindow.gm_authFailure!();

      await expect(loadPromise).rejects.toThrow(/gm_authFailure/);
    });

    it('should handle network script onerror gracefully and allow retry after reset', async () => {
      let scriptListener: ((err: unknown) => void) | null = null;
      let removedScript = false;

      const mockDocument = {
        getElementById: vi.fn(() => null),
        querySelector: vi.fn(() => null),
        head: {
          appendChild: vi.fn(),
        },
        createElement: vi.fn(() => ({
          id: '',
          src: '',
          parentNode: {
            removeChild: vi.fn(() => {
              removedScript = true;
            }),
          },
          addEventListener: vi.fn((event: string, handler: (err: unknown) => void) => {
            if (event === 'error') scriptListener = handler;
          }),
        })),
      };

      (global as unknown as { window: unknown }).window = {};
      (global as unknown as { document: unknown }).document = mockDocument;

      const loadPromise = loadGoogleMapsScript({ apiKey: 'AIzaTestingNetworkErrorKey123' });

      // Trigger error
      if (scriptListener) {
        (scriptListener as (err: unknown) => void)('Network connection refused');
      }

      await expect(loadPromise).rejects.toThrow(/Failed to load Google Maps script/);
      expect(removedScript).toBe(true);
    });
  });

  // ==========================================================================
  // 3. GeoJSON to Google Maps Coordinate & Path Conversions
  // ==========================================================================
  describe('3. GeoJSON [lng, lat] to Google Maps {lat, lng} Conversions', () => {
    it('should convert GeoJSON positions [lng, lat] into Google Maps LatLngLiterals {lat, lng}', () => {
      const positions: Position[] = [
        [73.8100, 19.9950],
        [73.8160, 19.9955],
      ];

      const googleLatLngs = geoJsonCoordsToGoogleLatLng(positions);

      expect(googleLatLngs).toEqual([
        { lat: 19.9950, lng: 73.8100 },
        { lat: 19.9955, lng: 73.8160 },
      ]);
    });

    it('should filter out malformed or non-numeric coordinate tuples', () => {
      const malformed: unknown[] = [
        [73.81, 19.99],
        ['invalid', 20.0],
        [null, null],
        [73.82], // missing lat
        undefined,
      ];

      const converted = geoJsonCoordsToGoogleLatLng(malformed as Position[]);
      expect(converted).toEqual([{ lat: 19.99, lng: 73.81 }]);
    });

    it('should convert RFC 7946 GeoJSON Polygon into Google Maps paths', () => {
      const paths = geoJsonPolygonToGooglePaths(NASHIK_FARM_GEOJSON);

      expect(paths.length).toBe(1); // 1 exterior ring
      expect(paths[0].length).toBe(NASHIK_BOUNDARY_COORDS.length);

      // Verify coordinate flip: GeoJSON [0] is lng, Google is lat
      expect(paths[0][0]).toEqual({
        lat: NASHIK_BOUNDARY_COORDS[0][1],
        lng: NASHIK_BOUNDARY_COORDS[0][0],
      });
    });

    it('should safely return empty array for null or malformed polygons', () => {
      expect(geoJsonPolygonToGooglePaths(null)).toEqual([]);
      expect(geoJsonPolygonToGooglePaths(undefined)).toEqual([]);
      expect(geoJsonPolygonToGooglePaths({ type: 'Point', coordinates: [73.8, 20.0] } as unknown as GeoJSONPolygon)).toEqual([]);
      expect(geoJsonPolygonToGooglePaths({ type: 'Polygon', coordinates: [] })).toEqual([]);
    });
  });

  // ==========================================================================
  // 4. Turf.js-Backed Geospatial Bounding Box & Centroid Calculations
  // ==========================================================================
  describe('4. Turf.js Bounds & Centroid Calculations', () => {
    it('should calculate accurate GoogleMapBounds {north, south, east, west} using Turf.js', () => {
      const bounds = calculateFarmBounds(NASHIK_FARM_GEOJSON);

      expect(bounds.north).toBeCloseTo(20.0020, 4);
      expect(bounds.south).toBeCloseTo(19.9950, 4);
      expect(bounds.east).toBeCloseTo(73.8170, 4);
      expect(bounds.west).toBeCloseTo(73.8095, 4);

      // North must be greater than South, East greater than West
      expect(bounds.north).toBeGreaterThan(bounds.south);
      expect(bounds.east).toBeGreaterThan(bounds.west);
    });

    it('should calculate geographic centroid {lat, lng} within polygon bounds', () => {
      const centroid = calculateFarmCentroid(NASHIK_FARM_GEOJSON);
      const bounds = calculateFarmBounds(NASHIK_FARM_GEOJSON);

      expect(centroid.lat).toBeGreaterThanOrEqual(bounds.south);
      expect(centroid.lat).toBeLessThanOrEqual(bounds.north);
      expect(centroid.lng).toBeGreaterThanOrEqual(bounds.west);
      expect(centroid.lng).toBeLessThanOrEqual(bounds.east);
    });

    it('should execute fitMapToBounds and pass calculated bounds and padding to map', () => {
      const mockMap = {
        fitBounds: vi.fn(),
        setCenter: vi.fn(),
        setZoom: vi.fn(),
      };

      const success = fitMapToBounds(mockMap, NASHIK_FARM_GEOJSON, 50);

      expect(success).toBe(true);
      expect(mockMap.fitBounds).toHaveBeenCalledWith(
        expect.objectContaining({
          north: expect.any(Number),
          south: expect.any(Number),
          east: expect.any(Number),
          west: expect.any(Number),
        }),
        50
      );
    });
  });

  // ==========================================================================
  // 5. Zone Styling & Color Coding (Crop, Disease, Spray)
  // ==========================================================================
  describe('5. Distinct Zone Styling & Color Coding', () => {
    it('should format Farm Boundary with distinct emerald border and sage fill', () => {
      const normalStyle = getFarmBoundaryStyle(false);
      expect(normalStyle.strokeColor).toBe(MAP_COLORS.FARM_BOUNDARY_STROKE);
      expect(normalStyle.fillColor).toBe(MAP_COLORS.FARM_BOUNDARY_FILL);
      expect(normalStyle.strokeWeight).toBe(3.5);
      expect(normalStyle.zIndex).toBe(10);

      const selectedStyle = getFarmBoundaryStyle(true);
      expect(selectedStyle.strokeColor).toBe(MAP_COLORS.SELECTED_ACCENT);
      expect(selectedStyle.strokeWeight).toBeGreaterThan(normalStyle.strokeWeight);
      expect(selectedStyle.zIndex).toBeGreaterThan(normalStyle.zIndex!);
    });

    it('should format Crop zone with green parcel styling', () => {
      const cropZone = MOCK_ZONES[0];
      const style = getZoneStyle(cropZone, false);

      expect(style.strokeColor).toBe(cropZone.color);
      expect(style.fillColor).toBe(cropZone.color);
      expect(style.zIndex).toBe(20);
    });

    it('should format Disease hotspot zone with high-contrast alert red', () => {
      const diseaseZone = MOCK_ZONES[1];
      const style = getZoneStyle(diseaseZone, false);

      expect(style.strokeColor).toBe(MAP_COLORS.DISEASE_STROKE);
      expect(style.fillColor).toBe(MAP_COLORS.DISEASE_FILL);
      expect(style.strokeOpacity).toBe(1.0);
      expect(style.zIndex).toBe(30);
    });

    it('should format Spray zone with precision cyan/blue styling', () => {
      const sprayZone = MOCK_ZONES[2];
      const style = getZoneStyle(sprayZone, false);

      expect(style.strokeColor).toBe(MAP_COLORS.SPRAY_STROKE);
      expect(style.fillColor).toBe(MAP_COLORS.SPRAY_FILL);
      expect(style.zIndex).toBe(25);
    });

    it('should elevate styling when zone is selected', () => {
      const cropZone = MOCK_ZONES[0];
      const normalStyle = getZoneStyle(cropZone, false);
      const selectedStyle = getZoneStyle(cropZone, true);

      expect(selectedStyle.strokeColor).toBe(MAP_COLORS.SELECTED_ACCENT);
      expect(selectedStyle.strokeWeight).toBeGreaterThan(normalStyle.strokeWeight);
      expect(selectedStyle.fillOpacity).toBeGreaterThan(normalStyle.fillOpacity);
      expect(selectedStyle.zIndex).toBe(50);
    });
  });

  // ==========================================================================
  // 6. Overlays Lifecycle & Zone Click Synchronization
  // ==========================================================================
  describe('6. Overlays Lifecycle & Click Synchronization', () => {
    it('should render boundary and zone overlays, attach click handlers, and cleanup cleanly', () => {
      const createdPolygons: Array<{
        opts: unknown;
        map: unknown;
        setMap: (m: unknown) => void;
        addListener: (e: string, fn: () => void) => void;
      }> = [];

      class MockPolygon {
        listeners: Record<string, () => void> = {};
        map: unknown = null;
        constructor(public opts: unknown) {
          createdPolygons.push(this as unknown as (typeof createdPolygons)[0]);
        }
        setMap(m: unknown) {
          this.map = m;
        }
        addListener(event: string, handler: () => void) {
          this.listeners[event] = handler;
          return { remove: vi.fn() };
        }
      }

      (global as unknown as { window: unknown }).window = {
        google: {
          maps: {
            Polygon: MockPolygon,
          },
        },
      };

      const mockMap = {};
      const onSelectZone = vi.fn();

      const result = renderFarmOverlays(mockMap, MOCK_FARM, MOCK_ZONES, {
        selectedZoneId: 'zone-crop-1',
        onSelectZone,
      });

      // 1 boundary + 3 zones = 4 overlays
      expect(createdPolygons.length).toBe(4);
      expect(result.zonePolygons.size).toBe(3);
      expect(result.boundaryPolygon).not.toBeNull();

      // Trigger zone click
      const cropPolygon = result.zonePolygons.get('zone-crop-1') as unknown as { listeners: { click: () => void } };
      expect(cropPolygon.listeners.click).toBeDefined();
      cropPolygon.listeners.click();
      expect(onSelectZone).toHaveBeenCalledWith(MOCK_ZONES[0]);

      // Call cleanup
      result.cleanup();
      for (const p of createdPolygons) {
        expect(p.map).toBeNull();
      }
    });

    it('should safely clear overlays with clearOverlays utility', () => {
      const poly1 = { setMap: vi.fn() };
      const poly2 = { setMap: vi.fn() };
      clearOverlays([poly1 as unknown as never, poly2 as unknown as never]);

      expect(poly1.setMap).toHaveBeenCalledWith(null);
      expect(poly2.setMap).toHaveBeenCalledWith(null);
    });
  });

  // ==========================================================================
  // 7. Integration Health Check (/api/maps/health & getMapsHealth)
  // ==========================================================================
  describe('7. Integration Health Check & Provenance', () => {
    it('should report OFFLINE with vector_svg fallback when API key is missing', async () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      delete process.env.GOOGLE_MAPS_API_KEY;

      const health = await getMapsHealth();

      expect(health.provider).toBe('google-maps');
      expect(health.category).toBe('geospatial');
      expect(health.configurationStatus).toBe('unconfigured');
      expect(health.operatingMode).toBe('OFFLINE');
      expect(health.activeProvider).toBe('vector_svg');
      expect(health.cadastreFallbackAvailable).toBe(true);
      expect(health.hasApiKey).toBe(false);
      expect(health.dataFreshness?.provenance).toBe('offline_deterministic');
      expect(health.featuresSupported).toContain('offline_svg_vector_fallback');
    });

    it('should report SIMULATED when API key has placeholder format', async () => {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';

      const health = await getMapsHealth();

      expect(health.configurationStatus).toBe('partial');
      expect(health.operatingMode).toBe('SIMULATED');
      expect(health.activeProvider).toBe('vector_svg');
      expect(health.keyFormatValid).toBe(false);
      expect(health.cadastreFallbackAvailable).toBe(true);
    });

    it('should report LIVE when valid API key is configured', async () => {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'AIzaSyD-RealConfiguredKey1234567890';

      const health = await getMapsHealth();

      expect(health.configurationStatus).toBe('configured');
      expect(health.connectivityStatus).toBe('online');
      expect(health.operatingMode).toBe('LIVE');
      expect(health.activeProvider).toBe('google');
      expect(health.hasApiKey).toBe(true);
      expect(health.keyFormatValid).toBe(true);
      expect(health.dataFreshness?.provenance).toBe('live_api');
      expect(health.lastError).toBeNull();
    });

    it('should serve HTTP 200 from Next.js route handler /api/maps/health', async () => {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'AIzaSyRouteHandlerKey1234567890';

      const response = await getMapsHealthRoute();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.provider).toBe('google-maps');
      expect(json.displayName).toBe('Google Maps JavaScript API');
      expect(json.category).toBe('geospatial');
      expect(json.operatingMode).toBe('LIVE');
      expect(json.cadastreFallbackAvailable).toBe(true);
    });
  });
});
