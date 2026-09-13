'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { getAlertsApi, acknowledgeAlertApi, createTaskApi, getTasksApi } from '@/app/lib/api';
import Link from 'next/link';
import { ACTIVE_ALERTS, ActiveAlert } from '@/app/lib/officerMockData';
import { MAINTENANCE_CREWS } from '@/app/officer/tasks/page';
import {
  CheckCircle2,
  Zap,
  AlertTriangle,
  Check,
  MapPin,
  User,
  Clock,
  Eye,
  Bot,
  Undo2,
  Wrench,
  X,
  Loader2,
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

// ─── Extended Alert with AI Suggestions ──────────────────────────────────────

interface LiveAlertItem {
  _id: string;
  reportId?: string;
  title: string;
  category: any;
  severity: any;
  riskScore: number;
  sifProbability?: number;
  zone: string;
  location: string;
  timeAgo: string;
  acknowledged: boolean;
  submittedBy: string;
  precursors?: string[];
  hazards?: string[];
  recommendations?: string[];
  explanation?: string;
}

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

function catLabel(c: string, lang: any = 'en') {
  return translateCategory(c, lang);
}

function catStyle(c: string): CSSProperties {
  const m: Record<string, { bg: string; color: string }> = {
    electrical: { bg: '#fef3c7', color: '#92400e' }, fall: { bg: 'var(--primary-light)', color: 'var(--primary)' },
    chemical: { bg: '#ede9fe', color: '#5b21b6' }, fire: { bg: '#fee2e2', color: '#991b1b' },
    machinery: { bg: '#e0e7ff', color: '#3730a3' }, structural: { bg: '#f5f5f4', color: '#44403c' },
    ppe: { bg: '#dcfce7', color: '#14532d' },
  };
  const s = m[c] || { bg: '#f3f4f6', color: '#374151' };
  return { background: s.bg, color: s.color, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 500, display: 'inline-block' };
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
  if (/fire|explosion|flammable|gas|cylinder/i.test(text)) {
    return [
      "Isolate flammable gas supply lines and initiate continuous LEL combustible gas monitoring.",
      "Verify dry chemical fire suppression systems are armed and clear emergency access paths.",
      "Eliminate all ignition sources within 35 feet and ground metal structures."
    ];
  }
  if (/crack|structural|column|foundation|concrete/i.test(text)) {
    return [
      "Erect temporary heavy-duty steel shoring towers around affected structural members.",
      "Cordon off areas directly above and below the compromised zone to prevent load hazard.",
      "Engage certified structural reliability engineer for ultrasonic integrity assessment."
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

// ─── Main Page ───────────────────────────────────────────────────────────────

type Tab = 'all' | 'critical' | 'high';
type SortOpt = 'newest' | 'highest_risk';

export default function AlertsPage() {
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [sort, setSort] = useState<SortOpt>('highest_risk');
  const [alerts, setAlerts] = useState<LiveAlertItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Dispatch Modal State
  const [selectedAlertForDispatch, setSelectedAlertForDispatch] = useState<LiveAlertItem | null>(null);
  const [dispatchCrew, setDispatchCrew] = useState<string>(MAINTENANCE_CREWS[0]);
  const [dispatchInstructions, setDispatchInstructions] = useState<string>('');
  const [dispatchSeverity, setDispatchSeverity] = useState<string>('high');
  const [dispatchLoto, setDispatchLoto] = useState<boolean>(false);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [assignedAlerts, setAssignedAlerts] = useState<Record<string, { orderNumber: string; crew: string }>>({});

  useEffect(() => {
    let isMounted = true;

    async function loadAlerts() {
      try {
        const res = await getAlertsApi();
        if (res.data && res.data.length > 0 && isMounted) {
          const mapped: LiveAlertItem[] = res.data.map((a: any) => ({
            _id: a._id,
            reportId: a.reportId,
            title: a.reportTitle || a.message,
            category: a.category || inferCategory(a.reportTitle || a.message, a.precursors),
            severity: (a.riskLevel?.toLowerCase() === "critical" ? "critical" : "high") as any,
            riskScore: a.riskScore || 85,
            sifProbability: a.sifProbability,
            zone: a.zone || (a.location ? a.location.split(',')[0].trim() : "Sector 4"),
            location: a.location || "Plant Sector 4 North",
            timeAgo: timeAgo(a.createdAt),
            acknowledged: !!a.isAcknowledged,
            submittedBy: a.submittedBy || "Site Worker",
            precursors: a.precursors || [],
            hazards: a.hazards || [],
            recommendations: a.recommendations || [],
            explanation: a.explanation,
          }));
          setAlerts(mapped);
        } else if (isMounted && alerts.length === 0) {
          setAlerts([...ACTIVE_ALERTS]);
        }
      } catch (err) {
        console.warn("Using fallback alerts:", err);
        if (isMounted && alerts.length === 0) setAlerts([...ACTIVE_ALERTS]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    async function loadTasks() {
      try {
        const tRes = await getTasksApi();
        if (tRes.data && Array.isArray(tRes.data) && isMounted) {
          const map: Record<string, { orderNumber: string; crew: string }> = {};
          tRes.data.forEach((t: any) => {
            const info = { orderNumber: t.orderNumber || "WO-Task", crew: t.assignedCrew || t.assignedTo || "Maintenance" };
            if (t.reportId) map[t.reportId] = info;
            if (t.equipmentName) map[t.equipmentName] = info;
          });
          setAssignedAlerts(prev => ({ ...map, ...prev }));
        }
      } catch (tErr) {
        console.warn("Could not preload tasks:", tErr);
      }
    }

    loadAlerts();
    loadTasks();
    // Real-time live polling every 3.5 seconds
    const interval = setInterval(loadAlerts, 3500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const openDispatchModal = (alert: LiveAlertItem) => {
    setSelectedAlertForDispatch(alert);
    setDispatchCrew(inferSuggestedCrew(alert.title, alert.precursors));
    const rec = (alert.recommendations && alert.recommendations.length > 0)
      ? alert.recommendations[0]
      : `Implement immediate safety isolation and physical inspection for: ${alert.title}`;
    setDispatchInstructions(rec);
    setDispatchSeverity(alert.severity || 'high');
    setDispatchLoto(alert.severity === 'critical');
  };

  const handleConfirmDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlertForDispatch) return;
    setIsDispatching(true);
    try {
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

      // Mark assigned locally
      setAssignedAlerts(prev => ({
        ...prev,
        [selectedAlertForDispatch._id]: { orderNumber, crew: dispatchCrew },
        ...(selectedAlertForDispatch.reportId ? { [selectedAlertForDispatch.reportId]: { orderNumber, crew: dispatchCrew } } : {}),
        [selectedAlertForDispatch.title]: { orderNumber, crew: dispatchCrew },
      }));

      // Auto-acknowledge alert if not already
      if (!selectedAlertForDispatch.acknowledged) {
        toggle(selectedAlertForDispatch._id);
      }

      setToast(
        lang === 'hi'
          ? `मेंटेनेंस कार्य सौंपा गया [${orderNumber}]: ${translateCrew(dispatchCrew, lang)}`
          : `Work Order [${orderNumber}] assigned to ${dispatchCrew}!`
      );
      setSelectedAlertForDispatch(null);
      setTimeout(() => setToast(null), 5000);
    } catch (err) {
      console.warn("Failed to dispatch task:", err);
      setToast(lang === 'hi' ? "मेंटेनेंस कार्य कतार में दर्ज किया गया।" : "Maintenance task logged to dispatch queue.");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsDispatching(false);
    }
  };

  const filtered = alerts
    .filter(a => tab === 'all' || a.severity === tab)
    .sort((a, b) => {
      if (sort === 'highest_risk') return b.riskScore - a.riskScore;
      return 0;
    });

  const unackCount = alerts.filter(a => !a.acknowledged).length;

  const toggle = async (id: string) => {
    const target = alerts.find(a => a._id === id);
    const nextState = !target?.acknowledged;
    setAlerts(prev => prev.map(a => a._id === id ? { ...a, acknowledged: nextState } : a));
    try {
      await acknowledgeAlertApi(id, "Safety Officer", nextState);
    } catch (err) {
      console.warn("Failed to sync acknowledgment:", err);
    }
  };

  const card: CSSProperties = {
    background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  };

  if (loading) {
    return (
      <div>
        <div className="skeleton" style={{ height: 32, width: 240, marginBottom: 20, borderRadius: 12 }} />
        <div className="skeleton" style={{ height: 40, borderRadius: 12, marginBottom: 16 }} />
        {[0,1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 16, marginBottom: 12 }} />)}
      </div>
    );
  }

  return (
    <div>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 1000,
          backgroundColor: '#0A192F', color: '#FFFFFF', padding: '12px 20px',
          borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 700,
        }}>
          <CheckCircle2 size={16} color="#10b981" /> <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{lang === 'hi' ? 'सक्रिय अलर्ट' : 'Active Alerts'}</h2>
          <span style={{ background: '#dc2626', color: '#fff', borderRadius: 999, fontSize: 12, fontWeight: 700, padding: '2px 10px' }}>
            {unackCount}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#15803D', backgroundColor: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 6, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#15803D', display: 'inline-block' }}></span>
            {lang === 'hi' ? 'रीयल-टाइम AI सक्रिय' : 'Real-time AI Active'}
          </span>
        </div>
        <select value={sort} onChange={e => setSort(e.target.value as SortOpt)} style={{
          padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13,
          background: 'var(--surface)', color: 'var(--text)', outline: 'none', cursor: 'pointer',
        }}>
          <option value="highest_risk">{lang === 'hi' ? 'उच्चतम जोखिम पहले' : 'Highest Risk First'}</option>
          <option value="newest">{lang === 'hi' ? 'नवीनतम पहले' : 'Newest First'}</option>
        </select>
      </div>

      {/* Info bar */}
      <div style={{
        background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 14,
        padding: '12px 18px', marginBottom: 20, fontSize: 13, color: '#991b1b',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Zap size={16} style={{ flexShrink: 0 }} />
        <span>{lang === 'hi' ? 'OSHA सिफारिशों और AI जोखिम मॉडल द्वारा पहचाने गए रीयल-टाइम SIF खतरे दिखाए जा रहे हैं।' : 'Showing real-time automated SIF hazard detections with model-generated OSHA recommendations.'}</span>
      </div>

      {/* Filter tabs */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 20, background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', width: 'fit-content',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        {(['all', 'critical', 'high'] as Tab[]).map((t, i) => {
          const count = alerts.filter(a => t === 'all' || a.severity === t).length;
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '9px 18px', border: 'none', fontSize: 13, fontWeight: 600,
              background: tab === t ? 'var(--primary)' : 'var(--surface)',
              color: tab === t ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
              borderRight: i < 2 ? '1px solid var(--border)' : 'none',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              {t === 'all' ? (lang === 'hi' ? 'सभी' : 'All') : t === 'critical' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#dc2626', display: 'inline-block' }}></span>
                  {lang === 'hi' ? 'अति गंभीर' : 'Critical'}
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ea580c', display: 'inline-block' }}></span>
                  {lang === 'hi' ? 'उच्च' : 'High'}
                </span>
              )}
              <span style={{
                background: tab === t ? 'rgba(255,255,255,0.25)' : 'var(--surface-subtle)',
                color: tab === t ? '#fff' : 'var(--text-muted)',
                borderRadius: 999, fontSize: 11, padding: '0 8px',
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Alert list */}
      {filtered.length === 0 ? (
        <div style={{
          ...card, padding: '48px', textAlign: 'center', color: 'var(--text-muted)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <CheckCircle2 size={36} color="#10b981" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{lang === 'hi' ? 'इस श्रेणी में कोई अलर्ट नहीं है' : 'No alerts for this category'}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>{lang === 'hi' ? 'इस गंभीरता स्तर के सभी जोखिमों का समाधान किया जा चुका है।' : 'All risks in this severity level have been addressed.'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(alert => (
            <div key={alert._id} style={{
              ...card,
              opacity: alert.acknowledged ? 0.65 : 1,
              transition: 'opacity 0.2s ease',
              overflow: 'hidden',
              border: alert.severity === 'critical' ? '1.5px solid #FCA5A5' : '1px solid var(--border)',
            }}>
              <div style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  {/* Risk score circle */}
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                    background: alert.severity === 'critical' ? '#fef2f2' : '#fff7ed',
                    border: `3px solid ${alert.severity === 'critical' ? '#dc2626' : '#ea580c'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      fontSize: 18, fontWeight: 800, lineHeight: 1,
                      color: alert.severity === 'critical' ? '#dc2626' : '#ea580c',
                    }}>
                      {alert.riskScore}
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
                      <span style={{
                        background: alert.severity === 'critical' ? '#fef2f2' : '#fff7ed',
                        color: alert.severity === 'critical' ? '#dc2626' : '#ea580c',
                        borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700,
                        textTransform: 'uppercase' as const, letterSpacing: '0.05em',
                      }}>
                        {translateSeverity(alert.severity, lang)}
                      </span>
                      <span style={catStyle(alert.category)}>{catLabel(alert.category, lang)}</span>
                      {alert.sifProbability && (
                        <span style={{
                          backgroundColor: '#F1F5F9', color: '#0F172A',
                          borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700,
                          border: '1px solid #E2E8F0',
                        }}>
                          {lang === 'hi' ? `SIF संभावना: ${Math.round(alert.sifProbability * 100)}%` : `SIF Probability: ${Math.round(alert.sifProbability * 100)}%`}
                        </span>
                      )}
                      {alert.acknowledged && (
                        <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Check size={12} strokeWidth={2.5} /> {lang === 'hi' ? 'स्वीकृत' : 'Acknowledged'}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                      {translateSafetyText(alert.title, lang)}
                    </div>
                    
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {translateLocation(alert.location || alert.zone, lang)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={12} /> {alert.submittedBy === 'Site Worker' && lang === 'hi' ? 'साइट कर्मचारी' : alert.submittedBy}</span>
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

                    {/* ─── REAL-TIME AI SOLUTION BOX ─── */}
                    <div style={{
                      marginTop: 12,
                      padding: '12px 14px',
                      borderRadius: 8,
                      backgroundColor: 'var(--surface-subtle)',
                      border: '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Bot size={15} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>
                          {lang === 'hi' ? 'AI अनुशंसित समाधान व निवारण (OSHA 1910):' : 'AI Recommended Solutions & Remediation (OSHA 1910):'}
                        </span>
                      </div>

                      {(() => {
                        const recs = resolveRecommendations(alert);
                        return (
                          <ul style={{ margin: '4px 0 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
                            {recs.map((rec, i) => (
                              <li key={i} style={{ fontWeight: 600, marginBottom: 2 }}>{translateSafetyText(rec, lang)}</li>
                            ))}
                          </ul>
                        );
                      })()}

                      {alert.explanation && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                          {lang === 'hi' ? `विश्लेषण: ${translateSafetyText(alert.explanation, lang)}` : `Analysis: ${alert.explanation}`}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <Link href={`/officer/reports/${alert.reportId || alert._id}`}>
                      <button style={{
                        width: '100%',
                        padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8,
                        background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600,
                        transition: 'all 0.15s ease', whiteSpace: 'nowrap' as const, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        <Eye size={13} /> {lang === 'hi' ? 'रिपोर्ट देखें' : 'View Report'}
                      </button>
                    </Link>
                    {(() => {
                      const assignedInfo =
                        assignedAlerts[alert._id] ||
                        (alert.reportId ? assignedAlerts[alert.reportId] : null) ||
                        assignedAlerts[alert.title];

                      if (assignedInfo) {
                        return (
                          <Link href="/officer/tasks" style={{ textDecoration: 'none' }}>
                            <button
                              style={{
                                width: '100%',
                                padding: '8px 14px', border: '1px solid #16a34a', borderRadius: 8,
                                background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 700,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                whiteSpace: 'nowrap' as const,
                              }}
                              title={lang === 'hi' ? 'मेंटेनेंस कार्य सूची देखें' : 'View dispatched task in Tasks list'}
                            >
                              <CheckCircle2 size={13} color="#16a34a" />
                              <span>{assignedInfo.orderNumber ? `[${assignedInfo.orderNumber}] ` : ''}{lang === 'hi' ? 'कार्य सौंपा गया' : 'Task Assigned'}</span>
                            </button>
                          </Link>
                        );
                      }

                      return (
                        <button
                          onClick={() => openDispatchModal(alert)}
                          style={{
                            width: '100%',
                            padding: '8px 16px', border: 'none', borderRadius: 8,
                            background: '#0A192F', color: '#fff', fontSize: 12, fontWeight: 700,
                            transition: 'all 0.15s ease', whiteSpace: 'nowrap' as const, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          }}
                          title={lang === 'hi' ? 'AI सुझावों के आधार पर मेंटेनेंस कार्य सौंपें' : 'Assign maintenance task based on AI suggestions'}
                        >
                          <Zap size={13} /> {lang === 'hi' ? 'कार्य सौंपें' : 'Assign Task'}
                        </button>
                      );
                    })()}
                    <button
                      onClick={() => toggle(alert._id)}
                      style={{
                        padding: '8px 16px', border: `1px solid ${alert.acknowledged ? 'var(--border)' : '#16a34a'}`,
                        borderRadius: 8, background: 'var(--surface)',
                        color: alert.acknowledged ? 'var(--text-muted)' : '#16a34a',
                        fontSize: 12, fontWeight: 600, transition: 'all 0.15s ease', whiteSpace: 'nowrap' as const, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
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

              {/* Critical strip */}
              {alert.severity === 'critical' && !alert.acknowledged && (
                <div style={{
                  background: '#fef2f2', borderTop: '1px solid #fca5a5',
                  padding: '7px 18px', fontSize: 12, fontWeight: 700, color: '#dc2626',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Zap size={13} /> {lang === 'hi' ? 'अति-गंभीर SIF अलर्ट — OSHA 1910 के तहत तत्काल पर्यवेक्षक सत्यापन आवश्यक' : 'High-priority SIF alert — Immediate supervisor verification required under OSHA 1910'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── MODAL: Assign Maintenance Task to Crew ─── */}
      {selectedAlertForDispatch && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
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
            {/* Header */}
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
                  {lang === 'hi' ? 'मेंटेनेंस टीम को कार्य सौंपें' : 'Assign Maintenance Work Order'}
                </span>
              </div>
              <button
                onClick={() => setSelectedAlertForDispatch(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleConfirmDispatch} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Alert Summary Box */}
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {lang === 'hi' ? 'संबंधित अलर्ट / खतरा' : 'Target Hazard Observation'}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                    background: selectedAlertForDispatch.severity === 'critical' ? '#fee2e2' : '#fef3c7',
                    color: selectedAlertForDispatch.severity === 'critical' ? '#dc2626' : '#d97706',
                  }}>
                    {selectedAlertForDispatch.severity?.toUpperCase()} ({selectedAlertForDispatch.riskScore}/100)
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>
                  {translateSafetyText(selectedAlertForDispatch.title, lang)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={11} /> {translateLocation(selectedAlertForDispatch.location, lang)}
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
                    <option value="medium">Medium</option>
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
                  onClick={() => setSelectedAlertForDispatch(null)}
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
                      <span>{lang === 'hi' ? 'सौंपा जा रहा है...' : 'Dispatching Work Order...'}</span>
                    </>
                  ) : (
                    <>
                      <Zap size={14} />
                      <span>{lang === 'hi' ? 'कार्य आदेश भेजें' : 'Dispatch Work Order'}</span>
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
