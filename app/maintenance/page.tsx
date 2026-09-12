"use client";

import React, { useState, useEffect } from "react";
import { getTasksApi, updateTaskStatusApi } from "@/app/lib/api";
import { getStoredUser } from "@/app/lib/auth";
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Radio,
  Lock,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  ShieldCheck,
  Clock,
  User,
  FileText,
  Sliders,
  ArrowRight,
  ExternalLink,
  Info,
  CheckCircle,
  AlertCircle,
  Gauge,
  Zap,
  Flame,
  ShieldAlert,
  Layers,
  HardHat,
  RefreshCw,
  Cpu
} from "lucide-react";

// ─── Types & Models ─────────────────────────────────────────────────────────

type Severity = "critical" | "high" | "medium" | "low";
type OrderStatus = "dispatched" | "in_progress" | "clearance_submitted" | "officer_verified";

interface DispatchedOrder {
  id: string;
  orderNumber: string;
  title: string;
  equipmentId: string;
  equipmentName: string;
  location: string;
  zone: string;
  severity: Severity;
  status: OrderStatus;
  dispatchedBy: {
    name: string;
    role: string;
    badgeId: string;
  };
  safetyPermitId: string;
  assignedCrew: string;
  dispatchedAt: string;
  description: string;
  lotoRequired: boolean;
  clearanceNote?: string;
}

interface EquipmentNode {
  id: string;
  tag: string;
  name: string;
  type: string;
  status: "operating" | "warning" | "critical";
  vibration: number; // mm/s
  temperature: number; // °C
  pressure: number; // PSI
  activeOrderId?: string;
  lastPolled?: string;
}

interface LotoPermit {
  id: string;
  tagNumber: string;
  assetTag: string;
  assetName: string;
  isolationPoint: string;
  energyType: string;
  lockedByOfficer: string;
  padlockId: string;
  status: "LOCKED_SAFE" | "PENDING_CLEARANCE";
  lockedAt: string;
}

// ─── Default Data ──────────────────────────────────────────────────────────

const INITIAL_ORDERS: DispatchedOrder[] = [
  {
    id: "ord-001",
    orderNumber: "WO-9038",
    title: "Repair Corroded Steam Flange",
    equipmentId: "TK-80",
    equipmentName: "Crude Storage Tank Scaffolding",
    location: "Sector 4 North, Tank Farm",
    zone: "Zone TF-4",
    severity: "critical",
    status: "clearance_submitted",
    dispatchedBy: { name: "Vikram Sharma", role: "Safety Supervisor", badgeId: "SAF-4019" },
    safetyPermitId: "PTW-0881",
    assignedCrew: "Scaffolding Team M-4",
    dispatchedAt: "12m ago",
    description: "Isolate high pressure steam line under LOTO. Replace damaged gasket and verify barrier integrity.",
    lotoRequired: true,
  },
  {
    id: "ord-002",
    orderNumber: "WO-9039",
    title: "TK-80 Scaffolding – Replace outer handrails & safety gates",
    equipmentId: "TK-80",
    equipmentName: "Crude Storage Tank",
    location: "Sector 4 North, Tank Farm",
    zone: "Zone TF-4",
    severity: "critical",
    status: "in_progress",
    dispatchedBy: { name: "Sarah Chen", role: "Field Safety Officer", badgeId: "SAF-3302" },
    safetyPermitId: "PTW-0879",
    assignedCrew: "Scaffolding & Rigging Team M-4",
    dispatchedAt: "38m ago",
    description: "Erect certified 42-inch top-rails, mid-rails, and toe-boards on Tier 3 access walkway.",
    lotoRequired: true,
  },
  {
    id: "ord-003",
    orderNumber: "WO-9040",
    title: "V-204 Hydrocracker – Dynamic bearing balance & seal inspection",
    equipmentId: "V-204",
    equipmentName: "Hydrocracker Reaction Vessel",
    location: "Process Area 2, Hydro Unit",
    zone: "Zone PU-2",
    severity: "high",
    status: "dispatched",
    dispatchedBy: { name: "Vikram Sharma", role: "Safety Supervisor", badgeId: "SAF-4019" },
    safetyPermitId: "PTW-0875",
    assignedCrew: "Rotating Machinery Team M-4",
    dispatchedAt: "1h ago",
    description: "Isolate 415V MCC breaker CB-410B under LOTO padlock. Inspect pump bearings and dynamic balance.",
    lotoRequired: true,
  },
  {
    id: "ord-004",
    orderNumber: "WO-9041",
    title: "Slurry Pump P-102A Gland Packing Containment",
    equipmentId: "P-102A",
    equipmentName: "Heavy Slurry Transfer Pump",
    location: "Sector 1 East, Effluent Pad",
    zone: "Zone EP-1",
    severity: "medium",
    status: "in_progress",
    dispatchedBy: { name: "Sarah Chen", role: "Field Safety Officer", badgeId: "SAF-3302" },
    safetyPermitId: "PTW-0868",
    assignedCrew: "Pump Specialist Crew M-4",
    dispatchedAt: "2h ago",
    description: "Contain minor gland packing weep and retorque gland follower bolts to prevent slip hazards.",
    lotoRequired: false,
  }
];

const INITIAL_NODES: EquipmentNode[] = [
  { id: "node-1", tag: "TK-80", name: "Crude Storage Tank", type: "Storage Vessel", status: "critical", vibration: 0.8, temperature: 38, pressure: 1.2, activeOrderId: "WO-9038", lastPolled: "3s ago" },
  { id: "node-2", tag: "V-204", name: "Hydrocracker Vessel", type: "High-Pressure Reactor", status: "warning", vibration: 4.8, temperature: 215, pressure: 145, activeOrderId: "WO-9040", lastPolled: "1s ago" },
  { id: "node-3", tag: "EX-12", name: "Shell & Tube Exchanger", type: "Heat Exchanger", status: "critical", vibration: 2.7, temperature: 182, pressure: 62, lastPolled: "2s ago" },
  { id: "node-4", tag: "P-102A", name: "Heavy Slurry Pump", type: "Centrifugal Pump", status: "operating", vibration: 1.2, temperature: 68, pressure: 45, activeOrderId: "WO-9041", lastPolled: "Just now" },
  { id: "node-5", tag: "FL-01", name: "Flare Header Line", type: "Safety Relief Pipe", status: "operating", vibration: 0.4, temperature: 42, pressure: 8, lastPolled: "Just now" },
  { id: "node-6", tag: "C-301", name: "Wet Gas Compressor", type: "Reciprocating Compressor", status: "operating", vibration: 1.9, temperature: 94, pressure: 88, lastPolled: "1s ago" },
];

const INITIAL_LOTO: LotoPermit[] = [
  { id: "loto-1", tagNumber: "LOTO-2026-041", assetTag: "TK-80", assetName: "Crude Tank 80", isolationPoint: "Main Inflow Isolation Valve V-801", energyType: "Hydraulic / Gravity Flow", lockedByOfficer: "Vikram Sharma (SAF-4019)", padlockId: "PAD-409", status: "LOCKED_SAFE", lockedAt: "07:15 Today" },
  { id: "loto-2", tagNumber: "LOTO-2026-042", assetTag: "V-204", assetName: "Hydrocracker Reactor", isolationPoint: "High-Voltage Breaker MCC-4B", energyType: "Electrical 415V 3-Phase", lockedByOfficer: "Sarah Chen (SAF-3302)", padlockId: "PAD-412", status: "LOCKED_SAFE", lockedAt: "08:40 Today" },
  { id: "loto-3", tagNumber: "LOTO-2026-043", assetTag: "EX-12", assetName: "Exchanger 12", isolationPoint: "Steam Supply Header Gate Valve", energyType: "High-Pressure Steam (22 Bar)", lockedByOfficer: "Vikram Sharma (SAF-4019)", padlockId: "PAD-108", status: "LOCKED_SAFE", lockedAt: "09:10 Today" },
];

const REFINERY_SECTORS = [
  { id: "s1", name: "Sector 1: Crude Distillation (CDU-1)", status: "normal", alertCount: 0, tag: "Optimal", color: "var(--success)" },
  { id: "s2", name: "Sector 2: Hydrocracking Unit (HCU-2)", status: "warning", alertCount: 1, tag: "V-204 Vibration Warning", color: "var(--orange)" },
  { id: "s3", name: "Sector 3: Catalytic Reforming (CRU-3)", status: "normal", alertCount: 0, tag: "Optimal", color: "var(--success)" },
  { id: "s4", name: "Sector 4: Tank Farm & Offsites", status: "critical", alertCount: 2, tag: "LOTO Active · Flange Repair", color: "var(--danger)" },
];

export default function MaintenancePage() {
  const [orders, setOrders] = useState<DispatchedOrder[]>(INITIAL_ORDERS);
  const [activeTab, setActiveTab] = useState<string>("desk");
  const [orderFilter, setOrderFilter] = useState<string>("all");
  const [telemetryFilter, setTelemetryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<DispatchedOrder | null>(null);
  const [clearanceNote, setClearanceNote] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [isRefreshingTelemetry, setIsRefreshingTelemetry] = useState(false);

  useEffect(() => {
    const u = getStoredUser();
    if (u) setCurrentUser(u);

    const handleTab = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail);
      }
    };
    window.addEventListener("maintenance-tab-change", handleTab);

    async function loadTasks() {
      try {
        const res = await getTasksApi();
        if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
          const mapped: DispatchedOrder[] = res.data.map((t: any, idx: number) => ({
            id: t._id || `task-${idx}`,
            orderNumber: t.orderNumber || t.taskNumber || `WO-${9038 + idx}`,
            title: t.title || "Safety Remediation Task",
            equipmentId: t.equipmentId || "EQ-PLANT",
            equipmentName: t.equipmentName || "Plant Equipment",
            location: t.location || "Plant Sector 4",
            zone: t.zone || "Zone 4",
            severity: t.severity || "high",
            status: t.status || "dispatched",
            dispatchedBy: t.dispatchedBy || { name: "Officer Command", role: "Safety Lead", badgeId: "SAF-4019" },
            safetyPermitId: t.safetyPermitId || "PTW-2026-0881",
            assignedCrew: t.assignedCrew || "Maintenance Crew M-4",
            dispatchedAt: t.createdAt ? new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently",
            description: t.description || "Field safety repair work order.",
            lotoRequired: t.lotoRequired ?? true,
            clearanceNote: t.clearanceNote,
          }));
          setOrders(mapped);
        }
      } catch (err) {
        console.warn("Using local orders:", err);
      }
    }
    loadTasks();
    const interval = setInterval(loadTasks, 4000);

    return () => {
      window.removeEventListener("maintenance-tab-change", handleTab);
      clearInterval(interval);
    };
  }, []);

  const changeTab = (tabId: string) => {
    setActiveTab(tabId);
    window.dispatchEvent(new CustomEvent("maintenance-tab-change", { detail: tabId }));
  };

  const handleUpdateStatus = async (id: string, nextStatus: OrderStatus, note?: string) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: nextStatus } : o)));
    if (selectedOrder && selectedOrder.id === id) {
      setSelectedOrder({ ...selectedOrder, status: nextStatus });
    }
    try {
      await updateTaskStatusApi(id, nextStatus, note);
    } catch (err) {
      console.warn("Status update persisted locally:", err);
    }
  };

  const handleSignOffClearance = (id: string, directClear = false) => {
    const nextStatus: OrderStatus = directClear ? "officer_verified" : "clearance_submitted";
    handleUpdateStatus(id, nextStatus, clearanceNote || "Physical repair certified & cleared.");
    setSelectedOrder(null);
    setClearanceNote("");
  };

  const toggleExpand = (id: string) => {
    setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const triggerTelemetryRefresh = () => {
    setIsRefreshingTelemetry(true);
    setTimeout(() => setIsRefreshingTelemetry(false), 600);
  };

  const filteredOrders = orders
    .filter((o) => {
      if (orderFilter === "critical") return o.severity === "critical";
      if (orderFilter === "action_needed") return o.status === "dispatched" || o.status === "in_progress";
      if (orderFilter === "in_progress") return o.status === "in_progress";
      if (orderFilter === "clearance_submitted") return o.status === "clearance_submitted";
      if (orderFilter === "cleared") return o.status === "officer_verified" || o.status === "clearance_submitted";
      return true;
    })
    .filter((o) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.title.toLowerCase().includes(q) ||
        o.equipmentId.toLowerCase().includes(q) ||
        o.location.toLowerCase().includes(q)
      );
    });

  // KPI Calculations (used in Operations Desk)
  const totalCount = orders.length;
  const criticalCount = orders.filter((o) => o.severity === "critical").length;
  const inProgressCount = orders.filter((o) => o.status === "in_progress").length;
  const pendingClearanceCount = orders.filter((o) => o.status === "clearance_submitted").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%", maxWidth: 1140, margin: "0 auto" }} className="animate-apple-fade-in">

      {/* ═══════════════════════════════════════════════════════════════════════
          MODULE 1: OPERATIONS DESK (Rich Shift Command Overview)
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "desk" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* Shift Command Banner */}
          <div
            className="apple-card"
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 16,
              border: "1px solid var(--border)",
              padding: "20px 24px",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                <span style={{ backgroundColor: "var(--surface-subtle)", padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border)", color: "var(--text)" }}>
                  Shift A · Unit M-4 Lead
                </span>
                <span>·</span>
                <span style={{ color: "var(--success)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "var(--success)" }} />
                  Refinery Systems Live
                </span>
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.5px" }}>
                Maintenance Operations Command
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                Plant Sector 4 · Active shift dispatches, isolation status &amp; equipment telemetry.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => changeTab("orders")}
                className="apple-btn"
                style={{
                  padding: "9px 18px",
                  borderRadius: 10,
                  backgroundColor: "var(--primary)",
                  color: "#FFFFFF",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Wrench size={15} /> Open Work Orders Queue ({totalCount}) →
              </button>
            </div>
          </div>

          {/* 4 CORE KPI SUMMARY CARDS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <div
              className="apple-card"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "18px 20px",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Active Work Orders</span>
                <Wrench size={17} color="var(--primary)" />
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, color: "var(--text)", marginTop: 8, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
                {totalCount}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-light)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--primary)" }} />
                <span>{inProgressCount} in progress · {totalCount - inProgressCount} queued</span>
              </div>
            </div>

            <div
              className="apple-card"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "18px 20px",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Critical SIF Precursors</span>
                <AlertTriangle size={17} color="var(--danger)" />
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, color: "var(--danger)", marginTop: 8, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
                {criticalCount}
              </div>
              <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 6, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--danger)" }} />
                <span>Immediate barrier &amp; lockout protocol</span>
              </div>
            </div>

            <div
              className="apple-card"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "18px 20px",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--orange)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>LOTO Padlocks</span>
                <Lock size={17} color="var(--orange)" />
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, color: "var(--text)", marginTop: 8, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
                {INITIAL_LOTO.length} <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-muted)" }}>Active</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 600, marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--success)" }} />
                <span>100% Zero-energy state verified</span>
              </div>
            </div>

            <div
              className="apple-card"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "18px 20px",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>OSHA Clearance Desk</span>
                <CheckCircle2 size={17} color="var(--success)" />
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, color: "var(--text)", marginTop: 8, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
                {pendingClearanceCount}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--success)" }} />
                <span>Awaiting officer certification review</span>
              </div>
            </div>
          </div>

          {/* Plant Refinery Sectors Status Grid */}
          <div
            className="apple-card"
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 14,
              border: "1px solid var(--border)",
              padding: "20px 24px",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Layers size={17} color="var(--primary)" />
                <strong style={{ fontSize: 15, color: "var(--text)" }}>Refinery Complex Sector Status</strong>
              </div>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Plant Sector 4 Control Zone
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              {REFINERY_SECTORS.map((sector) => (
                <div
                  key={sector.id}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    backgroundColor: "var(--surface-subtle)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Sector {sector.id.toUpperCase()}
                    </span>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: sector.color }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                    {sector.name}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: sector.color, marginTop: 2 }}>
                    {sector.tag}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Immediate Action Items (Top 2 Urgent Orders) */}
          <div
            className="apple-card"
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 14,
              border: "1px solid var(--border)",
              padding: "20px 24px",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", margin: 0 }}>
                  Immediate Shift Action Items
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "3px 0 0 0" }}>
                  Dispatched tasks with elevated SIF risk requiring lead technician action
                </p>
              </div>
              <button
                onClick={() => changeTab("orders")}
                style={{ background: "none", border: "none", color: "var(--primary)", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                View Full Queue ({totalCount}) <ArrowRight size={14} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {orders.slice(0, 2).map((order) => {
                const isCrit = order.severity === "critical";
                return (
                  <div
                    key={order.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "14px 18px",
                      backgroundColor: "var(--surface-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 14,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text)", fontFamily: "monospace" }}>{order.orderNumber}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: isCrit ? "var(--danger)" : "var(--orange)", backgroundColor: isCrit ? "var(--danger-light)" : "var(--warning-light)", padding: "2px 6px", borderRadius: 4 }}>
                          {order.severity.toUpperCase()} SIF
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{order.equipmentId}</span>
                        <span style={{ fontSize: 12, color: "var(--text-light)" }}>· {order.location}</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{order.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{order.description}</div>
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      {order.status === "in_progress" ? (
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="apple-btn"
                          style={{
                            padding: "8px 18px",
                            backgroundColor: "var(--success)",
                            color: "#FFFFFF",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            border: "none",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Check size={14} /> Sign Off
                        </button>
                      ) : order.status === "dispatched" ? (
                        <button
                          onClick={() => handleUpdateStatus(order.id, "in_progress")}
                          className="apple-btn"
                          style={{
                            padding: "8px 18px",
                            backgroundColor: "var(--primary)",
                            color: "#FFFFFF",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            border: "none",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Wrench size={14} /> Accept Task
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <CheckCircle2 size={15} /> Submitted
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Subsystem Overview Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            
            {/* Quick Telemetry Glance */}
            <div
              className="apple-card"
              style={{
                backgroundColor: "var(--surface)",
                borderRadius: 14,
                border: "1px solid var(--border)",
                padding: 18,
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Radio size={16} color="var(--primary)" />
                  <strong style={{ fontSize: 14, color: "var(--text)" }}>Asset Health Telemetry</strong>
                </div>
                <button
                  onClick={() => changeTab("telemetry")}
                  style={{ background: "none", border: "none", color: "var(--primary)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  All (6) →
                </button>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                4 Normal · 1 Warning (V-204) · 1 Critical (EX-12)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {INITIAL_NODES.slice(0, 2).map((node) => (
                  <div key={node.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, backgroundColor: "var(--surface-subtle)", fontSize: 12 }}>
                    <div>
                      <span style={{ fontWeight: 700, color: "var(--text)" }}>{node.tag}</span> · {node.name}
                    </div>
                    <span style={{ color: node.status === "critical" ? "var(--danger)" : "var(--orange)", fontWeight: 700 }}>
                      {node.vibration} mm/s (Vib)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick LOTO Glance */}
            <div
              className="apple-card"
              style={{
                backgroundColor: "var(--surface)",
                borderRadius: 14,
                border: "1px solid var(--border)",
                padding: 18,
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Lock size={16} color="var(--orange)" />
                  <strong style={{ fontSize: 14, color: "var(--text)" }}>Active Energy Isolations</strong>
                </div>
                <button
                  onClick={() => changeTab("loto")}
                  style={{ background: "none", border: "none", color: "var(--primary)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Register (3) →
                </button>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                3 active zero-energy padlocks verified by safety officers
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {INITIAL_LOTO.slice(0, 2).map((loto) => (
                  <div key={loto.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, backgroundColor: "var(--surface-subtle)", fontSize: 12 }}>
                    <div>
                      <span style={{ fontWeight: 700, color: "var(--text)" }}>{loto.assetTag}</span> · {loto.isolationPoint.split(" ")[0]}
                    </div>
                    <span style={{ color: "var(--orange)", fontWeight: 700, backgroundColor: "var(--warning-light)", padding: "1px 6px", borderRadius: 4 }}>
                      {loto.padlockId}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODULE 2: WORK ORDERS QUEUE (Detailed Task Lifecycle Management)
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "orders" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* Work Orders Intelligence Strip */}
          <div
            className="apple-card"
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 16,
              border: "1px solid var(--border)",
              padding: "20px 24px",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  <span>Dispatched Maintenance Queue</span>
                  <span>·</span>
                  <span style={{ color: "var(--primary)" }}>{orders.length} Total Assignments</span>
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.5px" }}>
                  Work Orders Queue &amp; Dispatch
                </h1>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                  Manage crew assignments, accept urgent SIF mitigations, and submit clearance certification.
                </p>
              </div>

              {/* Search input */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: "var(--surface-subtle)",
                  padding: "7px 14px",
                  borderRadius: 24,
                  border: "1px solid var(--border)",
                }}
              >
                <Search size={15} color="var(--text-light)" />
                <input
                  type="text"
                  placeholder="Search order # or equipment..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontSize: 13,
                    outline: "none",
                    color: "var(--text)",
                    width: 200,
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{ background: "none", border: "none", padding: 0, color: "var(--text-muted)", cursor: "pointer" }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Queue Metrics Bar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <div style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: "var(--surface-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>ACTIVE CREWS DEPLOYED</span>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>3 Specialist Teams</div>
              </div>
              <div style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: "var(--surface-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>AVG. SIF RESPONSE TIME</span>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--success)", marginTop: 2 }}>18 min (Target &lt;30m)</div>
              </div>
              <div style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: "var(--surface-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>LOTO LOCKOUT REQUIRED</span>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--orange)", marginTop: 2 }}>3 of 4 Orders</div>
              </div>
              <div style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: "var(--surface-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>READY FOR CLEARANCE</span>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--primary)", marginTop: 2 }}>{inProgressCount} Ready</div>
              </div>
            </div>
          </div>

          {/* Filter Chips Bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {[
                { id: "all", label: `All Orders (${orders.length})` },
                { id: "action_needed", label: "Needs Action" },
                { id: "critical", label: `Critical SIF (${criticalCount})` },
                { id: "in_progress", label: "In Progress" },
                { id: "clearance_submitted", label: "Sign-Off Submitted" },
                { id: "cleared", label: `Cleared & Closed (${orders.filter(o => o.status === 'officer_verified' || o.status === 'clearance_submitted').length})` },
              ].map((f) => {
                const isActive = orderFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setOrderFilter(f.id)}
                    className="apple-btn"
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 500,
                      backgroundColor: isActive ? "var(--primary)" : "var(--surface)",
                      color: isActive ? "#FFFFFF" : "var(--text-muted)",
                      border: isActive ? "none" : "1px solid var(--border)",
                      cursor: "pointer",
                      boxShadow: isActive ? "var(--shadow-sm)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: 12, color: "var(--text-light)" }}>
              Showing {filteredOrders.length} of {orders.length}
            </div>
          </div>

          {/* Orders Cards with Lifecycle Step Indicator */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filteredOrders.map((order) => {
              const isCrit = order.severity === "critical";
              const isHigh = order.severity === "high";
              const isExpanded = !!expandedOrders[order.id];

              const priorityBg = isCrit ? "var(--danger-light)" : isHigh ? "var(--warning-light)" : "var(--surface-subtle)";
              const priorityColor = isCrit ? "var(--danger)" : isHigh ? "var(--orange)" : "var(--text-muted)";
              const priorityLabel = isCrit ? "Critical SIF" : isHigh ? "High Priority" : "Standard";

              // Lifecycle steps: 1: Dispatched, 2: In Progress, 3: Clearance Submitted, 4: Officer Verified
              const stepIndex = order.status === "dispatched" ? 1 : order.status === "in_progress" ? 2 : order.status === "clearance_submitted" ? 3 : 4;

              return (
                <div
                  key={order.id}
                  className="apple-card"
                  style={{
                    backgroundColor: "var(--surface)",
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    borderLeft: `5px solid ${isCrit ? "var(--danger)" : isHigh ? "var(--orange)" : "var(--primary)"}`,
                    padding: "20px 22px",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text)", fontFamily: "monospace", backgroundColor: "var(--surface-subtle)", padding: "2px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
                          {order.orderNumber}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: priorityColor, backgroundColor: priorityBg, padding: "2px 8px", borderRadius: 6 }}>
                          {priorityLabel}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                          {order.equipmentId}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-light)" }}>
                          · {order.location}
                        </span>
                      </div>

                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>
                        {order.title}
                      </div>

                      <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
                        {order.description}
                      </div>

                      {/* Visual Lifecycle Stepper */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                        {[
                          { step: 1, label: "Dispatched" },
                          { step: 2, label: "In Repair" },
                          { step: 3, label: "Clearance" },
                          { step: 4, label: "Verified" }
                        ].map((s, idx) => {
                          const isDone = stepIndex >= s.step;
                          const isCurrent = stepIndex === s.step;
                          return (
                            <div key={s.step} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: "50%",
                                  backgroundColor: isDone ? "var(--primary)" : "var(--surface-subtle)",
                                  color: isDone ? "#FFFFFF" : "var(--text-light)",
                                  fontSize: 10,
                                  fontWeight: 800,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {isDone ? "✓" : s.step}
                              </div>
                              <span style={{ fontSize: 11, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? "var(--text)" : "var(--text-muted)" }}>
                                {s.label}
                              </span>
                              {idx < 3 && <span style={{ color: "var(--border)", fontSize: 11 }}>➔</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                      {order.status === "dispatched" && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, "in_progress")}
                          className="apple-btn"
                          style={{
                            padding: "8px 18px",
                            backgroundColor: "var(--primary)",
                            color: "#FFFFFF",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            border: "none",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Wrench size={14} /> Accept Task
                        </button>
                      )}

                      {order.status === "in_progress" && (
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="apple-btn"
                          style={{
                            padding: "8px 18px",
                            backgroundColor: "var(--success)",
                            color: "#FFFFFF",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            border: "none",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Check size={14} /> Sign Off Clearance
                        </button>
                      )}

                      {order.status === "clearance_submitted" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                          <div
                            style={{
                              padding: "5px 12px",
                              borderRadius: 8,
                              backgroundColor: "#f5f3ff",
                              color: "#7c3aed",
                              border: "1px solid #ddd6fe",
                              fontSize: 11,
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Clock size={14} /> Awaiting Officer Review
                          </div>
                          <button
                            onClick={() => handleUpdateStatus(order.id, "officer_verified", "Cleared & Certified by Maintenance")}
                            className="apple-btn"
                            style={{
                              padding: "4px 10px",
                              backgroundColor: "var(--surface-subtle)",
                              color: "var(--primary)",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              border: "1px solid var(--border)",
                              cursor: "pointer",
                            }}
                          >
                            Mark Cleared &amp; Closed
                          </button>
                        </div>
                      )}

                      {order.status === "officer_verified" && (
                        <div
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            backgroundColor: "var(--success-light)",
                            color: "var(--success)",
                            fontSize: 12,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <CheckCircle size={15} /> Cleared &amp; Closed
                        </div>
                      )}

                      <button
                        onClick={() => toggleExpand(order.id)}
                        style={{
                          background: "none",
                          border: "none",
                          fontSize: 11,
                          color: "var(--text-light)",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          marginTop: 4,
                        }}
                      >
                        {isExpanded ? "Hide Details" : "View Details"}
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        marginTop: 16,
                        paddingTop: 14,
                        borderTop: "1px solid var(--border)",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: 12,
                        fontSize: 12,
                        backgroundColor: "var(--surface-subtle)",
                        padding: 14,
                        borderRadius: 10,
                      }}
                    >
                      <div>
                        <span style={{ color: "var(--text-light)", display: "block", fontSize: 11 }}>Safety Supervisor</span>
                        <strong style={{ color: "var(--text)" }}>{order.dispatchedBy.name}</strong> ({order.dispatchedBy.badgeId})
                      </div>
                      <div>
                        <span style={{ color: "var(--text-light)", display: "block", fontSize: 11 }}>Permit-to-Work ID</span>
                        <strong style={{ color: "var(--text)", fontFamily: "monospace" }}>{order.safetyPermitId}</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-light)", display: "block", fontSize: 11 }}>Assigned Maintenance Crew</span>
                        <strong style={{ color: "var(--text)" }}>{order.assignedCrew}</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-light)", display: "block", fontSize: 11 }}>Energy Isolation (LOTO)</span>
                        <strong style={{ color: order.lotoRequired ? "var(--orange)" : "var(--text-muted)" }}>
                          {order.lotoRequired ? "Padlock Isolation Required (OSHA 1910)" : "Standard Safety Caution"}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODULE 3: FLEET TELEMETRY (Sensors & Condition Monitoring)
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "telemetry" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* Telemetry Intelligence Strip */}
          <div
            className="apple-card"
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 16,
              border: "1px solid var(--border)",
              padding: "20px 24px",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  <span>Modbus TCP / RTU Telemetry Bus</span>
                  <span>·</span>
                  <span style={{ color: "var(--success)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "var(--success)" }} />
                    6/6 Sensors Online
                  </span>
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.5px" }}>
                  Equipment Sensor Telemetry
                </h1>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                  Continuous real-time asset monitoring: vibration velocity, thermal ramps &amp; casing pressures.
                </p>
              </div>

              <button
                onClick={triggerTelemetryRefresh}
                className="apple-btn"
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  backgroundColor: "var(--surface-subtle)",
                  border: "1px solid var(--border)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <RefreshCw size={14} className={isRefreshingTelemetry ? "animate-spin" : ""} />
                Poll Sensors Live
              </button>
            </div>

            {/* Telemetry ISO Standard Summary Bar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <div style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: "var(--surface-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>ISO 10816 VIBRATION</span>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--orange)", marginTop: 2 }}>1 Alerting Node (V-204)</div>
              </div>
              <div style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: "var(--surface-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>MAX THERMAL READING</span>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>215°C (Hydro Unit)</div>
              </div>
              <div style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: "var(--surface-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>MONITORED ASSET NODES</span>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--success)", marginTop: 2 }}>6 Assets Connected</div>
              </div>
              <div style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: "var(--surface-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>POLLING LATENCY</span>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--primary)", marginTop: 2 }}>&lt;120 ms (Real-Time)</div>
              </div>
            </div>
          </div>

          {/* Telemetry Filter Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {[
              { id: "all", label: "All Monitored Assets (6)" },
              { id: "alerting", label: "Threshold Alerts (2)" },
              { id: "normal", label: "Operating Normally (4)" },
            ].map((f) => {
              const isActive = telemetryFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setTelemetryFilter(f.id)}
                  className="apple-btn"
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    backgroundColor: isActive ? "var(--primary)" : "var(--surface)",
                    color: isActive ? "#FFFFFF" : "var(--text-muted)",
                    border: isActive ? "none" : "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Asset Telemetry Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            {INITIAL_NODES
              .filter((node) => {
                if (telemetryFilter === "alerting") return node.status === "critical" || node.status === "warning";
                if (telemetryFilter === "normal") return node.status === "operating";
                return true;
              })
              .map((node) => {
                const isCrit = node.status === "critical";
                const isWarn = node.status === "warning";
                const statusColor = isCrit ? "var(--danger)" : isWarn ? "var(--orange)" : "var(--success)";
                const statusBg = isCrit ? "var(--danger-light)" : isWarn ? "var(--warning-light)" : "var(--success-light)";

                // Vibration threshold bar percentage (max scale: 6.0 mm/s)
                const vibPercent = Math.min(100, Math.round((node.vibration / 6.0) * 100));

                return (
                  <div
                    key={node.id}
                    className="apple-card"
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 20,
                      backgroundColor: "var(--surface)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-light)", fontFamily: "monospace" }}>{node.tag}</span>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>{node.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{node.type}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "3px 8px",
                            borderRadius: 6,
                            backgroundColor: statusBg,
                            color: statusColor,
                            textTransform: "uppercase",
                          }}
                        >
                          {node.status}
                        </span>
                        <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 4 }}>{node.lastPolled}</div>
                      </div>
                    </div>

                    {/* Sensor Readings Gauges */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 8,
                        padding: "12px",
                        borderRadius: 10,
                        backgroundColor: "var(--surface-subtle)",
                        textAlign: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 10, color: "var(--text-light)", fontWeight: 700 }}>VIBRATION</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: node.vibration > 3 ? "var(--danger)" : "var(--text)", marginTop: 2 }}>
                          {node.vibration} mm/s
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "var(--text-light)", fontWeight: 700 }}>TEMP</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>
                          {node.temperature}°C
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "var(--text-light)", fontWeight: 700 }}>PRESSURE</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>
                          {node.pressure} PSI
                        </div>
                      </div>
                    </div>

                    {/* Vibration Visual Level Bar */}
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-light)", marginBottom: 4 }}>
                        <span>Vibration Level (ISO 10816)</span>
                        <strong style={{ color: statusColor }}>{node.vibration > 4 ? "Danger" : node.vibration > 2.5 ? "Warning" : "Good"}</strong>
                      </div>
                      <div style={{ width: "100%", height: 6, borderRadius: 3, backgroundColor: "var(--surface-subtle)", overflow: "hidden" }}>
                        <div style={{ width: `${vibPercent}%`, height: "100%", backgroundColor: statusColor, borderRadius: 3 }} />
                      </div>
                    </div>

                    {node.activeOrderId && (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "var(--text-muted)" }}>Active Repair: <strong>{node.activeOrderId}</strong></span>
                        <button
                          onClick={() => {
                            setSearchQuery(node.activeOrderId || "");
                            changeTab("orders");
                          }}
                          style={{ background: "none", border: "none", color: "var(--primary)", fontWeight: 700, cursor: "pointer", padding: 0 }}
                        >
                          View Work Order →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODULE 4: LOTO SAFETY PERMITS (OSHA Hazardous Energy Register)
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "loto" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* LOTO Intelligence Strip */}
          <div
            className="apple-card"
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 16,
              border: "1px solid var(--border)",
              padding: "20px 24px",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  <span>OSHA 1910.147 Isolation Compliance</span>
                  <span>·</span>
                  <span style={{ color: "var(--orange)" }}>Control of Hazardous Energy</span>
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.5px" }}>
                  Lockout / Tagout (LOTO) Register
                </h1>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                  Physical isolation padlocks securing machinery against electrical, steam, and hydraulic hazards.
                </p>
              </div>

              <span style={{ fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 20, backgroundColor: "var(--success-light)", color: "var(--success)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--success)" }} />
                100% Zero-Energy State Active
              </span>
            </div>

            {/* Interactive Zero-Energy 4-Stage Protocol */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              {[
                { step: "1. Lock Applied", desc: "Red safety padlock on breaker/valve", status: "Verified" },
                { step: "2. Energy Bleed", desc: "Residual pressure vented to 0 PSI", status: "Depressurized" },
                { step: "3. Zero-Energy Check", desc: "Multimeter & gauge test certified", status: "Safe" },
                { step: "4. Maintenance Clearance", desc: "Padlock removed only after sign-off", status: "Locked" },
              ].map((proto, idx) => (
                <div key={idx} style={{ padding: "10px 12px", borderRadius: 8, backgroundColor: "var(--surface-subtle)" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)" }}>{proto.step}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{proto.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Active LOTO Permits Register Table */}
          <div
            className="apple-card"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 22,
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <strong style={{ fontSize: 16, color: "var(--text)" }}>Active Physical Lockout Manifest</strong>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                  Verified by licensed safety supervisors before crew entry
                </p>
              </div>
              <span style={{ fontSize: 12, color: "var(--text-light)" }}>3 Active Padlocks</span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid var(--border)", color: "var(--text-light)", fontSize: 11 }}>
                    <th style={{ padding: "10px 12px" }}>PERMIT NUMBER</th>
                    <th style={{ padding: "10px 12px" }}>EQUIPMENT</th>
                    <th style={{ padding: "10px 12px" }}>ISOLATION POINT</th>
                    <th style={{ padding: "10px 12px" }}>ENERGY HAZARD</th>
                    <th style={{ padding: "10px 12px" }}>PADLOCK #</th>
                    <th style={{ padding: "10px 12px" }}>LOCKED BY OFFICER</th>
                    <th style={{ padding: "10px 12px" }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {INITIAL_LOTO.map((loto) => (
                    <tr key={loto.id} style={{ borderBottom: "1px solid var(--border)", color: "var(--text)" }}>
                      <td style={{ padding: "14px 12px", fontWeight: 700, fontFamily: "monospace" }}>{loto.tagNumber}</td>
                      <td style={{ padding: "14px 12px", fontWeight: 700 }}>{loto.assetTag}</td>
                      <td style={{ padding: "14px 12px", color: "var(--text-muted)" }}>{loto.isolationPoint}</td>
                      <td style={{ padding: "14px 12px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 4, backgroundColor: "var(--surface-subtle)", fontSize: 12, border: "1px solid var(--border)" }}>
                          {loto.energyType}
                        </span>
                      </td>
                      <td style={{ padding: "14px 12px" }}>
                        <span style={{ padding: "3px 8px", borderRadius: 6, backgroundColor: "var(--warning-light)", color: "var(--orange)", fontWeight: 800, fontSize: 12 }}>
                          {loto.padlockId}
                        </span>
                      </td>
                      <td style={{ padding: "14px 12px", color: "var(--text-muted)" }}>{loto.lockedByOfficer}</td>
                      <td style={{ padding: "14px 12px" }}>
                        <span style={{ padding: "3px 8px", borderRadius: 6, backgroundColor: "var(--success-light)", color: "var(--success)", fontWeight: 700, fontSize: 11 }}>
                          {loto.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODULE 5: CLEARANCE SIGN-OFF DESK (OSHA Certification)
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "clearance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* Clearance Intelligence Strip */}
          <div
            className="apple-card"
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 16,
              border: "1px solid var(--border)",
              padding: "20px 24px",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  <span>OSHA Safety Standard Verification</span>
                  <span>·</span>
                  <span style={{ color: "var(--success)" }}>Field Clearance Audit</span>
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.5px" }}>
                  Hazard Clearance Sign-Off
                </h1>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                  Certify physical remediation completion before returning equipment to operation.
                </p>
              </div>

              <span style={{ fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 12, backgroundColor: "var(--surface-subtle)", color: "var(--primary)", border: "1px solid var(--border)" }}>
                OSHA 1910 STANDARD
              </span>
            </div>

            {/* 4-Point Lead Tech Safety Checklist */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              {[
                { title: "Physical Repair", desc: "Replacement barrier / gasket verified" },
                { title: "Foreign Objects Cleared", desc: "No tools, debris, or rigging left" },
                { title: "Interlocks Re-engaged", desc: "Machine guards & switches verified" },
                { title: "Ready for Lock Removal", desc: "Officer authorized for padlock release" },
              ].map((chk, idx) => (
                <div key={idx} style={{ padding: "10px 12px", borderRadius: 8, backgroundColor: "var(--surface-subtle)", display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <CheckCircle size={15} color="var(--success)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{chk.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{chk.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Tasks Ready for Sign-Off */}
          <div
            className="apple-card"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 24,
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", marginBottom: 14 }}>
              Orders Pending Technician Certification ({orders.filter((o) => o.status === "in_progress").length})
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {orders.filter((o) => o.status === "in_progress").length === 0 ? (
                <div style={{
                  padding: "24px",
                  borderRadius: 12,
                  backgroundColor: "var(--surface-subtle)",
                  border: "1px dashed var(--border)",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}>
                  ✅ All dispatched work orders have been certified. Pending clearances are awaiting safety officer review.
                </div>
              ) : (
                orders
                  .filter((o) => o.status === "in_progress")
                  .map((order) => (
                    <div
                      key={order.id}
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        padding: "16px 20px",
                        backgroundColor: "var(--surface-subtle)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 16,
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text)", fontFamily: "monospace" }}>{order.orderNumber}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{order.equipmentId}</span>
                          <span style={{ fontSize: 12, color: "var(--text-light)" }}>· Assigned to {order.assignedCrew}</span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{order.title}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{order.description}</div>
                      </div>

                      <div style={{ flexShrink: 0 }}>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="apple-btn"
                          style={{
                            padding: "9px 20px",
                            backgroundColor: "var(--success)",
                            color: "#FFFFFF",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            border: "none",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Check size={14} /> Certify Repair
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Historical Cleared Ledger */}
            <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
                Recently Certified &amp; Cleared Work Orders ({orders.filter((o) => o.status === "clearance_submitted" || o.status === "officer_verified").length + 2})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Dynamically Cleared Orders */}
                {orders
                  .filter((o) => o.status === "clearance_submitted" || o.status === "officer_verified")
                  .map((order) => {
                    const isOfficerVerified = order.status === "officer_verified";
                    return (
                      <div
                        key={order.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 16px",
                          borderRadius: 10,
                          backgroundColor: "var(--surface)",
                          border: "1px solid var(--border)",
                          fontSize: 13,
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <strong style={{ fontFamily: "monospace" }}>{order.orderNumber}</strong>
                            <span>·</span>
                            <span style={{ fontWeight: 600, color: "var(--text)" }}>{order.title}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 3 }}>
                            {order.clearanceNote ? `Clearance Log: "${order.clearanceNote}" · ` : ""}
                            Permit: {order.safetyPermitId} · Crew: {order.assignedCrew}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          {isOfficerVerified ? (
                            <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 700, backgroundColor: "var(--success-light)", padding: "4px 10px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <CheckCircle2 size={13} /> Officer Verified &amp; Cleared
                            </span>
                          ) : (
                            <>
                              <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700, backgroundColor: "#f5f3ff", border: "1px solid #ddd6fe", padding: "4px 10px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Clock size={13} /> Awaiting Officer Verification
                              </span>
                              <button
                                onClick={() => handleUpdateStatus(order.id, "officer_verified", "Cleared & Closed by Technician")}
                                className="apple-btn"
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: 6,
                                  border: "1px solid var(--border)",
                                  backgroundColor: "var(--surface-subtle)",
                                  color: "var(--primary)",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Clear from Desk
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                {/* Seeded Certified Orders */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, backgroundColor: "var(--surface)", border: "1px solid var(--border)", fontSize: 13 }}>
                  <div>
                    <strong>WO-9035</strong> · Flare Stack Pressure Relief Valve Calibration
                    <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 2 }}>
                      Certified by {currentUser?.name || "Devon Vance"} · PTW-0850
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 700, backgroundColor: "var(--success-light)", padding: "2px 8px", borderRadius: 4 }}>
                    OSHA Signed
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, backgroundColor: "var(--surface)", border: "1px solid var(--border)", fontSize: 13 }}>
                  <div>
                    <strong>WO-9032</strong> · Crude Transfer Line Safety Eyewash Station Flush
                    <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 2 }}>
                      Certified by {currentUser?.name || "Devon Vance"} · PTW-0842
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 700, backgroundColor: "var(--success-light)", padding: "2px 8px", borderRadius: 4 }}>
                    OSHA Signed
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ─── MODAL: SIGN-OFF DIALOG ───────────────────────────────────── */}
      {selectedOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backgroundColor: "rgba(10, 25, 47, 0.55)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            className="animate-apple-scale-in"
            style={{
              width: "100%",
              maxWidth: 520,
              backgroundColor: "var(--surface)",
              borderRadius: 16,
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-md)",
              padding: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Hazard Clearance Sign-Off
                </span>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", margin: "4px 0 0 0" }}>
                  {selectedOrder.orderNumber} · {selectedOrder.equipmentId}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                backgroundColor: "var(--surface-subtle)",
                padding: 14,
                borderRadius: 10,
                marginBottom: 16,
                fontSize: 13,
                lineHeight: 1.4,
                color: "var(--text)",
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--text-light)", fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>
                Remediation Work Scope
              </div>
              {selectedOrder.title}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
                Resolution Work Log (Required for OSHA Audit Trail):
              </label>
              <textarea
                required
                rows={3}
                value={clearanceNote}
                onChange={(e) => setClearanceNote(e.target.value)}
                placeholder="Describe physical repairs completed (e.g. replaced outer safety barrier with OSHA steel handrails, torqued flange bolts)..."
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                  backgroundColor: "var(--surface)",
                  color: "var(--text)",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 8,
                backgroundColor: "var(--warning-light)",
                border: "1px solid var(--border)",
                marginBottom: 20,
                fontSize: 12,
                color: "var(--orange)",
              }}
            >
              <ShieldCheck size={18} style={{ flexShrink: 0 }} />
              <span>Certifies all physical hazard repairs are complete and unit is safe for safety officer verification.</span>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => setSelectedOrder(null)}
                className="apple-btn"
                style={{
                  flex: "1 1 80px",
                  padding: "10px",
                  borderRadius: 8,
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSignOffClearance(selectedOrder.id, false)}
                className="apple-btn"
                style={{
                  flex: "2 1 170px",
                  padding: "10px 14px",
                  borderRadius: 8,
                  backgroundColor: "var(--primary)",
                  color: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <CheckCircle2 size={16} />
                Submit for Officer Review
              </button>
              <button
                onClick={() => handleSignOffClearance(selectedOrder.id, true)}
                className="apple-btn"
                style={{
                  flex: "2 1 170px",
                  padding: "10px 14px",
                  borderRadius: 8,
                  backgroundColor: "var(--success)",
                  color: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Check size={16} />
                Certify &amp; Clear Now
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
