'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Zap,
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  CloudRain,
  TrendingUp,
  Layers,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  N8nEventType,
  N8nExecutionRecord,
  N8nWorkflowDefinition,
  GovernmentAssistancePayload,
  SmartFarmOperationsPayload,
  MarketIntelligencePayload,
  N8nEventEnvelope,
} from '@/types';

interface ManualTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWorkflowId?: 'government-assistance' | 'smart-farm-operations' | 'market-intelligence';
  onExecutionComplete?: (record: N8nExecutionRecord) => void;
  isSimulatedMode?: boolean;
}

// Preset Scenario Types
interface ScenarioPreset {
  id: string;
  workflowId: 'government-assistance' | 'smart-farm-operations' | 'market-intelligence';
  title: string;
  description: string;
  eventType: N8nEventType;
  payload:
    | GovernmentAssistancePayload
    | SmartFarmOperationsPayload
    | MarketIntelligencePayload
    | Record<string, unknown>;
}

const PRESET_SCENARIOS: ScenarioPreset[] = [
  // 1. Government Assistance: Approaching Deadline
  {
    id: 'gov-deadline',
    workflowId: 'government-assistance',
    title: 'PM-KISAN e-KYC Renewal Reminder',
    description: 'Upcoming deadline in 14 days for direct benefit transfer.',
    eventType: 'government.deadline.approaching',
    payload: {
      schemeId: 'pm-kisan',
      schemeName: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)',
      referenceNumber: 'MH-PMKISAN-2026-94812',
      currentStatus: 'submitted',
      statusSource: 'user_reported',
      deadlineDate: '2026-12-15',
      farmerName: 'Ramesh Patil',
      farmerContact: '+91 98765 43210',
      actionRequired: 'Complete biometric e-KYC at nearest CSC center before Dec 15.',
      officialPortalUrl: 'https://pmkisan.gov.in/',
    } as GovernmentAssistancePayload,
  },
  // 2. Government Assistance: Status Changed to Under Review
  {
    id: 'gov-status-change',
    workflowId: 'government-assistance',
    title: 'PMFBY Kharif Status Changed to Under Review',
    description: 'Application moved to verification stage by District Agriculture Officer.',
    eventType: 'government.application.status_changed',
    payload: {
      schemeId: 'pmfby',
      schemeName: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
      referenceNumber: 'PMFBY-2026-MH-440192',
      previousStatus: 'submitted',
      currentStatus: 'under_review',
      statusSource: 'user_reported',
      farmerName: 'Ramesh Patil',
      actionRequired: 'Verify land survey 7/12 documents with local Talathi.',
      officialPortalUrl: 'https://pmfby.gov.in/',
    } as GovernmentAssistancePayload,
  },
  // 3. Operations: Drone Spray Window Safe
  {
    id: 'ops-spray-safe',
    workflowId: 'smart-farm-operations',
    title: 'Drone Spray Window: Optimal Weather (Wind 8 km/h)',
    description: 'Validates safe wind speed, mild temp, 0% rain probability.',
    eventType: 'operations.spray.window_evaluation',
    payload: {
      operationType: 'spray',
      zoneId: 'zone-cotton-01',
      zoneName: 'North Parcel (Cotton)',
      targetCrop: 'Cotton',
      cropVariety: 'Bt Cotton',
      scheduledTime: new Date(Date.now() + 3600000).toISOString(),
      chemicalName: 'Neem-based Bio-Pesticide',
      dosagePerAcre: '250 ml/acre',
      weatherData: {
        temperatureC: 26.5,
        windSpeedKmh: 8.2,
        humidityPct: 62,
        precipitationProbPct: 5,
        condition: 'Clear Sky',
        forecastTimestamp: new Date().toISOString(),
        provider: 'Open-Meteo Agro',
      },
      thresholds: {
        maxWindSpeedKmh: 15.0,
        maxTempC: 34.0,
        minHumidityPct: 40.0,
      },
    } as SmartFarmOperationsPayload,
  },
  // 4. Operations: Drone Spray Window Unsafe (High Wind Alert)
  {
    id: 'ops-spray-unsafe',
    workflowId: 'smart-farm-operations',
    title: 'Drone Spray Alert: High Wind Warning (25 km/h)',
    description: 'Safety guard activates: wind exceeds 15 km/h threshold.',
    eventType: 'operations.spray.window_evaluation',
    payload: {
      operationType: 'spray',
      zoneId: 'zone-soybean-02',
      zoneName: 'East Field (Soybean)',
      targetCrop: 'Soybean',
      scheduledTime: new Date().toISOString(),
      chemicalName: 'Fungicide Spray',
      dosagePerAcre: '200 ml/acre',
      weatherData: {
        temperatureC: 31.0,
        windSpeedKmh: 25.4,
        humidityPct: 48,
        precipitationProbPct: 40,
        condition: 'Gusty Winds',
        forecastTimestamp: new Date().toISOString(),
        provider: 'Open-Meteo Agro',
      },
      thresholds: {
        maxWindSpeedKmh: 15.0,
        maxTempC: 34.0,
        minHumidityPct: 40.0,
      },
    } as SmartFarmOperationsPayload,
  },
  // 5. Market: Soybean Sell Advisory
  {
    id: 'mkt-soybean-sell',
    workflowId: 'market-intelligence',
    title: 'Soybean Mandi Price Check: Target Met (+4.2% Bullish)',
    description: 'Current ₹4,650 vs target ₹4,500. Triggers SELL advisory.',
    eventType: 'market.price.check_requested',
    payload: {
      commodityName: 'Soybean',
      variety: 'Yellow',
      targetMandi: 'Nashik APMC',
      state: 'Maharashtra',
      harvestYieldTonnes: 8.5,
      storedQuantityBags: 120,
      farmerTargetPriceInrPerQtl: 4500,
      currentMandiPriceInrPerQtl: 4680,
      minSupportPriceInrPerQtl: 4892,
      trend7DaysPct: 4.2,
      priceObservationDate: new Date().toISOString().split('T')[0],
      priceDataSource: 'Agmarknet (Govt of India)',
    } as MarketIntelligencePayload,
  },
  // 6. Market: Wheat Below MSP Hold Advisory
  {
    id: 'mkt-wheat-hold',
    workflowId: 'market-intelligence',
    title: 'Wheat Mandi Price Check: Below MSP (Hold Advisory)',
    description: 'Current ₹2,280 vs MSP ₹2,425. Triggers HOLD advisory.',
    eventType: 'market.price.check_requested',
    payload: {
      commodityName: 'Wheat',
      variety: 'Sharbati',
      targetMandi: 'Bhopal APMC',
      state: 'Madhya Pradesh',
      storedQuantityBags: 200,
      farmerTargetPriceInrPerQtl: 2500,
      currentMandiPriceInrPerQtl: 2280,
      minSupportPriceInrPerQtl: 2425,
      trend7DaysPct: -1.8,
      priceObservationDate: new Date().toISOString().split('T')[0],
      priceDataSource: 'Agmarknet (Govt of India)',
    } as MarketIntelligencePayload,
  },
];

export function ManualTriggerModal({
  isOpen,
  onClose,
  initialWorkflowId = 'government-assistance',
  onExecutionComplete,
  isSimulatedMode = true,
}: ManualTriggerModalProps) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<
    'government-assistance' | 'smart-farm-operations' | 'market-intelligence'
  >(initialWorkflowId);

  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [eventType, setEventType] = useState<N8nEventType>('government.deadline.approaching');
  const [payloadJson, setPayloadJson] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<N8nExecutionRecord | null>(null);

  // Sync with initialWorkflowId
  useEffect(() => {
    setSelectedWorkflowId(initialWorkflowId);
    // Select first matching preset
    const firstPreset = PRESET_SCENARIOS.find((p) => p.workflowId === initialWorkflowId);
    if (firstPreset) {
      setSelectedPresetId(firstPreset.id);
      setEventType(firstPreset.eventType);
      setPayloadJson(JSON.stringify(firstPreset.payload, null, 2));
    }
    setExecutionResult(null);
  }, [initialWorkflowId, isOpen]);

  // Handle preset selection
  const handleSelectPreset = (preset: ScenarioPreset) => {
    setSelectedPresetId(preset.id);
    setSelectedWorkflowId(preset.workflowId);
    setEventType(preset.eventType);
    setPayloadJson(JSON.stringify(preset.payload, null, 2));
    setExecutionResult(null);
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExecuting) onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isExecuting]);

  if (!isOpen) return null;

  // Execute Trigger
  const handleExecute = async () => {
    setIsExecuting(true);
    setExecutionResult(null);
    const startTime = Date.now();

    try {
      let parsedPayload: Record<string, unknown> = {};
      try {
        parsedPayload = JSON.parse(payloadJson);
      } catch {
        parsedPayload = { raw: payloadJson };
      }

      const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const farmId = 'demo-farm-01';

      // 1. Attempt Next.js API route dispatch first
      let apiResponseRecord: N8nExecutionRecord | null = null;
      try {
        const res = await fetch('/api/n8n/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflowId: selectedWorkflowId,
            eventType: eventType,
            farmId: farmId,
            farmerId: 'farmer-demo-01',
            payload: parsedPayload,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.executionRecord) {
            apiResponseRecord = data.executionRecord;
          }
        }
      } catch {
        // Fall back to deterministic client-side execution below
      }

      // 2. If API was offline or in simulation mode, execute deterministic simulation
      let record: N8nExecutionRecord;
      if (apiResponseRecord) {
        record = apiResponseRecord;
      } else {
        const durationMs = Date.now() - startTime + Math.floor(Math.random() * 60 + 80);

        let outputSummary = 'Execution completed successfully';
        let outputData: Record<string, unknown> = {};
        let status: N8nExecutionRecord['status'] = 'success';

        if (selectedWorkflowId === 'government-assistance') {
          const schemeName = String(parsedPayload.schemeName || 'Government Scheme');
          const deadline = String(parsedPayload.deadlineDate || '2026-12-15');
          outputSummary = `Validated ${schemeName}: Deadline ${deadline}. Generated 1 SMS alert & calendar reminder.`;
          outputData = {
            schemeName,
            deadlineDate: deadline,
            reminderCreated: true,
            notificationChannel: 'SMS + Push',
            status: 'success',
          };
        } else if (selectedWorkflowId === 'smart-farm-operations') {
          const weather = (parsedPayload.weatherData as Record<string, unknown>) || {};
          const wind = Number(weather.windSpeedKmh) || 10;
          const thresholds = (parsedPayload.thresholds as Record<string, unknown>) || {};
          const maxWind = Number(thresholds.maxWindSpeedKmh) || 15;

          if (wind > maxWind) {
            status = 'failed';
            outputSummary = `SAFETY ALERT: Wind speed ${wind} km/h exceeds threshold (${maxWind} km/h). Spray operation halted.`;
            outputData = {
              operationApproved: false,
              riskLevel: 'high',
              reason: 'Wind speed above maximum threshold for drone drift prevention',
              observedWindKmh: wind,
              maxAllowedWindKmh: maxWind,
            };
          } else {
            status = 'success';
            outputSummary = `OPTIMAL WINDOW APPROVED: Wind ${wind} km/h within safety limits. Spray schedule confirmed.`;
            outputData = {
              operationApproved: true,
              riskLevel: 'optimal',
              observedWindKmh: wind,
              safetyWindowHours: 3.5,
            };
          }
        } else if (selectedWorkflowId === 'market-intelligence') {
          const currentPrice = Number(parsedPayload.currentMandiPriceInrPerQtl) || 4500;
          const targetPrice = Number(parsedPayload.farmerTargetPriceInrPerQtl) || 4400;
          const msp = Number(parsedPayload.minSupportPriceInrPerQtl) || 4200;
          const commodity = String(parsedPayload.commodityName || 'Crop');

          if (currentPrice >= targetPrice) {
            status = 'success';
            outputSummary = `BULLISH ADVISORY: ${commodity} Mandi Price (₹${currentPrice}) meets target (₹${targetPrice}). Recommendation: SELL.`;
            outputData = {
              action: 'SELL',
              currentPriceInrPerQtl: currentPrice,
              targetPriceInrPerQtl: targetPrice,
              mspPriceInrPerQtl: msp,
              expectedMarginPct: Number((((currentPrice - targetPrice) / targetPrice) * 100).toFixed(1)),
            };
          } else {
            status = 'success';
            outputSummary = `HOLD ADVISORY: ${commodity} Price (₹${currentPrice}) is below target (₹${targetPrice}). Recommendation: HOLD.`;
            outputData = {
              action: 'HOLD',
              currentPriceInrPerQtl: currentPrice,
              targetPriceInrPerQtl: targetPrice,
              mspPriceInrPerQtl: msp,
              advisoryNote: 'Price below target threshold. Hold stock for projected seasonal price recovery.',
            };
          }
        }

        record = {
          id: `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          eventId,
          eventType,
          workflowId: selectedWorkflowId,
          farmId,
          status,
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs,
          inputSummary: `${eventType} triggered via Automation Center Manual Tester`,
          outputSummary,
          outputData,
          retryCount: 0,
        };
      }

      setExecutionResult(record);
      onExecutionComplete?.(record);
    } catch (err) {
      console.error('Trigger failed:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-xs transition-opacity duration-200">
      <div
        className="relative w-full max-w-3xl bg-[#FFFFFF] rounded-2xl shadow-2xl border border-[#E7E9E2] flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-6 border-b border-[#E7E9E2] bg-gradient-to-r from-[#F7F7F0] to-[#FFFFFF] relative">
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="absolute top-5 right-5 p-2 rounded-xl text-[#26312A]/60 hover:text-[#26312A] hover:bg-[#E7E9E2]/60 transition-colors disabled:opacity-40"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#DCE8D3] text-[#173F2B] border border-[#4D6B53]/20">
              <Zap className="w-3.5 h-3.5 text-[#173F2B]" />
              Manual Workflow Tester
            </span>
            <span className="text-xs font-medium text-[#26312A]/60">
              {isSimulatedMode ? 'Deterministic Simulation Engine' : 'Live n8n Webhook'}
            </span>
          </div>

          <h2 className="text-2xl font-bold font-heading text-[#173F2B]">
            Trigger n8n Automation Workflow
          </h2>
          <p className="text-sm text-[#26312A]/70 mt-1">
            Select a verified scenario preset or customize JSON payload to test event-driven automation.
          </p>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Workflow Tabs */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#4D6B53] mb-2">
              1. Select Target Workflow
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                {
                  id: 'government-assistance',
                  label: 'Government Assistance',
                  icon: <ShieldCheck className="w-4 h-4 text-emerald-700" />,
                },
                {
                  id: 'smart-farm-operations',
                  label: 'Smart Operations',
                  icon: <CloudRain className="w-4 h-4 text-sky-700" />,
                },
                {
                  id: 'market-intelligence',
                  label: 'Market Intelligence',
                  icon: <TrendingUp className="w-4 h-4 text-amber-700" />,
                },
              ].map((wf) => (
                <button
                  key={wf.id}
                  type="button"
                  onClick={() => {
                    setSelectedWorkflowId(wf.id as any);
                    const matching = PRESET_SCENARIOS.find((p) => p.workflowId === wf.id);
                    if (matching) handleSelectPreset(matching);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2 text-xs font-bold ${
                    selectedWorkflowId === wf.id
                      ? 'bg-[#173F2B] text-white border-[#173F2B] shadow-xs'
                      : 'bg-white border-[#E7E9E2] text-[#26312A]/80 hover:bg-[#F7F7F0]'
                  }`}
                >
                  {wf.icon}
                  <span>{wf.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preset Scenarios Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#4D6B53] mb-2">
              2. Choose Test Scenario Preset
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_SCENARIOS.filter((p) => p.workflowId === selectedWorkflowId).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-3 rounded-xl border text-left transition-all space-y-1 ${
                    selectedPresetId === preset.id
                      ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-[#173F2B]/20'
                      : 'bg-white border-[#E7E9E2] hover:bg-[#F7F7F0]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#173F2B]">{preset.title}</span>
                    {selectedPresetId === preset.id && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#26312A]/70 leading-relaxed">
                    {preset.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Event Type and Customizer */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#4D6B53]">
                3. Event Payload (JSON)
              </label>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[#F7F7F0] border border-[#E7E9E2] text-[#173F2B]">
                {eventType}
              </span>
            </div>

            <textarea
              rows={8}
              value={payloadJson}
              onChange={(e) => setPayloadJson(e.target.value)}
              className="w-full p-3 font-mono text-xs rounded-xl border border-[#E7E9E2] bg-[#F7F7F0]/60 text-[#26312A] focus:outline-hidden focus:ring-2 focus:ring-[#173F2B]/20 focus:bg-white transition-all leading-relaxed"
            />
          </div>

          {/* Live Execution Result Banner */}
          {executionResult && (
            <div
              className={`p-4 rounded-xl border transition-all animate-in fade-in duration-200 ${
                executionResult.status === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50 border-rose-200 text-rose-950'
              }`}
            >
              <div className="flex items-start gap-3">
                {executionResult.status === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wide">
                      Execution Result ({executionResult.status.toUpperCase()})
                    </span>
                    <span className="font-mono text-[11px] font-semibold">
                      {executionResult.durationMs}ms
                    </span>
                  </div>
                  <p className="font-medium text-xs leading-relaxed">
                    {executionResult.outputSummary}
                  </p>
                  {executionResult.outputData && (
                    <pre className="p-2 bg-white/70 rounded-lg font-mono text-[10px] text-[#26312A] mt-1 overflow-x-auto">
                      {JSON.stringify(executionResult.outputData, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-[#E7E9E2] bg-[#F7F7F0] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="px-4 py-2.5 rounded-xl border border-[#E7E9E2] text-sm font-semibold text-[#26312A] hover:bg-white transition-colors disabled:opacity-40"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleExecute}
            disabled={isExecuting}
            className="px-6 py-2.5 rounded-xl bg-[#173F2B] text-white text-sm font-bold hover:bg-[#0f2c1e] transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50"
          >
            {isExecuting ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin text-[#DCE8D3]" />
                <span>Executing Workflow...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-[#DCE8D3] fill-current" />
                <span>Trigger Workflow</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
