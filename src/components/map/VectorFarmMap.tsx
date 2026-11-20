'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Farm, FarmZone, GeoJSONPolygon, Position, BoundingBox } from '@/types';
import {
  calculateArea,
  calculatePerimeter,
  getBoundingBox,
  projectLngLatToCanvas,
  canvasToLngLat,
  positionsToPolygon,
  polygonToPositions,
  formatPerimeter,
} from '@/lib/geo/calculations';
import { MapLegend } from './MapLegend';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Compass,
  Sprout,
  ShieldAlert,
  Plane,
  Crosshair,
  Info,
} from 'lucide-react';

export interface VectorFarmMapProps {
  farm?: Farm | null;
  zones?: FarmZone[];
  selectedZoneId?: string | null;
  onSelectZone?: (zone: FarmZone | null) => void;
  mode?: 'view' | 'draw' | 'edit';
  externalPoints?: Position[];
  onBoundaryChange?: (newBoundary: GeoJSONPolygon, areaSqM: number, areaAcres: number) => void;
  onDraftPointsChange?: (points: Position[]) => void;
  allowDrawing?: boolean;
  height?: number | string;
  className?: string;
  showLegend?: boolean;
  showStatsOverlay?: boolean;
}

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 650;
const CANVAS_PADDING = 70;

export function VectorFarmMap({
  farm,
  zones = [],
  selectedZoneId = null,
  onSelectZone,
  mode = 'view',
  externalPoints,
  onBoundaryChange,
  onDraftPointsChange,
  allowDrawing = true,
  height = '580px',
  className = '',
  showLegend = true,
  showStatsOverlay = true,
}: VectorFarmMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Pan and Zoom transform state
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Boundary points state
  const [points, setPoints] = useState<Position[]>(() => {
    if (externalPoints && externalPoints.length > 0) return externalPoints;
    if (farm?.boundary) return polygonToPositions(farm.boundary);
    return [];
  });

  // Track dragging vertex in edit mode
  const [draggedVertexIndex, setDraggedVertexIndex] = useState<number | null>(null);

  // Mouse cursor coordinates in geographic lng/lat
  const [cursorGeo, setCursorGeo] = useState<Position | null>(null);
  const [cursorCanvas, setCursorCanvas] = useState<{ x: number; y: number } | null>(null);

  // Hovered zone for tooltip
  const [hoveredZone, setHoveredZone] = useState<FarmZone | null>(null);

  // Layer visibility toggles
  const [showZonesLayer, setShowZonesLayer] = useState(true);
  const [showGridLayer, setShowGridLayer] = useState(true);
  const [showLabelsLayer, setShowLabelsLayer] = useState(true);

  // Sync internal points when externalPoints or farm changes
  useEffect(() => {
    if (externalPoints !== undefined) {
      setPoints(externalPoints);
    } else if (farm?.boundary && mode !== 'draw') {
      setPoints(polygonToPositions(farm.boundary));
    }
  }, [externalPoints, farm?.boundary, mode]);

  // Notify parent of draft points changes
  useEffect(() => {
    if (onDraftPointsChange) {
      onDraftPointsChange(points);
    }
  }, [points, onDraftPointsChange]);

  // Compute bounding box encompassing farm boundary and all zones
  const bbox = useMemo<BoundingBox>(() => {
    const allCoords: Position[] = [];

    if (points.length > 0) {
      allCoords.push(...points);
    } else if (farm?.boundary) {
      allCoords.push(...polygonToPositions(farm.boundary));
    }

    zones.forEach((z) => {
      allCoords.push(...polygonToPositions(z.geometry));
    });

    if (allCoords.length === 0) {
      const center = farm?.locationDetails?.coordinates || [73.8124, 19.9975];
      return {
        minLng: center[0] - 0.005,
        minLat: center[1] - 0.005,
        maxLng: center[0] + 0.005,
        maxLat: center[1] + 0.005,
        centerLng: center[0],
        centerLat: center[1],
      };
    }

    return getBoundingBox(allCoords);
  }, [points, farm, zones]);

  // Real-time deterministic calculations
  const stats = useMemo(() => {
    if (points.length < 3) {
      return {
        sqM: 0,
        acres: 0,
        hectares: 0,
        perimeterM: 0,
        perimeterKm: 0,
      };
    }
    const poly = positionsToPolygon(points);
    const area = calculateArea(poly);
    const peri = calculatePerimeter(poly);
    return {
      sqM: area.sqM,
      acres: area.acres,
      hectares: area.hectares,
      perimeterM: peri.meters,
      perimeterKm: peri.kilometers,
    };
  }, [points]);

  // Project points to canvas coordinates
  const projectedBoundaryPoints = useMemo(() => {
    return points.map((p) => projectLngLatToCanvas(p, bbox, CANVAS_WIDTH, CANVAS_HEIGHT, CANVAS_PADDING));
  }, [points, bbox]);

  // SVG path string for boundary
  const boundaryPathD = useMemo(() => {
    if (projectedBoundaryPoints.length === 0) return '';
    const first = projectedBoundaryPoints[0];
    let d = `M ${first.x} ${first.y}`;
    for (let i = 1; i < projectedBoundaryPoints.length; i++) {
      d += ` L ${projectedBoundaryPoints[i].x} ${projectedBoundaryPoints[i].y}`;
    }
    if (projectedBoundaryPoints.length >= 3 && mode !== 'draw') {
      d += ' Z';
    }
    return d;
  }, [projectedBoundaryPoints, mode]);

  // Convert client mouse event to SVG coordinate space taking zoom and pan into account
  const getSvgCoordinates = useCallback(
    (e: React.MouseEvent<SVGSVGElement>): { x: number; y: number } => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      const rawX = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
      const rawY = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;

      // Invert pan and zoom
      const x = (rawX - pan.x - CANVAS_WIDTH / 2) / zoom + CANVAS_WIDTH / 2;
      const y = (rawY - pan.y - CANVAS_HEIGHT / 2) / zoom + CANVAS_HEIGHT / 2;
      return { x, y };
    },
    [zoom, pan]
  );

  // Mouse Move Handler
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const coords = getSvgCoordinates(e);
    setCursorCanvas(coords);
    const geo = canvasToLngLat(coords.x, coords.y, bbox, CANVAS_WIDTH, CANVAS_HEIGHT, CANVAS_PADDING);
    setCursorGeo(geo);

    // Pan handling
    if (isPanning) {
      setPan((prev) => ({
        x: prev.x + (e.clientX - panStart.x),
        y: prev.y + (e.clientY - panStart.y),
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Vertex dragging in edit mode
    if (draggedVertexIndex !== null && mode === 'edit') {
      const updated = [...points];
      updated[draggedVertexIndex] = geo;
      setPoints(updated);

      if (onBoundaryChange && updated.length >= 3) {
        const poly = positionsToPolygon(updated);
        const { sqM, acres } = calculateArea(poly);
        onBoundaryChange(poly, sqM, acres);
      }
    }
  };

  // Mouse Down Handler
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || e.altKey || mode === 'view') {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  // Mouse Up Handler
  const handleMouseUp = () => {
    setIsPanning(false);
    if (draggedVertexIndex !== null) {
      setDraggedVertexIndex(null);
    }
  };

  // Canvas Click Handler (for adding points in Draw mode)
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning || mode !== 'draw' || !allowDrawing) return;

    const coords = getSvgCoordinates(e);
    const newPoint = canvasToLngLat(coords.x, coords.y, bbox, CANVAS_WIDTH, CANVAS_HEIGHT, CANVAS_PADDING);

    // Check if clicking near the starting vertex (snap to close)
    if (points.length >= 3) {
      const startPt = projectLngLatToCanvas(points[0], bbox, CANVAS_WIDTH, CANVAS_HEIGHT, CANVAS_PADDING);
      const dist = Math.hypot(coords.x - startPt.x, coords.y - startPt.y);
      if (dist < 18 / zoom) {
        handleClosePolygon();
        return;
      }
    }

    const updated = [...points, newPoint];
    setPoints(updated);

    if (onBoundaryChange && updated.length >= 3) {
      const poly = positionsToPolygon(updated);
      const { sqM, acres } = calculateArea(poly);
      onBoundaryChange(poly, sqM, acres);
    }
  };

  // Close polygon
  const handleClosePolygon = () => {
    if (points.length < 3) return;
    const poly = positionsToPolygon(points);
    const { sqM, acres } = calculateArea(poly);
    if (onBoundaryChange) {
      onBoundaryChange(poly, sqM, acres);
    }
  };

  // Double Click Handler (quick close polygon)
  const handleDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (mode === 'draw' && points.length >= 3) {
      e.preventDefault();
      handleClosePolygon();
    }
  };

  // Insert midpoint vertex in edit mode
  const handleInsertMidpoint = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode !== 'edit') return;
    const p1 = points[index];
    const p2 = points[(index + 1) % points.length];
    const midPoint: Position = [
      Number(((p1[0] + p2[0]) / 2).toFixed(6)),
      Number(((p1[1] + p2[1]) / 2).toFixed(6)),
    ];
    const updated = [...points];
    updated.splice(index + 1, 0, midPoint);
    setPoints(updated);

    if (onBoundaryChange && updated.length >= 3) {
      const poly = positionsToPolygon(updated);
      const { sqM, acres } = calculateArea(poly);
      onBoundaryChange(poly, sqM, acres);
    }
  };

  // Delete vertex in edit mode
  const handleDeleteVertex = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (mode !== 'edit' || points.length <= 3) return;

    const updated = points.filter((_, i) => i !== index);
    setPoints(updated);

    if (onBoundaryChange && updated.length >= 3) {
      const poly = positionsToPolygon(updated);
      const { sqM, acres } = calculateArea(poly);
      onBoundaryChange(poly, sqM, acres);
    }
  };

  // Zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(4.0, Number((z + 0.25).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))));
  const handleResetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Generate coordinate grid lines
  const gridLines = useMemo(() => {
    const lines: Array<{ type: 'h' | 'v'; pos: number; label: string }> = [];
    const count = 5;

    for (let i = 1; i < count; i++) {
      const frac = i / count;
      const x = CANVAS_PADDING + (CANVAS_WIDTH - CANVAS_PADDING * 2) * frac;
      const y = CANVAS_PADDING + (CANVAS_HEIGHT - CANVAS_PADDING * 2) * frac;

      const lng = bbox.minLng + (bbox.maxLng - bbox.minLng) * frac;
      const lat = bbox.maxLat - (bbox.maxLat - bbox.minLat) * frac;

      lines.push({ type: 'v', pos: x, label: `${lng.toFixed(4)}°E` });
      lines.push({ type: 'h', pos: y, label: `${lat.toFixed(4)}°N` });
    }
    return lines;
  }, [bbox]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-[#E7E9E2] bg-[#F7F7F0] select-none shadow-xs ${className}`}
      style={{ height }}
    >
      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        className={`h-full w-full ${
          mode === 'draw'
            ? 'cursor-crosshair'
            : mode === 'edit'
            ? 'cursor-pointer'
            : isPanning
            ? 'cursor-grabbing'
            : 'cursor-grab'
        }`}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleCanvasClick}
        onDoubleClick={handleDoubleClick}
      >
        <defs>
          {/* Subtle Cadastre Grid Pattern */}
          <pattern id="cadastreGrid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#E7E9E2" strokeWidth="1" />
            <circle cx="25" cy="25" r="1" fill="#DCE8D3" />
          </pattern>

          {/* Farm Boundary Diagonal Hatch */}
          <pattern id="farmHatch" width="16" height="16" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="16" stroke="#173F2B" strokeWidth="1.2" strokeOpacity="0.08" />
          </pattern>

          {/* Disease Pattern (Earth Clay) */}
          <pattern id="diseaseHatch" width="12" height="12" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="12" stroke="#B9784F" strokeWidth="1.5" strokeOpacity="0.35" />
          </pattern>

          {/* Spray Pattern */}
          <pattern id="sprayHatch" width="14" height="14" patternTransform="rotate(-45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="14" stroke="#173F2B" strokeWidth="1.2" strokeOpacity="0.25" />
          </pattern>
        </defs>

        {/* Dynamic Zoom & Pan Group */}
        <g
          transform={`translate(${pan.x + CANVAS_WIDTH / 2}, ${pan.y + CANVAS_HEIGHT / 2}) scale(${zoom}) translate(${-CANVAS_WIDTH / 2}, ${-CANVAS_HEIGHT / 2})`}
        >
          {/* Cadastre Background & Grid */}
          <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#F7F7F0" />
          <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#cadastreGrid)" />

          {/* Coordinate Grid Lines */}
          {showGridLayer && (
            <g className="grid-layer">
              {gridLines.map((line, idx) =>
                line.type === 'v' ? (
                  <g key={`v-${idx}`}>
                    <line
                      x1={line.pos}
                      y1={0}
                      x2={line.pos}
                      y2={CANVAS_HEIGHT}
                      stroke="#E7E9E2"
                      strokeDasharray="4 6"
                      strokeWidth="1.2"
                    />
                    <text
                      x={line.pos + 4}
                      y={22}
                      fill="#8C9B90"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {line.label}
                    </text>
                  </g>
                ) : (
                  <g key={`h-${idx}`}>
                    <line
                      x1={0}
                      y1={line.pos}
                      x2={CANVAS_WIDTH}
                      y2={line.pos}
                      stroke="#E7E9E2"
                      strokeDasharray="4 6"
                      strokeWidth="1.2"
                    />
                    <text
                      x={10}
                      y={line.pos - 4}
                      fill="#8C9B90"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {line.label}
                    </text>
                  </g>
                )
              )}
            </g>
          )}

          {/* 1. Farm Boundary Polygon */}
          {projectedBoundaryPoints.length >= 2 && (
            <g className="boundary-group">
              {/* Boundary Fill */}
              {projectedBoundaryPoints.length >= 3 && (
                <>
                  <polygon
                    points={projectedBoundaryPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="#DCE8D3"
                    fillOpacity="0.45"
                  />
                  <polygon
                    points={projectedBoundaryPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="url(#farmHatch)"
                  />
                </>
              )}

              {/* Boundary Outline (High-contrast crisp stroke) */}
              <path
                d={boundaryPathD}
                fill="none"
                stroke="#173F2B"
                strokeWidth="2.8"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          )}

          {/* 2. Zone Overlays (Crops, Disease, Spray) */}
          {showZonesLayer &&
            zones.map((zone) => {
              const zonePositions = polygonToPositions(zone.geometry);
              if (zonePositions.length < 3) return null;

              const projected = zonePositions.map((p) =>
                projectLngLatToCanvas(p, bbox, CANVAS_WIDTH, CANVAS_HEIGHT, CANVAS_PADDING)
              );
              const pointsStr = projected.map((p) => `${p.x},${p.y}`).join(' ');
              const isSelected = selectedZoneId === zone.id;

              let fillColor = '#6F9B55';
              let strokeColor = '#173F2B';
              let dashArray = 'none';
              let fillHatch = 'none';

              if (zone.type === 'disease') {
                strokeColor = '#B9784F';
                fillColor = '#B9784F';
                dashArray = '5 4';
                fillHatch = 'url(#diseaseHatch)';
              } else if (zone.type === 'spray') {
                strokeColor = '#173F2B';
                fillColor = '#DCE8D3';
                dashArray = '3 3';
                fillHatch = 'url(#sprayHatch)';
              } else {
                // Crop zone
                fillColor = '#6F9B55';
                strokeColor = '#173F2B';
              }

              // Zone centroid for label
              const centerLngLat = [
                zonePositions.reduce((acc, p) => acc + p[0], 0) / zonePositions.length,
                zonePositions.reduce((acc, p) => acc + p[1], 0) / zonePositions.length,
              ] as Position;
              const centerProj = projectLngLatToCanvas(centerLngLat, bbox, CANVAS_WIDTH, CANVAS_HEIGHT, CANVAS_PADDING);

              return (
                <g
                  key={zone.id}
                  className="zone-layer cursor-pointer transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectZone) onSelectZone(zone);
                  }}
                  onMouseEnter={() => setHoveredZone(zone)}
                  onMouseLeave={() => setHoveredZone(null)}
                >
                  {/* Zone Area Fill (Translucent 0.4 opacity) */}
                  <polygon
                    points={pointsStr}
                    fill={fillColor}
                    fillOpacity={isSelected ? 0.6 : 0.4}
                    stroke={isSelected ? '#173F2B' : strokeColor}
                    strokeWidth={isSelected ? 3.5 : 1.8}
                    strokeDasharray={dashArray}
                    className="transition hover:fill-opacity-50"
                  />

                  {fillHatch !== 'none' && (
                    <polygon points={pointsStr} fill={fillHatch} pointerEvents="none" />
                  )}

                  {/* Zone Centroid Label & Badge */}
                  {showLabelsLayer && (
                    <g transform={`translate(${centerProj.x}, ${centerProj.y})`} pointerEvents="none">
                      <rect
                        x="-46"
                        y="-12"
                        width="92"
                        height="24"
                        rx="12"
                        fill="#FFFFFF"
                        stroke="#E7E9E2"
                        strokeWidth="1.2"
                      />
                      <text
                        x="0"
                        y="3"
                        textAnchor="middle"
                        fill="#173F2B"
                        fontSize="9.5"
                        fontWeight="600"
                        fontFamily="sans-serif"
                      >
                        {zone.cropName || zone.diseaseName || zone.name}
                      </text>
                      {zone.areaAcres !== undefined && (
                        <text
                          x="0"
                          y="22"
                          textAnchor="middle"
                          fill="#667069"
                          fontSize="8"
                          fontWeight="500"
                          fontFamily="sans-serif"
                        >
                          {zone.areaAcres.toFixed(1)} ac
                        </text>
                      )}
                    </g>
                  )}
                </g>
              );
            })}

          {/* 3. Rubberband Line in Draw Mode */}
          {mode === 'draw' && projectedBoundaryPoints.length > 0 && cursorCanvas && (
            <line
              x1={projectedBoundaryPoints[projectedBoundaryPoints.length - 1].x}
              y1={projectedBoundaryPoints[projectedBoundaryPoints.length - 1].y}
              x2={cursorCanvas.x}
              y2={cursorCanvas.y}
              stroke="#173F2B"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          )}

          {/* 4. Polygon Vertices & Midpoint Handles */}
          {projectedBoundaryPoints.map((pt, idx) => {
            const isStartPoint = idx === 0;
            const isNearbyStart =
              mode === 'draw' &&
              projectedBoundaryPoints.length >= 3 &&
              cursorCanvas &&
              Math.hypot(cursorCanvas.x - pt.x, cursorCanvas.y - pt.y) < 22 / zoom;

            // Compute midpoint to next vertex for edit mode
            const nextPt = projectedBoundaryPoints[(idx + 1) % projectedBoundaryPoints.length];
            const midX = (pt.x + nextPt.x) / 2;
            const midY = (pt.y + nextPt.y) / 2;

            return (
              <g key={`vertex-${idx}`}>
                {/* Midpoint '+' handle in edit mode */}
                {mode === 'edit' && projectedBoundaryPoints.length >= 3 && (
                  <g
                    transform={`translate(${midX}, ${midY})`}
                    className="cursor-copy"
                    onClick={(e) => handleInsertMidpoint(idx, e)}
                  >
                    <circle r={6.5 / zoom} fill="#B9784F" stroke="#FFFFFF" strokeWidth="1.5" />
                    <text
                      x="0"
                      y={3 / zoom}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize={8 / zoom}
                      fontWeight="bold"
                    >
                      +
                    </text>
                  </g>
                )}

                {/* Vertex Node */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isNearbyStart ? 9 / zoom : mode === 'edit' ? 7 / zoom : 5.5 / zoom}
                  fill={
                    isNearbyStart
                      ? '#6F9B55'
                      : isStartPoint
                      ? '#173F2B'
                      : mode === 'edit'
                      ? '#B9784F'
                      : '#173F2B'
                  }
                  stroke="#FFFFFF"
                  strokeWidth={2 / zoom}
                  className={`transition ${
                    mode === 'edit'
                      ? 'cursor-grab hover:fill-[#B9784F]/80 active:cursor-grabbing'
                      : ''
                  }`}
                  onMouseDown={(e) => {
                    if (mode === 'edit') {
                      e.stopPropagation();
                      setDraggedVertexIndex(idx);
                    }
                  }}
                  onContextMenu={(e) => handleDeleteVertex(idx, e)}
                />

                {/* Start Point indicator in Draw mode */}
                {isStartPoint && mode === 'draw' && (
                  <g transform={`translate(${pt.x}, ${pt.y - 14 / zoom})`} pointerEvents="none">
                    <rect
                      x={-28 / zoom}
                      y={-10 / zoom}
                      width={56 / zoom}
                      height={14 / zoom}
                      rx={7 / zoom}
                      fill="#173F2B"
                    />
                    <text
                      x="0"
                      y={0}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize={8 / zoom}
                      fontWeight="bold"
                    >
                      START
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Farm Info Drawer / Floating Panel */}
      {showStatsOverlay && (
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
          {/* Refined White Card for Area & Perimeter */}
          <div className="flex items-center gap-3.5 rounded-2xl border border-[#E7E9E2] bg-white p-3 shadow-xs">
            <div>
              <span className="block text-[10px] font-semibold tracking-wider text-[#26312A]/60 uppercase">
                Farm Cadastre Area
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-[#173F2B]">
                  {stats.acres > 0 ? stats.acres.toFixed(2) : farm?.areaAcres ? farm.areaAcres.toFixed(2) : '0.00'}
                </span>
                <span className="text-xs font-semibold text-[#173F2B]">Acres</span>
                <span className="text-xs text-[#26312A]/60">
                  (
                  {stats.sqM > 0
                    ? stats.sqM.toLocaleString('en-IN')
                    : farm?.areaSqM
                    ? farm.areaSqM.toLocaleString('en-IN')
                    : '0'}{' '}
                  m²)
                </span>
              </div>
            </div>

            <div className="h-7 w-px bg-[#E7E9E2]" />

            <div>
              <span className="block text-[10px] font-semibold tracking-wider text-[#26312A]/60 uppercase">
                Perimeter
              </span>
              <span className="text-xs font-semibold text-[#173F2B]">
                {formatPerimeter(stats.perimeterM)}
              </span>
            </div>

            <span className="hidden rounded-full bg-[#DCE8D3] px-2.5 py-0.5 text-[10px] font-semibold text-[#173F2B] border border-[#DCE8D3] sm:inline-block">
              Turf.js Code-Verified
            </span>
          </div>

          {/* Active Mode Pill */}
          {mode === 'draw' && (
            <div className="flex items-center gap-1.5 rounded-2xl border border-[#173F2B] bg-[#173F2B] px-3.5 py-2 text-xs font-semibold text-white shadow-xs">
              <Crosshair className="h-3.5 w-3.5 text-[#DCE8D3]" />
              <span>Click to add boundary points ({points.length} placed)</span>
            </div>
          )}

          {mode === 'edit' && (
            <div className="flex items-center gap-1.5 rounded-2xl border border-[#B9784F] bg-[#B9784F] px-3.5 py-2 text-xs font-semibold text-white shadow-xs">
              <Info className="h-3.5 w-3.5 text-[#F1D98A]" />
              <span>Drag vertices | Click &apos;+&apos; to add midpoint | Right-click to remove</span>
            </div>
          )}
        </div>
      )}

      {/* Floating Controls (Zoom, Pan Reset, Compass) */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-center gap-1.5">
        <div className="flex flex-col rounded-2xl border border-[#E7E9E2] bg-white p-1 shadow-xs">
          <button
            onClick={handleZoomIn}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-[#26312A] transition hover:bg-[#F7F7F0] hover:text-[#173F2B]"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <div className="h-px w-full bg-[#E7E9E2]" />
          <button
            onClick={handleZoomOut}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-[#26312A] transition hover:bg-[#F7F7F0] hover:text-[#173F2B]"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <div className="h-px w-full bg-[#E7E9E2]" />
          <button
            onClick={handleResetView}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-[#26312A] transition hover:bg-[#F7F7F0] hover:text-[#173F2B]"
            title="Reset View & Scale"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* North Indicator / Compass */}
        <div
          className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[#E7E9E2] bg-white shadow-xs"
          title="North Indicator"
        >
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-[#B9784F] leading-none">N</span>
            <Compass className="h-4 w-4 text-[#173F2B]" />
          </div>
        </div>
      </div>

      {/* Bottom Floating Bar: Cursor Coordinates & Scale */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 text-[11px] text-[#26312A]">
        <div className="rounded-xl border border-[#E7E9E2] bg-white px-3 py-1.5 shadow-xs font-mono text-xs text-[#26312A]">
          {cursorGeo ? (
            <span>
              {cursorGeo[0].toFixed(5)}° E, {cursorGeo[1].toFixed(5)}° N
            </span>
          ) : (
            <span>Hover on canvas for coordinates</span>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-[#E7E9E2] bg-white px-3 py-1.5 shadow-xs">
          <div className="h-1.5 w-10 border-b-2 border-l-2 border-r-2 border-[#173F2B]" />
          <span className="text-[10px] font-medium text-[#26312A]">~100m scale</span>
        </div>
      </div>

      {/* Bottom-right Legend Overlay */}
      {showLegend && (
        <div className="absolute bottom-3 right-3 z-10 hidden md:block max-w-xs">
          <MapLegend
            showZones={showZonesLayer}
            onToggleZones={() => setShowZonesLayer((v) => !v)}
            showGrid={showGridLayer}
            onToggleGrid={() => setShowGridLayer((v) => !v)}
            showLabels={showLabelsLayer}
            onToggleLabels={() => setShowLabelsLayer((v) => !v)}
          />
        </div>
      )}

      {/* Zone Hover Tooltip */}
      {hoveredZone && (
        <div className="pointer-events-none absolute bottom-14 left-3 z-20 rounded-2xl border border-[#E7E9E2] bg-white p-3 shadow-md text-xs text-[#26312A]">
          <div className="flex items-center gap-1.5 font-bold text-[#173F2B]">
            {hoveredZone.type === 'crop' && <Sprout className="h-3.5 w-3.5 text-[#173F2B]" />}
            {hoveredZone.type === 'disease' && <ShieldAlert className="h-3.5 w-3.5 text-[#B9784F]" />}
            {hoveredZone.type === 'spray' && <Plane className="h-3.5 w-3.5 text-[#173F2B]" />}
            <span>{hoveredZone.name}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[#26312A]/80">
            {hoveredZone.cropName && <span>Crop: {hoveredZone.cropName}</span>}
            {hoveredZone.areaAcres !== undefined && (
              <span className="font-semibold text-[#173F2B]">
                Area: {hoveredZone.areaAcres.toFixed(1)} Acres
              </span>
            )}
            {hoveredZone.severity && (
              <span className="capitalize text-[#B9784F] font-semibold">
                Severity: {hoveredZone.severity}
              </span>
            )}
          </div>
          {hoveredZone.notes && <p className="mt-1 text-[11px] text-[#26312A]/70">{hoveredZone.notes}</p>}
        </div>
      )}
    </div>
  );
}
