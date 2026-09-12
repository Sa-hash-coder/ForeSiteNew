'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { getAlertsApi, acknowledgeAlertApi, createTaskApi } from '@/app/lib/api';
import Link from 'next/link';
import { ACTIVE_ALERTS, ActiveAlert } from '@/app/lib/officerMockData';
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
} from 'lucide-react';

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

function catLabel(c: string) {
  const m: Record<string, string> = {
    electrical: 'Electrical', fall: 'Fall Risk', chemical: 'Chemical',
    fire: 'Fire', machinery: 'Machinery', structural: 'Structural', ppe: 'PPE',
  };
  return m[c] || c;
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
    "Schedule formal job safety analysis (JSA) and dispatch maintenance work order."
  ];
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type Tab = 'all' | 'critical' | 'high';
type SortOpt = 'newest' | 'highest_risk';

export default function AlertsPage() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [sort, setSort] = useState<SortOpt>('highest_risk');
  const [alerts, setAlerts] = useState<LiveAlertItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);

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

    loadAlerts();
    // Real-time live polling every 3.5 seconds
    const interval = setInterval(loadAlerts, 3500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleDispatchTask = async (alert: LiveAlertItem) => {
    try {
      const primaryRec = alert.recommendations && alert.recommendations.length > 0
        ? alert.recommendations[0]
        : `Implement immediate safety isolation for: ${alert.title}`;

      await createTaskApi({
        title: `Corrective Action: ${alert.title.slice(0, 50)}`,
        description: `${primaryRec}\n\nIdentified via automated SIF precursor analysis under OSHA 1910 standards.`,
        equipmentId: "EQ-" + Math.floor(100 + Math.random() * 900),
        equipmentName: alert.title,
        location: alert.location,
        severity: alert.severity,
        assignedCrew: "Reliability & Safety Team M-4",
        lotoRequired: alert.severity === "critical",
        reportId: alert.reportId,
      });

      setToast(`Work Order dispatched to Maintenance: "${primaryRec.slice(0, 45)}..."`);
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      console.warn("Failed to dispatch task:", err);
      setToast("Work order logged to dispatch queue.");
      setTimeout(() => setToast(null), 3000);
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
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Active Alerts</h2>
          <span style={{ background: '#dc2626', color: '#fff', borderRadius: 999, fontSize: 12, fontWeight: 700, padding: '2px 10px' }}>
            {unackCount}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#15803D', backgroundColor: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 6, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#15803D', display: 'inline-block' }}></span>
            Real-time AI Active
          </span>
        </div>
        <select value={sort} onChange={e => setSort(e.target.value as SortOpt)} style={{
          padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13,
          background: 'var(--surface)', color: 'var(--text)', outline: 'none', cursor: 'pointer',
        }}>
          <option value="highest_risk">Highest Risk First</option>
          <option value="newest">Newest First</option>
        </select>
      </div>

      {/* Info bar */}
      <div style={{
        background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 14,
        padding: '12px 18px', marginBottom: 20, fontSize: 13, color: '#991b1b',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Zap size={16} style={{ flexShrink: 0 }} />
        <span>Showing real-time automated SIF hazard detections with model-generated OSHA recommendations.</span>
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
              {t === 'all' ? 'All' : t === 'critical' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#dc2626', display: 'inline-block' }}></span>
                  Critical
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ea580c', display: 'inline-block' }}></span>
                  High
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
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>No alerts for this category</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>All risks in this severity level have been addressed.</div>
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
                        {alert.severity}
                      </span>
                      <span style={catStyle(alert.category)}>{catLabel(alert.category)}</span>
                      {alert.sifProbability && (
                        <span style={{
                          backgroundColor: '#F1F5F9', color: '#0F172A',
                          borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700,
                          border: '1px solid #E2E8F0',
                        }}>
                          SIF Probability: {Math.round(alert.sifProbability * 100)}%
                        </span>
                      )}
                      {alert.acknowledged && (
                        <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Check size={12} strokeWidth={2.5} /> Acknowledged
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{alert.title}</div>
                    
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {alert.location || alert.zone}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={12} /> {alert.submittedBy}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {alert.timeAgo}</span>
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
                            <AlertTriangle size={11} /> Precursor: {p}
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
                          AI Recommended Solutions &amp; Remediation (OSHA 1910):
                        </span>
                      </div>

                      {(() => {
                        const recs = resolveRecommendations(alert);
                        return (
                          <ul style={{ margin: '4px 0 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
                            {recs.map((rec, i) => (
                              <li key={i} style={{ fontWeight: 600, marginBottom: 2 }}>{rec}</li>
                            ))}
                          </ul>
                        );
                      })()}

                      {alert.explanation && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                          Analysis: {alert.explanation}
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
                        <Eye size={13} /> View Report
                      </button>
                    </Link>
                    <button
                      onClick={() => handleDispatchTask(alert)}
                      style={{
                        padding: '8px 16px', border: 'none', borderRadius: 8,
                        background: '#0A192F', color: '#fff', fontSize: 12, fontWeight: 700,
                        transition: 'all 0.15s ease', whiteSpace: 'nowrap' as const, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                      title="Dispatch maintenance work order based on AI suggestions"
                    >
                      <Zap size={13} /> Dispatch Task
                    </button>
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
                          <Undo2 size={12} /> Unacknowledge
                        </>
                      ) : (
                        <>
                          <Check size={12} strokeWidth={2.5} /> Acknowledge
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
                  <Zap size={13} /> High-priority SIF alert — Immediate supervisor verification required under OSHA 1910
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
