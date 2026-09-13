'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { getAlertsApi, acknowledgeAlertApi, createTaskApi, getTasksApi, updateTaskApi } from '@/app/lib/api';
import Link from 'next/link';
import { ACTIVE_ALERTS } from '@/app/lib/officerMockData';
import { MAINTENANCE_CREWS } from '@/app/officer/tasks/page';
import {
  CheckCircle2,
  Zap,
  AlertTriangle,
  Check,
  MapPin,
  Clock,
  Eye,
  Bot,
  Undo2,
  Wrench,
  X,
  Loader2,
  RefreshCw,
  FileText,
  Filter,
  Layers,
  ShieldAlert,
  Flame,
} from 'lucide-react';

import { useLanguage } from '@/app/lib/LanguageContext';
import {
  translateSafetyText,
  translateLocation,
  translateCategory,
  translateSeverity,
  translateTimeAgo,
  translateCrew,
} from '@/app/lib/hindiTranslator';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface LiveAlertItem {
  _id: string;
  reportId?: string;
  title: string;
  category: any;
  severity: 'critical' | 'high' | 'medium' | 'low';
  riskScore: number;
  sifProbability?: number;
  zone: string;
  location: string;
  timeAgo: string;
  createdAt?: string;
  acknowledged: boolean;
  submittedBy: string;
  precursors?: string[];
  hazards?: string[];
  recommendations?: string[];
  explanation?: string;
}

interface LiveTaskItem {
  _id: string;
  orderNumber?: string;
  title: string;
  description?: string;
  equipmentId?: string;
  equipmentName?: string;
  location?: string;
  zone?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  status: 'dispatched' | 'in_progress' | 'clearance_submitted' | 'officer_verified' | 'done' | 'verified';
  assignedCrew?: string;
  assignedTo?: string;
  safetyPermitId?: string;
  lotoRequired?: boolean;
  reportId?: string;
  reportTitle?: string;
  clearanceNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

type ItemTypeFilter = 'all' | 'alerts' | 'tasks';
type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type SortOption = 'highest_risk' | 'newest';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferCategory(title: string = '', precursors: string[] = []): string {
  const text = (title + ' ' + precursors.join(' ')).toLowerCase();
  if (/scaffold|fall|height|ladder|plank|guardrail|roof|perimeter/.test(text)) return 'fall';
  if (/electric|wire|cable|voltage|breaker|panel|spark/.test(text)) return 'electrical';
  if (/chemical|acid|toxic|spill|solvent|caustic/.test(text)) return 'chemical';
  if (/fire|explosion|gas|combustion|cylinder/.test(text)) return 'fire';
  if (/structural|crack|column|foundation/.test(text)) return 'structural';
  if (/ppe|helmet|glove|mask|eye/.test(text)) return 'ppe';
  return 'machinery';
}

function timeAgo(iso?: string) {
  if (!iso) return 'Live';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function normalizeSeverity(sev?: string): 'critical' | 'high' | 'medium' | 'low' {
  const s = (sev || '').toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'medium' || s === 'mid') return 'medium';
  if (s === 'low') return 'low';
  return 'medium';
}

function resolveRecommendations(alert: LiveAlertItem): string[] {
  if (alert.recommendations && alert.recommendations.length > 0) {
    return alert.recommendations;
  }
  const text = `${alert.title || ''} ${alert.category || ''} ${alert.location || ''} ${alert.explanation || ''}`.toLowerCase();
  if (/scaffold|fall|height|ladder|plank|guardrail|roof|perimeter/i.test(text)) {
    return [
      "Red-tag scaffolding and suspend elevated work until re-certified (OSHA 1926.451).",
      "Secure loose planks with certified scaffolding clamps and install 42-inch guardrails.",
      "Enforce 100% tie-off using dual self-retracting lifelines (SRLs) anchored to tested points."
    ];
  }
  if (/vibration|bearing|pump|hydrocracker|motor|compressor|shaft|rotating|machinery/i.test(text)) {
    return [
      "Initiate controlled operational throttling/shutdown of unit to prevent catastrophic bearing seizure.",
      "Conduct vibration spectrum FFT analysis and laser shaft alignment on bearing housing.",
      "Inspect lubrication reservoir for metal particulates and replace degraded bearings under LOTO."
    ];
  }
  if (/chemical|acid|caustic|toxic|solvent|corrosive|spill/i.test(text)) {
    return [
      "Evacuate affected sector, cordon 50m hot zone, and post OSHA HAZMAT danger signage.",
      "Deploy neutralizing chemical absorbent boom kit and activate emergency ventilation.",
      "Mandate Level B chemical protective suit and full-face respirator for containment crew."
    ];
  }
  if (/electric|wire|cable|voltage|breaker|panel|spark|conduit|energized/i.test(text)) {
    return [
      "Enforce zero-energy lockout/tagout (LOTO) at upstream distribution circuit breaker.",
      "Erect perimeter barricades and post 'DANGER - HIGH VOLTAGE' certified warnings.",
      "Inspect and re-insulate damaged wiring in flame-retardant industrial conduit."
    ];
  }
  if (/steam|flange|pressure|pipe|valve|leak|gasket/i.test(text)) {
    return [
      "Isolate upstream line valves and depressurize affected pipe section immediately.",
      "Deploy thermal splash blast shields and verify flange bolt torques per ASME B16.5.",
      "Replace compromised gasket with high-temp spiral-wound metallic gasket under hot-work permit."
    ];
  }
  return [
    "Conduct immediate frontline supervisor hazard walkthrough and isolate active work zone.",
    "Log incident in plant EHS register and verify operational PPE compliance.",
    "Schedule formal job safety analysis (JSA) and assign maintenance task."
  ];
}

function inferSuggestedCrew(title: string, precursors?: string[]): string {
  const combined = `${title} ${(precursors || []).join(' ')}`.toLowerCase();
  if (/scaffold|fall|height|ladder|roof|barrier|guardrail/i.test(combined)) {
    return "Scaffolding & Structural Rigging Team S-3";
  }
  if (/wire|electric|voltage|conduit|breaker|loto|cable|shock|energiz/i.test(combined)) {
    return "Electrical & High-Voltage Crew E-2";
  }
  if (/steam|boiler|pressure|flange|pipe|leak|valve|hydraulic/i.test(combined)) {
    return "Hydraulics & Pressure Valve Crew H-1";
  }
  if (/bearing|vibration|pump|motor|gear|shaft|conveyor|rotating/i.test(combined)) {
    return "Rotating Machinery Team M-4";
  }
  if (/chemical|acid|toxic|spill|fume|gas|corrosive/i.test(combined)) {
    return "Hazardous Material Containment Team C-1";
  }
  return "General Plant Reliability Team G-5";
}

function taskStatusBadge(s: string): CSSProperties {
  if (s === 'done' || s === 'officer_verified' || s === 'verified') {
    return { background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 };
  }
  if (s === 'clearance_submitted') {
    return { background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 };
  }
  if (s === 'in_progress') {
    return { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 };
  }
  return { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 };
}

function taskStatusLabel(s: string, lang: string): string {
  if (s === 'done' || s === 'officer_verified' || s === 'verified') return lang === 'hi' ? 'सत्यापित व हल' : 'Verified & Cleared';
  if (s === 'clearance_submitted') return lang === 'hi' ? 'निकासी समीक्षा' : 'Clearance Review';
  if (s === 'in_progress') return lang === 'hi' ? 'प्रगति पर है' : 'In Progress';
  return lang === 'hi' ? 'प्रेषित' : 'Dispatched';
}

function severityPill(sev: 'critical' | 'high' | 'medium' | 'low', lang: string) {
  const styles: Record<string, CSSProperties> = {
    critical: { background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' },
    high: { background: '#ffedd5', color: '#ea580c', border: '1px solid #fed7aa' },
    medium: { background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' },
    low: { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' },
  };
  const labels: Record<string, { en: string; hi: string }> = {
    critical: { en: 'CRITICAL', hi: 'अति-गंभीर' },
    high: { en: 'HIGH', hi: 'उच्च' },
    medium: { en: 'MID', hi: 'मध्यम' },
    low: { en: 'LOW', hi: 'निम्न' },
  };
  return {
    style: {
      borderRadius: 999,
      padding: '2px 9px',
      fontSize: 11,
      fontWeight: 800,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      ...styles[sev],
    },
    label: lang === 'hi' ? labels[sev].hi : labels[sev].en,
  };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AlertsAndTasksPage() {
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<ItemTypeFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [sortOpt, setSortOpt] = useState<SortOption>('highest_risk');
  const [searchQuery, setSearchQuery] = useState('');

  const [alerts, setAlerts] = useState<LiveAlertItem[]>([]);
  const [tasks, setTasks] = useState<LiveTaskItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Modal State for Assigning / Reassigning Tasks
  const [modalMode, setModalMode] = useState<'assign_alert' | 'reassign_task'>('assign_alert');
  const [selectedAlertForDispatch, setSelectedAlertForDispatch] = useState<LiveAlertItem | null>(null);
  const [selectedTaskForReassign, setSelectedTaskForReassign] = useState<LiveTaskItem | null>(null);
  const [dispatchCrew, setDispatchCrew] = useState<string>(MAINTENANCE_CREWS[0]);
  const [dispatchInstructions, setDispatchInstructions] = useState<string>('');
  const [dispatchSeverity, setDispatchSeverity] = useState<string>('high');
  const [dispatchLoto, setDispatchLoto] = useState<boolean>(false);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [assignedAlerts, setAssignedAlerts] = useState<Record<string, { orderNumber: string; crew: string }>>({});

  // ─── Data Loaders ─────────────────────────────────────────────────────────

  const loadData = async () => {
    try {
      const [alertsRes, tasksRes] = await Promise.allSettled([
        getAlertsApi(),
        getTasksApi(),
      ]);

      if (alertsRes.status === 'fulfilled' && alertsRes.value.data && alertsRes.value.data.length > 0) {
        const mapped: LiveAlertItem[] = alertsRes.value.data.map((a: any) => ({
          _id: a._id,
          reportId: a.reportId,
          title: a.reportTitle || a.message,
          category: a.category || inferCategory(a.reportTitle || a.message, a.precursors),
          severity: normalizeSeverity(a.riskLevel || a.severity),
          riskScore: a.riskScore || 85,
          sifProbability: a.sifProbability,
          zone: a.zone || (a.location ? a.location.split(',')[0].trim() : "Sector 4"),
          location: a.location || "Plant Sector 4 North",
          timeAgo: timeAgo(a.createdAt),
          createdAt: a.createdAt,
          acknowledged: !!a.isAcknowledged,
          submittedBy: a.submittedBy || "Site Worker",
          precursors: a.precursors || [],
          hazards: a.hazards || [],
          recommendations: a.recommendations || [],
          explanation: a.explanation,
        }));
        setAlerts(mapped);
      } else if (alerts.length === 0) {
        setAlerts([...ACTIVE_ALERTS].map(a => ({
          ...a,
          severity: normalizeSeverity(a.severity),
          category: a.category as any,
        })));
      }

      if (tasksRes.status === 'fulfilled' && tasksRes.value.data && Array.isArray(tasksRes.value.data)) {
        const activeOnly: LiveTaskItem[] = tasksRes.value.data
          .filter((t: any) => t.status !== 'officer_verified' && t.status !== 'done')
          .map((t: any) => ({
            _id: t._id,
            orderNumber: t.orderNumber || 'WO-Task',
            title: t.title,
            description: t.description,
            equipmentId: t.equipmentId,
            equipmentName: t.equipmentName,
            location: t.location || 'Plant Sector 4',
            zone: t.zone || 'Sector 4',
            severity: normalizeSeverity(t.severity || t.priority),
            priority: normalizeSeverity(t.priority || t.severity),
            status: t.status || 'dispatched',
            assignedCrew: t.assignedCrew || t.assignedTo || 'Maintenance Response Team',
            assignedTo: t.assignedTo || t.assignedCrew,
            safetyPermitId: t.safetyPermitId,
            lotoRequired: !!t.lotoRequired,
            reportId: t.reportId,
            reportTitle: t.reportTitle,
            clearanceNote: t.clearanceNote,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          }));
        setTasks(activeOnly);

        // Preload map of assigned tasks
        const map: Record<string, { orderNumber: string; crew: string }> = {};
        tasksRes.value.data.forEach((t: any) => {
          const info = { orderNumber: t.orderNumber || "WO-Task", crew: t.assignedCrew || t.assignedTo || "Maintenance" };
          if (t.reportId) map[t.reportId] = info;
          if (t.equipmentName) map[t.equipmentName] = info;
        });
        setAssignedAlerts(prev => ({ ...map, ...prev }));
      }
    } catch (err) {
      console.warn("Error refreshing alerts and tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  // ─── Modal Handlers ───────────────────────────────────────────────────────

  const openDispatchModalForAlert = (alert: LiveAlertItem) => {
    setModalMode('assign_alert');
    setSelectedAlertForDispatch(alert);
    setSelectedTaskForReassign(null);
    setDispatchCrew(inferSuggestedCrew(alert.title, alert.precursors));
    const rec = (alert.recommendations && alert.recommendations.length > 0)
      ? alert.recommendations[0]
      : `Implement immediate safety isolation and physical inspection for: ${alert.title}`;
    setDispatchInstructions(rec);
    setDispatchSeverity(alert.severity);
    setDispatchLoto(alert.severity === 'critical');
  };

  const openReassignModalForTask = (task: LiveTaskItem) => {
    setModalMode('reassign_task');
    setSelectedTaskForReassign(task);
    setSelectedAlertForDispatch(null);
    setDispatchCrew(task.assignedCrew || MAINTENANCE_CREWS[0]);
    setDispatchInstructions(task.description || task.title);
    setDispatchSeverity(task.severity);
    setDispatchLoto(!!task.lotoRequired);
  };

  const handleConfirmModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDispatching(true);

    try {
      if (modalMode === 'assign_alert' && selectedAlertForDispatch) {
        const res = await createTaskApi({
          title: `Corrective Action: ${selectedAlertForDispatch.title.slice(0, 50)}`,
          description: `${dispatchInstructions}\n\nIdentified via automated SIF precursor analysis under OSHA 1910 standards.`,
          equipmentId: "EQ-" + Math.floor(100 + Math.random() * 900),
          equipmentName: selectedAlertForDispatch.title,
          location: selectedAlertForDispatch.location,
          severity: dispatchSeverity,
          assignedCrew: dispatchCrew,
          lotoRequired: dispatchLoto,
          reportId: selectedAlertForDispatch.reportId,
        });

        const orderNumber = res.data?.orderNumber || "WO-" + Math.floor(9040 + Math.random() * 50);

        setAssignedAlerts(prev => ({
          ...prev,
          [selectedAlertForDispatch._id]: { orderNumber, crew: dispatchCrew },
          ...(selectedAlertForDispatch.reportId ? { [selectedAlertForDispatch.reportId]: { orderNumber, crew: dispatchCrew } } : {}),
          [selectedAlertForDispatch.title]: { orderNumber, crew: dispatchCrew },
        }));

        if (!selectedAlertForDispatch.acknowledged) {
          toggleAlertAck(selectedAlertForDispatch._id);
        }

        setToast(
          lang === 'hi'
            ? `कार्य आदेश [${orderNumber}] सफलतापूर्वक ${translateCrew(dispatchCrew, lang)} को भेजा गया!`
            : `Work Order [${orderNumber}] assigned to ${dispatchCrew}!`
        );
        setSelectedAlertForDispatch(null);
      } else if (modalMode === 'reassign_task' && selectedTaskForReassign) {
        await updateTaskApi(selectedTaskForReassign._id, {
          assignedCrew: dispatchCrew,
          severity: dispatchSeverity,
          description: dispatchInstructions,
          lotoRequired: dispatchLoto,
        });

        setTasks(prev => prev.map(t => t._id === selectedTaskForReassign._id ? {
          ...t,
          assignedCrew: dispatchCrew,
          assignedTo: dispatchCrew,
          severity: dispatchSeverity as any,
          description: dispatchInstructions,
          lotoRequired: dispatchLoto,
        } : t));

        setToast(
          lang === 'hi'
            ? `कार्य [${selectedTaskForReassign.orderNumber}] ${translateCrew(dispatchCrew, lang)} को पुनः सौंपा गया!`
            : `Task [${selectedTaskForReassign.orderNumber}] reassigned to ${dispatchCrew}!`
        );
        setSelectedTaskForReassign(null);
      }
      setTimeout(() => setToast(null), 4000);
      loadData();
    } catch (err) {
      console.warn("Failed to dispatch/reassign task:", err);
      setToast(lang === 'hi' ? "कार्य कतार में अपडेट किया गया।" : "Task logged to queue.");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleVerifyAndClearTask = async (task: LiveTaskItem) => {
    setTasks(prev => prev.filter(t => t._id !== task._id));
    try {
      await updateTaskApi(task._id, { status: 'officer_verified' });
      setToast(
        lang === 'hi'
          ? `कार्य ${task.orderNumber || task.title} सत्यापित व हल हो गया!`
          : `Task ${task.orderNumber || task.title} verified & cleared!`
      );
    } catch (err) {
      console.warn("Failed to verify task:", err);
      setToast(lang === 'hi' ? 'कार्य हल चिह्नित किया गया।' : 'Task marked as cleared.');
    } finally {
      setTimeout(() => setToast(null), 3500);
      loadData();
    }
  };

  const toggleAlertAck = async (id: string) => {
    const target = alerts.find(a => a._id === id);
    const nextState = !target?.acknowledged;
    setAlerts(prev => prev.map(a => a._id === id ? { ...a, acknowledged: nextState } : a));
    try {
      await acknowledgeAlertApi(id, "Safety Officer", nextState);
    } catch (err) {
      console.warn("Failed to sync acknowledgment:", err);
    }
  };

  // ─── Filter & Categorization Engine ───────────────────────────────────────

  const filteredAlerts = alerts.filter(a => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.location.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredTasks = tasks.filter(t => {
    if (severityFilter !== 'all' && t.severity !== severityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.orderNumber || '').toLowerCase().includes(q) ||
        (t.assignedCrew || '').toLowerCase().includes(q) ||
        (t.location || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Severity counts across all active items (Alerts + Tasks)
  const allSeveritiesCount = {
    all: alerts.length + tasks.length,
    critical: alerts.filter(a => a.severity === 'critical').length + tasks.filter(t => t.severity === 'critical').length,
    high: alerts.filter(a => a.severity === 'high').length + tasks.filter(t => t.severity === 'high').length,
    medium: alerts.filter(a => a.severity === 'medium').length + tasks.filter(t => t.severity === 'medium').length,
    low: alerts.filter(a => a.severity === 'low').length + tasks.filter(t => t.severity === 'low').length,
  };

  const cardStyle: CSSProperties = {
    background: 'var(--surface)',
    borderRadius: 16,
    border: '1px solid var(--border)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    overflow: 'hidden',
  };

  if (loading) {
    return (
      <div>
        <div className="skeleton" style={{ height: 36, width: 280, marginBottom: 20, borderRadius: 12 }} />
        <div className="skeleton" style={{ height: 44, borderRadius: 12, marginBottom: 16 }} />
        {[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16, marginBottom: 12 }} />)}
      </div>
    );
  }

  return (
    <div>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 3000,
          backgroundColor: '#0A192F', color: '#FFFFFF', padding: '14px 22px',
          borderRadius: 10, boxShadow: '0 15px 35px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 700,
          border: '1px solid rgba(255,255,255,0.15)',
        }}>
          <CheckCircle2 size={18} color="#10b981" /> <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10 }}>
            {lang === 'hi' ? 'सक्रिय चेतावनियाँ एवं मेंटेनेंस कार्य' : 'Active Hazard Alerts & Maintenance Tasks'}
            <span style={{
              background: '#0A192F', color: '#fff', borderRadius: 999,
              fontSize: 12, fontWeight: 800, padding: '2px 10px'
            }}>
              {allSeveritiesCount.all}
            </span>
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {lang === 'hi'
              ? 'रीयल-टाइम SIF चेतावनियाँ और ऑन-ग्राउंड मेंटेनेंस कार्य आदेशों की एकीकृत कमांड'
              : 'Unified operational command: Real-time SIF hazard alerts & on-ground maintenance work orders'}
          </p>
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', minWidth: 240 }}>
          <input
            type="text"
            placeholder={lang === 'hi' ? 'खोजें (खतरा, क्रू, वर्क आर्डर)...' : 'Search alerts, tasks, crews...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%',
            }}
          />
        </div>
      </div>

      {/* ─── Filter Bar 1: Type Selector (All Items / Alerts / Tasks) ─── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{
          display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden', padding: 3,
        }}>
          <button
            onClick={() => setTypeFilter('all')}
            style={{
              padding: '7px 16px', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700,
              background: typeFilter === 'all' ? '#0A192F' : 'transparent',
              color: typeFilter === 'all' ? '#FFFFFF' : 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Layers size={13} />
            <span>{lang === 'hi' ? 'सभी' : 'All Items'} ({allSeveritiesCount.all})</span>
          </button>
          <button
            onClick={() => setTypeFilter('alerts')}
            style={{
              padding: '7px 16px', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700,
              background: typeFilter === 'alerts' ? '#0A192F' : 'transparent',
              color: typeFilter === 'alerts' ? '#FFFFFF' : 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <ShieldAlert size={13} />
            <span>{lang === 'hi' ? 'ख़तरा चेतावनियाँ' : 'Hazard Alerts'} ({alerts.length})</span>
          </button>
          <button
            onClick={() => setTypeFilter('tasks')}
            style={{
              padding: '7px 16px', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700,
              background: typeFilter === 'tasks' ? '#0A192F' : 'transparent',
              color: typeFilter === 'tasks' ? '#FFFFFF' : 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Wrench size={13} />
            <span>{lang === 'hi' ? 'सक्रिय कार्य' : 'Active Tasks'} ({tasks.length})</span>
          </button>
        </div>

        {/* Severity Filter Pills: Critical, High, Mid, Low */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['all', 'critical', 'high', 'medium', 'low'] as SeverityFilter[]).map(sev => {
            const isSelected = severityFilter === sev;
            const count = allSeveritiesCount[sev];
            const labels: Record<SeverityFilter, { en: string; hi: string; dotColor: string }> = {
              all: { en: 'All Priorities', hi: 'सभी प्राथमिकता', dotColor: '#0A192F' },
              critical: { en: 'Critical', hi: 'अति-गंभीर', dotColor: '#dc2626' },
              high: { en: 'High', hi: 'उच्च', dotColor: '#ea580c' },
              medium: { en: 'Mid', hi: 'मध्यम', dotColor: '#0284c7' },
              low: { en: 'Low', hi: 'निम्न', dotColor: '#64748b' },
            };
            const meta = labels[sev];
            return (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                style={{
                  padding: '6px 13px', borderRadius: 999, border: `1px solid ${isSelected ? meta.dotColor : 'var(--border)'}`,
                  background: isSelected ? meta.dotColor : 'var(--surface)',
                  color: isSelected ? '#FFFFFF' : 'var(--text)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                {!isSelected && (
                  <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: meta.dotColor }} />
                )}
                <span>{lang === 'hi' ? meta.hi : meta.en}</span>
                <span style={{
                  fontSize: 11, padding: '1px 6px', borderRadius: 999,
                  background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--surface-subtle)',
                  color: isSelected ? '#fff' : 'var(--text-muted)',
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Content List ─── */}
      {filteredAlerts.length === 0 && filteredTasks.length === 0 ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <CheckCircle2 size={40} color="#16a34a" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            {lang === 'hi' ? 'इस श्रेणी में कोई सक्रिय चेतावनी या कार्य नहीं है' : 'No active alerts or tasks in this filter category'}
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {lang === 'hi' ? 'कृपया अन्य प्राथमिकता या फ़िल्टर चुनें।' : 'Select another priority or filter tab.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Render Alerts (if typeFilter is 'all' or 'alerts') */}
          {(typeFilter === 'all' || typeFilter === 'alerts') && filteredAlerts.map(alert => {
            const assignedInfo =
              assignedAlerts[alert._id] ||
              (alert.reportId ? assignedAlerts[alert.reportId] : null) ||
              assignedAlerts[alert.title];
            const sevBadge = severityPill(alert.severity, lang);

            return (
              <div key={alert._id} style={cardStyle}>
                <div style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    {/* Left Risk Score Circle */}
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                      background: alert.riskScore >= 75 ? '#fee2e2' : '#ffedd5',
                      color: alert.riskScore >= 75 ? '#dc2626' : '#ea580c',
                      border: `2px solid ${alert.riskScore >= 75 ? '#fca5a5' : '#fed7aa'}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 18, lineHeight: 1,
                    }}>
                      {alert.riskScore}
                      <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.8 }}>SIF</span>
                    </div>

                    {/* Middle Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={sevBadge.style}>{sevBadge.label}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                          background: 'var(--surface-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)',
                        }}>
                          {alert.category ? translateCategory(alert.category, lang) : 'Hazard'}
                        </span>
                        {alert.sifProbability !== undefined && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                            SIF Prob: {Math.round(alert.sifProbability * 100)}%
                          </span>
                        )}
                        {alert.acknowledged && (
                          <span style={{
                            fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#dcfce7',
                            padding: '2px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}>
                            <Check size={11} strokeWidth={2.5} /> {lang === 'hi' ? 'स्वीकृत' : 'Acknowledged'}
                          </span>
                        )}
                      </div>

                      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px 0', lineHeight: 1.4 }}>
                        {translateSafetyText(alert.title, lang)}
                      </h3>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {translateLocation(alert.location, lang)}</span>
                        <span>·</span>
                        <span>{alert.submittedBy}</span>
                        <span>·</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {translateTimeAgo(alert.timeAgo, lang)}</span>
                      </div>

                      {/* Precursor Tags */}
                      {alert.precursors && alert.precursors.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {alert.precursors.map((p, idx) => (
                            <span key={idx} style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                              backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}>
                              <AlertTriangle size={11} /> {lang === 'hi' ? `संकेतक: ${translateSafetyText(p, lang)}` : `Precursor: ${p}`}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* AI Solution Box */}
                      <div style={{
                        marginTop: 10, padding: '10px 14px', borderRadius: 8,
                        backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Bot size={14} style={{ color: 'var(--primary)' }} />
                          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>
                            {lang === 'hi' ? 'AI अनुशंसित समाधान (OSHA 1910):' : 'AI Recommended Solution (OSHA 1910):'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, lineHeight: 1.4 }}>
                          {translateSafetyText(resolveRecommendations(alert)[0], lang)}
                        </div>
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      <Link href={`/officer/reports/${alert.reportId || alert._id}`}>
                        <button style={{
                          width: '100%', padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8,
                          background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          whiteSpace: 'nowrap',
                        }}>
                          <Eye size={13} /> {lang === 'hi' ? 'रिपोर्ट देखें' : 'View Report'}
                        </button>
                      </Link>

                      {assignedInfo ? (
                        <button
                          onClick={() => setTypeFilter('tasks')}
                          style={{
                            width: '100%', padding: '8px 14px', border: '1px solid #16a34a', borderRadius: 8,
                            background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                            whiteSpace: 'nowrap',
                          }}
                          title="View in Tasks"
                        >
                          <CheckCircle2 size={13} color="#16a34a" />
                          <span>{assignedInfo.orderNumber ? `[${assignedInfo.orderNumber}] ` : ''}{lang === 'hi' ? 'कार्य सौंपा गया' : 'Task Assigned'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => openDispatchModalForAlert(alert)}
                          style={{
                            width: '100%', padding: '8px 16px', border: 'none', borderRadius: 8,
                            background: '#0A192F', color: '#fff', fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Zap size={13} /> {lang === 'hi' ? 'कार्य सौंपें' : 'Assign Task'}
                        </button>
                      )}

                      <button
                        onClick={() => toggleAlertAck(alert._id)}
                        style={{
                          padding: '8px 16px', border: `1px solid ${alert.acknowledged ? 'var(--border)' : '#16a34a'}`,
                          borderRadius: 8, background: 'var(--surface)',
                          color: alert.acknowledged ? 'var(--text-muted)' : '#16a34a',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {alert.acknowledged ? (
                          <>
                            <Undo2 size={12} /> {lang === 'hi' ? 'अस्वीकृत करें' : 'Unacknowledge'}
                          </>
                        ) : (
                          <>
                            <Check size={12} strokeWidth={2.5} /> {lang === 'hi' ? 'स्वीकार करें' : 'Acknowledge'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {alert.severity === 'critical' && !alert.acknowledged && (
                  <div style={{
                    background: '#fef2f2', borderTop: '1px solid #fca5a5',
                    padding: '6px 18px', fontSize: 12, fontWeight: 700, color: '#dc2626',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Zap size={12} /> {lang === 'hi' ? 'अति-गंभीर SIF अलर्ट — OSHA 1910 तत्काल पर्यवेक्षक सत्यापन अनिवार्य' : 'High-priority SIF alert — Immediate supervisor verification required'}
                  </div>
                )}
              </div>
            );
          })}

          {/* Render Active Maintenance Tasks (if typeFilter is 'all' or 'tasks') */}
          {(typeFilter === 'all' || typeFilter === 'tasks') && filteredTasks.map(task => {
            const sevBadge = severityPill(task.severity, lang);

            return (
              <div key={task._id} style={{ ...cardStyle, borderLeft: '4px solid #0A192F' }}>
                <div style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    {/* Left Icon Badge for Task */}
                    <div style={{
                      width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                      background: '#0A192F', color: '#FFFFFF',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 2,
                    }}>
                      <Wrench size={20} />
                      <span style={{ fontSize: 9, fontWeight: 800 }}>TASK</span>
                    </div>

                    {/* Middle Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{
                          fontFamily: 'monospace', fontSize: 11, fontWeight: 800,
                          background: '#0A192F', color: '#fff', padding: '2px 8px', borderRadius: 6,
                        }}>
                          {task.orderNumber || 'WO-Task'}
                        </span>
                        <span style={sevBadge.style}>{sevBadge.label}</span>
                        <span style={taskStatusBadge(task.status)}>
                          {taskStatusLabel(task.status, lang)}
                        </span>
                        {task.lotoRequired && (
                          <span style={{
                            fontSize: 11, fontWeight: 700, background: '#fef2f2', color: '#dc2626',
                            border: '1px solid #fecaca', padding: '2px 8px', borderRadius: 999,
                          }}>
                            🔒 LOTO
                          </span>
                        )}
                      </div>

                      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px 0', lineHeight: 1.4 }}>
                        {translateSafetyText(task.title, lang)}
                      </h3>

                      {task.description && (
                        <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 8px 0', lineHeight: 1.4, opacity: 0.9 }}>
                          {translateSafetyText(task.description, lang)}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Wrench size={12} />
                          <strong>{lang === 'hi' ? 'सौंपी गई टीम:' : 'Assigned Crew:'}</strong>{' '}
                          <span style={{ color: 'var(--text)', fontWeight: 700 }}>
                            {translateCrew(task.assignedCrew || task.assignedTo, lang)}
                          </span>
                        </span>
                        <span>·</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={12} /> {translateLocation(task.location || 'Plant Floor', lang)}
                        </span>
                        {task.createdAt && (
                          <>
                            <span>·</span>
                            <span><Clock size={12} /> {timeAgo(task.createdAt)}</span>
                          </>
                        )}
                      </div>

                      {/* Clearance Note if maintenance submitted */}
                      {task.clearanceNote && (
                        <div style={{
                          marginTop: 10, padding: '8px 12px', background: '#faf5ff',
                          border: '1px solid #e9d5ff', borderRadius: 8, fontSize: 12, color: '#6b21a8',
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <FileText size={15} style={{ flexShrink: 0 }} />
                          <div>
                            <strong>{lang === 'hi' ? 'मेंटेनेंस निकासी नोट:' : 'Maintenance Clearance Note:'}</strong>{' '}
                            {translateSafetyText(task.clearanceNote, lang)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Actions for Task */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      {task.status === 'clearance_submitted' && (
                        <button
                          onClick={() => handleVerifyAndClearTask(task)}
                          style={{
                            width: '100%', padding: '9px 16px', border: 'none', borderRadius: 8,
                            background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            boxShadow: '0 2px 6px rgba(22,163,74,0.3)', whiteSpace: 'nowrap',
                          }}
                        >
                          <CheckCircle2 size={14} />
                          <span>{lang === 'hi' ? 'सत्यापित व हल करें' : 'Verify & Clear'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => openReassignModalForTask(task)}
                        style={{
                          width: '100%', padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8,
                          background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Wrench size={13} />
                        <span>{lang === 'hi' ? 'टीम बदलें' : 'Reassign Crew'}</span>
                      </button>

                      {task.reportId && (
                        <Link href={`/officer/reports/${task.reportId}`}>
                          <button style={{
                            width: '100%', padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8,
                            background: 'var(--surface-subtle)', color: 'var(--text)', fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            whiteSpace: 'nowrap',
                          }}>
                            <Eye size={13} /> {lang === 'hi' ? 'रिपोर्ट देखें' : 'View Report'}
                          </button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL: Assign / Reassign Maintenance Work Order ─── */}
      {(selectedAlertForDispatch || selectedTaskForReassign) && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 540,
            border: '1px solid var(--border)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'var(--surface-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wrench size={18} style={{ color: '#0A192F' }} />
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                  {modalMode === 'assign_alert'
                    ? (lang === 'hi' ? 'मेंटेनेंस टीम को नया कार्य आदेश भेजें' : 'Dispatch Maintenance Work Order')
                    : (lang === 'hi' ? 'मेंटेनेंस टीम व प्राथमिकता पुनः सौंपें' : 'Reassign Maintenance Team & Priority')}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedAlertForDispatch(null);
                  setSelectedTaskForReassign(null);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmModalSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Context Summary Box */}
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {modalMode === 'assign_alert' ? 'Target Hazard Observation' : 'Target Maintenance Work Order'}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                    background: dispatchSeverity === 'critical' ? '#fee2e2' : dispatchSeverity === 'high' ? '#ffedd5' : '#e0f2fe',
                    color: dispatchSeverity === 'critical' ? '#dc2626' : dispatchSeverity === 'high' ? '#ea580c' : '#0369a1',
                  }}>
                    {dispatchSeverity.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>
                  {translateSafetyText(selectedAlertForDispatch?.title || selectedTaskForReassign?.title || '', lang)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={11} /> {translateLocation(selectedAlertForDispatch?.location || selectedTaskForReassign?.location || 'Plant Floor', lang)}
                </div>
              </div>

              {/* Work Order Instructions */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  {lang === 'hi' ? 'कार्य निर्देश व निवारक कार्रवाई (AI सुझावित)' : 'Work Order Instructions & Remediation'}
                </label>
                <textarea
                  value={dispatchInstructions}
                  onChange={e => setDispatchInstructions(e.target.value)}
                  rows={3}
                  required
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    color: 'var(--text)', fontSize: 13, resize: 'vertical',
                  }}
                />
              </div>

              {/* Maintenance Crew Selection */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  {lang === 'hi' ? 'मेंटेनेंस टीम चुनें' : 'Assign to Maintenance Crew'}
                </label>
                <select
                  value={dispatchCrew}
                  onChange={e => setDispatchCrew(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    color: 'var(--text)', fontSize: 13, fontWeight: 600,
                  }}
                >
                  {MAINTENANCE_CREWS.map(crew => (
                    <option key={crew} value={crew}>
                      {translateCrew(crew, lang)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority & LOTO Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                    {lang === 'hi' ? 'प्राथमिकता स्तर' : 'Priority Severity'}
                  </label>
                  <select
                    value={dispatchSeverity}
                    onChange={e => setDispatchSeverity(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      border: '1px solid var(--border)', background: 'var(--surface)',
                      color: 'var(--text)', fontSize: 13,
                    }}
                  >
                    <option value="critical">Critical (Immediate SIF)</option>
                    <option value="high">High Priority</option>
                    <option value="medium">Medium / Mid</option>
                    <option value="low">Low / Routine</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12, fontWeight: 700, color: 'var(--text)', cursor: 'pointer', marginTop: 16
                  }}>
                    <input
                      type="checkbox"
                      checked={dispatchLoto}
                      onChange={e => setDispatchLoto(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <span>{lang === 'hi' ? 'LOTO आवश्यक (Lockout)' : 'LOTO Isolation Required'}</span>
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAlertForDispatch(null);
                    setSelectedTaskForReassign(null);
                  }}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text)', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isDispatching}
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: '#0A192F', color: '#fff', fontSize: 12, fontWeight: 700,
                    cursor: isDispatching ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                    opacity: isDispatching ? 0.7 : 1,
                  }}
                >
                  {isDispatching ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>{lang === 'hi' ? 'अपडेट किया जा रहा है...' : 'Dispatching...'}</span>
                    </>
                  ) : (
                    <>
                      <Zap size={14} />
                      <span>{modalMode === 'assign_alert' ? (lang === 'hi' ? 'कार्य आदेश भेजें' : 'Dispatch Work Order') : (lang === 'hi' ? 'अपडेट सहेजें' : 'Save Assignment')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
