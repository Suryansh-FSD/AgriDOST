'use client';

import React, { useState, useEffect } from 'react';
import {
  MandiPriceRecord,
  MarketAdvisory,
  FinancialAnalysis,
} from '@/types/market';
import { getMarketIntelligence } from '@/lib/market';
import { Farm } from '@/types';
import {
  TrendingUp,
  Landmark,
  Calculator,
  ShieldCheck,
  AlertTriangle,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Scale,
  Sparkles,
  DollarSign,
} from 'lucide-react';

interface MarketIntelligenceModuleProps {
  farm?: Farm;
}

export function MarketIntelligenceModule({ farm }: MarketIntelligenceModuleProps) {
  const [commodity, setCommodity] = useState<string>('Soybean');
  const [state, setState] = useState<string>('Maharashtra');
  const [market, setMarket] = useState<string>('Nashik');
  const [yieldTonnes, setYieldTonnes] = useState<number>(4.5);
  const [inputCost, setInputCost] = useState<number>(45000);
  const [targetPrice, setTargetPrice] = useState<number>(5000);

  const [loading, setLoading] = useState(false);
  const [priceData, setPriceData] = useState<MandiPriceRecord | null>(null);
  const [advisory, setAdvisory] = useState<MarketAdvisory | null>(null);
  const [financials, setFinancials] = useState<FinancialAnalysis | null>(null);
  const [provenance, setProvenance] = useState<string>('simulated_fallback');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getMarketIntelligence({
        filters: {
          commodity,
          state,
          market,
        },
        financialParams: {
          expectedYieldTonnes: yieldTonnes,
          totalInputCostInr: inputCost,
        },
        targetPriceInrPerQtl: targetPrice,
      });

      setPriceData(res.priceRecord);
      setAdvisory(res.advisory || null);
      setFinancials(res.financialAnalysis || null);
      setProvenance(res.freshness?.provenance || 'simulated_fallback');
    } catch (err) {
      console.error('[MarketIntelligenceModule] Analysis failed:', err);
      setErrorMsg('Unable to retrieve market price for this commodity and mandi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis();
  }, [commodity, state]);

  const getAdvisoryBadge = (rec?: string) => {
    switch (rec) {
      case 'SELL':
        return {
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          label: 'SELL (अनुकूल विक्रय)',
          icon: ArrowUpRight,
        };
      case 'PARTIAL_SELL':
        return {
          bg: 'bg-blue-100 text-blue-800 border-blue-300',
          label: 'PARTIAL SELL (आंशिक विक्रय)',
          icon: Scale,
        };
      default:
        return {
          bg: 'bg-amber-100 text-amber-800 border-amber-300',
          label: 'HOLD (रोकें / सरकारी खरीद)',
          icon: ArrowDownRight,
        };
    }
  };

  const badge = getAdvisoryBadge(advisory?.recommendation);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E7E9E2] bg-white p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#DCE8D3] text-[#173F2B]">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h2 className="text-xl font-bold text-[#173F2B] font-heading">
              Market Intelligence & Mandi Pricing
            </h2>
          </div>
          <p className="mt-1 text-xs text-[#26312A]/60">
            Real-time APMC Mandi prices (data.gov.in / Agmarknet), MSP floor protection & crop break-even economics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] px-3 py-1 text-xs font-semibold text-[#173F2B]">
            Data Mode: <strong className="uppercase">{provenance}</strong>
          </span>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl bg-[#173F2B] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#173F2B]/90 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Update Prices</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Filters & Market Rates + Advisory & Financials */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Input Controls & Spot Price Card (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-2xl border border-[#E7E9E2] bg-white p-5 shadow-xs space-y-4">
            <h3 className="font-heading text-sm font-bold text-[#173F2B] flex items-center gap-1.5">
              <Calculator className="h-4 w-4 text-[#173F2B]" />
              Commodity & Farm Economics Input
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#26312A] block mb-1">Commodity / Crop</label>
                <select
                  value={commodity}
                  onChange={(e) => setCommodity(e.target.value)}
                  className="w-full rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] p-2.5 font-medium text-[#173F2B]"
                >
                  <option value="Soybean">Soybean (सोयाबीन)</option>
                  <option value="Wheat">Wheat / Gehu (गेहूं)</option>
                  <option value="Paddy">Paddy / Dhan (धान)</option>
                  <option value="Gram">Gram / Chana (चना)</option>
                  <option value="Mustard">Mustard / Sarson (सरसों)</option>
                  <option value="Cotton">Cotton / Kapas (कपास)</option>
                  <option value="Onion">Onion / Pyaz (प्याज)</option>
                  <option value="Tomato">Tomato / Tamatar (टमाटर)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#26312A] block mb-1">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] p-2.5 font-medium text-[#173F2B]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#26312A] block mb-1">Target Mandi</label>
                  <input
                    type="text"
                    value={market}
                    onChange={(e) => setMarket(e.target.value)}
                    className="w-full rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] p-2.5 font-medium text-[#173F2B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E7E9E2]">
                <div>
                  <label className="text-[11px] font-semibold text-[#26312A] block mb-0.5">Yield (Tonnes)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={yieldTonnes}
                    onChange={(e) => setYieldTonnes(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-[#E7E9E2] bg-[#F7F7F0] p-2 text-xs font-medium text-[#173F2B]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#26312A] block mb-0.5">Total Cost (₹)</label>
                  <input
                    type="number"
                    step="500"
                    value={inputCost}
                    onChange={(e) => setInputCost(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-[#E7E9E2] bg-[#F7F7F0] p-2 text-xs font-medium text-[#173F2B]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#26312A] block mb-0.5">Target Rate (₹/Q)</label>
                  <input
                    type="number"
                    step="50"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-[#E7E9E2] bg-[#F7F7F0] p-2 text-xs font-medium text-[#173F2B]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Mandi Spot Rates Card */}
          {priceData && (
            <div className="rounded-2xl border border-[#E7E9E2] bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#26312A]/60">APMC Mandi Spot Rate</span>
                <span className="text-[10px] bg-[#DCE8D3] text-[#173F2B] font-bold px-2 py-0.5 rounded-full">
                  Arrival: {priceData.arrival_date}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-extrabold text-[#173F2B] font-heading">
                    ₹{priceData.modal_price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-[#26312A]/60 font-medium ml-1">/ Quintal</span>
                </div>
                <div className="text-right text-xs">
                  <span className="text-[#26312A]/70 block">Range</span>
                  <span className="font-semibold text-[#173F2B]">
                    ₹{priceData.min_price} - ₹{priceData.max_price}
                  </span>
                </div>
              </div>

              {advisory?.mspComparison && (
                <div className="rounded-xl bg-[#F7F7F0] p-3 border border-[#E7E9E2] text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#26312A] flex items-center gap-1">
                      <Landmark className="w-3.5 h-3.5 text-[#173F2B]" /> Government MSP Floor
                    </span>
                    <span className="font-bold text-[#173F2B]">
                      ₹{advisory.mspComparison.mspPrice.toLocaleString('en-IN')}/Qtl
                    </span>
                  </div>
                  <p className="text-[11px] text-[#26312A]/70">
                    {advisory.mspComparison.isAboveMsp ? (
                      <span className="text-emerald-700 font-semibold">
                        ▲ ₹{advisory.mspComparison.diffInr.toLocaleString('en-IN')} (+{advisory.mspComparison.diffPct.toFixed(1)}%) above official MSP.
                      </span>
                    ) : (
                      <span className="text-amber-700 font-semibold">
                        ▼ ₹{Math.abs(advisory.mspComparison.diffInr).toLocaleString('en-IN')} ({advisory.mspComparison.diffPct.toFixed(1)}%) below official MSP.
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Advisory & Financial Breakdown (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Statutory Advisory Card */}
          {advisory && (
            <div className="rounded-2xl border border-[#E7E9E2] bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#26312A]/60">Algorithmic Harvest Advisory</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${badge.bg}`}>
                  <badge.icon className="w-3.5 h-3.5" />
                  {badge.label}
                </span>
              </div>

              <div className="space-y-2 text-xs leading-relaxed">
                <p className="font-medium text-[#173F2B]">{advisory.rationaleEn}</p>
                <p className="text-[#26312A]/70 italic">{advisory.rationaleHi}</p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-[11px] text-amber-900 leading-relaxed">
                <strong>Statutory Disclaimer:</strong> {advisory.disclaimer}
              </div>
            </div>
          )}

          {/* Farm Financial Economics Card */}
          {financials && (
            <div className="rounded-2xl border border-[#E7E9E2] bg-white p-5 shadow-xs space-y-4">
              <h3 className="font-heading text-sm font-bold text-[#173F2B] flex items-center gap-1.5">
                <Scale className="h-4 w-4 text-[#173F2B]" />
                Crop Harvest Economics & Profitability
              </h3>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                <div className="rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] p-3 text-left">
                  <span className="text-[10px] text-[#26312A]/60 block mb-0.5">Estimated Revenue</span>
                  <span className="font-heading text-sm font-bold text-[#173F2B]">
                    ₹{financials.estimatedRevenueInr.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] p-3 text-left">
                  <span className="text-[10px] text-[#26312A]/60 block mb-0.5">Total Cost</span>
                  <span className="font-heading text-sm font-bold text-[#173F2B]">
                    ₹{financials.estimatedCostInr.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] p-3 text-left">
                  <span className="text-[10px] text-[#26312A]/60 block mb-0.5">Break-Even Rate</span>
                  <span className="font-heading text-sm font-bold text-[#173F2B]">
                    ₹{financials.breakEvenPricePerQtl.toFixed(0)}/Qtl
                  </span>
                </div>

                <div className="rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] p-3 text-left">
                  <span className="text-[10px] text-[#26312A]/60 block mb-0.5">Expected Net Profit</span>
                  <span className={`font-heading text-sm font-bold ${financials.expectedProfitInr >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    ₹{financials.expectedProfitInr.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-[#26312A]/70 pt-2 border-t border-[#E7E9E2]">
                <span>Profit Margin: <strong>{financials.profitMarginPct.toFixed(1)}%</strong></span>
                <span>Return on Investment (ROI): <strong>{financials.roiPct.toFixed(1)}%</strong></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
