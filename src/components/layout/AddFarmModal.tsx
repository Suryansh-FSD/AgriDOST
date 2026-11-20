'use client';

import React, { useState } from 'react';
import { Farm, GeoJSONPolygon } from '@/types';
import { X, Sprout, Check } from 'lucide-react';

interface AddFarmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveFarm: (farm: Farm) => void;
}

export function AddFarmModal({ isOpen, onClose, onSaveFarm }: AddFarmModalProps) {
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [surveyNumber, setSurveyNumber] = useState('');
  const [location, setLocation] = useState('');
  const [soilType, setSoilType] = useState('Medium Black Soil (Regur)');
  const [waterSource, setWaterSource] = useState('Drip & Tube-well');
  const [primaryCrop, setPrimaryCrop] = useState('Cotton & Soybean');
  const [areaAcres, setAreaAcres] = useState('15.0');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const acres = parseFloat(areaAcres) || 10;
    const areaSqM = Math.round(acres * 4046.856);

    const initialBoundary: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [73.8100, 19.9950],
          [73.8150, 19.9955],
          [73.8160, 20.0000],
          [73.8105, 20.0005],
          [73.8100, 19.9950],
        ],
      ],
    };

    const newFarm: Farm = {
      id: `farm-${Date.now()}`,
      name: name.trim(),
      ownerName: ownerName.trim() || 'Farmer',
      surveyNumber: surveyNumber.trim() || `SN-${Math.floor(1000 + Math.random() * 9000)}`,
      location: location.trim() || 'Nashik, Maharashtra, India',
      soilType,
      waterSource,
      primaryCrop,
      areaAcres: acres,
      areaSqM,
      boundary: initialBoundary,
      isDemo: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveFarm(newFarm);
    onClose();
    setName('');
    setOwnerName('');
    setSurveyNumber('');
    setLocation('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#26312A]/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-[#E7E9E2]">
        <div className="flex items-center justify-between border-b border-[#E7E9E2] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#DCE8D3] text-[#173F2B]">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#173F2B] font-heading">Add New Farm Profile</h3>
              <p className="text-xs text-[#26312A]/60">Initialize farm boundary & baseline agronomics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-[#26312A]/60 hover:bg-[#F7F7F0] hover:text-[#26312A]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs sm:text-sm">
          <div>
            <label className="block font-semibold text-[#26312A] mb-1 font-heading">
              Farm Name <span className="text-[#B9784F]">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kisan Agro Oasis"
              className="w-full rounded-2xl border border-[#E7E9E2] px-3.5 py-2 text-[#26312A] focus:border-[#173F2B] focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#26312A] mb-1 font-heading">Farmer / Owner</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Ramesh Patel"
                className="w-full rounded-2xl border border-[#E7E9E2] px-3.5 py-2 text-[#26312A] focus:border-[#173F2B] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#26312A] mb-1 font-heading">Survey / Khata No.</label>
              <input
                type="text"
                value={surveyNumber}
                onChange={(e) => setSurveyNumber(e.target.value)}
                placeholder="e.g. MH-NAS-412"
                className="w-full rounded-2xl border border-[#E7E9E2] px-3.5 py-2 text-[#26312A] focus:border-[#173F2B] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#26312A] mb-1 font-heading">Village / District / State</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Dindori, Nashik, MH"
                className="w-full rounded-2xl border border-[#E7E9E2] px-3.5 py-2 text-[#26312A] focus:border-[#173F2B] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#26312A] mb-1 font-heading">Initial Area (Acres)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={areaAcres}
                onChange={(e) => setAreaAcres(e.target.value)}
                className="w-full rounded-2xl border border-[#E7E9E2] px-3.5 py-2 text-[#26312A] focus:border-[#173F2B] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#26312A] mb-1 font-heading">Dominant Soil Type</label>
              <select
                value={soilType}
                onChange={(e) => setSoilType(e.target.value)}
                className="w-full rounded-2xl border border-[#E7E9E2] px-3.5 py-2 text-[#26312A] focus:border-[#173F2B] focus:outline-hidden bg-white"
              >
                <option value="Medium Black Soil (Regur)">Medium Black Soil (Regur)</option>
                <option value="Alluvial Loam">Alluvial Loam</option>
                <option value="Red Laterite Soil">Red Laterite Soil</option>
                <option value="Sandy Loam">Sandy Loam</option>
                <option value="Clayey Deltaic">Clayey Deltaic</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-[#26312A] mb-1 font-heading">Irrigation Source</label>
              <select
                value={waterSource}
                onChange={(e) => setWaterSource(e.target.value)}
                className="w-full rounded-2xl border border-[#E7E9E2] px-3.5 py-2 text-[#26312A] focus:border-[#173F2B] focus:outline-hidden bg-white"
              >
                <option value="Drip & Micro-sprinkler">Drip & Micro-sprinkler</option>
                <option value="Tube-well / Bore-well">Tube-well / Bore-well</option>
                <option value="Canal Lift Irrigation">Canal Lift Irrigation</option>
                <option value="Farm Pond / Rainfed">Farm Pond / Rainfed</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#E7E9E2]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl px-4 py-2 font-semibold text-[#26312A]/70 hover:bg-[#F7F7F0]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-2xl bg-[#173F2B] px-5 py-2 font-semibold text-white shadow-xs hover:bg-[#0f2c1e] transition active:scale-95"
            >
              <Check className="h-4 w-4 text-[#DCE8D3]" />
              Save Farm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
