'use client';

// ─── Refinery Facility Units with Precise Architectural Coordinates (%) ───────────────
export interface FacilityUnit {
  id: string;
  name: string;
  code: string;
  sector: string;
  category: 'crude' | 'process' | 'utilities' | 'storage' | 'logistics' | 'admin' | 'safety';
  x: number;      // left percentage (0 - 100)
  y: number;      // top percentage (0 - 100)
  w: number;      // width percentage
  h: number;      // height percentage
  riskScore: number;
  incidents: number;
  lastIncident: string | null;
  dominantHazard: string;
  status: 'critical' | 'high' | 'medium' | 'low' | 'normal';
  details: string;
  equipmentIds: string[];
}

// ─── Facility Units Configured with Nominal Baselines (Real DB Reports Elevate Risk) ───
export const REFINERY_FACILITY_UNITS: FacilityUnit[] = [
  // ── Sector 1: Utilities & Power Generation ──
  {
    id: 'unit-boiler-a',
    name: 'Sector 1: Boiler Room A & Main Header',
    code: 'UTIL-BLR-A',
    sector: 'Sector 1 (Utilities)',
    category: 'utilities',
    x: 6,
    y: 12,
    w: 25,
    h: 22,
    riskScore: 10,
    incidents: 0,
    lastIncident: null,
    dominantHazard: 'Nominal Operations · High-Pressure Steam Circuit',
    status: 'normal',
    details: 'Utility Block A: Superheated steam headers, fuel gas feed lines, and feedwater economizers.',
    equipmentIds: ['BLR-101', 'STM-HDR-A', 'FW-PUMP-1'],
  },
  {
    id: 'unit-electrical-room',
    name: 'Sector 1: Substation & Electrical Panel Room',
    code: 'UTIL-ELEC-01',
    sector: 'Sector 1 (Utilities)',
    category: 'utilities',
    x: 6,
    y: 38,
    w: 25,
    h: 20,
    riskScore: 8,
    incidents: 0,
    lastIncident: null,
    dominantHazard: 'Nominal Operations · 11kV Switchgear & MCC Distribution',
    status: 'normal',
    details: 'Main Motor Control Center (MCC) and 11kV step-down transformer yard with automatic CO2 fire suppression.',
    equipmentIds: ['MCC-01', 'TR-04', 'ELEC-PANEL-R1'],
  },

  // ── Sector 2: Process Block (Hydrocracking & Reaction) ──
  {
    id: 'unit-hydro-unit',
    name: 'Sector 2: Hydrocracker Reaction Train (V-204)',
    code: 'PROC-HYDRO-02',
    sector: 'Sector 2 (Process)',
    category: 'process',
    x: 37,
    y: 12,
    w: 28,
    h: 22,
    riskScore: 12,
    incidents: 0,
    lastIncident: null,
    dominantHazard: 'Nominal Operations · High-Pressure Hydrogen Reactor Loop',
    status: 'normal',
    details: 'Heavy gas oil hydrocracker vessel V-204 and high-pressure recycle compressor train.',
    equipmentIds: ['V-204', 'C-201', 'P-202A/B'],
  },
  {
    id: 'unit-elevation-deck',
    name: 'Sector 2: Unit 3 Elevation Deck & Scaffolding Tier',
    code: 'PROC-DECK-03',
    sector: 'Sector 2 (Process)',
    category: 'process',
    x: 37,
    y: 38,
    w: 28,
    h: 20,
    riskScore: 10,
    incidents: 0,
    lastIncident: null,
    dominantHazard: 'Nominal Operations · Multi-tier Elevated Work Platforms',
    status: 'normal',
    details: 'Unit 3 structural column and elevated mezzanine deck (Level 3, +18m elevation) with access stairwells.',
    equipmentIds: ['UNIT-3-DECK', 'SCAF-D3', 'PLANK-T2'],
  },

  // ── Sector 3: Catalytic Cracking & Heat Exchangers ──
  {
    id: 'unit-cracking-east',
    name: 'Sector 3: Cracking Platform East & EX-12 Flanges',
    code: 'CRACK-EX-12',
    sector: 'Sector 3 (Cracking)',
    category: 'process',
    x: 71,
    y: 12,
    w: 24,
    h: 22,
    riskScore: 10,
    incidents: 0,
    lastIncident: null,
    dominantHazard: 'Nominal Operations · Shell & Tube Heat Exchanger Train',
    status: 'normal',
    details: 'FCC platform east quadrant housing high-temperature exchanger bank EX-12 and fractionation reboilers.',
    equipmentIds: ['EX-12', 'FCC-REB-1', 'FLG-12B'],
  },
  {
    id: 'unit-water-treatment',
    name: 'Sector 3: Industrial Effluent & Water Treatment',
    code: 'UTIL-WTP-01',
    sector: 'Sector 3 (Utilities)',
    category: 'utilities',
    x: 71,
    y: 38,
    w: 24,
    h: 20,
    riskScore: 8,
    incidents: 0,
    lastIncident: null,
    dominantHazard: 'Nominal Operations · Neutralization & Clarifier Aeration Basin',
    status: 'normal',
    details: 'Process water treatment, oily water separator API pit, and chemical neutralization dosing skid.',
    equipmentIds: ['WTP-POND-1', 'API-SEP-02', 'DOS-SKID-3'],
  },

  // ── Sector 4: Offsite Storage & Crude Tank Farm ──
  {
    id: 'unit-tank-farm-north',
    name: 'Sector 4: North Tank Farm & Crude Storage (TK-80)',
    code: 'OFFSITE-TK-80',
    sector: 'Sector 4 (Tank Farm)',
    category: 'crude',
    x: 6,
    y: 64,
    w: 42,
    h: 24,
    riskScore: 10,
    incidents: 0,
    lastIncident: null,
    dominantHazard: 'Nominal Operations · Atmospheric Floating-Roof Storage Tanks',
    status: 'normal',
    details: 'Crude bulk storage containment basin containing Tank TK-80, steam manifold tracing, and perimeter bund walls.',
    equipmentIds: ['TK-80', 'TK-81', 'BUND-4N', 'FLG-STM-04'],
  },

  // ── Sector 5: Finished Product Dispatch & Loading Gantry ──
  {
    id: 'unit-product-logistics',
    name: 'Sector 5: Finished Product Gantry & Rail Terminal',
    code: 'LOG-RAIL-05',
    sector: 'Sector 5 (Logistics)',
    category: 'logistics',
    x: 52,
    y: 64,
    w: 24,
    h: 24,
    riskScore: 12,
    incidents: 0,
    lastIncident: null,
    dominantHazard: 'Nominal Operations · Grounding Interlocks & Vapor Recovery',
    status: 'normal',
    details: 'Heavy distillate truck loading bays, railcar tanker gantry, and automated grounding continuity verification skids.',
    equipmentIds: ['GANTRY-01', 'RAIL-BAY-A', 'VRU-01'],
  },

  // ── Sector 6: Central Safety Command & Crisis HQ ──
  {
    id: 'unit-safety-hq',
    name: 'Sector 6: Central Safety HQ & Emergency Assembly',
    code: 'HQ-CCR-06',
    sector: 'Sector 6 (HQ & Safety)',
    category: 'safety',
    x: 80,
    y: 64,
    w: 15,
    h: 24,
    riskScore: 5,
    incidents: 0,
    lastIncident: null,
    dominantHazard: 'Designated Safe Haven · Blast-Resistant Command Center',
    status: 'normal',
    details: 'Central Control Room (CCR), SCADA control hub, site medical station, and muster assembly point alpha.',
    equipmentIds: ['CCR-DCS', 'EAP-ALPHA', 'MED-CLINIC'],
  },
];

// ─── Visual Risk Styling ───────────────────────────────────────────────────────
export function getUnitRiskColor(score: number): string {
  if (score >= 80) return '#dc2626'; // Safety Red (Critical SIF Precursor)
  if (score >= 60) return '#ea580c'; // Signal Orange (High Risk)
  if (score >= 40) return '#d97706'; // Hazard Amber (Moderate)
  if (score >= 20) return '#16a34a'; // Safe Green
  return '#10b981';                  // Nominal Baseline
}

export function getUnitRiskOverlay(score: number): { fill: string; border: string; glow: string } {
  if (score >= 80) {
    return {
      fill: 'rgba(220, 38, 38, 0.28)',
      border: '#dc2626',
      glow: 'rgba(220, 38, 38, 0.65)',
    };
  }
  if (score >= 60) {
    return {
      fill: 'rgba(234, 88, 12, 0.22)',
      border: '#ea580c',
      glow: 'rgba(234, 88, 12, 0.5)',
    };
  }
  if (score >= 40) {
    return {
      fill: 'rgba(217, 119, 6, 0.18)',
      border: '#d97706',
      glow: 'rgba(217, 119, 6, 0.35)',
    };
  }
  return {
    fill: 'rgba(16, 185, 129, 0.08)',
    border: '#10b981',
    glow: 'transparent',
  };
}
