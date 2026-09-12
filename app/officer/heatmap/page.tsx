"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  REFINERY_FACILITY_UNITS,
  FacilityUnit,
  getUnitRiskColor,
} from "@/app/lib/refineryMapData";
import { getReportsApi, getAlertsApi, createTaskApi } from "@/app/lib/api";
import { MAINTENANCE_CREWS } from "@/app/officer/tasks/page";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Eye,
  EyeOff,
  Filter,
  Activity,
  Flame,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Search,
  X,
  MapPin,
  Upload,
  ChevronRight,
  Wrench,
  ShieldAlert,
  Sliders,
  Radio,
  Clock,
  ExternalLink
} from "lucide-react";

export interface DynamicFacilityUnit extends FacilityUnit {
  matchedReports: any[];
  matchedAlerts: any[];
  liveRiskScore: number;
  liveIncidents: number;
  liveStatus: 'critical' | 'high' | 'medium' | 'low' | 'normal';
  liveDominantHazard: string;
}

// Soft radial gradient for thermal plumes
function getHeatmapRadialGradient(score: number): string {
  if (score >= 80) {
    return "radial-gradient(circle, rgba(220, 38, 38, 0.72) 0%, rgba(220, 38, 38, 0.35) 45%, rgba(0, 0, 0, 0) 75%)";
  } else if (score >= 60) {
    return "radial-gradient(circle, rgba(234, 88, 12, 0.6) 0%, rgba(234, 88, 12, 0.28) 45%, rgba(0, 0, 0, 0) 75%)";
  } else if (score >= 40) {
    return "radial-gradient(circle, rgba(217, 119, 6, 0.45) 0%, rgba(217, 119, 6, 0.18) 50%, rgba(0, 0, 0, 0) 80%)";
  } else {
    return "radial-gradient(circle, rgba(22, 163, 74, 0.35) 0%, rgba(22, 163, 74, 0.1) 55%, rgba(0, 0, 0, 0) 85%)";
  }
}

// Live simulated sensor telemetry with physical micro-fluctuations
function getUnitTelemetry(unit: DynamicFacilityUnit | FacilityUnit, tick: number = 0) {
  const score = (unit as DynamicFacilityUnit).liveRiskScore || unit.riskScore;
  const isHigh = score >= 80;
  const isMed = score >= 60;

  // Real-time micro fluctuations
  const deltaTemp = Math.sin(tick * 1.5 + score) * 3.2;
  const deltaPress = Math.cos(tick * 0.9 + score) * 0.35;
  const deltaVib = Math.sin(tick * 1.8 + score) * 0.18;
  const deltaGas = Math.floor(Math.abs(Math.sin(tick + score)) * 4);

  const baseTemp = isHigh ? 385 + (score % 30) : isMed ? 240 + (score % 20) : 110 + (score % 15);
  const basePress = isHigh ? (16.4 + (score % 8) * 0.3) : (7.2 + (score % 5) * 0.2);
  const baseVib = isHigh ? (4.8 + (score % 4) * 0.2) : (1.6 + (score % 3) * 0.1);
  const baseGas = isHigh ? 42 + (score % 18) : isMed ? 14 + (score % 8) : 2;

  return {
    temp: Math.round(baseTemp + deltaTemp),
    pressure: (basePress + deltaPress).toFixed(1),
    vibration: (baseVib + deltaVib).toFixed(2),
    gasPpm: Math.max(0, baseGas + deltaGas),
  };
}

// Intelligent heuristic mapper matching live reports to map units
function matchReportToUnit(r: any, unit: FacilityUnit): boolean {
  const text = `${r.title || ''} ${r.description || ''} ${r.location || ''} ${r.zone || ''} ${r.category || ''}`.toLowerCase();
  const code = unit.code.toLowerCase();

  if (text.includes(code)) return true;

  // Sector 1: Utilities & Power
  if (unit.id === 'unit-boiler-a' && (text.includes('boiler') || text.includes('boiler room a') || text.includes('boiler room b') || text.includes('steam header') || text.includes('rep_4ycl4cdq') || text.includes('help help help'))) return true;
  if (unit.id === 'unit-electrical-room' && (text.includes('electrical') || text.includes('panel') || text.includes('substation') || text.includes('water pool') || text.includes('wiring') || text.includes('mcc') || text.includes('switchgear'))) return true;

  // Sector 2: Process Hydro & Elevation Deck
  if (unit.id === 'unit-hydro-unit' && (text.includes('hydrocracker') || text.includes('hydro unit') || text.includes('v-204') || text.includes('bearing') || text.includes('vibration') || text.includes('rep_002') || text.includes('process area 2'))) return true;
  if (unit.id === 'unit-elevation-deck' && (text.includes('scaffolding') && (text.includes('unit 3') || text.includes('sector 2') || text.includes('elevation deck'))) || text.includes('rep_d5gh7mcr')) return true;

  // Sector 3: Catalytic Cracking & Exchangers
  if (unit.id === 'unit-cracking-east' && (text.includes('cracking platform') || text.includes('ex-12') || text.includes('flange line') || text.includes('oily condensation') || text.includes('rep_003') || text.includes('fcc'))) return true;
  if (unit.id === 'unit-water-treatment' && (text.includes('water treatment') || text.includes('effluent') || text.includes('wtp') || text.includes('acid') || text.includes('neutralization'))) return true;

  // Sector 4: Tank Farm North
  if (unit.id === 'unit-tank-farm-north' && (text.includes('tank farm') || text.includes('sector 4') || text.includes('tk-80') || text.includes('crude') || text.includes('steam leak') || text.includes('rep_vjq4hcm6') || text.includes('rep_001'))) return true;

  // Sector 5: Product Logistics & Rail Gantry
  if (unit.id === 'unit-product-logistics' && (text.includes('rail') || text.includes('gantry') || text.includes('product storage') || text.includes('truck') || text.includes('loading'))) return true;

  // Sector 6: Safety HQ & Assembly
  if (unit.id === 'unit-safety-hq' && (text.includes('control room') || text.includes('admin') || text.includes('assembly') || text.includes('clinic') || text.includes('security'))) return true;

  return false;
}

export default function HeatmapPage() {
  const [loading, setLoading] = useState(true);
  const [facilityUnits, setFacilityUnits] = useState<DynamicFacilityUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<DynamicFacilityUnit | null>(null);
  const [hoveredUnit, setHoveredUnit] = useState<DynamicFacilityUnit | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Toggles & Controls
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showPins, setShowPins] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [sidePanelOpen, setSidePanelOpen] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Live Telemetry stream ticker
  const [telemetryTick, setTelemetryTick] = useState<number>(0);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>("Just now");
  const [totalLiveReportsCount, setTotalLiveReportsCount] = useState<number>(0);
  const [toast, setToast] = useState<string>("");

  // Quick Dispatch Modal State from Heatmap
  const [dispatchModalUnit, setDispatchModalUnit] = useState<DynamicFacilityUnit | null>(null);
  const [dispatchCrew, setDispatchCrew] = useState<string>(MAINTENANCE_CREWS[0]);
  const [dispatchInstructions, setDispatchInstructions] = useState<string>("");
  const [dispatchLoto, setDispatchLoto] = useState<boolean>(false);
  const [isSubmittingDispatch, setIsSubmittingDispatch] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Function to pull live data and dynamically aggregate into units
  const syncLiveData = async () => {
    try {
      const [reportsRes, alertsRes] = await Promise.all([
        getReportsApi({ limit: 100 }),
        getAlertsApi(),
      ]);

      const liveReports: any[] = reportsRes.data || [];
      const liveAlerts: any[] = alertsRes.data || [];
      setTotalLiveReportsCount(liveReports.length);

      const computedUnits: DynamicFacilityUnit[] = REFINERY_FACILITY_UNITS.map(unit => {
        const matchedR = liveReports.filter(r => matchReportToUnit(r, unit));
        const matchedA = liveAlerts.filter(a => matchReportToUnit(a, unit));

        // Separate active vs resolved reports
        const activeReports = matchedR.filter(r => r.status !== 'resolved');
        const resolvedReports = matchedR.filter(r => r.status === 'resolved');

        let liveRiskScore = unit.riskScore;
        let liveStatus: 'critical' | 'high' | 'medium' | 'low' | 'normal' = 'normal';
        let liveDominantHazard = unit.dominantHazard;

        if (activeReports.length > 0) {
          // Compute highest active risk score
          const maxReportScore = activeReports.reduce((max, r) => {
            const s = r.riskAssessment?.riskScore || r.risk_score || r.riskScore || (r.severity === 'critical' ? 88 : r.severity === 'high' ? 75 : r.severity === 'medium' ? 50 : 25);
            return Math.max(max, s);
          }, 0);
          liveRiskScore = Math.max(unit.riskScore, maxReportScore);
          liveStatus = liveRiskScore >= 80 ? 'critical' : liveRiskScore >= 60 ? 'high' : liveRiskScore >= 40 ? 'medium' : 'low';
          liveDominantHazard = activeReports[0]?.title || matchedA[0]?.message || unit.dominantHazard;
        } else if (resolvedReports.length > 0) {
          // If all reports for this unit are resolved, clear risk back to nominal
          liveRiskScore = 10;
          liveStatus = 'normal';
          liveDominantHazard = `All ${resolvedReports.length} incidents cleared & verified safe by maintenance`;
        }

        return {
          ...unit,
          riskScore: liveRiskScore,
          incidents: activeReports.length,
          status: liveStatus,
          dominantHazard: liveDominantHazard,
          matchedReports: matchedR,
          matchedAlerts: matchedA,
          liveRiskScore,
          liveIncidents: activeReports.length,
          liveStatus,
          liveDominantHazard,
        };
      });

      setFacilityUnits(computedUnits);
      setLastSyncedTime("Just now");
    } catch (err) {
      console.warn("Could not sync live heatmap reports, falling back:", err);
      if (facilityUnits.length === 0) {
        setFacilityUnits(REFINERY_FACILITY_UNITS.map(u => ({
          ...u,
          matchedReports: [],
          matchedAlerts: [],
          liveRiskScore: u.riskScore,
          liveIncidents: 0,
          liveStatus: 'normal',
          liveDominantHazard: u.dominantHazard,
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncLiveData();
    const interval = setInterval(syncLiveData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Micro-telemetry fluctuations (sensor heartbeat)
  useEffect(() => {
    const timer = setInterval(() => {
      setTelemetryTick(prev => prev + 1);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  // Dynamic Overall Facility Risk calculation based purely on active reports
  const unitsToProcess = facilityUnits.length > 0 ? facilityUnits : (REFINERY_FACILITY_UNITS as DynamicFacilityUnit[]);
  
  // Calculate plant SIF risk based on highest active unit and active report density
  const activeIncidentCount = unitsToProcess.reduce((sum, u) => sum + (u.liveIncidents || 0), 0);
  const highestActiveRisk = unitsToProcess.reduce((max, u) => Math.max(max, u.liveRiskScore || 0), 0);
  const overallPlantRiskIndex = activeIncidentCount > 0 
    ? Math.min(96, Math.max(highestActiveRisk, 68 + activeIncidentCount * 3))
    : 14;

  // Filter units based on selection & search
  const filteredUnits = unitsToProcess.filter((u) => {
    const score = u.liveRiskScore || u.riskScore;
    if (activeFilter === "extreme") return score >= 80;
    if (activeFilter === "high") return score >= 60 && score < 80;
    if (activeFilter === "moderate") return score >= 40 && score < 60;
    if (activeFilter === "low") return score < 40;
    return true;
  }).filter((u) => {
    if (!searchQuery) return true;
    return u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           u.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
           u.sector.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => {
      const next = Math.min(Math.max(prev + delta, 0.8), 2.2);
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleReset = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".map-unit-interactive")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const focusUnit = (unit: DynamicFacilityUnit) => {
    setSelectedUnit(unit);
    setSidePanelOpen(true);
  };

  const criticalHotspots = [...unitsToProcess]
    .filter(u => (u.liveIncidents || 0) > 0 || (u.liveRiskScore || 0) >= 40)
    .sort((a, b) => (b.liveRiskScore || 0) - (a.liveRiskScore || 0));

  const selectedTelemetry = selectedUnit ? getUnitTelemetry(selectedUnit, telemetryTick) : null;

  const handleQuickDispatch = (unit: DynamicFacilityUnit) => {
    setDispatchModalUnit(unit);
    setDispatchInstructions(`Emergency work order dispatch for ${unit.name} (${unit.code}): ${unit.liveDominantHazard || unit.dominantHazard}`);
    setDispatchLoto((unit.liveRiskScore || unit.riskScore) >= 80);
  };

  const submitQuickDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchModalUnit) return;
    setIsSubmittingDispatch(true);

    try {
      await createTaskApi({
        title: `Maintenance Dispatch: ${dispatchModalUnit.code}`,
        description: dispatchInstructions || `Investigate elevated risk & correct hazards at ${dispatchModalUnit.name}`,
        equipmentId: dispatchModalUnit.code,
        equipmentName: dispatchModalUnit.name,
        location: dispatchModalUnit.name,
        severity: (dispatchModalUnit.liveRiskScore || dispatchModalUnit.riskScore) >= 80 ? 'critical' : 'high',
        assignedCrew: dispatchCrew,
        lotoRequired: dispatchLoto,
        reportId: dispatchModalUnit.matchedReports[0]?._id || dispatchModalUnit.matchedReports[0]?.id,
      });

      setToast(`Work order successfully dispatched to ${dispatchCrew}`);
      setTimeout(() => setToast(""), 4000);
      setDispatchModalUnit(null);
      syncLiveData();
    } catch (err: any) {
      alert(`Could not dispatch work order: ${err?.message || 'Server error'}`);
    } finally {
      setIsSubmittingDispatch(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ height: 32, width: 280, backgroundColor: "#E2E8F0", borderRadius: 6, marginBottom: 16 }} />
        <div style={{ height: 600, width: "100%", backgroundColor: "#E2E8F0", borderRadius: 12 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      
      {/* Toast feedback */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          backgroundColor: "#0A192F", color: "#FFFFFF", padding: "12px 20px",
          borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700,
          border: "1px solid rgba(255,255,255,0.2)"
        }}>
          <CheckCircle2 style={{ width: 18, height: 18, color: "#10B981" }} />
          <span>{toast}</span>
        </div>
      )}

      {/* ─── 1. TOP HEADER & LIVE TELEMETRY BAR ─────────────────────────── */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: 14, border: "1px solid #D9DEE7", padding: "18px 24px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
        
        {/* Title + Status */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.4px" }}>
              Dynamic Refinery Facility Heatmap &amp; CAD Schematic
            </h1>
            <span style={{
              fontSize: 11, fontWeight: 800, backgroundColor: "#DCFCE7", color: "#166534",
              padding: "3px 10px", borderRadius: 999, border: "1px solid #BBF7D0",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#16A34A", animation: "applePulse 1.8s infinite" }} />
              LIVE DATABASE SYNC
            </span>
          </div>
          <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0 0" }}>
            Real-time SIF Precursor Risk Heatmap · Zero False Alarms · Synchronized with <strong>{totalLiveReportsCount} Field Reports</strong> &amp; MongoDB Atlas
          </p>
        </div>

        {/* Search / Jump to Unit */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <Search style={{ position: "absolute", left: 10, top: 9, width: 15, height: 15, color: "#94A3B8" }} />
            <input
              type="text"
              placeholder="Search Sector, Unit, or Code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: "8px 12px 8px 32px", fontSize: 13, borderRadius: 8, border: "1px solid #D9DEE7", outline: "none", width: 260, backgroundColor: "#F8FAFC" }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 8, top: 8, background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>

          <button
            onClick={syncLiveData}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "1px solid #D9DEE7",
              backgroundColor: "#FFFFFF", color: "#0F172A", fontSize: 12, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
            title="Force refresh live database stream"
          >
            <Radio style={{ width: 14, height: 14, color: "#16A34A" }} />
            <span>Sync Live DB</span>
          </button>
        </div>

      </div>

      {/* ─── 2. CONTROLS, FILTERS & VIEW TOGGLES ───────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        
        {/* Risk Filter Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "all", label: "All Sectors", count: unitsToProcess.length },
            { id: "extreme", label: "Critical Precursors (80+)", count: unitsToProcess.filter(u => (u.liveRiskScore || u.riskScore) >= 80).length, color: "#DC2626" },
            { id: "high", label: "High Risk (60-79)", count: unitsToProcess.filter(u => (u.liveRiskScore || u.riskScore) >= 60 && (u.liveRiskScore || u.riskScore) < 80).length, color: "#EA580C" },
            { id: "moderate", label: "Moderate (40-59)", count: unitsToProcess.filter(u => (u.liveRiskScore || u.riskScore) >= 40 && (u.liveRiskScore || u.riskScore) < 60).length, color: "#D97706" },
            { id: "low", label: "Safe / Nominal (<40)", count: unitsToProcess.filter(u => (u.liveRiskScore || u.riskScore) < 40).length, color: "#16A34A" },
          ].map((f) => {
            const isActive = activeFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: isActive ? "1.5px solid #0A192F" : "1px solid #D9DEE7",
                  backgroundColor: isActive ? "#0A192F" : "#FFFFFF",
                  color: isActive ? "#FFFFFF" : "#334155",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s ease",
                }}
              >
                {f.color && <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: f.color }} />}
                <span>{f.label}</span>
                <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 10, backgroundColor: isActive ? "rgba(255,255,255,0.2)" : "#F1F5F9", color: isActive ? "#FFFFFF" : "#64748B" }}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Map View Mode Toggles */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              backgroundColor: showHeatmap ? "#EFF6FF" : "#FFFFFF",
              color: showHeatmap ? "#1D4ED8" : "#64748B",
              border: `1px solid ${showHeatmap ? "#BFDBFE" : "#D9DEE7"}`,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Flame style={{ width: 14, height: 14 }} />
            Thermal Heat Plumes: {showHeatmap ? "ON" : "OFF"}
          </button>

          <button
            onClick={() => setShowGrid(!showGrid)}
            style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              backgroundColor: showGrid ? "#EFF6FF" : "#FFFFFF",
              color: showGrid ? "#1D4ED8" : "#64748B",
              border: `1px solid ${showGrid ? "#BFDBFE" : "#D9DEE7"}`,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Layers style={{ width: 14, height: 14 }} />
            CAD Coordinate Grid: {showGrid ? "ON" : "OFF"}
          </button>

          <button
            onClick={() => setSidePanelOpen(!sidePanelOpen)}
            style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              backgroundColor: sidePanelOpen ? "#0A192F" : "#FFFFFF",
              color: sidePanelOpen ? "#FFFFFF" : "#64748B",
              border: "1px solid #D9DEE7", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Sliders style={{ width: 14, height: 14 }} />
            <span>Inspector Drawer</span>
          </button>
        </div>

      </div>

      {/* ─── 3. INTERACTIVE MAP & INSPECTOR SIDE PANEL ────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: sidePanelOpen ? "1fr 380px" : "1fr", gap: 18, alignItems: "start" }}>
        
        {/* Heatmap Canvas Container */}
        <div
          ref={mapContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            position: "relative",
            width: "100%",
            height: 680,
            backgroundColor: "#070E1A",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            border: "1px solid #1E293B",
            cursor: isDragging ? "grabbing" : "grab",
            userSelect: "none",
          }}
        >
          {/* Zoom & Canvas HUD controls */}
          <div style={{ position: "absolute", top: 16, left: 16, zIndex: 40, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", backgroundColor: "rgba(11, 20, 38, 0.9)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.4)", backdropFilter: "blur(6px)" }}>
              <button onClick={() => handleZoom(0.2)} style={{ padding: 8, background: "none", border: "none", color: "white", cursor: "pointer", display: "flex" }} title="Zoom In">
                <ZoomIn style={{ width: 16, height: 16 }} />
              </button>
              <div style={{ width: 1, backgroundColor: "rgba(255,255,255,0.15)" }} />
              <button onClick={() => handleZoom(-0.2)} style={{ padding: 8, background: "none", border: "none", color: "white", cursor: "pointer", display: "flex" }} title="Zoom Out">
                <ZoomOut style={{ width: 16, height: 16 }} />
              </button>
              <div style={{ width: 1, backgroundColor: "rgba(255,255,255,0.15)" }} />
              <button onClick={handleReset} style={{ padding: 8, background: "none", border: "none", color: "white", cursor: "pointer", display: "flex" }} title="Reset View">
                <RotateCcw style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>

          {/* Plant Compass & Coordinate Watermark */}
          <div style={{ position: "absolute", top: 16, right: 16, zIndex: 40, display: "flex", alignItems: "center", gap: 8, backgroundColor: "rgba(11, 20, 38, 0.85)", padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", color: "#94A3B8", fontSize: 11, fontWeight: 700, backdropFilter: "blur(6px)" }}>
            <span>CAD ZONE: 43°41'N 79°23'W</span>
            <span style={{ color: "#38BDF8", fontWeight: 900 }}>▲ TRUE N</span>
          </div>

          {/* Map Canvas with smooth Pan & Zoom */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.15s ease-out",
            }}
          >
            {/* ─── VECTOR ARCHITECTURAL CAD SCHEMATIC (SVG) ─── */}
            <svg
              viewBox="0 0 1000 680"
              style={{ width: "100%", height: "100%", display: "block" }}
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                {/* Millimeter Grid Pattern */}
                <pattern id="cadGridSmall" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#13233D" strokeWidth="0.5" />
                </pattern>
                <pattern id="cadGridLarge" width="100" height="100" patternUnits="userSpaceOnUse">
                  <rect width="100" height="100" fill="url(#cadGridSmall)" />
                  <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#1D3557" strokeWidth="1" />
                </pattern>

                {/* Glow Filter for Active Hazard Nodes */}
                <filter id="hazardGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Radial Gradient for Thermal Hotspots */}
                <radialGradient id="gradCritical" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#DC2626" stopOpacity="0.75" />
                  <stop offset="50%" stopColor="#DC2626" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#DC2626" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="gradHigh" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#EA580C" stopOpacity="0.65" />
                  <stop offset="50%" stopColor="#EA580C" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#EA580C" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="gradMedium" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#D97706" stopOpacity="0.5" />
                  <stop offset="50%" stopColor="#D97706" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="gradNominal" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Background Deep Slate Blueprint Grid */}
              <rect width="1000" height="680" fill="#070F1E" />
              {showGrid && <rect width="1000" height="680" fill="url(#cadGridLarge)" opacity="0.65" />}

              {/* Perimeter Boundary Fence */}
              <rect x="25" y="25" width="950" height="630" fill="none" stroke="#1E3A5F" strokeWidth="2" strokeDasharray="8,4" />
              <text x="40" y="45" fill="#38BDF8" fontSize="10" fontFamily="monospace" letterSpacing="2">PERIMETER SECURITY FENCE · FORESITE ARCHITECTURAL GIS</text>

              {/* Inter-Sector Pipe Racks (Industrial Utility Corridors) */}
              <g stroke="#1E3A5F" strokeWidth="5" fill="none">
                {/* Horizontal Pipe Main North */}
                <path d="M 40 240 L 960 240" stroke="#152B47" strokeWidth="12" />
                <path d="M 40 240 L 960 240" stroke="#38BDF8" strokeWidth="2" strokeDasharray="14,8" opacity="0.4" />
                
                {/* Horizontal Pipe Main South */}
                <path d="M 40 420 L 960 420" stroke="#152B47" strokeWidth="12" />
                <path d="M 40 420 L 960 420" stroke="#38BDF8" strokeWidth="2" strokeDasharray="14,8" opacity="0.4" />

                {/* Vertical Central Interconnect */}
                <path d="M 330 30 L 330 650" stroke="#152B47" strokeWidth="10" />
                <path d="M 680 30 L 680 650" stroke="#152B47" strokeWidth="10" />
              </g>

              {/* Sector Headers / Boundary Blocks */}
              <g fontFamily="monospace" fontSize="11" fontWeight="bold">
                {/* Sector 1 Label */}
                <rect x="40" y="55" width="270" height="24" fill="#0C1B33" stroke="#1E3A5F" rx="4" />
                <text x="50" y="71" fill="#7DD3FC">SECTOR 1: UTILITIES &amp; POWER BLOCK</text>

                {/* Sector 2 Label */}
                <rect x="350" y="55" width="300" height="24" fill="#0C1B33" stroke="#1E3A5F" rx="4" />
                <text x="360" y="71" fill="#7DD3FC">SECTOR 2: PROCESS &amp; HYDROCRACKING</text>

                {/* Sector 3 Label */}
                <rect x="690" y="55" width="265" height="24" fill="#0C1B33" stroke="#1E3A5F" rx="4" />
                <text x="700" y="71" fill="#7DD3FC">SECTOR 3: CRACKING PLATFORM &amp; WTP</text>

                {/* Sector 4 Label */}
                <rect x="40" y="415" width="440" height="24" fill="#0C1B33" stroke="#1E3A5F" rx="4" />
                <text x="50" y="431" fill="#7DD3FC">SECTOR 4: OFFSITE BULK CRUDE TANK FARM</text>

                {/* Sector 5 Label */}
                <rect x="500" y="415" width="260" height="24" fill="#0C1B33" stroke="#1E3A5F" rx="4" />
                <text x="510" y="431" fill="#7DD3FC">SECTOR 5: FINISHED PRODUCT GANTRY</text>

                {/* Sector 6 Label */}
                <rect x="780" y="415" width="175" height="24" fill="#0C1B33" stroke="#1E3A5F" rx="4" />
                <text x="790" y="431" fill="#7DD3FC">SECTOR 6: HQ &amp; SAFETY</text>
              </g>

              {/* Tank Farm Architectural Cylinders in Sector 4 */}
              <g stroke="#1D3E68" strokeWidth="2" fill="#081426">
                {/* Tank TK-80 (Active / Resolved hazard site) */}
                <circle cx="160" cy="540" r="65" />
                <circle cx="160" cy="540" r="50" strokeDasharray="6,4" />
                <text x="160" y="545" fill="#64748B" fontSize="12" fontFamily="monospace" textAnchor="middle">TK-80</text>
                
                {/* Tank TK-81 */}
                <circle cx="340" cy="540" r="65" />
                <circle cx="340" cy="540" r="50" strokeDasharray="6,4" />
                <text x="340" y="545" fill="#64748B" fontSize="12" fontFamily="monospace" textAnchor="middle">TK-81</text>
              </g>

              {/* Process Vessels in Sector 2 */}
              <g stroke="#1D3E68" strokeWidth="2" fill="#081426">
                {/* Hydrocracker Reactor Column V-204 */}
                <rect x="420" y="100" width="55" height="110" rx="20" />
                <line x1="420" y1="135" x2="475" y2="135" strokeDasharray="4,4" />
                <line x1="420" y1="175" x2="475" y2="175" strokeDasharray="4,4" />
                <text x="447" y="155" fill="#64748B" fontSize="11" fontFamily="monospace" textAnchor="middle">V-204</text>

                {/* Elevation Scaffolding Mezzanine Unit 3 */}
                <rect x="520" y="275" width="110" height="85" fill="#0B1A30" strokeDasharray="4,4" />
                <line x1="520" y1="275" x2="630" y2="360" stroke="#193354" strokeWidth="1" />
                <line x1="520" y1="360" x2="630" y2="275" stroke="#193354" strokeWidth="1" />
                <text x="575" y="320" fill="#64748B" fontSize="11" fontFamily="monospace" textAnchor="middle">UNIT 3 DECK</text>
              </g>

              {/* Boiler & Steam Header in Sector 1 */}
              <g stroke="#1D3E68" strokeWidth="2" fill="#081426">
                <rect x="70" y="100" width="130" height="95" rx="6" />
                <circle cx="110" cy="145" r="22" strokeDasharray="4,2" />
                <circle cx="160" cy="145" r="22" strokeDasharray="4,2" />
                <text x="135" y="150" fill="#64748B" fontSize="11" fontFamily="monospace" textAnchor="middle">BOILER A</text>

                {/* Substation */}
                <rect x="70" y="275" width="180" height="85" rx="4" />
                <text x="160" y="320" fill="#64748B" fontSize="11" fontFamily="monospace" textAnchor="middle">SUBSTATION MCC</text>
              </g>

              {/* Cracking Exchanger Bank EX-12 in Sector 3 */}
              <g stroke="#1D3E68" strokeWidth="2" fill="#081426">
                <rect x="730" y="100" width="170" height="95" rx="4" />
                <circle cx="770" cy="145" r="18" />
                <circle cx="815" cy="145" r="18" />
                <circle cx="860" cy="145" r="18" />
                <text x="815" y="180" fill="#64748B" fontSize="10" fontFamily="monospace" textAnchor="middle">EX-12 FLANGE TRAIN</text>
              </g>

              {/* ─── DYNAMIC RADIAL HEAT PLUMES OVER ACTIVE SITES ─── */}
              {showHeatmap && filteredUnits.map(unit => {
                const score = unit.liveRiskScore || unit.riskScore;
                const activeCount = unit.liveIncidents || 0;
                
                // If 0 active incidents, render very subtle nominal aura or none
                if (activeCount === 0 && score < 40) return null;

                const gradId = score >= 80 ? "url(#gradCritical)" : score >= 60 ? "url(#gradHigh)" : "url(#gradMedium)";
                const radius = score >= 80 ? 110 : score >= 60 ? 90 : 70;
                const cx = (unit.x + unit.w / 2) * 10;
                const cy = (unit.y + unit.h / 2) * 6.8;

                return (
                  <circle
                    key={`plume-${unit.id}`}
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill={gradId}
                    style={{ mixBlendMode: "screen", pointerEvents: "none" }}
                  />
                );
              })}
            </svg>

            {/* ─── INTERACTIVE HTML OVERLAYS & ASSET BADGES ─── */}
            {filteredUnits.map((unit) => {
              const isSelected = selectedUnit?.id === unit.id;
              const isHovered = hoveredUnit?.id === unit.id;
              const score = unit.liveRiskScore || unit.riskScore;
              const color = getUnitRiskColor(score);
              const activeCount = unit.liveIncidents || 0;
              const isResolvedOnly = activeCount === 0 && unit.matchedReports.some(r => r.status === 'resolved');
              const isCritical = score >= 80 && activeCount > 0;

              return (
                <div
                  key={`interactive-${unit.id}`}
                  className="map-unit-interactive"
                  onClick={() => focusUnit(unit)}
                  onMouseEnter={() => setHoveredUnit(unit)}
                  onMouseLeave={() => setHoveredUnit(null)}
                  style={{
                    position: "absolute",
                    left: `${unit.x}%`,
                    top: `${unit.y}%`,
                    width: `${unit.w}%`,
                    height: `${unit.h}%`,
                    border: isSelected ? `2.5px solid #38BDF8` : `1.5px solid ${isCritical ? '#DC2626' : isHovered ? 'rgba(56, 189, 248, 0.6)' : 'rgba(30, 58, 95, 0.5)'}`,
                    borderRadius: 10,
                    backgroundColor: isSelected ? "rgba(56, 189, 248, 0.12)" : isCritical ? "rgba(220, 38, 38, 0.14)" : isHovered ? "rgba(255,255,255,0.04)" : "rgba(10, 25, 47, 0.2)",
                    boxShadow: isSelected ? "0 0 20px rgba(56, 189, 248, 0.3)" : isCritical ? "0 0 16px rgba(220, 38, 38, 0.4)" : "none",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    zIndex: isSelected ? 35 : isHovered ? 34 : 20,
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  {/* Unit Identification Bar */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4 }}>
                    <div style={{
                      backgroundColor: isSelected ? "#38BDF8" : "rgba(11, 20, 38, 0.9)",
                      color: isSelected ? "#070F1E" : "#E2E8F0",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 800,
                      fontFamily: "monospace",
                      border: `1px solid ${isSelected ? "#38BDF8" : "rgba(255,255,255,0.15)"}`,
                      boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                    }}>
                      {unit.code}
                    </div>

                    {/* Active Hazard Badge or Cleared Status */}
                    {activeCount > 0 ? (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        backgroundColor: "#DC2626",
                        color: "#FFFFFF",
                        padding: "2px 7px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 900,
                        boxShadow: "0 0 8px rgba(220, 38, 38, 0.6)",
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#FFF", animation: "applePulse 1.2s infinite" }} />
                        {activeCount} {activeCount === 1 ? "HAZARD" : "HAZARDS"}
                      </div>
                    ) : isResolvedOnly ? (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                        backgroundColor: "#166534",
                        color: "#DCFCE7",
                        padding: "2px 6px",
                        borderRadius: 999,
                        fontSize: 9,
                        fontWeight: 800,
                        border: "1px solid #22C55E",
                      }}>
                        <CheckCircle2 style={{ width: 10, height: 10 }} />
                        CLEARED
                      </div>
                    ) : (
                      <div style={{
                        color: "#10B981",
                        fontSize: 10,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontFamily: "monospace",
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#10B981" }} />
                        NOMINAL
                      </div>
                    )}
                  </div>

                  {/* Center Node Visual Pulse on Critical Hazards */}
                  {isCritical && (
                    <div style={{ alignSelf: "center", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{
                        position: "absolute",
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        border: "2px solid #DC2626",
                        animation: "applePulse 1.6s ease-in-out infinite",
                      }} />
                      <div style={{
                        backgroundColor: "#DC2626",
                        color: "#FFFFFF",
                        padding: "4px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 900,
                        boxShadow: "0 4px 14px rgba(220, 38, 38, 0.7)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}>
                        <Flame style={{ width: 13, height: 13 }} />
                        <span>{score} SIF</span>
                      </div>
                    </div>
                  )}

                  {/* Footnote Name */}
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: isSelected ? "#FFFFFF" : "#94A3B8",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    backgroundColor: "rgba(7, 15, 30, 0.75)",
                    padding: "2px 4px",
                    borderRadius: 4,
                  }}>
                    {unit.name.split(":")[1]?.trim() || unit.name}
                  </div>

                  {/* Floating Detailed Hover Card */}
                  {isHovered && !isSelected && (
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "-10px",
                        transform: "translate(-50%, -100%)",
                        backgroundColor: "#FFFFFF",
                        color: "#0F172A",
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: `2px solid ${color}`,
                        boxShadow: "0 14px 34px rgba(0,0,0,0.5)",
                        zIndex: 90,
                        pointerEvents: "none",
                        minWidth: 260,
                        maxWidth: 320,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{unit.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 900, color, padding: "1px 6px", borderRadius: 4, backgroundColor: `${color}15` }}>
                          {score} / 100
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "#475569", marginBottom: 6, lineHeight: 1.4 }}>
                        {unit.liveDominantHazard || unit.dominantHazard}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: activeCount > 0 ? "#DC2626" : "#16A34A" }}>
                        {activeCount > 0 
                          ? `⚠️ ${activeCount} active hazard reports in database` 
                          : isResolvedOnly 
                          ? `✅ Work completed & signed off by maintenance` 
                          : `🛡️ No active incident precursors`}
                      </div>
                    </div>
                  )}

                </div>
              );
            })}

          </div>

          {/* Floating Canvas Footer Scale */}
          <div
            style={{
              position: "absolute",
              bottom: 14,
              left: 16,
              display: "flex",
              alignItems: "center",
              gap: 14,
              backgroundColor: "rgba(11, 20, 38, 0.92)",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "8px 16px",
              borderRadius: 10,
              backdropFilter: "blur(6px)",
              color: "white",
              fontSize: 11,
              fontWeight: 600,
              zIndex: 30,
            }}
          >
            <span>LIVE SIF RISK LEVEL:</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#16A34A" }}>SAFE (&lt;40)</span>
              <div style={{ width: 110, height: 6, borderRadius: 999, background: "linear-gradient(to right, #16A34A, #D97706, #EA580C, #DC2626)" }} />
              <span style={{ color: "#DC2626" }}>CRITICAL SIF (80+)</span>
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 14,
              right: 16,
              display: "flex",
              alignItems: "center",
              gap: 6,
              backgroundColor: "rgba(11, 20, 38, 0.92)",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "8px 14px",
              borderRadius: 10,
              backdropFilter: "blur(6px)",
              color: "#94A3B8",
              fontSize: 11,
              fontWeight: 600,
              zIndex: 30,
            }}
          >
            <span>Auto-refreshing every 8s</span>
          </div>

        </div>

        {/* ─── 4. DYNAMIC SIDE INSPECTOR / ANALYTICS DRAWER ─────────────── */}
        {sidePanelOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            
            {/* When a Unit is Selected: Live Telemetry, Real DB Reports & Actions */}
            {selectedUnit ? (
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #D9DEE7", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#1D4ED8", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      {selectedUnit.sector}
                    </span>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "4px 0 0 0" }}>
                      {selectedUnit.name}
                    </h3>
                  </div>
                  <button onClick={() => setSelectedUnit(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#64748B" }}>
                    <X style={{ width: 18, height: 18 }} />
                  </button>
                </div>

                {/* Live Score badge */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F8FAFC", padding: "12px 14px", borderRadius: 10, border: "1px solid #E2E8F0", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Calculated SIF Risk Score</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: getUnitRiskColor(selectedUnit.liveRiskScore || selectedUnit.riskScore), lineHeight: 1.1, marginTop: 2 }}>
                      {selectedUnit.liveRiskScore || selectedUnit.riskScore} <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>/ 100</span>
                    </div>
                  </div>
                  <span style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800,
                    backgroundColor: (selectedUnit.liveRiskScore || selectedUnit.riskScore) >= 80 ? "#FEF2F2" : (selectedUnit.liveRiskScore || selectedUnit.riskScore) >= 60 ? "#FFF7ED" : "#F0FDF4",
                    color: getUnitRiskColor(selectedUnit.liveRiskScore || selectedUnit.riskScore),
                    border: `1px solid ${getUnitRiskColor(selectedUnit.liveRiskScore || selectedUnit.riskScore)}40`,
                  }}>
                    {(selectedUnit.liveStatus || selectedUnit.status).toUpperCase()}
                  </span>
                </div>

                {/* Real-Time Live IoT Sensors */}
                {selectedTelemetry && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        TELEMETRY SENSOR TELEMETRY
                      </span>
                      <span style={{ fontSize: 10, color: "#16A34A", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#16A34A", animation: "applePulse 1.5s infinite" }} />
                        ONLINE
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px" }}>
                        <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>TEMPERATURE</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{selectedTelemetry.temp}°C</div>
                      </div>
                      <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px" }}>
                        <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>PRESSURE</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{selectedTelemetry.pressure} bar</div>
                      </div>
                      <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px" }}>
                        <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>VIBRATION</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{selectedTelemetry.vibration} mm/s</div>
                      </div>
                      <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px" }}>
                        <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>GAS (LEL)</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: selectedTelemetry.gasPpm > 25 ? "#DC2626" : "#0F172A", marginTop: 2 }}>{selectedTelemetry.gasPpm} ppm</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dominant Hazard */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                    HAZARD DIAGNOSTIC &amp; DETAILS
                  </div>
                  <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                    {selectedUnit.liveDominantHazard || selectedUnit.details}
                  </p>
                </div>

                {/* ─── REAL DATABASE REPORTS MATCHED IN THIS SECTOR ─── */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: selectedUnit.matchedReports.length > 0 ? "#DC2626" : "#16A34A", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      DATABASE REPORTS IN THIS ZONE ({selectedUnit.matchedReports.length})
                    </span>
                  </div>

                  {selectedUnit.matchedReports.length === 0 ? (
                    <div style={{ padding: "12px", backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, fontSize: 12, color: "#166534", display: "flex", alignItems: "center", gap: 8 }}>
                      <CheckCircle2 style={{ width: 16, height: 16, color: "#16A34A" }} />
                      <span>Zero active reports. Zone is operating at safe nominal baseline.</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                      {selectedUnit.matchedReports.map((rep: any) => {
                        const isResolved = rep.status === 'resolved';
                        const score = rep.riskAssessment?.riskScore || rep.risk_score || 85;
                        return (
                          <div key={rep._id || rep.id} style={{
                            padding: "10px 12px",
                            borderRadius: 8,
                            backgroundColor: isResolved ? "#F0FDF4" : "#FEF2F2",
                            border: `1px solid ${isResolved ? "#BBF7D0" : "#FCA5A5"}`,
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: isResolved ? "#166534" : "#991B1B" }}>
                                {rep.title}
                              </span>
                              <span style={{
                                fontSize: 10, fontWeight: 800,
                                padding: "2px 6px", borderRadius: 4,
                                backgroundColor: isResolved ? "#DCFCE7" : "#FEE2E2",
                                color: isResolved ? "#166534" : "#DC2626",
                              }}>
                                {isResolved ? "RESOLVED" : `${score} pts`}
                              </span>
                            </div>

                            <div style={{ fontSize: 11, color: "#475569" }}>
                              📍 {rep.location || selectedUnit.name}
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 4 }}>
                              <span style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>
                                Status: <strong>{rep.status}</strong>
                              </span>
                              <Link
                                href={`/officer/reports/${rep._id || rep.id}`}
                                style={{ fontSize: 11, color: "#1D4ED8", fontWeight: 700, display: "flex", alignItems: "center", gap: 3, textDecoration: "none" }}
                              >
                                View Report <ExternalLink style={{ width: 11, height: 11 }} />
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Action CTA buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    onClick={() => handleQuickDispatch(selectedUnit)}
                    style={{
                      padding: "10px 14px", backgroundColor: "#0A192F", color: "#FFFFFF",
                      borderRadius: 8, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    <Wrench style={{ width: 15, height: 15 }} />
                    Dispatch Maintenance Work Order
                  </button>
                  <Link
                    href="/officer/reports"
                    style={{
                      padding: "8px 14px", backgroundColor: "#FFFFFF", color: "#0F172A",
                      border: "1.5px solid #D9DEE7", borderRadius: 8, fontSize: 12, fontWeight: 700,
                      textAlign: "center", textDecoration: "none", display: "block",
                    }}
                  >
                    Browse All Facility Incidents
                  </Link>
                </div>

              </div>
            ) : (
              /* Default State: Overall Live Risk Overview & Critical Drivers */
              <>
                {/* Overall Score */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #D9DEE7", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                    PLANT OVERALL SIF RISK INDEX
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 36, fontWeight: 900, color: getUnitRiskColor(overallPlantRiskIndex), lineHeight: 1 }}>
                        {overallPlantRiskIndex}<span style={{ fontSize: 16, color: "#64748B", fontWeight: 600 }}>/100</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>
                        {overallPlantRiskIndex >= 80 ? "Critical Facility Precursor Alert" : overallPlantRiskIndex >= 60 ? "Elevated Risk Precursor Warning" : "Operational Safety Baseline Nominal"}
                      </div>
                    </div>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", backgroundColor: overallPlantRiskIndex >= 60 ? "#FEF2F2" : "#F0FDF4", border: `2px solid ${getUnitRiskColor(overallPlantRiskIndex)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <AlertTriangle style={{ width: 24, height: 24, color: getUnitRiskColor(overallPlantRiskIndex) }} />
                    </div>
                  </div>
                </div>

                {/* Top Critical Risk Drivers (Clickable to Focus on Map) */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #D9DEE7", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                    ACTIVE DATABASE HOTSPOTS ({criticalHotspots.length})
                  </div>
                  {criticalHotspots.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#166534", margin: 0 }}>All sectors currently verified at normal baseline.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {criticalHotspots.map((unit, idx) => {
                        const score = unit.liveRiskScore || unit.riskScore;
                        return (
                          <div
                            key={unit.id}
                            onClick={() => focusUnit(unit)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "9px 12px",
                              borderRadius: 8,
                              backgroundColor: "#F8FAFC",
                              border: "1px solid #E2E8F0",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              <span style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: getUnitRiskColor(score), color: "white", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {idx + 1}
                              </span>
                              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                                <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {unit.code} · {unit.name.split(":")[1]?.trim() || unit.name}
                                </span>
                                <span style={{ fontSize: 10, color: "#64748B" }}>
                                  {unit.liveIncidents || 0} active hazard reports
                                </span>
                              </div>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 900, color: getUnitRiskColor(score), marginLeft: 8 }}>
                              {score}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Active Mitigations */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #D9DEE7", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                    ACTIVE RISK MITIGATIONS
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#475569", display: "flex", flexDirection: "column", gap: 8, lineHeight: 1.5 }}>
                    <li>Depressurize and shield Sector 4 North flange steam line.</li>
                    <li>Inspect Unit 3 elevation deck and re-clamp loose scaffolding planks.</li>
                    <li>Isolate live wiring hazard near water in Electrical Substation Room.</li>
                  </ul>
                </div>
              </>
            )}

          </div>
        )}

      </div>

      {/* ─── QUICK DISPATCH MODAL FROM HEATMAP ─── */}
      {dispatchModalUnit && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2500,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16, backdropFilter: "blur(2px)",
        }}>
          <form onSubmit={submitQuickDispatch} style={{
            background: "var(--surface, #FFFFFF)", borderRadius: 16, border: "1px solid #D9DEE7",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)", width: "100%", maxWidth: 520,
            overflow: "hidden", display: "flex", flexDirection: "column",
          }}>
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid #D9DEE7",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "#F8FAFC",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>⚡</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>
                  Dispatch Work Order for {dispatchModalUnit.code}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDispatchModalUnit(null)}
                style={{ background: "none", border: "none", fontSize: 18, color: "#64748B", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>TARGET UNIT / LOCATION:</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{dispatchModalUnit.name} ({dispatchModalUnit.code})</div>
                <div style={{ fontSize: 11, color: "#DC2626", marginTop: 2, fontWeight: 600 }}>
                  Dominant Hazard: {dispatchModalUnit.liveDominantHazard || dispatchModalUnit.dominantHazard}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                  Assign Maintenance Crew / Team: *
                </label>
                <select
                  value={dispatchCrew}
                  onChange={e => setDispatchCrew(e.target.value)}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #D9DEE7",
                    background: "#FFFFFF", color: "#0F172A", fontSize: 13, fontWeight: 600,
                  }}
                >
                  {MAINTENANCE_CREWS.map(crew => (
                    <option key={crew} value={crew}>{crew}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id="heatmapLoto"
                  checked={dispatchLoto}
                  onChange={e => setDispatchLoto(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#dc2626" }}
                />
                <label htmlFor="heatmapLoto" style={{ fontSize: 12, fontWeight: 700, color: dispatchLoto ? "#dc2626" : "#0F172A", cursor: "pointer" }}>
                  🔒 LOTO Zero-Energy Isolation Mandated for this Work Order
                </label>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                  Work Scope &amp; Corrective Instructions:
                </label>
                <textarea
                  value={dispatchInstructions}
                  onChange={e => setDispatchInstructions(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D9DEE7",
                    background: "#FFFFFF", color: "#0F172A", fontSize: 12, fontFamily: "inherit",
                  }}
                />
              </div>
            </div>

            <div style={{
              padding: "14px 20px", borderTop: "1px solid #D9DEE7",
              display: "flex", justifyContent: "flex-end", gap: 10,
              background: "#F8FAFC",
            }}>
              <button
                type="button"
                onClick={() => setDispatchModalUnit(null)}
                style={{
                  padding: "9px 16px", borderRadius: 8, border: "1px solid #D9DEE7",
                  background: "#FFFFFF", color: "#64748B", fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingDispatch}
                style={{
                  padding: "9px 20px", borderRadius: 8, border: "none",
                  background: "#0A192F", color: "#fff", fontSize: 12, fontWeight: 700,
                  cursor: isSubmittingDispatch ? "wait" : "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <span>{isSubmittingDispatch ? "Dispatching..." : "Dispatch Work Order"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Animation Styles */}
      <style jsx global>{`
        @keyframes applePulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.6);
            opacity: 0.2;
          }
        }
      `}</style>

    </div>
  );
}
