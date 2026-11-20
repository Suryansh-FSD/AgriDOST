'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as turf from '@turf/turf';
import {
  Plane,
  Wind,
  Thermometer,
  Droplets,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  Calendar,
  Clock,
  Sliders,
  Check,
  Sparkles,
  Info,
  Maximize2,
  Layers,
  Compass,
  Tractor,
  SprayCan,
  Trash2,
} from 'lucide-react';
import { Farm, FarmZone, SprayOperation, DroneSprayExport, GeoJSONPolygon, Position } from '@/types';
import * as storage from '@/lib/data/storage';

interface DroneSprayPlannerProps {
  farm?: Farm;
  onOperationSaved?: (op: SprayOperation) => void;
}

export function DroneSprayPlanner({ farm: propFarm, onOperationSaved }: DroneSprayPlannerProps) {
  const [activeFarm, setActiveFarm] = useState<Farm | undefined>(propFarm);
  const [zones, setZones] = useState<FarmZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [sprayOps, setSprayOps] = useState<SprayOperation[]>([]);

  // Equipment & Flight Parameters
  const [equipmentType, setEquipmentType] = useState<SprayOperation['equipmentType']>('Drone');
  const [operationType, setOperationType] = useState<SprayOperation['operationType']>('Fungicide');
  const [productName, setProductName] = useState<string>('Bio-Neem 5% + Trichoderma viride Liquid');
  const [dosagePerAcre, setDosagePerAcre] = useState<string>('10 Liters/Acre');
  const [dilutionRatio, setDilutionRatio] = useState<string>('1:100 with water');
  const [flightAltitude, setFlightAltitude] = useState<number>(2.5); // meters
  const [flightSpeed, setFlightSpeed] = useState<number>(14); // km/h
  const [swathWidth, setSwathWidth] = useState<number>(4.5); // meters
  const [nozzleType, setNozzleType] = useState<string>('Centrifugal Atomizer (150-200µm)');
  const [scheduledDateTime, setScheduledDateTime] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(6, 30, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState<string>('Morning thermal inversion window. Calibrated droplet size for high leaf adhesion.');

  // Weather & Safety Simulation
  const [windSpeedKmh, setWindSpeedKmh] = useState<number>(7.5);
  const [temperatureC, setTemperatureC] = useState<number>(25.0);
  const [humidityPct, setHumidityPct] = useState<number>(65);
  const [windDirection, setWindDirection] = useState<string>('NW (315°)');

  // Mandatory Human Verification Checkbox
  const [humanVerified, setHumanVerified] = useState<boolean>(false);

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string; type: 'success' | 'warn' } | null>(null);

  // Sync farm
  useEffect(() => {
    if (propFarm) {
      setActiveFarm(propFarm);
    } else {
      setActiveFarm(storage.getActiveFarm());
    }
  }, [propFarm]);

  // Load zones & spray operations
  const loadData = useCallback(() => {
    if (!activeFarm) return;
    const loadedZones = storage.getFarmZones(activeFarm.id);
    setZones(loadedZones);

    const loadedOps = storage.getSprayOperations(activeFarm.id);
    setSprayOps(loadedOps);

    // Auto-select first disease or spray zone if none selected
    if (!selectedZoneId && loadedZones.length > 0) {
      const priorityZone = loadedZones.find((z) => z.type === 'disease' || z.type === 'spray') || loadedZones[0];
      setSelectedZoneId(priorityZone.id);
    }
  }, [activeFarm, selectedZoneId]);

  useEffect(() => {
    loadData();
    const unsub = storage.subscribeToDataChanges(loadData);
    return () => unsub();
  }, [loadData]);

  // Selected Zone Object
  const selectedZone = useMemo(() => {
    return zones.find((z) => z.id === selectedZoneId) || zones[0];
  }, [zones, selectedZoneId]);

  // Target Geometry (selected zone or full farm boundary fallback)
  const targetGeometry: GeoJSONPolygon | null = useMemo(() => {
    if (selectedZone?.geometry) return selectedZone.geometry;
    if (activeFarm?.boundary) return activeFarm.boundary;
    return null;
  }, [selectedZone, activeFarm]);

  // Deterministic Area Calculation using Turf.js
  const areaCalculation = useMemo(() => {
    if (!targetGeometry || !targetGeometry.coordinates?.[0]?.length) {
      return { areaSqM: 0, areaAcres: 0 };
    }
    try {
      const poly = turf.polygon(targetGeometry.coordinates);
      const sqM = turf.area(poly);
      const acres = sqM / 4046.856;
      return {
        areaSqM: Math.round(sqM),
        areaAcres: Math.round(acres * 100) / 100,
      };
    } catch {
      return { areaSqM: 0, areaAcres: 0 };
    }
  }, [targetGeometry]);

  // Weather & Spray Safety Index Logic
  const safetyEvaluation = useMemo(() => {
    const isUnsafe = windSpeedKmh > 18 || temperatureC > 35 || humidityPct < 40;
    const isCaution =
      !isUnsafe &&
      (windSpeedKmh >= 12 || temperatureC >= 30 || humidityPct <= 50 || humidityPct >= 85);

    if (isUnsafe) {
      let reason = 'High wind velocity risks off-target chemical drift to adjacent fields.';
      if (temperatureC > 35) reason = 'Excessive thermal updrafts cause rapid droplet evaporation before canopy contact.';
      if (humidityPct < 40) reason = 'Low atmospheric humidity causes severe droplet shrinkage and drift loss.';
      return {
        status: 'unsafe' as const,
        label: 'Unsafe for Spraying',
        badgeColor: 'bg-[#B9784F]/15 text-[#9C5832] border-[#B9784F]/40',
        dotColor: 'bg-[#B9784F]',
        reason,
        canExport: false,
      };
    }

    if (isCaution) {
      return {
        status: 'caution' as const,
        label: 'Caution Advisory',
        badgeColor: 'bg-[#F1D98A]/30 text-[#8F6805] border-[#F1D98A]',
        dotColor: 'bg-[#F1D98A]',
        reason: 'Marginal atmospheric conditions. Lower flight altitude to 2.0m, switch to Anti-Drift nozzle, and monitor wind gusts.',
        canExport: true,
      };
    }

    return {
      status: 'optimal' as const,
      label: 'Optimal Spray Window',
      badgeColor: 'bg-[#DCE8D3] text-[#173F2B] border-[#6F9B55]/30',
      dotColor: 'bg-[#6F9B55]',
      reason: 'Ideal calm conditions. Zero thermal turbulence and excellent relative humidity ensure 94%+ canopy deposition.',
      canExport: true,
    };
  }, [windSpeedKmh, temperatureC, humidityPct]);

  // Operational Drone Logistics Calculations
  const droneLogistics = useMemo(() => {
    const acres = areaCalculation.areaAcres || 1;
    const sqM = areaCalculation.areaSqM || 4047;

    const totalLiquidL = Math.round(acres * 10);
    const mPerMin = (flightSpeed * 1000) / 60;
    const areaPerMin = mPerMin * swathWidth;
    const effectiveFlightMinutes = Math.max(3, Math.round((sqM / (areaPerMin * 0.75)) + 2));
    const batteryCycles = Math.max(1, Math.ceil(effectiveFlightMinutes / 16));
    const tankLoads = Math.max(1, Math.ceil(totalLiquidL / 16));

    return {
      totalLiquidL,
      effectiveFlightMinutes,
      batteryCycles,
      tankLoads,
    };
  }, [areaCalculation, flightSpeed, swathWidth]);

  // Weather Presets Handler
  const applyWeatherPreset = (preset: 'dawn' | 'afternoon' | 'dusk') => {
    if (preset === 'dawn') {
      setWindSpeedKmh(6.5);
      setTemperatureC(24.0);
      setHumidityPct(68);
      setWindDirection('WNW (290°)');
    } else if (preset === 'afternoon') {
      setWindSpeedKmh(16.5);
      setTemperatureC(34.5);
      setHumidityPct(38);
      setWindDirection('SW (225°)');
    } else if (preset === 'dusk') {
      setWindSpeedKmh(8.0);
      setTemperatureC(27.0);
      setHumidityPct(58);
      setWindDirection('NNE (030°)');
    }
  };

  // Export GeoJSON file
  const handleExportGeoJson = () => {
    if (!humanVerified) {
      setToastMessage({
        title: 'Human Verification Required',
        desc: 'Please tick the safety verification checkbox before exporting ground control files.',
        type: 'warn',
      });
      return;
    }

    if (!targetGeometry || !activeFarm) return;

    const exportData = {
      type: 'FeatureCollection',
      name: `AgriDOST-SprayMission-${selectedZone?.name || activeFarm.name}`,
      properties: {
        platform: 'AgriDOST Autonomous Drone Spray Planner',
        standard: 'RFC 7946',
        farmId: activeFarm.id,
        farmName: activeFarm.name,
        zoneId: selectedZone?.id || 'full-farm',
        zoneName: selectedZone?.name || 'Full Farm Boundary',
        areaSqM: areaCalculation.areaSqM,
        areaAcres: areaCalculation.areaAcres,
        equipment: equipmentType,
        flightAltitudeMeters: equipmentType === 'Drone' ? flightAltitude : null,
        flightSpeedKmh: equipmentType === 'Drone' ? flightSpeed : null,
        swathWidthMeters: equipmentType === 'Drone' ? swathWidth : null,
        nozzleType: equipmentType === 'Drone' ? nozzleType : null,
        productName,
        dosagePerAcre,
        dilutionRatio,
        windSpeedKmh,
        temperatureC,
        humidityPct,
        safetyStatus: safetyEvaluation.status,
        humanVerified: true,
        exportedAt: new Date().toISOString(),
      },
      features: [
        {
          type: 'Feature',
          properties: {
            featureRole: 'Precision Spray Boundary',
            targetZone: selectedZone?.name || 'Field Perimeter',
            cropAffected: selectedZone?.cropName || activeFarm.primaryCrop || 'Mixed',
          },
          geometry: targetGeometry,
        },
      ],
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const filename = `${activeFarm.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-spray-${selectedZone?.id || 'boundary'}.geojson`;
    downloadFile(jsonStr, filename, 'application/geo+json');

    setToastMessage({
      title: 'GeoJSON RFC 7946 Exported',
      desc: `Saved ${filename} for QGroundControl, Mission Planner, and DJI Agras.`,
      type: 'success',
    });
  };

  // Export Mission Corridor Waypoint CSV
  const handleExportMissionCsv = () => {
    if (!humanVerified) {
      setToastMessage({
        title: 'Human Verification Required',
        desc: 'Please tick the safety verification checkbox before exporting flight corridor waypoints.',
        type: 'warn',
      });
      return;
    }

    if (!targetGeometry || !activeFarm) return;

    const ring = targetGeometry.coordinates[0] || [];
    const lines = [
      '# AgriDOST Drone Mission Corridor Export',
      `# Farm: ${activeFarm.name} | Zone: ${selectedZone?.name || 'Boundary'}`,
      `# Equipment: ${equipmentType} | Alt: ${flightAltitude}m | Speed: ${flightSpeed} km/h`,
      `# Product: ${productName} | Dosage: ${dosagePerAcre} | Safety: ${safetyEvaluation.status}`,
      `# Exported: ${new Date().toISOString()}`,
      'Index,WaypointType,Latitude,Longitude,AltitudeMeters,SpeedKmh,SprayStatus,Param1,Param2',
    ];

    if (ring.length > 0) {
      const [startLng, startLat] = ring[0];
      lines.push(`1,TAKEOFF,${startLat.toFixed(6)},${startLng.toFixed(6)},${flightAltitude},${flightSpeed},OFF,0,0`);

      ring.forEach(([lng, lat], idx) => {
        lines.push(`${idx + 2},WAYPOINT,${lat.toFixed(6)},${lng.toFixed(6)},${flightAltitude},${flightSpeed},ON,0,0`);
      });

      const lastIdx = ring.length + 2;
      lines.push(`${lastIdx},RTL,${startLat.toFixed(6)},${startLng.toFixed(6)},15,${flightSpeed},OFF,0,0`);
    }

    const csvContent = lines.join('\n');
    const filename = `${activeFarm.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-mission-${selectedZone?.id || 'corridor'}.csv`;
    downloadFile(csvContent, filename, 'text/csv');

    setToastMessage({
      title: 'Mission Corridor CSV Exported',
      desc: `Generated ${ring.length + 2} flight waypoints for ground control station import.`,
      type: 'success',
    });
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Save Spray Operation to Storage
  const handleSaveOperation = () => {
    if (!activeFarm) return;

    if (!humanVerified) {
      setToastMessage({
        title: 'Safety Verification Required',
        desc: 'Please verify field wind conditions before saving operation to local registry.',
        type: 'warn',
      });
      return;
    }

    const newOp: SprayOperation = {
      id: `spray-${Date.now()}`,
      farmId: activeFarm.id,
      zoneId: selectedZone?.id,
      operationType,
      productName,
      dosagePerAcre,
      dilutionRatio,
      equipmentType,
      flightAltitudeMeters: equipmentType === 'Drone' ? flightAltitude : undefined,
      speedKmh: equipmentType === 'Drone' ? flightSpeed : undefined,
      windSpeedKmh,
      temperatureC,
      humidityPct,
      safetyStatus: safetyEvaluation.status,
      scheduledTime: new Date(scheduledDateTime).toISOString(),
      status: 'scheduled',
      notes: `${notes} [Verified Buffer: ${humanVerified ? 'Yes' : 'No'}]`,
      isDemo: activeFarm.isDemo ?? false,
    };

    storage.saveSprayOperation(newOp);
    loadData();
    if (onOperationSaved) onOperationSaved(newOp);

    setToastMessage({
      title: 'Spray Operation Scheduled',
      desc: `Saved ${operationType} operation for ${selectedZone?.name || activeFarm.name}.`,
      type: 'success',
    });
  };

  // Delete Spray Operation
  const handleDeleteOperation = (id: string) => {
    const existing = storage.getSprayOperations();
    const updated = existing.filter((o) => o.id !== id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('agridost_spray_operations', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('agridost:data-changed', { detail: { key: 'agridost_spray_operations' } }));
    }
    loadData();
  };

  if (!activeFarm) {
    return (
      <div className="bg-[#F7F7F0] border border-[#E7E9E2] rounded-2xl p-8 text-center text-[#26312A]">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-[#B9784F]" />
        <h3 className="font-semibold text-lg text-[#173F2B]">No Active Farm Selected</h3>
        <p className="text-xs mt-1 text-[#26312A]/70">
          Please select a farm boundary to plan precision drone spraying operations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 animate-fadeIn shadow-xs ${
            toastMessage.type === 'success'
              ? 'bg-[#DCE8D3]/70 border-[#6F9B55]/40 text-[#173F2B]'
              : 'bg-[#B9784F]/15 border-[#B9784F]/40 text-[#9C5832]'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#173F2B] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#B9784F] shrink-0" />
            )}
            <div>
              <p className="font-bold text-sm">{toastMessage.title}</p>
              <p className="text-[#26312A]/80 mt-0.5">{toastMessage.desc}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-[#26312A] border border-[#E7E9E2]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Top Header */}
      <div className="bg-white rounded-2xl border border-[#E7E9E2] shadow-xs p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-[#DCE8D3] text-[#173F2B]">
              <Plane className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[#173F2B]">
                Precision Drone Spray & Flight Corridor Planner
              </h2>
              <p className="text-xs text-[#26312A]/70">
                Weather-calibrated flight paths, spray safety index, and GCS mission export for{' '}
                <span className="font-semibold text-[#173F2B]">{activeFarm.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 font-semibold rounded-full border ${safetyEvaluation.badgeColor}`}>
              <span className={`w-2 h-2 rounded-full ${safetyEvaluation.dotColor}`} />
              {safetyEvaluation.label}
            </span>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#E7E9E2]">
          <div className="p-3.5 bg-[#F7F7F0] rounded-xl border border-[#E7E9E2]">
            <p className="text-[11px] font-medium text-[#26312A]/70 uppercase tracking-wider">Target Spray Area</p>
            <p className="text-xl font-bold text-[#173F2B] mt-0.5">
              {areaCalculation.areaAcres}{' '}
              <span className="text-xs font-normal text-[#26312A]/60">Acres</span>
            </p>
            <p className="text-[11px] text-[#26312A]/60 font-mono mt-0.5">{areaCalculation.areaSqM.toLocaleString('en-IN')} m² [Turf.js]</p>
          </div>

          <div className="p-3.5 bg-[#DCE8D3]/35 rounded-xl border border-[#6F9B55]/25">
            <p className="text-[11px] font-medium text-[#173F2B] uppercase tracking-wider">Flight Time & Batteries</p>
            <p className="text-xl font-bold text-[#173F2B] mt-0.5">
              ~{droneLogistics.effectiveFlightMinutes}{' '}
              <span className="text-xs font-normal text-[#173F2B]/75">min</span>
            </p>
            <p className="text-[11px] text-[#173F2B]/75 mt-0.5">{droneLogistics.batteryCycles} battery cycle(s) @ 14 km/h</p>
          </div>

          <div className="p-3.5 bg-[#F7F7F0] rounded-xl border border-[#E7E9E2]">
            <p className="text-[11px] font-medium text-[#26312A]/70 uppercase tracking-wider">Volume & Refills</p>
            <p className="text-xl font-bold text-[#173F2B] mt-0.5">
              {droneLogistics.totalLiquidL}{' '}
              <span className="text-xs font-normal text-[#26312A]/60">Liters</span>
            </p>
            <p className="text-[11px] text-[#26312A]/60 mt-0.5">{droneLogistics.tankLoads} tank load(s) (16L payload)</p>
          </div>

          <div className="p-3.5 bg-[#F7F7F0] rounded-xl border border-[#E7E9E2]">
            <p className="text-[11px] font-medium text-[#26312A]/70 uppercase tracking-wider">Equipment Mode</p>
            <p className="text-xl font-bold text-[#173F2B] mt-0.5">{equipmentType}</p>
            <p className="text-[11px] text-[#26312A]/60 mt-0.5">Alt: {flightAltitude}m • Swath: {swathWidth}m</p>
          </div>
        </div>
      </div>

      {/* Main 2-Column Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Zone Selection, Weather Simulator, Equipment (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Target Zone Selector Card */}
          <div className="bg-white rounded-2xl border border-[#E7E9E2] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#173F2B] text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#173F2B]" />
                Target Spray Zone
              </h3>
              <span className="text-xs text-[#26312A]/60">
                {zones.length} zone{zones.length !== 1 ? 's' : ''} available
              </span>
            </div>

            {zones.length === 0 ? (
              <div className="p-3.5 bg-[#F7F7F0] rounded-xl border border-[#E7E9E2] text-xs text-[#26312A]/80">
                <p className="font-medium text-[#173F2B]">Targeting Entire Farm Perimeter</p>
                <p className="text-[#26312A]/60 mt-0.5">
                  Using overall {activeFarm.name} boundary ({activeFarm.areaAcres} acres).
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {zones.map((zone) => {
                  const isSelected = zone.id === selectedZoneId;
                  const isDisease = zone.type === 'disease';
                  const isSpray = zone.type === 'spray';

                  return (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => setSelectedZoneId(zone.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-[#173F2B] bg-[#F7F7F0] ring-1 ring-[#173F2B] shadow-xs'
                          : 'border-[#E7E9E2] bg-white hover:border-[#6F9B55]/60 hover:bg-[#F7F7F0]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: zone.color || (isDisease ? '#B9784F' : '#173F2B') }}
                            />
                            <p className="font-semibold text-sm text-[#173F2B]">{zone.name}</p>
                          </div>
                          <p className="text-xs text-[#26312A]/70 mt-1">
                            {zone.cropName ? `Crop: ${zone.cropName}` : 'Field Parcel'} •{' '}
                            {zone.areaAcres ? `${zone.areaAcres} Acres` : 'Calculated on select'}
                            {zone.diseaseName && ` • Target: ${zone.diseaseName}`}
                          </p>
                        </div>

                        <span
                          className={`text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full border ${
                            isDisease
                              ? 'bg-[#B9784F]/15 text-[#9C5832] border-[#B9784F]/30'
                              : isSpray
                              ? 'bg-[#DCE8D3] text-[#173F2B] border-[#6F9B55]/30'
                              : 'bg-[#F7F7F0] text-[#26312A] border-[#E7E9E2]'
                          }`}
                        >
                          {zone.type}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weather & Spray Safety Index Simulator */}
          <div className="bg-white rounded-2xl border border-[#E7E9E2] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#173F2B] text-sm flex items-center gap-2">
                <Wind className="w-4 h-4 text-[#173F2B]" />
                Weather & Spray Safety Simulator
              </h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyWeatherPreset('dawn')}
                  className="text-[11px] px-2.5 py-1 bg-[#DCE8D3]/70 hover:bg-[#DCE8D3] text-[#173F2B] rounded-lg font-medium border border-[#6F9B55]/30"
                >
                  06:30 AM (Optimal)
                </button>
                <button
                  type="button"
                  onClick={() => applyWeatherPreset('afternoon')}
                  className="text-[11px] px-2.5 py-1 bg-[#F7F7F0] hover:bg-[#E7E9E2] text-[#26312A]/80 rounded-lg font-medium border border-[#E7E9E2]"
                >
                  13:30 PM (Hot/Drift)
                </button>
                <button
                  type="button"
                  onClick={() => applyWeatherPreset('dusk')}
                  className="text-[11px] px-2.5 py-1 bg-[#F7F7F0] hover:bg-[#E7E9E2] text-[#26312A]/80 rounded-lg font-medium border border-[#E7E9E2]"
                >
                  17:30 PM (Dusk)
                </button>
              </div>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Wind Speed */}
              <div className="p-3 bg-[#F7F7F0] rounded-xl border border-[#E7E9E2] space-y-2">
                <div className="flex items-center justify-between text-[#26312A]">
                  <span className="flex items-center gap-1 font-semibold">
                    <Wind className="w-3.5 h-3.5 text-[#173F2B]" /> Wind Speed
                  </span>
                  <span className="font-bold text-[#173F2B]">{windSpeedKmh} km/h</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="0.5"
                  value={windSpeedKmh}
                  onChange={(e) => setWindSpeedKmh(parseFloat(e.target.value))}
                  className="w-full accent-[#173F2B]"
                />
                <span className="text-[10px] text-[#26312A]/60 block">Safe threshold: &lt;12 km/h</span>
              </div>

              {/* Temperature */}
              <div className="p-3 bg-[#F7F7F0] rounded-xl border border-[#E7E9E2] space-y-2">
                <div className="flex items-center justify-between text-[#26312A]">
                  <span className="flex items-center gap-1 font-semibold">
                    <Thermometer className="w-3.5 h-3.5 text-[#B9784F]" /> Temperature
                  </span>
                  <span className="font-bold text-[#173F2B]">{temperatureC}°C</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="42"
                  step="0.5"
                  value={temperatureC}
                  onChange={(e) => setTemperatureC(parseFloat(e.target.value))}
                  className="w-full accent-[#B9784F]"
                />
                <span className="text-[10px] text-[#26312A]/60 block">Optimal: 18°C - 30°C</span>
              </div>

              {/* Humidity */}
              <div className="p-3 bg-[#F7F7F0] rounded-xl border border-[#E7E9E2] space-y-2">
                <div className="flex items-center justify-between text-[#26312A]">
                  <span className="flex items-center gap-1 font-semibold">
                    <Droplets className="w-3.5 h-3.5 text-[#6F9B55]" /> Humidity
                  </span>
                  <span className="font-bold text-[#173F2B]">{humidityPct}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="95"
                  step="1"
                  value={humidityPct}
                  onChange={(e) => setHumidityPct(parseInt(e.target.value, 10))}
                  className="w-full accent-[#6F9B55]"
                />
                <span className="text-[10px] text-[#26312A]/60 block">Ideal: 50% - 80%</span>
              </div>
            </div>

            {/* Dynamic Safety Reason Card */}
            <div className={`p-3.5 rounded-xl border text-xs leading-relaxed ${safetyEvaluation.badgeColor}`}>
              <div className="flex items-center gap-2 font-bold mb-1">
                {safetyEvaluation.status === 'optimal' ? (
                  <ShieldCheck className="w-4 h-4 text-[#173F2B]" />
                ) : safetyEvaluation.status === 'caution' ? (
                  <AlertTriangle className="w-4 h-4 text-[#8F6805]" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-[#9C5832]" />
                )}
                <span>{safetyEvaluation.label} Advisory:</span>
              </div>
              <p>{safetyEvaluation.reason}</p>
            </div>
          </div>

          {/* Equipment & Flight Corridor Settings */}
          <div className="bg-white rounded-2xl border border-[#E7E9E2] p-5 shadow-xs space-y-4">
            <h3 className="font-semibold text-[#173F2B] text-sm flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#173F2B]" />
              Equipment & Spray Parameters
            </h3>

            {/* Equipment selection tabs */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'Drone' as const, label: 'Agri Hexacopter', desc: '16L Autonomous', icon: Plane },
                { type: 'Tractor Boom' as const, label: 'Tractor Boom', desc: '12m Hydraulic', icon: Tractor },
                { type: 'Knapsack Sprayer' as const, label: 'Knapsack Sprayer', desc: '16L Manual/Battery', icon: SprayCan },
              ].map((eq) => {
                const isSelected = equipmentType === eq.type;
                const Icon = eq.icon;
                return (
                  <button
                    key={eq.type}
                    type="button"
                    onClick={() => setEquipmentType(eq.type)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-[#173F2B] bg-[#173F2B] text-white shadow-xs'
                        : 'border-[#E7E9E2] bg-white text-[#26312A] hover:bg-[#F7F7F0]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1 ${isSelected ? 'text-[#DCE8D3]' : 'text-[#173F2B]'}`} />
                    <p className="font-bold text-xs">{eq.label}</p>
                    <p className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-[#26312A]/60'}`}>{eq.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Drone Specific Flight Tuning */}
            {equipmentType === 'Drone' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div>
                  <label className="font-semibold text-[#26312A] block mb-1">
                    Flight Altitude: <span className="text-[#173F2B] font-bold">{flightAltitude}m</span>
                  </label>
                  <select
                    value={flightAltitude}
                    onChange={(e) => setFlightAltitude(parseFloat(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-[#E7E9E2] rounded-lg text-[#26312A] bg-[#F7F7F0] focus:outline-none focus:border-[#173F2B]"
                  >
                    <option value={2.0}>2.0 meters (Low Drift)</option>
                    <option value={2.5}>2.5 meters (Recommended)</option>
                    <option value={3.0}>3.0 meters</option>
                    <option value={3.5}>3.5 meters (Wide Swath)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#26312A] block mb-1">
                    Flight Speed: <span className="text-[#173F2B] font-bold">{flightSpeed} km/h</span>
                  </label>
                  <select
                    value={flightSpeed}
                    onChange={(e) => setFlightSpeed(parseFloat(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-[#E7E9E2] rounded-lg text-[#26312A] bg-[#F7F7F0] focus:outline-none focus:border-[#173F2B]"
                  >
                    <option value={10}>10 km/h (Dense Penetration)</option>
                    <option value={14}>14 km/h (Standard)</option>
                    <option value={18}>18 km/h (Rapid Scan)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#26312A] block mb-1">Nozzle Atomizer</label>
                  <select
                    value={nozzleType}
                    onChange={(e) => setNozzleType(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E7E9E2] rounded-lg text-[#26312A] bg-[#F7F7F0] focus:outline-none focus:border-[#173F2B]"
                  >
                    <option value="Centrifugal Atomizer (150-200µm)">Centrifugal (150-200µm)</option>
                    <option value="Anti-Drift Flat Fan (250µm)">Anti-Drift Flat Fan (250µm)</option>
                    <option value="Air Induction Coarse (350µm)">Air Induction (350µm)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Chemical & Formulation Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div>
                <label className="font-semibold text-[#26312A] block mb-1">Product Formulation *</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E7E9E2] bg-[#F7F7F0] rounded-lg text-[#26312A] text-xs focus:outline-none focus:border-[#173F2B]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#26312A] block mb-1">Dilution / Dosage *</label>
                <input
                  type="text"
                  value={dosagePerAcre}
                  onChange={(e) => setDosagePerAcre(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E7E9E2] bg-[#F7F7F0] rounded-lg text-[#26312A] text-xs focus:outline-none focus:border-[#173F2B]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Human Verification & Mission Exports (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Mandatory Human Verification & Action Box */}
          <div className="bg-white rounded-2xl border border-[#E7E9E2] p-5 shadow-xs space-y-4">
            <h3 className="font-semibold text-[#173F2B] text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#173F2B]" />
              Human Verification & Mission Export
            </h3>

            {/* High-Contrast Human Verification Checkbox Card */}
            <div className={`p-4 rounded-xl border transition-colors ${
              humanVerified
                ? 'bg-[#DCE8D3]/40 border-[#6F9B55]/50'
                : 'bg-[#F7F7F0] border-[#E7E9E2]'
            }`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={humanVerified}
                  onChange={(e) => setHumanVerified(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-[#173F2B] rounded border-[#E7E9E2] focus:ring-[#173F2B]"
                />
                <span className="text-xs text-[#26312A] font-semibold leading-relaxed">
                  I have inspected field wind conditions and verified safe buffer distances before exporting ground control files.
                </span>
              </label>
              {!humanVerified && (
                <p className="text-[11px] text-[#9C5832] font-medium mt-2 pl-7">
                  Mandatory human confirmation required prior to autonomous drone file generation.
                </p>
              )}
            </div>

            {/* Export & Save Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleExportGeoJson}
                disabled={!humanVerified}
                className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  humanVerified
                    ? 'bg-[#173F2B] hover:bg-[#123222] text-white shadow-xs'
                    : 'bg-[#F7F7F0] text-[#26312A]/40 border border-[#E7E9E2] cursor-not-allowed'
                }`}
              >
                <FileCode className="w-4 h-4" />
                Export GeoJSON RFC 7946 (GCS)
              </button>

              <button
                type="button"
                onClick={handleExportMissionCsv}
                disabled={!humanVerified}
                className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  humanVerified
                    ? 'bg-white hover:bg-[#F7F7F0] text-[#173F2B] border border-[#E7E9E2] shadow-xs'
                    : 'bg-[#F7F7F0] text-[#26312A]/40 border border-[#E7E9E2] cursor-not-allowed'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Mission CSV (Flight Waypoints)
              </button>

              <button
                type="button"
                onClick={handleSaveOperation}
                disabled={!humanVerified}
                className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  humanVerified
                    ? 'bg-[#6F9B55] hover:bg-[#5E8746] text-white shadow-xs'
                    : 'bg-[#F7F7F0] text-[#26312A]/40 border border-[#E7E9E2] cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" />
                Save Operation to Registry
              </button>
            </div>

            <p className="text-[11px] text-[#26312A]/60 text-center pt-1 font-mono">
              QGroundControl • Mission Planner • DJI Agras RFC 7946
            </p>
          </div>

          {/* Operations History Card */}
          <div className="bg-white rounded-2xl border border-[#E7E9E2] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#173F2B] text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#26312A]/50" />
                Spray Operations Registry ({sprayOps.length})
              </h3>
            </div>

            {sprayOps.length === 0 ? (
              <p className="text-xs text-[#26312A]/50 py-3 text-center">
                No spray missions recorded yet for {activeFarm.name}.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {sprayOps.map((op) => {
                  const statusColors = {
                    scheduled: 'bg-[#DCE8D3] text-[#173F2B] border-[#6F9B55]/30',
                    in_progress: 'bg-[#F1D98A]/30 text-[#8F6805] border-[#F1D98A]',
                    completed: 'bg-[#173F2B] text-white border-[#173F2B]',
                    cancelled: 'bg-[#B9784F]/15 text-[#9C5832] border-[#B9784F]/30',
                  }[op.status];

                  return (
                    <div
                      key={op.id}
                      className="p-3 bg-[#F7F7F0] rounded-xl border border-[#E7E9E2] flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-xs text-[#173F2B]">{op.productName}</p>
                          <p className="text-[11px] text-[#26312A]/70">
                            {op.operationType} • {op.equipmentType} • {op.dosagePerAcre}
                          </p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${statusColors}`}>
                          {op.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#26312A]/60 border-t border-[#E7E9E2] pt-1.5 mt-1">
                        <span>Wind: {op.windSpeedKmh} km/h • {op.temperatureC}°C</span>
                        <div className="flex items-center gap-2">
                          {op.isDemo && <span className="font-mono text-[10px] text-[#26312A]/40">[DEMO]</span>}
                          <button
                            type="button"
                            onClick={() => handleDeleteOperation(op.id)}
                            className="text-[#26312A]/40 hover:text-[#B9784F] p-0.5"
                            title="Delete record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
