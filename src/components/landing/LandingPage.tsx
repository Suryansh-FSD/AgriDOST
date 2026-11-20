'use client';

import React from 'react';
import { 
  Sprout, 
  Map, 
  CalendarDays, 
  ScanEye, 
  TreePine, 
  Plane, 
  Boxes, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  Layers, 
  Cpu, 
  Database, 
  Compass, 
  ExternalLink,
  Sparkles,
  ChevronRight,
  TrendingUp,
  FileCheck2
} from 'lucide-react';
import { NavTab } from '../layout/Sidebar';

interface LandingPageProps {
  onLaunchApp: (tab?: NavTab) => void;
}

export function LandingPage({ onLaunchApp }: LandingPageProps) {
  const capabilities = [
    {
      id: 'mapping' as NavTab,
      number: '01',
      title: 'Smart Farm Cadastral Mapping',
      subtitle: 'Map your land boundary once. Manage everything from it.',
      description:
        'Draw your exact field boundaries on Google Maps satellite imagery or our built-in offline vector canvas. Computes perimeter and area in acres and square meters deterministically using Turf.js.',
      icon: Map,
      badge: 'Core Cadastre',
      cta: 'Open Mapping Canvas',
      highlights: ['Interactive vertex editing', 'RFC 7946 GeoJSON export', '100% offline SVG fallback'],
    },
    {
      id: 'planner' as NavTab,
      number: '02',
      title: 'AI & Farmer-Selected Crop Planner',
      subtitle: 'Evidence-based crop zoning tailored to Indian soils.',
      description:
        'Delineate crop sectors using AI recommendations, manual selection, or combined synergy. Real-time allocation meter prevents exceeding usable farm acreage while presenting soil suitability evidence.',
      icon: CalendarDays,
      badge: 'Agronomic Zoning',
      cta: 'Explore Crop Planner',
      highlights: ['Indian crop database', 'Acreage allocation guardrails', 'Traceable agronomic sources'],
    },
    {
      id: 'health' as NavTab,
      number: '03',
      title: 'AI Crop Health & Leaf Pathology',
      subtitle: 'Multi-modal foliar vision with strict anti-hallucination guardrails.',
      description:
        'Upload photographs of affected plant leaves. Server-side Gemini vision identifies visible symptoms and differential causes, validated strictly with Zod schemas and verified ICAR extension guidance.',
      icon: ScanEye,
      badge: 'Gemini Vision',
      cta: 'Scan Leaf Health',
      highlights: ['Differential possible causes', 'Organic-first remedy priority', 'Mandatory field verification'],
    },
    {
      id: 'operations' as NavTab,
      number: '04',
      title: 'Boundary Agro-Forestry Trees',
      subtitle: 'Maximize farm perimeter value without harming active crops.',
      description:
        'Plan border tree placements along your farm perimeter. Calculate exact tree counts for Teak, Malabar Neem, Subabul, Moringa, and Casuarina with shade risk analysis and root competition notes.',
      icon: TreePine,
      badge: 'Agro-Forestry',
      cta: 'Plan Boundary Trees',
      highlights: ['Sourced spacing models', 'Root clearance drip-line buffer', 'Annual carbon offset metrics'],
    },
    {
      id: 'operations' as NavTab,
      number: '05',
      title: 'Farm Inputs & Activity Reminders',
      subtitle: 'Never miss an irrigation cycle or run out of critical inputs.',
      description:
        'Track on-farm inventory of seeds, fertilizers, and bio-agents with stock level alerts. Schedule and monitor field tasks with due dates, urgency badges, and one-click completion.',
      icon: Boxes,
      badge: 'Farm Logistics',
      cta: 'Manage Farm Inputs',
      highlights: ['Low-stock warning badges', 'Categorized field activities', 'Due date urgency tracking'],
    },
    {
      id: 'drone' as NavTab,
      number: '06',
      title: 'Precision Drone Spray Planner',
      subtitle: 'Targeted treatment corridors with weather safety validation.',
      description:
        'Select infected field sectors, compute spray swath area with Turf.js, and verify live weather feasibility (wind, temperature, humidity). Export standard RFC 7946 GeoJSON and waypoint CSV files.',
      icon: Plane,
      badge: 'Precision Flight',
      cta: 'Configure Drone Spray',
      highlights: ['Dynamic wind drift safety index', 'Mandatory human verification gate', 'QGroundControl & DJI Agras GeoJSON'],
    },
  ];

  const pillars = [
    {
      label: 'Calculated with Code',
      desc: 'All area, perimeter, and tree positions are computed deterministically via Turf.js. An LLM is never allowed to guess geographic coordinates.',
      icon: Cpu,
    },
    {
      label: 'Explained with AI',
      desc: 'Gemini 2.5/3.8 Flash interprets visual leaf pathology and suggests agronomic rationale without directly mutating data or geometry.',
      icon: Sparkles,
    },
    {
      label: 'Verified with Sources',
      desc: 'All crop varieties, sowing calendars, and tree spacing are sourced from ICAR, State Agricultural Universities (PAU, MPKV), and KVKs.',
      icon: FileCheck2,
    },
    {
      label: '100% Offline Persistence',
      desc: 'Browser-native LocalStorage architecture with reactive event sync. Zero dependency on external cloud databases for the core OS.',
      icon: Database,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F0] text-[#26312A] font-sans selection:bg-[#DCE8D3] selection:text-[#173F2B]">
      {/* 1. Global Navigation Bar */}
      <nav className="sticky top-0 z-40 border-b border-[#E7E9E2] bg-white/95 px-4 md:px-8 py-3.5 backdrop-blur-md shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#173F2B] text-white shadow-xs">
              <Sprout className="h-5 w-5 text-[#DCE8D3]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-[#173F2B] font-heading">
                  AgriDOST
                </span>
                <span className="rounded-full bg-[#DCE8D3] px-2 py-0.5 text-[10px] font-bold text-[#173F2B] border border-[#6F9B55]/30">
                  Precision OS
                </span>
              </div>
              <p className="text-[11px] font-medium text-[#26312A]/60 hidden sm:block">
                Map-First Farm Planning & Management OS
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-6 text-xs font-semibold text-[#26312A]/70 font-heading">
            <a href="#philosophy" className="hover:text-[#173F2B] transition">Core Philosophy</a>
            <a href="#capabilities" className="hover:text-[#173F2B] transition">Six Capabilities</a>
            <a href="#anti-hallucination" className="hover:text-[#173F2B] transition">Trust Architecture</a>
            <a href="#scenarios" className="hover:text-[#173F2B] transition">Farmer Scenarios</a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onLaunchApp('dashboard')}
              className="flex items-center gap-2 rounded-2xl bg-[#173F2B] px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-[#0f2c1e] transition active:scale-95 font-heading"
            >
              <span>Launch Farm OS</span>
              <ArrowRight className="h-4 w-4 text-[#DCE8D3]" />
            </button>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-12 pb-16 md:pt-18 md:pb-24 border-b border-[#E7E9E2] bg-gradient-to-b from-white to-[#F7F7F0]">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E7E9E2] bg-[#F7F7F0] px-3.5 py-1 text-xs font-semibold text-[#173F2B] shadow-2xs font-heading mb-6">
            <Sparkles className="h-3.5 w-3.5 text-[#6F9B55]" />
            <span>Built for Small & Medium Indian Farmers • Powered by Gemini Vision & Turf.js</span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#173F2B] font-heading leading-tight sm:leading-none">
            Map your farm once. <br className="hidden sm:inline" />
            <span className="text-[#6F9B55]">Plan and manage it from one place.</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-2xl mx-auto text-sm sm:text-base text-[#26312A]/80 leading-relaxed">
            AgriDOST transforms satellite land boundaries into an intelligent, connected cadastre. 
            One single farm map anchors crop zoning, leaf disease detection, agro-forestry border trees, 
            and precision drone spray missions — with zero agricultural hallucinations.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <button
              onClick={() => onLaunchApp('dashboard')}
              className="flex items-center gap-2 rounded-2xl bg-[#173F2B] px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-[#0f2c1e] transition active:scale-95 font-heading"
            >
              <span>Open Farm Workspace</span>
              <ArrowRight className="h-4 w-4 text-[#DCE8D3]" />
            </button>

            <button
              onClick={() => onLaunchApp('mapping')}
              className="flex items-center gap-2 rounded-2xl border border-[#E7E9E2] bg-white px-6 py-3.5 text-sm font-semibold text-[#173F2B] shadow-xs hover:bg-[#F7F7F0] transition font-heading"
            >
              <Compass className="h-4 w-4 text-[#6F9B55]" />
              <span>Try Interactive Cadastre</span>
            </button>
          </div>

          {/* Verified Technical Badges */}
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 max-w-4xl mx-auto text-left">
            {pillars.map((p, idx) => {
              const Icon = p.icon;
              return (
                <div key={idx} className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-2xs">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#DCE8D3] text-[#173F2B] mb-2.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-bold text-[#173F2B] font-heading">{p.label}</h4>
                  <p className="mt-1 text-[11px] text-[#26312A]/70 line-clamp-2 leading-relaxed">
                    {p.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. The Core Concept: "One Map Anchors Everything" */}
      <section id="philosophy" className="px-4 sm:px-6 lg:px-8 py-16 md:py-20 border-b border-[#E7E9E2] bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6F9B55] font-heading">
              The AgriDOST Philosophy
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-[#173F2B] font-heading">
              Why Disconnected Farm Tools Fail Farmers
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-[#26312A]/70">
              Today, a farmer calculates land area in one app, consults crop advice in another, logs reminders on paper, and guesses spray boundaries. AgriDOST unifies all operations to the exact geographic coordinates of your land.
            </p>
          </div>

          {/* Unified Map Cadastre Architecture Diagram */}
          <div className="rounded-2xl border border-[#E7E9E2] bg-[#F7F7F0] p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Flow Explanation */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4.5 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#173F2B] text-white">
                      <Map className="h-4 w-4 text-[#DCE8D3]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#173F2B] font-heading">Step 1: Map Land Once</h4>
                      <p className="text-[11px] text-[#26312A]/60">Satellite cadastral polygon in GeoJSON</p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs text-[#26312A]/80 leading-relaxed">
                    Farmer plots boundary coordinates. Turf.js computes exact geodesic acreage and perimeter deterministically.
                  </p>
                </div>

                <div className="flex justify-center text-[#6F9B55]">
                  <ChevronRight className="h-5 w-5 rotate-90 lg:rotate-0" />
                </div>

                <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4.5 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#6F9B55] text-white">
                      <Layers className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#173F2B] font-heading">Step 2: Delineate Sectors</h4>
                      <p className="text-[11px] text-[#26312A]/60">Slices boundary into crop & spray zones</p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs text-[#26312A]/80 leading-relaxed">
                    Crop planner divides fields by crop varieties. Disease scanner logs infection hotspots. All share the parent <code className="bg-[#F7F7F0] px-1 py-0.5 rounded text-[10px] font-mono text-[#173F2B]">farmId</code>.
                  </p>
                </div>

                <div className="flex justify-center text-[#6F9B55]">
                  <ChevronRight className="h-5 w-5 rotate-90 lg:rotate-0" />
                </div>

                <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4.5 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#B9784F] text-white">
                      <Plane className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#173F2B] font-heading">Step 3: Execute Missions</h4>
                      <p className="text-[11px] text-[#26312A]/60">Export GeoJSON for drone & tractor path</p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs text-[#26312A]/80 leading-relaxed">
                    Export verified spray polygons directly to drone ground stations (QGroundControl, DJI Agras) with zero coordinate mismatch.
                  </p>
                </div>
              </div>

              {/* Right Column: Visual Cadastre Schematic */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E7E9E2] p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#E7E9E2] pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#173F2B]" />
                    <span className="text-xs font-bold text-[#173F2B] font-heading">
                      Cadastral Blueprint: Green Valley Agro Park (24.5 Acres)
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-[#26312A]/60 font-mono">
                    RFC 7946 Standard
                  </span>
                </div>

                {/* SVG Visual Representation */}
                <div className="relative h-64 sm:h-72 w-full bg-[#FAF9F5] rounded-xl border border-[#E7E9E2] flex items-center justify-center p-3">
                  <svg viewBox="0 0 400 240" className="w-full h-full drop-shadow-sm select-none">
                    {/* Outer Farm Boundary */}
                    <polygon
                      points="30,30 370,45 350,210 50,195"
                      fill="#DCE8D3"
                      fillOpacity="0.5"
                      stroke="#173F2B"
                      strokeWidth="3"
                    />

                    {/* Sector 1: Cotton (Crop Green) */}
                    <polygon
                      points="40,40 220,50 210,140 45,130"
                      fill="#6F9B55"
                      fillOpacity="0.75"
                      stroke="#173F2B"
                      strokeWidth="1.5"
                    />
                    <text x="75" y="90" fill="#FFFFFF" fontSize="10" fontWeight="bold">BT Cotton: 9.2 Ac</text>

                    {/* Sector 2: Wheat (Harvest Gold) */}
                    <polygon
                      points="45,140 210,145 200,190 55,185"
                      fill="#F1D98A"
                      fillOpacity="0.7"
                      stroke="#B9784F"
                      strokeWidth="1.5"
                    />
                    <text x="75" y="170" fill="#26312A" fontSize="10" fontWeight="bold">Wheat GW-496: 6.8 Ac</text>

                    {/* Sector 3: Disease Alert Hotspot (Earth Clay) */}
                    <polygon
                      points="230,55 355,65 345,120 225,115"
                      fill="#B9784F"
                      fillOpacity="0.8"
                      stroke="#8A4F2A"
                      strokeWidth="1.5"
                    />
                    <text x="240" y="90" fill="#FFFFFF" fontSize="10" fontWeight="bold">Mosaic Hotspot: 3.4 Ac</text>

                    {/* Sector 4: Precision Spray Corridor (Dashed Forest Green) */}
                    <polygon
                      points="225,125 345,130 340,195 220,185"
                      fill="#173F2B"
                      fillOpacity="0.3"
                      stroke="#173F2B"
                      strokeWidth="1.8"
                      strokeDasharray="4 3"
                    />
                    <text x="235" y="165" fill="#173F2B" fontSize="10" fontWeight="bold">Drone Corridor: 5.1 Ac</text>

                    {/* Boundary Tree Marker Dots along perimeter */}
                    <circle cx="30" cy="30" r="3" fill="#173F2B" />
                    <circle cx="115" cy="34" r="3" fill="#173F2B" />
                    <circle cx="200" cy="37" r="3" fill="#173F2B" />
                    <circle cx="285" cy="41" r="3" fill="#173F2B" />
                    <circle cx="370" cy="45" r="3" fill="#173F2B" />
                    <circle cx="363" cy="100" r="3" fill="#173F2B" />
                    <circle cx="356" cy="155" r="3" fill="#173F2B" />
                    <circle cx="350" cy="210" r="3" fill="#173F2B" />
                  </svg>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-[#26312A]/70 gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#6F9B55]" /> Crop Sector
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#B9784F]" /> Disease Alert
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#173F2B]" /> Tree Markers
                    </span>
                  </div>
                  <button
                    onClick={() => onLaunchApp('dashboard')}
                    className="text-xs font-bold text-[#173F2B] hover:underline font-heading flex items-center gap-1"
                  >
                    <span>Launch Live Interactive Cadastre</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. The Six Core Capabilities (Feature Grid) */}
      <section id="capabilities" className="px-4 sm:px-6 lg:px-8 py-16 md:py-24 border-b border-[#E7E9E2]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6F9B55] font-heading">
              End-to-End Platform
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-[#173F2B] font-heading">
              Six Agricultural Capabilities, One Single Workspace
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-[#26312A]/70">
              Each module connects directly to the shared LocalStorage repository and geometry engine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {capabilities.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.number}
                  className="flex flex-col justify-between rounded-2xl border border-[#E7E9E2] bg-white p-5 sm:p-6 shadow-xs hover:border-[#6F9B55]/60 hover:shadow-sm transition"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#DCE8D3] text-[#173F2B]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold text-[#173F2B]/40 font-mono">
                        {cap.number}
                      </span>
                    </div>

                    <div className="mt-4">
                      <span className="rounded-full bg-[#F7F7F0] px-2.5 py-0.5 text-[10px] font-bold text-[#173F2B] border border-[#E7E9E2] font-heading">
                        {cap.badge}
                      </span>
                      <h3 className="mt-2 text-base font-bold text-[#173F2B] font-heading">
                        {cap.title}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-[#6F9B55] font-heading">
                        {cap.subtitle}
                      </p>
                      <p className="mt-2.5 text-xs text-[#26312A]/75 leading-relaxed">
                        {cap.description}
                      </p>
                    </div>

                    {/* Highlights */}
                    <div className="mt-4 pt-3 border-t border-[#E7E9E2] space-y-1.5">
                      {cap.highlights.map((h, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-[#26312A]/80">
                          <CheckCircle2 className="h-3 w-3 text-[#6F9B55] shrink-0" />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-3">
                    <button
                      onClick={() => onLaunchApp(cap.id)}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] py-2 text-xs font-bold text-[#173F2B] hover:bg-[#DCE8D3]/50 transition font-heading"
                    >
                      <span>{cap.cta}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Anti-Hallucination & Evidence Policy */}
      <section id="anti-hallucination" className="px-4 sm:px-6 lg:px-8 py-16 md:py-20 border-b border-[#E7E9E2] bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-[#173F2B]/20 bg-[#173F2B] text-white p-6 sm:p-10 shadow-lg">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#DCE8D3] font-heading">
              <ShieldCheck className="h-4 w-4" />
              <span>Strict Anti-Hallucination Guardrails</span>
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold font-heading">
              AgriDOST Never Pretends to Know What It Does Not Know
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-white/80 leading-relaxed max-w-3xl">
              Unlike generic chatbot prototypes, AgriDOST separates deterministic mathematics from AI interpretation. 
              We never fabricate pesticide dosages, fake yields, or pretend a 2D photograph provides a definitive clinical laboratory diagnosis.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs text-[#26312A]">
              <div className="rounded-xl bg-white p-3.5 border border-white/20">
                <span className="font-bold text-[#173F2B] font-heading block">[Farmer-Provided]</span>
                <p className="mt-1 text-[11px] text-[#26312A]/70">Inputs typed by the user (crop choice, sowing date, survey number).</p>
              </div>

              <div className="rounded-xl bg-white p-3.5 border border-white/20">
                <span className="font-bold text-[#173F2B] font-heading block">[Turf.js Calculated]</span>
                <p className="mt-1 text-[11px] text-[#26312A]/70">Strict code calculations (area in acres/m², perimeter, drone flight minutes).</p>
              </div>

              <div className="rounded-xl bg-white p-3.5 border border-white/20">
                <span className="font-bold text-[#B9784F] font-heading block">[AI-Generated Advice]</span>
                <p className="mt-1 text-[11px] text-[#26312A]/70">Gemini foliar symptom analysis explicitly requiring physical field verification.</p>
              </div>

              <div className="rounded-xl bg-white p-3.5 border border-white/20">
                <span className="font-bold text-[#8A4F2A] font-heading block">[DEMO DATA]</span>
                <p className="mt-1 text-[11px] text-[#26312A]/70">Pre-seeded demonstration records visibly labelled to avoid confusing farmers.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Farmer Case Scenarios (Preloaded Demo Farms) */}
      <section id="scenarios" className="px-4 sm:px-6 lg:px-8 py-16 md:py-20 border-b border-[#E7E9E2]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6F9B55] font-heading">
              Ready-to-Test Agricultural Cadastres
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-[#173F2B] font-heading">
              Explore Three Pre-Configured Indian Farms
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-[#26312A]/70">
              Test every feature immediately. Switch between farms using the header dropdown or click below.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Farm 1: Nashik */}
            <div className="rounded-2xl border border-[#E7E9E2] bg-white p-5 shadow-xs flex flex-col justify-between">
              <div>
                <span className="rounded-full bg-[#DCE8D3] px-2.5 py-0.5 text-[10px] font-bold text-[#173F2B]">
                  Maharashtra Agro Belt
                </span>
                <h3 className="mt-2.5 text-base font-bold text-[#173F2B] font-heading">
                  Green Valley Agro Park
                </h3>
                <p className="mt-1 text-xs text-[#26312A]/60">Nashik • 24.5 Acres • Medium Black Regur</p>
                <p className="mt-3 text-xs text-[#26312A]/80 leading-relaxed">
                  High-density Bollgard II Cotton intercropped with GW-496 Sharbati Wheat. Features a Yellow Mosaic Virus containment zone and a scheduled precision drone bio-fungicide flight corridor.
                </p>
              </div>
              <button
                onClick={() => onLaunchApp('dashboard')}
                className="mt-5 w-full rounded-xl bg-[#173F2B] py-2 text-xs font-bold text-white hover:bg-[#0f2c1e] transition font-heading"
              >
                Inspect Nashik Farm
              </button>
            </div>

            {/* Farm 2: Bathinda */}
            <div className="rounded-2xl border border-[#E7E9E2] bg-white p-5 shadow-xs flex flex-col justify-between">
              <div>
                <span className="rounded-full bg-[#DCE8D3] px-2.5 py-0.5 text-[10px] font-bold text-[#173F2B]">
                  Punjab Citrus Corridor
                </span>
                <h3 className="mt-2.5 text-base font-bold text-[#173F2B] font-heading">
                  Surya Precision Orchards
                </h3>
                <p className="mt-1 text-xs text-[#26312A]/60">Bathinda • 18.2 Acres • Alluvial Loam</p>
                <p className="mt-3 text-xs text-[#26312A]/80 leading-relaxed">
                  High-density Kinnow Mandarin orchard protected by Casuarina windbreaks. Delineated Citrus Canker hotspot with verified copper bactericide spray schedule.
                </p>
              </div>
              <button
                onClick={() => onLaunchApp('dashboard')}
                className="mt-5 w-full rounded-xl bg-[#173F2B] py-2 text-xs font-bold text-white hover:bg-[#0f2c1e] transition font-heading"
              >
                Inspect Punjab Orchard
              </button>
            </div>

            {/* Farm 3: Krishna Delta */}
            <div className="rounded-2xl border border-[#E7E9E2] bg-white p-5 shadow-xs flex flex-col justify-between">
              <div>
                <span className="rounded-full bg-[#DCE8D3] px-2.5 py-0.5 text-[10px] font-bold text-[#173F2B]">
                  Andhra Delta Basin
                </span>
                <h3 className="mt-2.5 text-base font-bold text-[#173F2B] font-heading">
                  Krishna Delta Agro Sanctuary
                </h3>
                <p className="mt-1 text-xs text-[#26312A]/60">Vijayawada • 12.8 Acres • Deltaic Clay</p>
                <p className="mt-3 text-xs text-[#26312A]/80 leading-relaxed">
                  Traditional Sona Masoori Paddy rotation with black gram nitrogen fixation. Demonstrates soil-sensitive AI crop suitability and canal lift irrigation scheduling.
                </p>
              </div>
              <button
                onClick={() => onLaunchApp('dashboard')}
                className="mt-5 w-full rounded-xl bg-[#173F2B] py-2 text-xs font-bold text-white hover:bg-[#0f2c1e] transition font-heading"
              >
                Inspect Delta Field
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Bottom CTA & Footer */}
      <footer className="bg-white border-t border-[#E7E9E2] px-4 md:px-8 py-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#173F2B] text-white">
              <Sprout className="h-4 w-4 text-[#DCE8D3]" />
            </div>
            <div>
              <span className="text-base font-bold text-[#173F2B] font-heading">AgriDOST</span>
              <p className="text-[11px] text-[#26312A]/60">Precision Agriculture & Farm Intelligence OS</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#26312A]/70 font-heading">
            <button onClick={() => onLaunchApp('dashboard')} className="hover:text-[#173F2B]">
              Farm Dashboard
            </button>
            <span>•</span>
            <button onClick={() => onLaunchApp('mapping')} className="hover:text-[#173F2B]">
              Cadastral Mapping
            </button>
            <span>•</span>
            <button onClick={() => onLaunchApp('health')} className="hover:text-[#173F2B]">
              Crop Health
            </button>
            <span>•</span>
            <a
              href="https://github.com/Suryansh-FSD/AgriDOST"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-[#173F2B]"
            >
              <span>GitHub Repo</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div>
            <button
              onClick={() => onLaunchApp('dashboard')}
              className="rounded-2xl bg-[#173F2B] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#0f2c1e] transition font-heading"
            >
              Launch Platform →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
