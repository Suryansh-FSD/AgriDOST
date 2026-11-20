'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Farm, FarmZone, GeoJSONPolygon, Position } from '@/types';
import {
  calculateArea,
  positionsToPolygon,
  polygonToPositions,
  calculateCentroid,
} from '@/lib/geo/calculations';
import { saveFarm, getActiveFarm } from '@/lib/data/storage';
import { DEMO_FARMS } from '@/lib/data/demo-data';
import { VectorFarmMap } from './VectorFarmMap';
import { DrawingToolbar, MapInteractionMode, MapRendererMode } from './DrawingToolbar';
import {
  Satellite,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react';

export interface FarmMapProps {
  activeFarm?: Farm;
  onFarmUpdated?: (farm: Farm) => void;
  zones?: FarmZone[];
  selectedZoneId?: string | null;
  onSelectZone?: (zone: FarmZone | null) => void;
  height?: number | string;
  className?: string;
  readOnly?: boolean;
}

export function FarmMap({
  activeFarm: initialFarm,
  onFarmUpdated,
  zones = [],
  selectedZoneId = null,
  onSelectZone,
  height = '620px',
  className = '',
  readOnly = false,
}: FarmMapProps) {
  // Active farm state
  const [farm, setFarm] = useState<Farm | undefined>(() => {
    return initialFarm || (typeof window !== 'undefined' ? getActiveFarm() : undefined) || DEMO_FARMS[0];
  });

  useEffect(() => {
    if (initialFarm) {
      setFarm(initialFarm);
    }
  }, [initialFarm]);

  // Google Maps API Key check
  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const hasGoogleKey = Boolean(googleApiKey && googleApiKey.trim().length > 0 && googleApiKey !== 'YOUR_GOOGLE_MAPS_API_KEY');

  // Interactive modes
  const [interactionMode, setInteractionMode] = useState<MapInteractionMode>('view');
  const [rendererMode, setRendererMode] = useState<MapRendererMode>('vector');

  // Draft boundary vertices
  const [draftPoints, setDraftPoints] = useState<Position[]>(() => {
    if (farm?.boundary) {
      return polygonToPositions(farm.boundary);
    }
    return [];
  });

  // Track unsaved modifications
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  // Sync draft points when farm changes
  useEffect(() => {
    if (farm?.boundary) {
      setDraftPoints(polygonToPositions(farm.boundary));
      setIsDirty(false);
    }
  }, [farm?.id]);

  // Auto-clear notification after 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Handle draft points boundary change
  const handleBoundaryChange = useCallback(
    (newBoundary: GeoJSONPolygon) => {
      setDraftPoints(polygonToPositions(newBoundary));
      setIsDirty(true);
    },
    []
  );

  // Undo point
  const handleUndoPoint = () => {
    if (draftPoints.length > 0) {
      setDraftPoints((prev) => prev.slice(0, -1));
      setIsDirty(true);
    }
  };

  // Finish Drawing
  const handleFinishDrawing = () => {
    if (draftPoints.length >= 3) {
      setInteractionMode('view');
      setIsDirty(true);
      setNotification({
        type: 'info',
        message: 'Boundary closed. Review calculated area and click "Save Boundary" to apply.',
      });
    }
  };

  // Reset Points
  const handleResetPoints = () => {
    if (farm?.boundary) {
      setDraftPoints(polygonToPositions(farm.boundary));
    } else {
      setDraftPoints([]);
    }
    setInteractionMode('view');
    setIsDirty(false);
    setNotification({
      type: 'info',
      message: 'Points reset to current active farm boundary.',
    });
  };

  // Load Demo Boundary
  const handleLoadDemoBoundary = () => {
    const demo = DEMO_FARMS[0];
    const coords = polygonToPositions(demo.boundary);
    setDraftPoints(coords);
    setIsDirty(true);
    setNotification({
      type: 'success',
      message: `Loaded GPS boundary from "${demo.name}" (${demo.areaAcres} Acres).`,
    });
  };

  // Save Boundary to Storage
  const handleSaveBoundary = () => {
    if (draftPoints.length < 3) {
      setNotification({
        type: 'error',
        message: 'A valid farm boundary requires at least 3 GPS coordinates.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const polygon = positionsToPolygon(draftPoints);
      const { sqM, acres } = calculateArea(polygon);
      const centroid = calculateCentroid(polygon);

      const targetFarmId = farm?.id || `farm-${Date.now()}`;
      const updatedFarm: Farm = {
        id: targetFarmId,
        name: farm?.name || 'My Agro Farm',
        boundary: polygon,
        areaSqM: sqM,
        areaAcres: acres,
        location: farm?.location || 'Maharashtra, India',
        soilType: farm?.soilType || 'Medium Black Soil',
        waterSource: farm?.waterSource || 'Drip Irrigation',
        locationDetails: farm?.locationDetails || {
          country: 'India',
          coordinates: centroid,
        },
        createdAt: farm?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Persist to storage
      saveFarm(updatedFarm);
      setFarm(updatedFarm);
      setIsDirty(false);
      setInteractionMode('view');

      if (onFarmUpdated) {
        onFarmUpdated(updatedFarm);
      }

      setNotification({
        type: 'success',
        message: `Farm boundary saved successfully! Area: ${acres.toFixed(2)} Acres (${sqM.toLocaleString('en-IN')} m²).`,
      });
    } catch (err) {
      console.error('[AgriDOST Map] Failed to save farm boundary:', err);
      setNotification({
        type: 'error',
        message: 'Failed to save boundary. Please verify polygon vertices.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Export GeoJSON RFC 7946 Polygon
  const handleExportGeoJson = () => {
    if (draftPoints.length < 3) return;
    const poly = positionsToPolygon(draftPoints);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(poly, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${farm?.name?.replace(/\s+/g, '_') || 'farm'}_boundary.geojson`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setNotification({
      type: 'info',
      message: 'RFC 7946 GeoJSON boundary downloaded.',
    });
  };

  return (
    <div className={`flex flex-col gap-3.5 w-full ${className}`}>
      {/* Top Banner if in Satellite mode without Google Key */}
      {rendererMode === 'satellite' && !hasGoogleKey && (
        <div className="flex items-center justify-between rounded-2xl border border-[#E7E9E2] bg-white p-3.5 text-xs text-[#26312A] shadow-xs">
          <div className="flex items-center gap-2.5">
            <Satellite className="h-4 w-4 text-[#B9784F] shrink-0" />
            <span>
              <strong>Satellite Imagery:</strong> Google Maps API key is not configured in this environment (
              <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>). High-precision SVG Cadastre Blueprint is active and 100% functional offline.
            </span>
          </div>
          <button
            onClick={() => setRendererMode('vector')}
            className="rounded-xl bg-[#DCE8D3] px-3 py-1 font-semibold text-[#173F2B] hover:bg-[#DCE8D3]/80 transition"
          >
            Switch to Cadastre
          </button>
        </div>
      )}

      {/* Drawing Toolbar */}
      {!readOnly && (
        <DrawingToolbar
          mode={interactionMode}
          onChangeMode={setInteractionMode}
          rendererMode={rendererMode}
          onChangeRendererMode={setRendererMode}
          draftPointsCount={draftPoints.length}
          canFinishDrawing={draftPoints.length >= 3}
          onUndoPoint={handleUndoPoint}
          onFinishDrawing={handleFinishDrawing}
          onResetPoints={handleResetPoints}
          onSaveBoundary={handleSaveBoundary}
          onLoadDemoBoundary={handleLoadDemoBoundary}
          onExportGeoJson={handleExportGeoJson}
          isDirty={isDirty}
          isSaving={isSaving}
          hasGoogleKey={hasGoogleKey}
        />
      )}

      {/* Notification Toast */}
      {notification && (
        <div
          className={`flex items-center gap-2.5 rounded-2xl p-3 text-xs shadow-xs transition-all ${
            notification.type === 'success'
              ? 'border border-[#DCE8D3] bg-[#DCE8D3]/30 text-[#173F2B]'
              : notification.type === 'error'
              ? 'border border-[#B9784F]/40 bg-white text-[#B9784F]'
              : 'border border-[#E7E9E2] bg-white text-[#173F2B]'
          }`}
        >
          {notification.type === 'success' && <CheckCircle className="h-4 w-4 text-[#173F2B] shrink-0" />}
          {notification.type === 'error' && <AlertCircle className="h-4 w-4 text-[#B9784F] shrink-0" />}
          {notification.type === 'info' && <Info className="h-4 w-4 text-[#173F2B] shrink-0" />}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Map Rendering Container */}
      <div className="relative w-full">
        <VectorFarmMap
          farm={farm}
          zones={zones}
          selectedZoneId={selectedZoneId}
          onSelectZone={onSelectZone}
          mode={interactionMode}
          externalPoints={draftPoints}
          onBoundaryChange={handleBoundaryChange}
          allowDrawing={!readOnly}
          height={height}
        />
      </div>
    </div>
  );
}
