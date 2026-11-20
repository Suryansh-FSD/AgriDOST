'use client';

import React from 'react';
import {
  PenTool,
  Move,
  RotateCcw,
  CheckCircle2,
  Save,
  Download,
  Sparkles,
  Satellite,
  Compass,
  Undo2,
  Layers,
} from 'lucide-react';

export type MapInteractionMode = 'view' | 'draw' | 'edit';
export type MapRendererMode = 'vector' | 'satellite';

export interface DrawingToolbarProps {
  mode: MapInteractionMode;
  onChangeMode: (mode: MapInteractionMode) => void;
  rendererMode: MapRendererMode;
  onChangeRendererMode: (mode: MapRendererMode) => void;
  draftPointsCount: number;
  canFinishDrawing: boolean;
  onUndoPoint?: () => void;
  onFinishDrawing?: () => void;
  onResetPoints: () => void;
  onSaveBoundary: () => void;
  onLoadDemoBoundary: () => void;
  onExportGeoJson?: () => void;
  isDirty?: boolean;
  isSaving?: boolean;
  hasGoogleKey?: boolean;
  className?: string;
}

export function DrawingToolbar({
  mode,
  onChangeMode,
  rendererMode,
  onChangeRendererMode,
  draftPointsCount,
  canFinishDrawing,
  onUndoPoint,
  onFinishDrawing,
  onResetPoints,
  onSaveBoundary,
  onLoadDemoBoundary,
  onExportGeoJson,
  isDirty = false,
  isSaving = false,
  hasGoogleKey = false,
  className = '',
}: DrawingToolbarProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[#E7E9E2] bg-white p-2.5 sm:p-3 shadow-xs ${className}`}
    >
      {/* Left: Tool Modes */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* View Mode */}
        <button
          type="button"
          onClick={() => onChangeMode('view')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
            mode === 'view'
              ? 'bg-[#173F2B] text-white shadow-xs'
              : 'text-[#26312A] hover:bg-[#F7F7F0] hover:text-[#173F2B]'
          }`}
          title="Pan & Inspect farm layers"
        >
          <Move className="h-3.5 w-3.5" />
          <span>View & Pan</span>
        </button>

        {/* Draw Mode */}
        <button
          type="button"
          onClick={() => onChangeMode('draw')}
          className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
            mode === 'draw'
              ? 'bg-[#173F2B] text-white shadow-xs ring-2 ring-[#6F9B55]/50'
              : 'text-[#26312A] hover:bg-[#F7F7F0] hover:text-[#173F2B]'
          }`}
          title="Click vertices on map to plot boundary polygon"
        >
          <PenTool className="h-3.5 w-3.5" />
          <span>Draw Boundary</span>
          {mode === 'draw' && draftPointsCount > 0 && (
            <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
              {draftPointsCount} pts
            </span>
          )}
        </button>

        {/* Edit Vertices Mode */}
        <button
          type="button"
          onClick={() => onChangeMode('edit')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
            mode === 'edit'
              ? 'bg-[#B9784F] text-white shadow-xs ring-2 ring-[#B9784F]/40'
              : 'text-[#26312A] hover:bg-[#F7F7F0] hover:text-[#173F2B]'
          }`}
          title="Drag and fine-tune polygon vertices"
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Edit Vertices</span>
        </button>

        {/* Draw Mode specific controls: Undo & Finish */}
        {mode === 'draw' && (
          <div className="flex items-center gap-1.5 pl-1.5 border-l border-[#E7E9E2]">
            {onUndoPoint && draftPointsCount > 0 && (
              <button
                type="button"
                onClick={onUndoPoint}
                className="flex items-center gap-1 rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] px-2.5 py-1.5 text-xs font-medium text-[#26312A] hover:bg-white"
                title="Undo last placed point"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Undo</span>
              </button>
            )}

            {canFinishDrawing && onFinishDrawing && (
              <button
                type="button"
                onClick={onFinishDrawing}
                className="flex items-center gap-1.5 rounded-xl bg-[#173F2B] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#173F2B]/90 transition"
                title="Close polygon and finish drawing"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-[#DCE8D3]" />
                <span>Close Polygon</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions, Reset, Demo, Save & View Switcher */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* Reset */}
        <button
          type="button"
          onClick={onResetPoints}
          className="flex items-center gap-1 rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] px-2.5 py-2 text-xs font-medium text-[#26312A] transition hover:bg-white"
          title="Reset unsaved changes to active farm boundary"
        >
          <RotateCcw className="h-3.5 w-3.5 text-[#26312A]/60" />
          <span className="hidden sm:inline">Reset</span>
        </button>

        {/* Load Demo Boundary */}
        <button
          type="button"
          onClick={onLoadDemoBoundary}
          className="flex items-center gap-1 rounded-xl border border-[#DCE8D3] bg-[#DCE8D3]/40 px-2.5 py-2 text-xs font-semibold text-[#173F2B] transition hover:bg-[#DCE8D3]"
          title="Load pre-calibrated GPS boundary coordinates from demo farm"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#173F2B]" />
          <span className="hidden md:inline">Load Demo Boundary</span>
          <span className="md:hidden">Demo</span>
        </button>

        {/* Export GeoJSON */}
        {onExportGeoJson && (
          <button
            type="button"
            onClick={onExportGeoJson}
            className="flex items-center gap-1 rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] px-2.5 py-2 text-xs font-medium text-[#26312A] transition hover:bg-white"
            title="Download GeoJSON RFC 7946 Polygon"
          >
            <Download className="h-3.5 w-3.5 text-[#26312A]/60" />
            <span className="hidden lg:inline">GeoJSON</span>
          </button>
        )}

        {/* Save Boundary Button */}
        <button
          type="button"
          onClick={onSaveBoundary}
          disabled={isSaving}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition ${
            isDirty
              ? 'bg-[#173F2B] hover:bg-[#173F2B]/90 ring-2 ring-[#6F9B55]/50'
              : 'bg-[#173F2B] hover:bg-[#173F2B]/90'
          } ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
          title="Save farm boundary to active farm in storage"
        >
          <Save className="h-3.5 w-3.5 text-[#DCE8D3]" />
          <span>{isSaving ? 'Saving...' : 'Save Boundary'}</span>
        </button>

        {/* Map Engine View Toggle: Vector vs Satellite */}
        <div className="ml-1 flex items-center rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] p-0.5">
          <button
            type="button"
            onClick={() => onChangeRendererMode('vector')}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition ${
              rendererMode === 'vector'
                ? 'bg-white text-[#173F2B] font-semibold shadow-xs'
                : 'text-[#26312A]/70 hover:text-[#26312A]'
            }`}
            title="Precision Cadastre Blueprint (Offline & 100% functional without API keys)"
          >
            <Layers className="h-3 w-3" />
            <span>Cadastre</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeRendererMode('satellite')}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition ${
              rendererMode === 'satellite'
                ? 'bg-white text-[#173F2B] font-semibold shadow-xs'
                : 'text-[#26312A]/70 hover:text-[#26312A]'
            }`}
            title={
              hasGoogleKey
                ? 'Google Satellite & Hybrid View'
                : 'Satellite view (Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)'
            }
          >
            <Satellite className="h-3 w-3" />
            <span>Satellite</span>
            {!hasGoogleKey && (
              <span className="text-[9px] text-[#B9784F] font-bold ml-0.5">!</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
