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
  ExternalLink,
  Zap,
  Lock,
} from "lucide-react";
import { useLanguage } from "@/app/lib/LanguageContext";
import {
  translateSafetyText,
  translateLocation,
  translateCrew,
  translateSeverity,
} from "@/app/lib/hindiTranslator";

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

  if (unit.id === 'unit-crude-storage' && (text.includes('tank') || text.includes('tk-80') || text.includes('crude') || text.includes('storage') || text.includes('scaffolding') || text.includes('sector 4 north'))) return true;
  if (unit.id === 'unit-fcc' && (text.includes('fcc') || text.includes('catalytic') || text.includes('slide valve') || text.includes('cracking platform'))) return true;
  if (unit.id === 'unit-hdt' && (text.includes('hydrotreater') || text.includes('hydrocracker') || text.includes('v-204') || text.includes('h2') || text.includes('hydrogen') || text.includes('bearing') || text.includes('vibration') || text.includes('process area 2'))) return true;
  if (unit.id === 'unit-vdu' && (text.includes('vdu') || text.includes('vacuum') || text.includes('ex-12') || text.includes('flange') || text.includes('stripper'))) return true;
  if (unit.id === 'unit-adu' && (text.includes('adu') || text.includes('atmospheric') || text.includes('distillation') || text.includes('fractionation'))) return true;
  if (unit.id === 'unit-power-plant' && (text.includes('boiler') || text.includes('boiler room b') || text.includes('steam') || text.includes('power') || text.includes('turbine'))) return true;
  if (unit.id === 'unit-water-treatment' && (text.includes('water') || text.includes('acid') || text.includes('caustic') || text.includes('effluent') || text.includes('chemical') || text.includes('p-102a'))) return true;
  if (unit.id === 'unit-flare' && (text.includes('flare') || text.includes('knockout') || text.includes('ko drum') || text.includes('emission'))) return true;
  if (unit.id === 'unit-lpg' && (text.includes('lpg') || text.includes('sphere') || text.includes('pressurized propane'))) return true;
  if (unit.id === 'unit-cooling-tower' && (text.includes('cooling tower') || text.includes('fan deck'))) return true;
  if (unit.id === 'unit-firewater' && (text.includes('firewater') || text.includes('diesel pump'))) return true;

  return false;
}

const INITIAL_FACILITY_UNITS: DynamicFacilityUnit[] = REFINERY_FACILITY_UNITS.map((u) => ({
  ...u,
  matchedReports: [],
  matchedAlerts: [],
  liveRiskScore: u.riskScore,
  liveIncidents: u.incidents,
  liveStatus: u.status,
  liveDominantHazard: u.dominantHazard,
}));

export default function HeatmapPage() {
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [facilityUnits, setFacilityUnits] = useState<DynamicFacilityUnit[]>(INITIAL_FACILITY_UNITS);
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
  const [pinDropMode, setPinDropMode] = useState<boolean>(false);
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
  const [customMarkers, setCustomMarkers] = useState<{ id: number; x: number; y: number; note: string }[]>([]);

  // Function to pull live data and dynamically aggregate into units
  const syncLiveData = async () => {
    try {
      const [reportsRes, alertsRes] = await Promise.all([
        getReportsApi({ limit: 100 }),
        getAlertsApi(),
      ]);

      const liveReports = reportsRes.data || [];
      const liveAlerts = alertsRes.data || [];
      setTotalLiveReportsCount(liveReports.length);

      const computedUnits: DynamicFacilityUnit[] = REFINERY_FACILITY_UNITS.map(unit => {
        const matchedR = liveReports.filter(r => matchReportToUnit(r, unit));
        const matchedA = liveAlerts.filter(a => matchReportToUnit(a, unit));

        const maxReportScore = matchedR.reduce((max, r) => {
          const s = r.riskAssessment?.riskScore || (r as any).risk_score || (r as any).riskScore || (r.severity === 'critical' ? 92 : r.severity === 'high' ? 78 : r.severity === 'medium' ? 55 : 30);
          return Math.max(max, s);
        }, 0);

        const maxAlertScore = matchedA.reduce((max, a) => {
          const s = a.riskScore || (a.riskLevel === 'CRITICAL' ? 95 : 75);
          return Math.max(max, s);
        }, 0);

        const liveScore = Math.max(unit.riskScore, maxReportScore, maxAlertScore);
        const liveIncidents = unit.incidents + matchedR.length;

        let liveStatus: DynamicFacilityUnit['liveStatus'] = 'normal';
        if (liveScore >= 80) liveStatus = 'critical';
        else if (liveScore >= 60) liveStatus = 'high';
        else if (liveScore >= 40) liveStatus = 'medium';
        else if (liveScore >= 20) liveStatus = 'low';

        // Dominant hazard inference from recent reports
        let dominantHazard = unit.dominantHazard;
        if (matchedR.length > 0 && matchedR[0].title) {
          dominantHazard = matchedR[0].title;
        }

        return {
          ...unit,
          matchedReports: matchedR,
          matchedAlerts: matchedA,
          liveRiskScore: liveScore,
          liveIncidents: liveIncidents,
          liveStatus: liveStatus,
          liveDominantHazard: dominantHazard,
        };
      });

      setFacilityUnits(computedUnits);
      setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.warn("Using baseline map units:", err);
      // Fallback
      setFacilityUnits(REFINERY_FACILITY_UNITS.map(u => ({
        ...u,
        matchedReports: [],
        matchedAlerts: [],
        liveRiskScore: u.riskScore,
        liveIncidents: u.incidents,
        liveStatus: u.status,
        liveDominantHazard: u.dominantHazard,
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncLiveData();

    // Micro telemetry loop every 2.5 seconds
    const telemetryInterval = setInterval(() => {
      setTelemetryTick(t => t + 1);
    }, 2500);

    // Live reports polling every 8 seconds
    const dataInterval = setInterval(() => {
      syncLiveData();
    }, 8000);

    return () => {
      clearInterval(telemetryInterval);
      clearInterval(dataInterval);
    };
  }, []);

  // Update selected unit when units array re-computes to keep telemetry reactive
  useEffect(() => {
    if (selectedUnit && facilityUnits.length > 0) {
      const refreshed = facilityUnits.find(u => u.id === selectedUnit.id);
      if (refreshed) setSelectedUnit(refreshed);
    }
  }, [facilityUnits]);

  // Handle map units filtering & searching
  const unitsToProcess: DynamicFacilityUnit[] = facilityUnits;

  const filteredUnits = unitsToProcess.filter(unit => {
    const score = unit.liveRiskScore || unit.riskScore;

    // Filter pill matching
    if (activeFilter === "extreme" && score < 80) return false;
    if (activeFilter === "high" && (score < 60 || score >= 80)) return false;
    if (activeFilter === "moderate" && (score < 40 || score >= 60)) return false;
    if (activeFilter === "low" && score >= 40) return false;

    // Search query matching
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = unit.name.toLowerCase().includes(q);
      const matchCode = unit.code.toLowerCase().includes(q);
      const matchHazard = unit.liveDominantHazard?.toLowerCase().includes(q) || unit.dominantHazard.toLowerCase().includes(q);
      return matchName || matchCode || matchHazard;
    }

    return true;
  });

  // KPI Calculations
  const averageRisk = Math.round(
    unitsToProcess.reduce((sum, u) => sum + (u.liveRiskScore || u.riskScore), 0) / (unitsToProcess.length || 1)
  ) || 68;

  // Zoom & Pan Handlers
  const handleZoom = (delta: number) => {
    setZoomLevel(prev => Math.min(Math.max(prev + delta, 0.75), 2.5));
  };

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setSelectedUnit(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (pinDropMode) return;
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

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinDropMode) return;
    if ((e.target as HTMLElement).closest(".map-unit-interactive")) return;

    if (mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setCustomMarkers([...customMarkers, { id: Date.now(), x, y, note: lang === 'hi' ? 'फील्ड अवलोकन पिन' : "Field Observation Pin" }]);
      setPinDropMode(false);
    }
  };

  const focusUnit = (unit: DynamicFacilityUnit) => {
    setSelectedUnit(unit);
    setSidePanelOpen(true);
  };

  const criticalHotspots = [...unitsToProcess]
    .sort((a, b) => (b.liveRiskScore || b.riskScore) - (a.liveRiskScore || a.riskScore))
    .slice(0, 4);

  const selectedTelemetry = selectedUnit ? getUnitTelemetry(selectedUnit, telemetryTick) : null;

  const handleQuickDispatch = (unit: DynamicFacilityUnit) => {
    setDispatchModalUnit(unit);
    setDispatchInstructions(lang === 'hi' ? `${unit.name} (${unit.code}) के लिए आपातकालीन मेंटेनेंस कार्य - ${unit.liveDominantHazard || unit.dominantHazard}` : `Emergency maintenance dispatch for ${unit.name} (${unit.code}) - ${unit.liveDominantHazard || unit.dominantHazard}`);
    setDispatchLoto((unit.liveRiskScore || unit.riskScore) >= 80);
  };

  const submitQuickDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchModalUnit) return;
    setIsSubmittingDispatch(true);
    try {
      await createTaskApi({
        title: `Task: ${dispatchModalUnit.code} Urgent Remediation`,
        description: dispatchInstructions || `Field corrective maintenance task for ${dispatchModalUnit.name}`,
        equipmentId: dispatchModalUnit.code,
        equipmentName: dispatchModalUnit.name,
        location: dispatchModalUnit.name,
        severity: (dispatchModalUnit.liveRiskScore || dispatchModalUnit.riskScore) >= 80 ? 'critical' : 'high',
        assignedCrew: dispatchCrew,
        lotoRequired: dispatchLoto,
      });

      setToast(lang === 'hi' ? `कार्य सफलतापूर्वक ${translateCrew(dispatchCrew, lang)} को सौंपा गया!` : `Task successfully assigned to ${dispatchCrew}!`);
      setDispatchModalUnit(null);
      setTimeout(() => setToast(""), 3500);
      syncLiveData();
    } catch (err) {
      console.warn("Dispatch failed:", err);
      setToast(lang === 'hi' ? "कार्य कतार में दर्ज किया गया।" : "Task logged to dispatch queue.");
      setDispatchModalUnit(null);
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>

      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 3000,
          background: "#0A192F", color: "#fff", border: "1px solid #1E293B", borderRadius: 12,
          padding: "12px 20px", boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8,
        }}>
          <CheckCircle2 size={16} color="#10b981" /> <span>{toast}</span>
        </div>
      )}

      {/* ─── 1. TOP HEADER & LIVE TELEMETRY BAR ─────────────────────────── */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: 14, border: "1px solid #D9DEE7", padding: "18px 24px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
        
        {/* Title + Status */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.4px" }}>
              {lang === 'hi' ? 'डायनामिक रिफाइनरी प्लांट हीटमैप' : 'Dynamic Refinery Facility Heatmap'}
            </h1>
            <span style={{
              fontSize: 11, fontWeight: 800, backgroundColor: "#DCFCE7", color: "#166534",
              padding: "3px 10px", borderRadius: 999, border: "1px solid #BBF7D0",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#16A34A", animation: "applePulse 1.8s infinite" }} />
              {lang === 'hi' ? 'लाइव टेलीमेट्री स्ट्रीम' : 'LIVE TELEMETRY STREAM'}
            </span>
          </div>
          <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0 0" }}>
            {lang === 'hi' ? `रीयल-टाइम SIF संकेतक खतरा घनत्व · डायनामिक मल्टी-सोर्स एकत्रीकरण (${totalLiveReportsCount} सक्रिय फील्ड रिपोर्टों का विश्लेषण)` : `Real-time SIF precursor hazard density · Dynamic multi-source aggregation (${totalLiveReportsCount} active field reports analyzed)`}
          </p>
        </div>

        {/* Search / Jump to Unit */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <Search style={{ position: "absolute", left: 10, top: 9, width: 15, height: 15, color: "#94A3B8" }} />
            <input
              type="text"
              placeholder={lang === 'hi' ? 'यूनिट पर जाएं (उदा. FCC, ADU, TK-80)...' : "Jump to unit (e.g. FCC, ADU, TK-80)..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: "8px 12px 8px 32px", fontSize: 13, borderRadius: 8, border: "1px solid #D9DEE7", outline: "none", width: 240, backgroundColor: "#F8FAFC" }}
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
            title={lang === 'hi' ? 'डेटाबेस स्ट्रीम रीफ्रेश करें' : "Force refresh live database stream"}
          >
            <Radio style={{ width: 14, height: 14, color: "#16A34A" }} />
            <span>{lang === 'hi' ? 'अभी रीफ्रेश करें' : 'Poll Now'}</span>
          </button>
        </div>

      </div>

      {/* ─── 2. CONTROLS, FILTERS & VIEW TOGGLES ───────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        
        {/* Risk Filter Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "all", label: lang === 'hi' ? 'सभी इकाइयां' : "All Units", count: unitsToProcess.length },
            { id: "extreme", label: lang === 'hi' ? 'अति गंभीर (80+)' : "Extreme Risk (80+)", count: unitsToProcess.filter(u => (u.liveRiskScore || u.riskScore) >= 80).length, color: "#DC2626" },
            { id: "high", label: lang === 'hi' ? 'उच्च जोखिम (60-79)' : "High Risk (60-79)", count: unitsToProcess.filter(u => (u.liveRiskScore || u.riskScore) >= 60 && (u.liveRiskScore || u.riskScore) < 80).length, color: "#EA580C" },
            { id: "moderate", label: lang === 'hi' ? 'मध्यम जोखिम (40-59)' : "Moderate (40-59)", count: unitsToProcess.filter(u => (u.liveRiskScore || u.riskScore) >= 40 && (u.liveRiskScore || u.riskScore) < 60).length, color: "#D97706" },
            { id: "low", label: lang === 'hi' ? 'सुरक्षित (<40)' : "Safe / Low (<40)", count: unitsToProcess.filter(u => (u.liveRiskScore || u.riskScore) < 40).length, color: "#16A34A" },
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
            {lang === 'hi' ? `थर्मल प्लूम्स: ${showHeatmap ? "चालू" : "बंद"}` : `Thermal Plumes: ${showHeatmap ? "ON" : "OFF"}`}
          </button>

          <button
            onClick={() => setShowPins(!showPins)}
            style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              backgroundColor: showPins ? "#EFF6FF" : "#FFFFFF",
              color: showPins ? "#1D4ED8" : "#64748B",
              border: `1px solid ${showPins ? "#BFDBFE" : "#D9DEE7"}`,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <MapPin style={{ width: 14, height: 14 }} />
            {lang === 'hi' ? `एसेट लेबल: ${showPins ? "चालू" : "बंद"}` : `Asset Labels: ${showPins ? "ON" : "OFF"}`}
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
            <span>{lang === 'hi' ? 'निरीक्षक पैनल' : 'Inspector Drawer'}</span>
          </button>
        </div>

      </div>

      {/* ─── 3. INTERACTIVE MAP & INSPECTOR SIDE PANEL ────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: sidePanelOpen ? "1fr 360px" : "1fr", gap: 18, alignItems: "start" }}>
        
        {/* Heatmap Canvas Container */}
        <div
          ref={mapContainerRef}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            position: "relative",
            width: "100%",
            height: 640,
            backgroundColor: "#0B1426",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            border: "1px solid #1E293B",
            cursor: pinDropMode ? "crosshair" : isDragging ? "grabbing" : "grab",
            userSelect: "none",
          }}
        >
          {/* Zoom & Canvas HUD controls */}
          <div style={{ position: "absolute", top: 16, left: 16, zIndex: 25, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", backgroundColor: "#0A192F", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
              <button onClick={() => handleZoom(0.2)} style={{ padding: 8, background: "none", border: "none", color: "white", cursor: "pointer", display: "flex" }} title="Zoom In">
                <ZoomIn style={{ width: 16, height: 16 }} />
              </button>
              <div style={{ width: 1, backgroundColor: "rgba(255,255,255,0.15)" }} />
              <button onClick={() => handleZoom(-0.2)} style={{ padding: 8, background: "none", border: "none", color: "white", cursor: "pointer", display: "flex" }} title="Zoom Out">
                <ZoomOut style={{ width: 16, height: 16 }} />
              </button>
              <div style={{ width: 1, backgroundColor: "rgba(255,255,255,0.15)" }} />
              <button onClick={resetView} style={{ padding: 8, background: "none", border: "none", color: "white", cursor: "pointer", display: "flex" }} title="Reset View">
                <RotateCcw style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>

          {/* Map & Thermal Layers Canvas */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.15s ease-out",
            }}
          >
            {/* Refinery Blueprint Background */}
            <img
              src="/refinery_map.jpg"
              alt="Refinery Blueprint Map"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "brightness(0.85) contrast(1.15)",
                pointerEvents: "none",
              }}
            />

            {/* Dynamic Thermal Radial Heat Plumes */}
            {showHeatmap && filteredUnits.map((unit) => {
              const score = unit.liveRiskScore || unit.riskScore;
              const plumeSize = Math.max(unit.w, unit.h) * 2.2;
              const centerX = unit.x + unit.w / 2;
              const centerY = unit.y + unit.h / 2;

              return (
                <div
                  key={`heat-${unit.id}`}
                  style={{
                    position: "absolute",
                    left: `${centerX}%`,
                    top: `${centerY}%`,
                    width: `${plumeSize}%`,
                    height: `${plumeSize * 1.2}%`,
                    transform: "translate(-50%, -50%)",
                    background: getHeatmapRadialGradient(score),
                    pointerEvents: "none",
                    mixBlendMode: "screen",
                    zIndex: 10,
                  }}
                />
              );
            })}

            {/* Custom Operator Pins */}
            {customMarkers.map((marker) => (
              <div
                key={marker.id}
                style={{
                  position: "absolute",
                  left: `${marker.x}%`,
                  top: `${marker.y}%`,
                  transform: "translate(-50%, -100%)",
                  zIndex: 40,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div style={{ backgroundColor: "#0A192F", color: "white", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", boxShadow: "0 2px 6px rgba(0,0,0,0.4)" }}>
                  {marker.note}
                </div>
                <MapPin style={{ width: 26, height: 26, color: "#EF4444", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }} />
              </div>
            ))}

            {/* Interactive Unit Indicators */}
            {showPins && filteredUnits.map((unit) => {
              const isSelected = selectedUnit?.id === unit.id;
              const isHovered = hoveredUnit?.id === unit.id;
              const centerX = unit.x + unit.w / 2;
              const centerY = unit.y + unit.h / 2;
              const score = unit.liveRiskScore || unit.riskScore;
              const color = getUnitRiskColor(score);
              const isCritical = score >= 80;
              const hasLiveReports = unit.matchedReports && unit.matchedReports.length > 0;

              return (
                <div key={`ui-${unit.id}`} className="map-unit-interactive">
                  
                  {/* Pin Element */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      focusUnit(unit);
                    }}
                    onMouseEnter={() => setHoveredUnit(unit)}
                    onMouseLeave={() => setHoveredUnit(null)}
                    style={{
                      position: "absolute",
                      left: `${centerX}%`,
                      top: `${centerY}%`,
                      transform: `translate(-50%, -50%) scale(${isSelected ? 1.25 : isHovered ? 1.15 : 1})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      zIndex: isSelected ? 35 : isHovered ? 34 : 30,
                      transition: "transform 0.15s ease",
                    }}
                  >
                    
                    {/* Glowing Pulse Ring for Critical & High-Risk Units */}
                    {isCritical && (
                      <div
                        style={{
                          position: "absolute",
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          border: `2.5px solid ${color}`,
                          animation: "applePulse 1.8s ease-in-out infinite",
                        }}
                      />
                    )}

                    {/* Unit Pill Badge with Live Incident Indicator */}
                    <div
                      style={{
                        backgroundColor: isSelected ? "#FFFFFF" : "rgba(10, 25, 47, 0.92)",
                        border: `2px solid ${color}`,
                        padding: "3px 8px",
                        borderRadius: 14,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        boxShadow: "0 3px 10px rgba(0,0,0,0.45)",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color, display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: isSelected ? "#0F172A" : "#FFFFFF", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                        {unit.code}
                      </span>
                      {hasLiveReports && (
                        <span style={{
                          fontSize: 9, fontWeight: 900, backgroundColor: "#EF4444", color: "#fff",
                          borderRadius: 999, padding: "0 5px", lineHeight: "14px",
                        }}>
                          {unit.matchedReports.length}
                        </span>
                      )}
                    </div>

                  </div>

                  {/* Floating Hover Card */}
                  {isHovered && !isSelected && (
                    <div
                      style={{
                        position: "absolute",
                        left: `${centerX}%`,
                        top: `calc(${centerY}% - 22px)`,
                        transform: "translate(-50%, -100%)",
                        backgroundColor: "#FFFFFF",
                        color: "#0F172A",
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: `1.5px solid ${color}`,
                        boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
                        zIndex: 60,
                        pointerEvents: "none",
                        minWidth: 220,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{unit.name}</span>
                        <span style={{ fontSize: 14, fontWeight: 900, color }}>{score}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>
                        {unit.liveDominantHazard || unit.dominantHazard}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>
                        {unit.liveIncidents || unit.incidents} active incidents · Click to inspect live telemetry
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
              zIndex: 25,
            }}
          >
            <span>LIVE SIF RISK LEVEL:</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#16A34A" }}>LOW</span>
              <div style={{ width: 120, height: 6, borderRadius: 999, background: "linear-gradient(to right, #16A34A, #D97706, #EA580C, #DC2626)" }} />
              <span style={{ color: "#DC2626" }}>CRITICAL (80+)</span>
            </div>
          </div>

        </div>

        {/* ─── 4. DYNAMIC SIDE INSPECTOR / ANALYTICS DRAWER ─────────────── */}
        {sidePanelOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            
            {/* When a Unit is Selected: Live Telemetry & Actions */}
            {selectedUnit ? (
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #D9DEE7", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#1D4ED8", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      {lang === 'hi' ? 'प्लांट उपकरण टेलीमेट्री' : 'FACILITY ASSET TELEMETRY'}
                    </span>
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: "4px 0 0 0" }}>
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
                    <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>
                      {lang === 'hi' ? 'परिकलित जोखिम स्कोर' : 'Calculated Risk Score'}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: getUnitRiskColor(selectedUnit.liveRiskScore || selectedUnit.riskScore), lineHeight: 1.1, marginTop: 2 }}>
                      {selectedUnit.liveRiskScore || selectedUnit.riskScore} <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>/ 100</span>
                    </div>
                  </div>
                  <span style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 800,
                    backgroundColor: (selectedUnit.liveRiskScore || selectedUnit.riskScore) >= 80 ? "#FEF2F2" : "#FFF7ED",
                    color: getUnitRiskColor(selectedUnit.liveRiskScore || selectedUnit.riskScore),
                  }}>
                    {translateSeverity(selectedUnit.liveStatus || selectedUnit.status, lang).toUpperCase()}
                  </span>
                </div>

                {/* Real-Time Live IoT Sensors */}
                {selectedTelemetry && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {lang === 'hi' ? 'लाइव एसेट सेंसर्स' : 'LIVE ASSET SENSORS'}
                      </span>
                      <span style={{ fontSize: 10, color: "#16A34A", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#16A34A", animation: "applePulse 1.5s infinite" }} />
                        {lang === 'hi' ? 'पोलिंग 2.5s' : 'POLLING 2.5s'}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px" }}>
                        <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>{lang === 'hi' ? 'तापमान' : 'TEMPERATURE'}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{selectedTelemetry.temp}°C</div>
                      </div>
                      <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px" }}>
                        <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>{lang === 'hi' ? 'दबाव' : 'PRESSURE'}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{selectedTelemetry.pressure} bar</div>
                      </div>
                      <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px" }}>
                        <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>{lang === 'hi' ? 'कंपन' : 'VIBRATION'}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{selectedTelemetry.vibration} mm/s</div>
                      </div>
                      <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px" }}>
                        <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>{lang === 'hi' ? 'गैस (LEL)' : 'GAS (LEL)'}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: selectedTelemetry.gasPpm > 25 ? "#DC2626" : "#0F172A", marginTop: 2 }}>{selectedTelemetry.gasPpm} ppm</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dominant Hazard */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                    {lang === 'hi' ? 'पहचाना गया प्रमुख खतरा' : 'IDENTIFIED DOMINANT HAZARD'}
                  </div>
                  <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                    {translateSafetyText(selectedUnit.liveDominantHazard || selectedUnit.details, lang)}
                  </p>
                </div>

                {/* ─── LIVE FRONTLINE INCIDENTS MATCHED FROM DB ─── */}
                {selectedUnit.matchedReports && selectedUnit.matchedReports.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      {lang === 'hi' ? `इस क्षेत्र में सक्रिय घटनाएं (${selectedUnit.matchedReports.length})` : `ACTIVE FIELD INCIDENTS IN THIS ZONE (${selectedUnit.matchedReports.length})`}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                      {selectedUnit.matchedReports.map((rep: any) => (
                        <div key={rep._id} style={{
                          padding: "8px 10px", borderRadius: 8, backgroundColor: "#FEF2F2",
                          border: "1px solid #FCA5A5", display: "flex", flexDirection: "column", gap: 2,
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#991B1B" }}>{translateSafetyText(rep.title, lang).slice(0, 35)}...</span>
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#DC2626" }}>
                              {rep.riskAssessment?.riskScore || rep.risk_score || 85} pts
                            </span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                            <span style={{ fontSize: 10, color: "#7F1D1D", display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <MapPin size={10} /> {translateLocation(rep.location, lang)}
                            </span>
                            <Link href={`/officer/reports/${rep._id}`} style={{ fontSize: 10, color: "#1D4ED8", fontWeight: 700, textDecoration: "underline" }}>
                              {lang === 'hi' ? 'रिपोर्ट देखें ↗' : 'View Report ↗'}
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                    {lang === 'hi' ? 'मेंटेनेंस कार्य सौंपें' : 'Assign Maintenance Task'}
                  </button>
                  <Link
                    href="/officer/alerts"
                    style={{
                      padding: "9px 14px", backgroundColor: "#FFFFFF", color: "#0F172A",
                      border: "1.5px solid #D9DEE7", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      textAlign: "center", textDecoration: "none", display: "block",
                    }}
                  >
                    {lang === 'hi' ? `सभी सक्रिय घटनाएं देखें (${selectedUnit.liveIncidents || selectedUnit.incidents})` : `View All Active Incidents (${selectedUnit.liveIncidents || selectedUnit.incidents})`}
                  </Link>
                </div>

              </div>
            ) : (
              /* Default State: Overall Live Risk Overview & Critical Drivers */
              <>
                {/* Overall Score */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #D9DEE7", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {lang === 'hi' ? 'प्लांट समग्र SIF जोखिम' : 'FACILITY OVERALL SIF RISK'}
                      </div>
                      <div style={{ fontSize: 32, fontWeight: 900, color: "#DC2626", lineHeight: 1.1, marginTop: 4 }}>
                        {averageRisk}/100
                      </div>
                    </div>
                    <span style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800 }}>
                      {lang === 'hi' ? 'अति गंभीर जोखिम' : 'CRITICAL RISK'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                    {lang === 'hi' ? '3 इकाइयां क्रिटिकल SIF संकेतक सीमा में हैं। प्रोसेस एरिया 2 और सेक्टर 4 में सक्रिय पर्यवेक्षण आवश्यक है।' : '3 Units in Critical SIF Precursor threshold. Process Area 2 and Sector 4 require active supervision.'}
                  </div>
                </div>

                {/* Top Critical Precursors List */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #D9DEE7", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                    {lang === 'hi' ? 'शीर्ष सक्रिय SIF संकेतक' : 'TOP SIF PRECURSORS ACTIVE'}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { name: lang === 'hi' ? "भारी मशीनरी कंपन और बेयरिंग विफलता" : "Heavy Machinery Vibration & Bearing Failure", count: 4, level: "CRITICAL" },
                      { name: lang === 'hi' ? "खुला 480V तार और कंड्यूट क्षति" : "Exposed 480V Energized Line & Conduit Breach", count: 2, level: "CRITICAL" },
                      { name: lang === 'hi' ? "मचान अस्थिर टो-बोर्ड और सुरक्षा टाई-ऑफ दोष" : "Scaffolding Unstable Toe-Board & Tie-Off Defect", count: 2, level: "HIGH" },
                      { name: lang === 'hi' ? "हाइड्रोकार्बन फ्लैंज सूक्ष्म रिसाव" : "Hydrocarbon Flange Micro-Leak Detection", count: 1, level: "HIGH" },
                    ].map((p, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                        <span style={{ color: "#1E293B", fontWeight: 600, flex: 1, paddingRight: 8 }}>{p.name}</span>
                        <span style={{
                          backgroundColor: p.level === "CRITICAL" ? "#FEF2F2" : "#FFF7ED",
                          color: p.level === "CRITICAL" ? "#DC2626" : "#EA580C",
                          fontWeight: 800, fontSize: 10, padding: "2px 6px", borderRadius: 4,
                        }}>
                          {p.count} {lang === 'hi' ? 'सक्रिय' : 'active'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Critical Risk Drivers (Clickable to Focus on Map) */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #D9DEE7", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                    {lang === 'hi' ? 'शीर्ष जोखिम केंद्र (फ़ोकस करने हेतु क्लिक करें)' : 'TOP RISK HOTSPOTS (CLICK TO FOCUS)'}
                  </div>
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
                            padding: "8px 10px",
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
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {unit.code} · {unit.name.split("(")[0].trim()}
                            </span>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 900, color: getUnitRiskColor(score), marginLeft: 8 }}>
                            {score}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic Recommended Actions */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #D9DEE7", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                    {lang === 'hi' ? 'सक्रिय जोखिम निवारण उपाय' : 'ACTIVE RISK MITIGATIONS'}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#475569", display: "flex", flexDirection: "column", gap: 8, lineHeight: 1.5 }}>
                    <li>{lang === 'hi' ? 'टैंक फार्म मचान रेलिंग की समीक्षा करें और 100% हार्नेस टाई-ऑफ लागू करें।' : 'Review Tank Farm scaffolding guardrails and enforce 100% harness tie-off.'}</li>
                    <li>{lang === 'hi' ? 'हाइड्रोक्रैकर फीड पंपों पर कंपन स्पेक्ट्रम FFT विश्लेषण करें।' : 'Conduct vibration spectrum FFT analysis on Hydrocracker feed pumps.'}</li>
                    <li>{lang === 'hi' ? 'सक्रिय मेंटेनेंस कार्यों पर शून्य-ऊर्जा LOTO तालाबंदी सत्यापित करें।' : 'Verify zero-energy LOTO isolation on active maintenance tasks.'}</li>
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
            background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)", width: "100%", maxWidth: 520,
            overflow: "hidden", display: "flex", flexDirection: "column",
          }}>
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid var(--border)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "var(--surface-subtle)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Zap size={18} style={{ color: "#0A192F" }} />
                <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>
                  {lang === 'hi' ? `${dispatchModalUnit.code} के लिए मेंटेनेंस कार्य सौंपें` : `Assign Maintenance Task for ${dispatchModalUnit.code}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDispatchModalUnit(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>{lang === 'hi' ? 'लक्षित इकाई / स्थान:' : 'TARGET UNIT / LOCATION:'}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{dispatchModalUnit.name} ({dispatchModalUnit.code})</div>
                <div style={{ fontSize: 11, color: "#DC2626", marginTop: 2, fontWeight: 600 }}>
                  {lang === 'hi' ? 'प्रमुख खतरा:' : 'Dominant Hazard:'} {translateSafetyText(dispatchModalUnit.liveDominantHazard || dispatchModalUnit.dominantHazard, lang)}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                  {lang === 'hi' ? 'मेंटेनेंस क्रू / टीम सौंपें: *' : 'Assign Maintenance Crew / Team: *'}
                </label>
                <select
                  value={dispatchCrew}
                  onChange={e => setDispatchCrew(e.target.value)}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid var(--border)",
                    background: "var(--surface)", color: "var(--text)", fontSize: 13, fontWeight: 600,
                  }}
                >
                  {MAINTENANCE_CREWS.map(crew => (
                    <option key={crew} value={crew}>{translateCrew(crew, lang)}</option>
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
                <label htmlFor="heatmapLoto" style={{ fontSize: 12, fontWeight: 700, color: dispatchLoto ? "#dc2626" : "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <Lock size={13} /> {lang === 'hi' ? 'इस कार्य के लिए LOTO तालाबंदी अनिवार्य' : 'LOTO Isolation Mandated for this Task'}
                </label>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                  {lang === 'hi' ? 'कार्य दायरा और सुधारात्मक निर्देश:' : 'Work Scope & Corrective Instructions:'}
                </label>
                <textarea
                  value={dispatchInstructions}
                  onChange={e => setDispatchInstructions(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
                    background: "var(--surface)", color: "var(--text)", fontSize: 12, fontFamily: "inherit",
                  }}
                />
              </div>
            </div>

            <div style={{
              padding: "14px 20px", borderTop: "1px solid var(--border)",
              display: "flex", justifyContent: "flex-end", gap: 10,
              background: "var(--surface-subtle)",
            }}>
              <button
                type="button"
                onClick={() => setDispatchModalUnit(null)}
                style={{
                  padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)",
                  background: "var(--surface)", color: "var(--text)", fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
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
                <span>{isSubmittingDispatch ? (lang === 'hi' ? 'भेजा जा रहा है...' : 'Dispatching...') : (lang === 'hi' ? 'कार्य सौंपें व भेजें' : 'Assign Task & Dispatch')}</span>
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
