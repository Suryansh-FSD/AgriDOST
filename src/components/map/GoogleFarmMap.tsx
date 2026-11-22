'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Farm,
  FarmZone,
  GeoJSONPolygon,
  Position,
} from '@/types';
import {
  GoogleFarmMapProps,
  MapDisplayStyle,
  MapProvider,
  MapLoaderState,
  IGoogleMap,
} from '@/types/maps';
import {
  loadGoogleMapsScript,
  hasValidGoogleMapsKey,
  getGoogleMapsApiKey,
} from '@/lib/maps/loader';
import {
  renderFarmOverlays,
  fitMapToBounds,
  calculateFarmCentroid,
  calculateFarmBounds,
  RenderFarmOverlaysResult,
} from '@/lib/maps/overlay-utils';
import { calculateArea, calculatePerimeter, formatPerimeter } from '@/lib/geo/calculations';
import { VectorFarmMap } from './VectorFarmMap';
import { MapLegend } from './MapLegend';
import {
  Satellite,
  Layers,
  Map as MapIcon,
  Compass,
  Maximize2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Sprout,
  ShieldAlert,
  Plane,
  Info,
} from 'lucide-react';

export function GoogleFarmMap({
  farm,
  zones = [],
  selectedZoneId = null,
  onSelectZone,
  initialStyle = 'hybrid',
  height = '620px',
  className = '',
  showStyleControls = true,
  showLegend = true,
  showStatsOverlay = true,
  showProviderToggle = true,
  readOnly = false,
  apiKey,
  onProviderChange,
  forceFallback = false,
  allowDrawing = false,
  onBoundaryChange,
}: GoogleFarmMapProps) {
  // Determine if Google Maps API key is configured
  const effectiveKey = getGoogleMapsApiKey(apiKey);
  const isKeyValid = hasValidGoogleMapsKey(apiKey);

  // Active provider: 'google' or 'vector_svg'
  const [provider, setProvider] = useState<MapProvider>(() => {
    if (forceFallback || !isKeyValid) return 'vector_svg';
    return 'google';
  });

  // Loader state
  const [loaderState, setLoaderState] = useState<MapLoaderState>(() => {
    if (forceFallback || !isKeyValid) return 'error';
    return 'idle';
  });
  const [loaderError, setLoaderError] = useState<string | null>(() => {
    if (forceFallback) return 'Manual vector cadastre mode forced.';
    if (!isKeyValid) return 'Google Maps API key is not configured or invalid (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).';
    return null;
  });

  // Map display style: satellite, hybrid, roadmap, terrain
  const [displayStyle, setDisplayStyle] = useState<MapDisplayStyle>(initialStyle);

  // Map DOM element & Google Map instance refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<IGoogleMap | null>(null);
  const overlayResultRef = useRef<RenderFarmOverlaysResult | null>(null);

  // Layer visibility toggles
  const [showBoundary, setShowBoundary] = useState(true);
  const [showZonesLayer, setShowZonesLayer] = useState(true);

  // Sync provider change callback
  const updateProvider = useCallback(
    (newProvider: MapProvider) => {
      setProvider(newProvider);
      if (onProviderChange) {
        onProviderChange(newProvider);
      }
    },
    [onProviderChange]
  );

  // Handle external forceFallback changes
  useEffect(() => {
    if (forceFallback) {
      updateProvider('vector_svg');
    }
  }, [forceFallback, updateProvider]);

  // Load Google Maps API Script
  useEffect(() => {
    if (provider !== 'google') return;

    let isMounted = true;
    setLoaderState('loading');

    loadGoogleMapsScript({ apiKey: effectiveKey || undefined })
      .then(() => {
        if (!isMounted) return;
        setLoaderState('loaded');
        setLoaderError(null);
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        const msg = err?.message || 'Failed to initialize Google Maps JS API.';
        setLoaderError(msg);
        setLoaderState('error');
        // Gracefully fallback to Vector SVG
        updateProvider('vector_svg');
      });

    return () => {
      isMounted = false;
    };
  }, [provider, effectiveKey, updateProvider]);

  // Initialize or re-center Google Map instance once loaded
  useEffect(() => {
    if (provider !== 'google' || loaderState !== 'loaded' || !mapContainerRef.current) {
      return;
    }

    const win = window as unknown as {
      google?: {
        maps?: {
          Map: new (el: HTMLElement, opts: unknown) => IGoogleMap;
          MapTypeId: Record<string, string>;
        };
      };
    };

    if (!win.google?.maps?.Map) return;

    // Calculate default center from farm boundary or default coordinates
    const defaultCenter = farm?.boundary
      ? calculateFarmCentroid(farm.boundary)
      : { lat: 19.9975, lng: 73.815 };

    // Resolve MapTypeId
    let mapTypeId = 'hybrid';
    if (win.google.maps.MapTypeId) {
      if (displayStyle === 'satellite') mapTypeId = win.google.maps.MapTypeId.SATELLITE || 'satellite';
      else if (displayStyle === 'roadmap') mapTypeId = win.google.maps.MapTypeId.ROADMAP || 'roadmap';
      else if (displayStyle === 'terrain') mapTypeId = win.google.maps.MapTypeId.TERRAIN || 'terrain';
      else mapTypeId = win.google.maps.MapTypeId.HYBRID || 'hybrid';
    }

    if (!mapInstanceRef.current) {
      const map = new win.google.maps.Map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 16,
        mapTypeId,
        disableDefaultUI: false,
        mapTypeControl: false, // We render our own themed pill controls
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        gestureHandling: 'cooperative',
      });
      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setMapTypeId(mapTypeId);
    }

    // Fit map bounds to farm boundary
    if (farm?.boundary && mapInstanceRef.current) {
      fitMapToBounds(mapInstanceRef.current, farm.boundary, 45);
    }
  }, [provider, loaderState, displayStyle, farm?.id]);

  // Render or update Polygon Overlays (Boundary + Zones)
  useEffect(() => {
    if (provider !== 'google' || !mapInstanceRef.current) return;

    // Cleanup previous overlays
    if (overlayResultRef.current) {
      overlayResultRef.current.cleanup();
      overlayResultRef.current = null;
    }

    // Render new overlays
    const overlays = renderFarmOverlays(mapInstanceRef.current, farm, zones, {
      selectedZoneId,
      onSelectZone,
      showBoundary,
      showZones: showZonesLayer,
    });

    overlayResultRef.current = overlays;

    return () => {
      if (overlayResultRef.current) {
        overlayResultRef.current.cleanup();
        overlayResultRef.current = null;
      }
    };
  }, [provider, farm, zones, selectedZoneId, onSelectZone, showBoundary, showZonesLayer]);

  // Handle map style switch
  const handleStyleChange = (style: MapDisplayStyle) => {
    setDisplayStyle(style);
    if (mapInstanceRef.current) {
      const win = window as unknown as { google?: { maps?: { MapTypeId: Record<string, string> } } };
      let mapTypeId: string = style;
      if (win.google?.maps?.MapTypeId) {
        if (style === 'satellite') mapTypeId = win.google.maps.MapTypeId.SATELLITE;
        else if (style === 'roadmap') mapTypeId = win.google.maps.MapTypeId.ROADMAP;
        else if (style === 'terrain') mapTypeId = win.google.maps.MapTypeId.TERRAIN;
        else mapTypeId = win.google.maps.MapTypeId.HYBRID;
      }
      mapInstanceRef.current.setMapTypeId(mapTypeId);
    }
  };

  // Re-fit / Center map button
  const handleFitBounds = () => {
    if (mapInstanceRef.current && farm?.boundary) {
      fitMapToBounds(mapInstanceRef.current, farm.boundary, 45);
    }
  };

  // Farm Metrics Calculation for overlay stats
  const farmAreaStats = useMemo(() => {
    if (!farm?.boundary) return null;
    return calculateArea(farm.boundary);
  }, [farm?.boundary]);

  const selectedZone = useMemo(() => {
    if (!selectedZoneId) return null;
    return zones.find((z) => z.id === selectedZoneId) || null;
  }, [zones, selectedZoneId]);

  // If in Vector SVG mode (either selected or fallback), render VectorFarmMap with banner
  if (provider === 'vector_svg') {
    return (
      <div className={`flex flex-col gap-3 w-full ${className}`}>
        {/* Fallback Banner */}
        {loaderError && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[#DCE8D3] bg-[#F7F9F5] p-3 text-xs text-[#26312A] shadow-xs">
            <div className="flex items-center gap-2">
              <Satellite className="h-4 w-4 text-[#173F2B] shrink-0" />
              <span>
                <strong className="text-[#173F2B]">Vector Cadastre Active:</strong>{' '}
                {loaderError.includes('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')
                  ? 'Google Maps API key is not configured. Interactive SVG vector cadastre blueprint is active offline.'
                  : loaderError}
              </span>
            </div>
            {isKeyValid && (
              <button
                type="button"
                onClick={() => updateProvider('google')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#173F2B] px-3 py-1 font-semibold text-white hover:bg-[#173F2B]/90 transition"
              >
                <RotateCcw className="h-3 w-3" />
                Retry Satellite
              </button>
            )}
          </div>
        )}

        {/* Manual Provider Toggle when key IS valid */}
        {showProviderToggle && isKeyValid && !loaderError && (
          <div className="flex items-center justify-between rounded-xl border border-[#E7E9E2] bg-white px-3 py-1.5 text-xs text-[#26312A]">
            <span className="text-[#26312A]/70">Currently viewing Vector Blueprint</span>
            <button
              type="button"
              onClick={() => updateProvider('google')}
              className="font-semibold text-[#173F2B] hover:underline"
            >
              Switch to Google Satellite Map &rarr;
            </button>
          </div>
        )}

        {/* Render VectorFarmMap fallback */}
        <VectorFarmMap
          farm={farm}
          zones={zones}
          selectedZoneId={selectedZoneId}
          onSelectZone={onSelectZone}
          allowDrawing={allowDrawing}
          onBoundaryChange={onBoundaryChange}
          height={height}
          showLegend={showLegend}
          showStatsOverlay={showStatsOverlay}
        />
      </div>
    );
  }

  // Google Maps Interactive View
  return (
    <div className={`flex flex-col gap-3 w-full ${className}`}>
      {/* Top Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[#E7E9E2] bg-white p-2.5 sm:p-3 shadow-xs">
        {/* Left: Active Provider Badge & Farm info */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-[#DCE8D3] px-2.5 py-1 text-xs font-semibold text-[#173F2B]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#173F2B] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#173F2B]"></span>
            </span>
            <span>Google Maps {displayStyle.toUpperCase()}</span>
          </div>

          <span className="text-xs font-medium text-[#26312A] hidden sm:inline">
            {farm?.name || 'Survey Cadastre'}
          </span>
        </div>

        {/* Center: Style Switcher (Satellite, Hybrid, Roadmap, Terrain) */}
        {showStyleControls && (
          <div className="flex items-center gap-1 rounded-xl bg-[#F7F9F5] p-1 border border-[#E7E9E2]">
            {(['hybrid', 'satellite', 'roadmap', 'terrain'] as MapDisplayStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => handleStyleChange(style)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  displayStyle === style
                    ? 'bg-[#173F2B] text-white shadow-xs'
                    : 'text-[#26312A] hover:bg-white'
                }`}
              >
                {style.charAt(0).toUpperCase() + style.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Right: Actions (Recenter, Cadastre switch) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleFitBounds}
            title="Recenter Map to Farm Boundary"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7E9E2] bg-white px-2.5 py-1.5 text-xs font-medium text-[#26312A] hover:bg-[#F7F9F5] transition shadow-xs"
          >
            <Maximize2 className="h-3.5 w-3.5 text-[#173F2B]" />
            <span className="hidden sm:inline">Fit Bounds</span>
          </button>

          {showProviderToggle && (
            <button
              type="button"
              onClick={() => updateProvider('vector_svg')}
              title="Switch to Vector SVG Cadastre Blueprint"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#DCE8D3] px-2.5 py-1.5 text-xs font-semibold text-[#173F2B] hover:bg-[#DCE8D3]/80 transition"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>SVG Cadastre</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Map Container */}
      <div
        className="relative w-full rounded-2xl border border-[#E7E9E2] bg-[#1a231d] overflow-hidden shadow-xs"
        style={{ height }}
      >
        {/* Loading Overlay */}
        {loaderState === 'loading' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50 backdrop-blur-xs text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-white border-t-transparent mb-3" />
            <p className="text-sm font-medium">Streaming Google Maps Satellite Tiles...</p>
            <p className="text-xs text-white/70 mt-1">Calibrating RFC 7946 Polygon Overlays</p>
          </div>
        )}

        {/* Google Map Div */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Stats & Farm Details Overlay */}
        {showStatsOverlay && farmAreaStats && (
          <div className="absolute top-4 left-4 z-20 rounded-2xl border border-white/20 bg-black/60 p-3 text-white backdrop-blur-md shadow-lg max-w-xs text-xs">
            <div className="font-semibold text-sm text-[#DCE8D3] flex items-center justify-between">
              <span>{farm?.name || 'Selected Farm'}</span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">
                {farm?.surveyNumber ? `Survey #${farm.surveyNumber}` : 'Cadastre'}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-white/60 block">Calculated Area</span>
                <span className="font-semibold text-emerald-400">
                  {farmAreaStats.acres} Acres ({farmAreaStats.sqM.toLocaleString()} m²)
                </span>
              </div>
              <div>
                <span className="text-white/60 block">Zoned Sectors</span>
                <span className="font-semibold text-white">{zones.length} Zones</span>
              </div>
            </div>

            {selectedZone && (
              <div className="mt-2.5 pt-2 border-t border-white/20 text-[11px]">
                <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                  {selectedZone.type === 'crop' && <Sprout className="h-3 w-3" />}
                  {selectedZone.type === 'disease' && <ShieldAlert className="h-3 w-3" />}
                  {selectedZone.type === 'spray' && <Plane className="h-3 w-3" />}
                  <span>{selectedZone.name}</span>
                </div>
                <div className="text-white/80 text-[10px] mt-0.5">
                  Type: <span className="capitalize">{selectedZone.type}</span>
                  {selectedZone.cropName && ` • ${selectedZone.cropName}`}
                  {selectedZone.diseaseName && ` • ${selectedZone.diseaseName}`}
                  {selectedZone.chemicalName && ` • ${selectedZone.chemicalName}`}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Floating Cadastre Legend */}
        {showLegend && (
          <div className="absolute bottom-4 right-4 z-20 max-w-xs">
            <MapLegend
              showZones={showZonesLayer}
              onToggleZones={() => setShowZonesLayer(!showZonesLayer)}
              showGrid={false}
              showLabels={showBoundary}
              onToggleLabels={() => setShowBoundary(!showBoundary)}
              className="bg-white/95 backdrop-blur-md"
            />
          </div>
        )}
      </div>
    </div>
  );
}
