'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Camera,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Layers,
  CheckCircle2,
  Calendar,
  Key,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { AIHealthResponse, HealthApiResponse, FallbackDiagnosticGuide } from '@/lib/ai/schemas';
import { HealthObservation, Farm, FarmZone, SprayOperation } from '@/types';
import {
  getFarms,
  getActiveFarmId,
  getFarmZones,
  getHealthObservations,
  subscribeToDataChanges,
} from '@/lib/data/storage';
import { DEMO_LEAF_PRESETS, DemoLeafPreset } from './demo-presets';
import { DiagnosticReport } from './DiagnosticReport';

export interface CropHealthScannerProps {
  initialFarmId?: string;
  onRecordSaved?: (record: HealthObservation) => void;
  onSprayPlanned?: (sprayOp: SprayOperation) => void;
}

const SCAN_STAGES = [
  'Calibrating optical resolution & leaf color balance...',
  'Analyzing leaf venation & structural tissue margins...',
  'Detecting chlorosis, necrotic lesions & pustule patterns...',
  'Cross-referencing agronomic pathologies & ICAR database...',
  'Formulating anti-hallucination differential diagnosis...',
];

export function CropHealthScanner({
  initialFarmId,
  onRecordSaved,
  onSprayPlanned,
}: CropHealthScannerProps) {
  // Farm & Zone Selection
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [zones, setZones] = useState<FarmZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [cropName, setCropName] = useState<string>('');
  const [farmerNotes, setFarmerNotes] = useState<string>('');

  // Image & Upload State
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<DemoLeafPreset | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Scanning & API State
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStageIndex, setScanStageIndex] = useState<number>(0);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [analysisResult, setAnalysisResult] = useState<AIHealthResponse | null>(null);
  const [fallbackGuide, setFallbackGuide] = useState<FallbackDiagnosticGuide | null>(null);
  const [apiUnavailableMessage, setApiUnavailableMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isApiKeyAvailable, setIsApiKeyAvailable] = useState<boolean | null>(null);

  // Previous Records
  const [recentRecords, setRecentRecords] = useState<HealthObservation[]>([]);

  // DOM Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Initialize Farm Data & Storage Listener
  useEffect(() => {
    const loadData = () => {
      const allFarms = getFarms();
      setFarms(allFarms);
      const activeId = initialFarmId || getActiveFarmId() || allFarms[0]?.id || '';
      setSelectedFarmId(activeId);

      if (activeId) {
        const farmZones = getFarmZones(activeId);
        setZones(farmZones);
        setRecentRecords(getHealthObservations(activeId));
      }
    };

    loadData();
    const unsubscribe = subscribeToDataChanges(loadData);
    return () => unsubscribe();
  }, [initialFarmId]);

  // Update zones when selected farm changes
  useEffect(() => {
    if (selectedFarmId) {
      const farmZones = getFarmZones(selectedFarmId);
      setZones(farmZones);
      setRecentRecords(getHealthObservations(selectedFarmId));
      setSelectedZoneId('');
    }
  }, [selectedFarmId]);

  // Check API health status on mount
  useEffect(() => {
    async function checkApiStatus() {
      try {
        const res = await fetch('/api/ai/health');
        if (res.ok) {
          const data = await res.json();
          setIsApiKeyAvailable(data.apiKeyConfigured);
        } else {
          setIsApiKeyAvailable(false);
        }
      } catch {
        setIsApiKeyAvailable(false);
      }
    }
    checkApiStatus();
  }, []);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  // Convert uploaded file to base64 Data URL
  const processSelectedFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPEG, PNG, WEBP).');
      return;
    }
    setErrorMessage(null);
    setSelectedPreset(null);
    setAnalysisResult(null);
    setFallbackGuide(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImagePreviewUrl(result);
    };
    reader.readAsDataURL(file);
  };

  // Select a preset leaf photograph
  const handleSelectPreset = (preset: DemoLeafPreset) => {
    setSelectedPreset(preset);
    setImagePreviewUrl(preset.imageDataUrl);
    setCropName(preset.crop);
    setAnalysisResult(null);
    setFallbackGuide(null);
    setErrorMessage(null);
  };

  // Execute Gemini AI Crop Health Analysis
  const handleStartScan = async () => {
    if (!imagePreviewUrl) return;

    setIsScanning(true);
    setScanStageIndex(0);
    setScanProgress(5);
    setErrorMessage(null);
    setAnalysisResult(null);
    setFallbackGuide(null);

    // Progressive multi-stage scanning animation using Forest Green & Sage
    const stageTimer = setInterval(() => {
      setScanStageIndex((prev) => (prev < SCAN_STAGES.length - 1 ? prev + 1 : prev));
      setScanProgress((prev) => Math.min(prev + 20, 95));
    }, 550);

    try {
      const response = await fetch('/api/ai/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imagePreviewUrl,
          cropName: cropName.trim() || undefined,
          farmId: selectedFarmId || undefined,
          zoneId: selectedZoneId || undefined,
          additionalNotes: farmerNotes.trim() || undefined,
        }),
      });

      clearInterval(stageTimer);
      setScanProgress(100);

      const result: HealthApiResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Server error processing vision diagnosis.');
      }

      if (result.status === 'unavailable') {
        // Truthful API key missing state
        setApiUnavailableMessage(result.message || 'GEMINI_API_KEY is not configured on the server.');
        setFallbackGuide(result.fallbackGuide || null);
      } else if (result.data) {
        setAnalysisResult(result.data);
      }
    } catch (err: unknown) {
      clearInterval(stageTimer);
      const msg = err instanceof Error ? err.message : 'Failed to complete vision diagnosis.';
      setErrorMessage(msg);
    } finally {
      setIsScanning(false);
    }
  };

  // Clear / Reset Scanner
  const handleReset = () => {
    setImagePreviewUrl(null);
    setSelectedPreset(null);
    setAnalysisResult(null);
    setFallbackGuide(null);
    setErrorMessage(null);
    setScanProgress(0);
    setCropName('');
    setFarmerNotes('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Load preset pre-diagnosis when running in demo/offline mode
  const handleLoadPresetDiagnosis = () => {
    if (selectedPreset) {
      setAnalysisResult(selectedPreset.presetResponse);
      setFallbackGuide(null);
      setApiUnavailableMessage(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Module Title & Engine Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E7E9E2]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6F9B55] mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#6F9B55]" />
            <span>Multi-Modal Foliar Pathology &bull; Gemini 2.5 Flash</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#173F2B] tracking-tight">
            Crop Health & AI Pathology Scanner
          </h1>
          <p className="text-sm text-[#26312A]/80 mt-1">
            Identify visible foliar symptoms, differential diagnoses, and precision spray advisories.
          </p>
        </div>

        {/* Live Engine Status Pill */}
        <div className="flex items-center gap-2">
          {isApiKeyAvailable === true ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#DCE8D3] text-[#173F2B] border border-[#6F9B55]/30">
              <span className="w-2 h-2 rounded-full bg-[#173F2B] animate-pulse" />
              Gemini Vision Live
            </div>
          ) : isApiKeyAvailable === false ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#F1D98A]/30 text-[#8C6D1F] border border-[#F1D98A]">
              <span className="w-2 h-2 rounded-full bg-[#8C6D1F]" />
              Demo / Protocol Mode
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-white text-[#26312A]/70 border border-[#E7E9E2]">
              <RefreshCw className="w-3 h-3 animate-spin text-[#173F2B]" />
              Checking Engine
            </div>
          )}
        </div>
      </div>

      {/* Target Farm & Zone Selector (Refined White Card) */}
      <div className="bg-white p-5 rounded-2xl border border-[#E7E9E2] shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-bold text-[#173F2B]/80 uppercase tracking-wider mb-1.5">
            Target Farm
          </label>
          <select
            value={selectedFarmId}
            onChange={(e) => setSelectedFarmId(e.target.value)}
            className="w-full bg-[#F7F7F0] border border-[#E7E9E2] rounded-xl px-3.5 py-2.5 text-sm text-[#26312A] font-medium focus:outline-none focus:border-[#173F2B] focus:bg-white transition-colors"
          >
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.areaAcres.toFixed(1)} ac)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#173F2B]/80 uppercase tracking-wider mb-1.5">
            Farm Zone (Optional)
          </label>
          <select
            value={selectedZoneId}
            onChange={(e) => setSelectedZoneId(e.target.value)}
            className="w-full bg-[#F7F7F0] border border-[#E7E9E2] rounded-xl px-3.5 py-2.5 text-sm text-[#26312A] font-medium focus:outline-none focus:border-[#173F2B] focus:bg-white transition-colors"
          >
            <option value="">-- All / General Farm --</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} ({z.type})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#173F2B]/80 uppercase tracking-wider mb-1.5">
            Crop Species
          </label>
          <input
            type="text"
            placeholder="e.g. Cotton, Soybean, Tomato"
            value={cropName}
            onChange={(e) => setCropName(e.target.value)}
            className="w-full bg-[#F7F7F0] border border-[#E7E9E2] rounded-xl px-3.5 py-2.5 text-sm text-[#26312A] font-medium placeholder-[#26312A]/40 focus:outline-none focus:border-[#173F2B] focus:bg-white transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#173F2B]/80 uppercase tracking-wider mb-1.5">
            Field Notes (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Yellowing after heavy rain"
            value={farmerNotes}
            onChange={(e) => setFarmerNotes(e.target.value)}
            className="w-full bg-[#F7F7F0] border border-[#E7E9E2] rounded-xl px-3.5 py-2.5 text-sm text-[#26312A] font-medium placeholder-[#26312A]/40 focus:outline-none focus:border-[#173F2B] focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Main Scanner Section */}
      {!analysisResult && !fallbackGuide && (
        <div className="space-y-6">
          {/* Upload / Capture Stage */}
          {!imagePreviewUrl ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`bg-white border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all shadow-xs ${
                isDragging
                  ? 'border-[#173F2B] bg-[#DCE8D3]/20'
                  : 'border-[#E7E9E2] hover:border-[#6F9B55]'
              }`}
            >
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#DCE8D3] text-[#173F2B] flex items-center justify-center mx-auto shadow-xs">
                  <Upload className="w-7 h-7 text-[#173F2B]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#173F2B]">
                    Upload Diseased Plant Photograph
                  </h3>
                  <p className="text-xs sm:text-sm text-[#26312A]/70 mt-1 max-w-sm mx-auto">
                    Drag and drop a clear close-up leaf photograph, or select from your camera / gallery.
                  </p>
                </div>

                {/* Upload Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-[#173F2B] hover:bg-[#123222] active:scale-95 text-white transition-colors shadow-xs"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Browse Photos
                  </button>

                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-white hover:bg-[#F7F7F0] active:scale-95 text-[#173F2B] border border-[#E7E9E2] transition-colors shadow-xs"
                  >
                    <Camera className="w-4 h-4 text-[#6F9B55]" />
                    Open Camera
                  </button>

                  {/* Hidden inputs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && processSelectedFile(e.target.files[0])}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => e.target.files?.[0] && processSelectedFile(e.target.files[0])}
                    className="hidden"
                  />
                </div>

                <div className="text-[11px] text-[#26312A]/50 pt-2">
                  Recommended: Macro shot of leaf upper or lower surface with natural lighting.
                </div>
              </div>
            </div>
          ) : (
            /* Image Preview & Inspection Trigger */
            <div className="bg-white border border-[#E7E9E2] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                {/* Image Container with Refined Scanning Radar Overlay */}
                <div className="relative aspect-square max-w-md mx-auto w-full rounded-2xl overflow-hidden border border-[#E7E9E2] bg-[#F7F7F0] shadow-xs flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreviewUrl}
                    alt="Leaf Preview for Diagnostics"
                    className="w-full h-full object-contain"
                  />

                  {/* Active Scanning Holographic Overlay with Forest Green & Sage */}
                  {isScanning && (
                    <div className="absolute inset-0 bg-[#173F2B]/35 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center space-y-4">
                      <div className="relative w-20 h-20 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-2 border-[#DCE8D3] animate-ping opacity-75" />
                        <div className="w-16 h-16 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <Sparkles className="w-7 h-7 text-white absolute" />
                      </div>
                      <div className="space-y-1">
                        <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#DCE8D3] text-[#173F2B] border border-[#6F9B55]/30">
                          Step {scanStageIndex + 1} of {SCAN_STAGES.length}
                        </div>
                        <div className="text-sm font-bold text-white tracking-wide mt-1">
                          {SCAN_STAGES[scanStageIndex]}
                        </div>
                        <div className="text-xs text-[#DCE8D3] font-mono">
                          Agronomic Vision Processing: {scanProgress}%
                        </div>
                      </div>
                      {/* Step Progress Bar */}
                      <div className="w-full max-w-xs h-2 bg-white/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white transition-all duration-300 rounded-full"
                          style={{ width: `${scanProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Metadata & Actions Panel */}
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#6F9B55]">
                      Foliar Specimen Ready
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold text-[#173F2B] mt-1">
                      {selectedPreset ? selectedPreset.name : 'Custom Leaf Photograph'}
                    </h3>
                    <p className="text-xs text-[#26312A]/80 mt-1 leading-relaxed">
                      {selectedPreset
                        ? selectedPreset.description
                        : 'Image loaded successfully. Confirm crop details and trigger Gemini 2.5 Flash analysis below.'}
                    </p>
                  </div>

                  <div className="space-y-2 bg-[#F7F7F0] p-4 rounded-xl border border-[#E7E9E2] text-xs">
                    <div className="flex justify-between py-1 border-b border-[#E7E9E2]">
                      <span className="text-[#26312A]/60 font-medium">Target Farm:</span>
                      <span className="text-[#173F2B] font-mono font-bold">
                        {farms.find((f) => f.id === selectedFarmId)?.name || selectedFarmId || 'Default Farm'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#E7E9E2]">
                      <span className="text-[#26312A]/60 font-medium">Target Sector/Zone:</span>
                      <span className="text-[#173F2B] font-mono font-bold">
                        {zones.find((z) => z.id === selectedZoneId)?.name || 'General Plot'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-[#26312A]/60 font-medium">Identified Crop:</span>
                      <span className="text-[#6F9B55] font-bold">
                        {cropName || 'Auto-detect by Vision Model'}
                      </span>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="space-y-3">
                    <button
                      onClick={handleStartScan}
                      disabled={isScanning}
                      className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-[#173F2B] hover:bg-[#123222] active:scale-[0.98] text-white shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isScanning ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Analyzing Foliar Pathology...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Analyze Leaf with Gemini 2.5 Flash
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleReset}
                      disabled={isScanning}
                      className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-[#26312A]/70 hover:text-[#173F2B] hover:bg-[#F7F7F0] border border-[#E7E9E2] transition-colors"
                    >
                      Change Photograph / Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sample Diseased Leaf Photographs (Clean Demo Presets Carousel) */}
          <div className="bg-white border border-[#E7E9E2] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#173F2B] uppercase tracking-wider">
                <Layers className="w-4 h-4 text-[#6F9B55]" />
                <span>Test Presets: Verified Agricultural Leaf Pathology Samples</span>
              </div>
              <span className="text-[11px] text-[#26312A]/60 hidden sm:inline">
                Click any specimen to load and test immediately
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {DEMO_LEAF_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`text-left p-3 rounded-xl border transition-all duration-200 group flex flex-col justify-between ${
                    selectedPreset?.id === preset.id
                      ? 'bg-white border-2 border-[#173F2B] shadow-xs'
                      : 'bg-[#F7F7F0] hover:bg-white border-[#E7E9E2] hover:border-[#6F9B55]'
                  }`}
                >
                  <div className="aspect-square w-full rounded-lg overflow-hidden bg-white mb-2 border border-[#E7E9E2] relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preset.imageDataUrl}
                      alt={preset.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white backdrop-blur-xs">
                      {preset.severity}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-[#6F9B55] uppercase tracking-tight">
                      {preset.crop}
                    </div>
                    <div className="text-xs font-bold text-[#173F2B] line-clamp-1 group-hover:text-[#6F9B55] transition-colors">
                      {preset.name}
                    </div>
                    <div className="text-[10px] text-[#26312A]/60 mt-0.5 font-medium">
                      Match: {preset.confidenceScore}%
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-[#B9784F]/10 border border-[#B9784F]/30 flex items-start gap-3 text-[#B9784F] text-sm">
          <AlertCircle className="w-5 h-5 text-[#B9784F] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Inspection Error:</span>
            <p className="text-xs text-[#26312A]">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Fallback View: Truthful Pre-Diagnostic Guide when GEMINI_API_KEY is not configured */}
      {fallbackGuide && !analysisResult && (
        <div className="bg-white border border-[#E7E9E2] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-start gap-4 p-5 rounded-xl bg-[#F1D98A]/25 border border-[#F1D98A] text-[#26312A]">
            <Key className="w-6 h-6 text-[#8C6D1F] shrink-0 mt-1" />
            <div className="space-y-2">
              <h3 className="text-base font-bold text-[#173F2B]">
                Live Gemini Vision Diagnostics Currently Offline
              </h3>
              <p className="text-xs text-[#26312A]/80 leading-relaxed">
                {apiUnavailableMessage || fallbackGuide.notice}
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                {selectedPreset && (
                  <button
                    onClick={handleLoadPresetDiagnosis}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#173F2B] hover:bg-[#123222] text-white transition-colors shadow-xs"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#DCE8D3]" />
                    Load Verified Agronomic Diagnosis for {selectedPreset.name}
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#26312A] hover:bg-[#F7F7F0] border border-[#E7E9E2] transition-colors"
                >
                  Back to Scanner
                </button>
              </div>
            </div>
          </div>

          {/* Quick Setup Instructions */}
          <div className="bg-[#F7F7F0] p-5 rounded-xl border border-[#E7E9E2] space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#173F2B]">
              <CheckCircle2 className="w-4 h-4 text-[#173F2B]" />
              <span>How to Activate Live Gemini 2.5 Flash Vision</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-[#26312A]">
              {fallbackGuide.setupInstructions.map((step, idx) => (
                <li key={idx} className="leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Manual Agronomic Field Checklist */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-[#173F2B] uppercase tracking-wider">
              {fallbackGuide.title}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fallbackGuide.manualInspectionChecklist.map((item, idx) => (
                <div key={idx} className="bg-[#F7F7F0] p-4 rounded-xl border border-[#E7E9E2] space-y-1">
                  <div className="text-xs font-bold text-[#173F2B]">{item.title}</div>
                  <p className="text-xs text-[#26312A]/80 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Institutional Agronomic Helplines */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-[#26312A]/70 uppercase tracking-wider">
              Authoritative Extension Services & Laboratory Diagnostics
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {fallbackGuide.institutionalResources.map((res, idx) => (
                <a
                  key={idx}
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-xl bg-[#F7F7F0] hover:bg-white border border-[#E7E9E2] hover:border-[#6F9B55] transition-all flex flex-col justify-between group shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-[#173F2B] group-hover:text-[#6F9B55] transition-colors flex items-center justify-between">
                      <span className="line-clamp-1">{res.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 ml-1 opacity-50 group-hover:opacity-100" />
                    </div>
                    <div className="text-[11px] text-[#26312A]/70">{res.organization}</div>
                  </div>
                  {res.helpline && (
                    <div className="text-[10px] text-[#173F2B] font-mono mt-2 pt-2 border-t border-[#E7E9E2] font-semibold">
                      {res.helpline}
                    </div>
                  )}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Render Diagnostic Report When Analysis Is Completed */}
      {analysisResult && (
        <DiagnosticReport
          report={analysisResult}
          imagePreviewUrl={imagePreviewUrl}
          farmId={selectedFarmId}
          zoneId={selectedZoneId || undefined}
          onSaveToRecords={(saved) => {
            if (onRecordSaved) onRecordSaved(saved);
          }}
          onPlanTreatmentSpray={(obs, sprayOp) => {
            if (onSprayPlanned && sprayOp) onSprayPlanned(sprayOp);
          }}
          onReset={handleReset}
        />
      )}

      {/* Recent Health Observations History for Target Farm */}
      {recentRecords.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-[#E7E9E2]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#173F2B]/80">
              <Calendar className="w-4 h-4 text-[#6F9B55]" />
              <span>Farm Foliar Inspection History ({recentRecords.length} records)</span>
            </div>
            <span className="text-xs text-[#26312A]/60">
              Storage: <span className="font-mono text-[#173F2B]">agridost_health_records</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentRecords.map((rec) => (
              <div
                key={rec.id}
                className="bg-white border border-[#E7E9E2] rounded-xl p-4 space-y-3 hover:border-[#6F9B55] transition-colors shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F9B55]">
                      {rec.cropAffected || 'Crop Inspection'}
                    </span>
                    <h5 className="text-sm font-bold text-[#173F2B] line-clamp-1">
                      {rec.detectedDisease || 'Field Health Observation'}
                    </h5>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                      rec.severity === 'critical'
                        ? 'bg-[#B9784F]/15 text-[#9E4E28] border border-[#B9784F]/30'
                        : rec.severity === 'high'
                        ? 'bg-[#B9784F]/10 text-[#B9784F] border border-[#B9784F]/25'
                        : 'bg-[#DCE8D3]/60 text-[#173F2B] border border-[#6F9B55]/30'
                    }`}
                  >
                    {rec.severity || 'medium'}
                  </span>
                </div>

                <div className="text-xs text-[#26312A]/80 line-clamp-2">
                  {rec.symptoms?.[0] || 'Visual symptoms recorded in farm log.'}
                </div>

                <div className="pt-2 border-t border-[#E7E9E2] flex items-center justify-between text-[11px] text-[#26312A]/60">
                  <span>
                    {rec.createdAt ? new Date(rec.createdAt).toLocaleDateString() : 'Recent'}
                  </span>
                  <span className="font-mono font-semibold text-[#173F2B]">
                    {rec.confidence ? `${rec.confidence.toFixed(1)}% match` : 'Field log'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
