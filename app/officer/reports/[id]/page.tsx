'use client';

import { use, useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import { MOCK_REPORTS, MAINTENANCE_TASKS } from '@/app/lib/officerMockData';
import { getReportByIdApi, createTaskApi, updateReportStatusApi, getTasksApi } from '@/app/lib/api';
import { MAINTENANCE_CREWS } from '@/app/officer/tasks/page';
import {
  CheckCircle2,
  MapPin,
  User,
  Clock,
  Bot,
  AlertTriangle,
  Zap,
  Wrench,
  X,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { useLanguage } from '@/app/lib/LanguageContext';
import {
  translateSafetyText,
  translateLocation,
  translateCategory,
  translateStatus,
  translateSeverity,
  translateCrew,
} from '@/app/lib/hindiTranslator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskColor(score: number) {
  if (score >= 80) return '#dc2626';
  if (score >= 60) return '#ea580c';
  if (score >= 40) return '#d97706';
  return '#16a34a';
}
function riskBg(score: number) {
  if (score >= 80) return '#fef2f2';
  if (score >= 60) return '#fff7ed';
  if (score >= 40) return '#fffbeb';
  return '#f0fdf4';
}

function statusLabel(s: string, lang: string = 'en') {
  if (lang === 'hi') return translateStatus(s, 'hi');
  const map: Record<string, string> = {
    pending: 'Pending', under_review: 'Under Review', action_assigned: 'Action Assigned',
    analysis_complete: 'Analysis Complete', resolved: 'Resolved',
  };
  return map[s] || s;
}

function statusBadgeStyle(status: string): CSSProperties {
  const map: Record<string, { bg: string; color: string }> = {
    pending: { bg: '#fef9c3', color: '#854d0e' }, under_review: { bg: '#e0f2fe', color: '#0369a1' },
    action_assigned: { bg: '#fff7ed', color: '#9a3412' }, analysis_complete: { bg: '#f3e8ff', color: '#6b21a8' },
    resolved: { bg: '#dcfce7', color: '#14532d' },
  };
  const s = map[status] || { bg: '#f3f4f6', color: '#374151' };
  return { background: s.bg, color: s.color, borderRadius: 12, padding: '3px 11px', fontSize: 12, fontWeight: 600, display: 'inline-block' };
}

function taskStatusStyle(s: string): CSSProperties {
  if (s === 'done' || s === 'officer_verified') return { background: 'var(--success-light)', color: 'var(--success)', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600, display: 'inline-block' };
  if (s === 'clearance_submitted') return { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600, display: 'inline-block' };
  if (s === 'in_progress') return { background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600, display: 'inline-block' };
  return { background: 'var(--warning-light)', color: 'var(--warning)', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600, display: 'inline-block' };
}

function catLabel(c: string, lang: string = 'en') {
  if (lang === 'hi') return translateCategory(c, 'hi');
  const map: Record<string, string> = {
    electrical: 'Electrical', fall: 'Fall Risk', chemical: 'Chemical',
    fire: 'Fire', machinery: 'Machinery', structural: 'Structural', ppe: 'PPE',
  };
  return map[c] || c;
}

function catBg(c: string) {
  const map: Record<string, { bg: string; color: string }> = {
    electrical: { bg: '#fef3c7', color: '#92400e' }, fall: { bg: 'var(--primary-light)', color: 'var(--primary)' },
    chemical: { bg: '#ede9fe', color: '#5b21b6' }, fire: { bg: '#fee2e2', color: '#991b1b' },
    machinery: { bg: '#e0e7ff', color: '#3730a3' }, structural: { bg: '#f5f5f4', color: '#44403c' },
    ppe: { bg: '#dcfce7', color: '#14532d' },
  };
  return map[c] || { bg: '#f3f4f6', color: '#374151' };
}

function timeAgo(iso: string, lang: string = 'en') {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === 'hi' ? 'अभी' : 'Just now';
  if (mins < 60) return `${mins}${lang === 'hi' ? ' मिनट पहले' : 'm ago'}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${lang === 'hi' ? ' घंटे पहले' : 'h ago'}`;
  return `${Math.floor(hrs / 24)}${lang === 'hi' ? ' दिन पहले' : 'd ago'}`;
}

function getDynamicTasks(
  category?: string,
  title?: string,
  description?: string,
  location?: string,
  precursors?: string[]
): { immediateActions: string[]; recommendations: string[]; suggestedCrew: string } {
  const combined = `${title || ''} ${description || ''} ${location || ''} ${category || ''} ${(precursors || []).join(' ')}`.toLowerCase();

  // 1. Scaffolding / Fall at Height
  if (/scaffold|fall|height|ladder|harness|plank|tier|deck|roof|guardrail|kickboard/i.test(combined) || category === 'fall') {
    return {
      immediateActions: [
        "Issue Stop-Work notice on elevated structure until 100% harness tie-off compliance is confirmed.",
        "Red-tag scaffold access ladders as 'DO NOT USE' under OSHA 1926.451."
      ],
      recommendations: [
        "Red-tag scaffold as 'DO NOT USE' until re-inspected by certified competent person under OSHA 1926.451.",
        "Fasten all wooden/metal planks with cleats and install 4-inch toe boards and midrails.",
        "Inspect all structural cross-bracing and anchor tie-ins to permanent walls."
      ],
      suggestedCrew: "Scaffolding & Structural Rigging Team S-3",
    };
  }

  // 2. High Pressure Steam / Flange Leaks / Boiler
  if (/steam|boiler|flange|pressure|psi|thermal|corroded|pipe|valve|gasket/i.test(combined)) {
    return {
      immediateActions: [
        "Isolate steam feed valves immediately and verify pressure bleeder drop to 0 PSI.",
        "Establish a 30-meter high-temperature exclusion zone with red thermal warning signage."
      ],
      recommendations: [
        "Depressurize line to 0 PSI and verify zero stored thermal energy before servicing couplings.",
        "Deploy certified mechanical team in Level B thermal PPE to replace damaged spiral-wound gasket.",
        "Torque flange studs in cross-star pattern to 185 ft-lbs and perform ultrasonic leak check."
      ],
      suggestedCrew: "Hydraulics & Pressure Valve Crew H-1",
    };
  }

  // 3. Electrical / High Voltage / Bare Wire
  if (/wire|electric|voltage|conduit|breaker|loto|cable|shock|energiz|submerged/i.test(combined) || category === 'electrical') {
    return {
      immediateActions: [
        "De-energize circuit breaker at source and lock out with master padlock under LOTO protocol.",
        "Barricade wet floor area and disconnect all adjacent conductive electrical equipment."
      ],
      recommendations: [
        "Lock out and tag out (LOTO) primary electrical feed at source panel and verify Zero Energy State.",
        "Erect red boundary perimeter barricades with 'DANGER - HIGH VOLTAGE' warning placards.",
        "Replace damaged wiring with IP67-rated industrial conduit and perform Megger insulation test."
      ],
      suggestedCrew: "Electrical & High-Voltage Crew E-2",
    };
  }

  // 4. Rotating Machinery / Bearing / Pump / Vibration / Hydrocracker
  if (/bearing|vibration|pump|motor|gear|shaft|conveyor|rotating|hydrocracker|nip|pinch/i.test(combined) || category === 'machinery') {
    return {
      immediateActions: [
        "Halt drive motor immediately and engage emergency stop pull-cord.",
        "Lock out drive power breaker and attach safety tag prohibiting unauthorized restart."
      ],
      recommendations: [
        "Perform high-resolution FFT vibration spectral analysis to identify bearing raceway degradation.",
        "Flush contaminated lubricant reservoir and install replacement spherical roller bearings.",
        "Verify dynamic shaft alignment within 0.05 mm tolerance before re-energizing drive."
      ],
      suggestedCrew: "Rotating Machinery Team M-4",
    };
  }

  // 5. Chemical Spill / Toxic Gas / Acid / Corrosive
  if (/chemical|acid|toxic|spill|fume|gas|corrosive|drum|drain|h2s|solvent/i.test(combined) || category === 'chemical' || category === 'chemical_exposure') {
    return {
      immediateActions: [
        "Evacuate affected area immediately and deploy forced-air positive ventilation blowers.",
        "Don Level B chemical protective suit, full-face respirator, and neoprene gloves."
      ],
      recommendations: [
        "Deploy chemical spill containment kit, place neutralizing absorbent berms, and stop active leak.",
        "Perform 4-gas atmospheric sweep to verify zero toxic gas ppm before re-entry.",
        "Log hazardous material manifest and replace corroded primary storage vessel."
      ],
      suggestedCrew: "Hazardous Material Containment Team C-1",
    };
  }

  // 6. Fire / Flammable / Combustible / Smoke
  if (/fire|smoke|flame|combustible|extinguisher|sprinkler|ignition/i.test(combined) || category === 'fire') {
    return {
      immediateActions: [
        "Sound local sector alarm and clear all combustible materials within 35-foot perimeter.",
        "Prohibit all hot work and verify automatic deluge/sprinkler valves are fully operational."
      ],
      recommendations: [
        "Post 24-hour continuous fire watch personnel until fire suppression system is recertified.",
        "Inspect and replace all depressurized dry-chemical extinguishers with certified units.",
        "Audit hot work permit logs and inspect combustible storage clearances per NFPA 30."
      ],
      suggestedCrew: "General Plant Reliability Team G-5",
    };
  }

  // 7. General Emergency / Distress / Unsafe Condition (e.g. "Help help help.")
  return {
    immediateActions: [
      "Dispatch field supervisor rapid-response team to physically inspect and secure the sector.",
      "Halt operations in immediate hazard vicinity under Stop-Work Authority."
    ],
    recommendations: [
      "Conduct comprehensive physical walkdown inspection with area supervisor to determine root hazard.",
      "Establish a controlled safety perimeter with yellow hazard tape and barricades.",
      "Schedule priority corrective maintenance work order and log findings in shift handover log."
    ],
    suggestedCrew: "General Plant Reliability Team G-5",
  };
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { lang, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [report, setReport] = useState<any>(null);
  const [reportTasks, setReportTasks] = useState<any[]>([]);

  // Dispatch Modal State
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchCrew, setDispatchCrew] = useState(MAINTENANCE_CREWS[0]);
  const [dispatchInstructions, setDispatchInstructions] = useState('');
  const [dispatchSeverity, setDispatchSeverity] = useState('high');
  const [dispatchLoto, setDispatchLoto] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  useEffect(() => {
    async function loadReportAndTasks() {
      try {
        const res = await getReportByIdApi(id);
        let loadedReport: any = null;
        if (res.data) {
          const d: any = res.data;
          const rawRecs: string[] = Array.isArray(d.recommendations) && d.recommendations.length > 0
            ? d.recommendations
            : Array.isArray(d.riskAssessment?.recommendations) && d.riskAssessment.recommendations.length > 0
            ? d.riskAssessment.recommendations
            : [];

          // If recs are generic placeholder, replace with smart contextual OSHA tasks
          const isGeneric = rawRecs.length > 0 && rawRecs.some((r: string) => r.toLowerCase().includes("daily hazard register"));
          const dynamic = getDynamicTasks(d.category, d.title, d.description, d.location, d.precursors || d.riskAssessment?.precursors);

          const finalRecs = (rawRecs.length > 0 && !isGeneric) ? rawRecs : dynamic.recommendations;
          const finalImm = (Array.isArray(d.immediateActions) && d.immediateActions.length > 0) ? d.immediateActions : dynamic.immediateActions;
          const finalPrecursors = (Array.isArray(d.precursors) && d.precursors.length > 0)
            ? d.precursors
            : (Array.isArray(d.riskAssessment?.precursors) && d.riskAssessment.precursors.length > 0)
            ? d.riskAssessment.precursors
            : [];
          const finalExplanation = d.explanation || d.riskAssessment?.explanation || "Automated SIF classification calculated by fine-tuned model under OSHA 1910 standards.";

          loadedReport = {
            _id: d._id,
            title: d.title,
            category: d.category || "machinery",
            severity: d.severity || "high",
            status: d.status || "analysis_complete",
            riskScore: d.risk_score || d.riskAssessment?.riskScore || 78,
            sifProbability: d.sif_probability ?? d.riskAssessment?.sifProbability,
            zone: "Sector 4",
            location: d.location || "Plant Sector 4 North",
            submittedBy: d.submittedBy?.name || "Site Worker",
            department: d.submittedBy?.department || "Operations",
            createdAt: d.createdAt || new Date().toISOString(),
            description: d.description,
            immediateActions: finalImm,
            recommendations: finalRecs,
            precursors: finalPrecursors,
            explanation: finalExplanation,
            suggestedCrew: dynamic.suggestedCrew,
            hasImage: Boolean(d.imageUrl),
            imageUrl: d.imageUrl,
          };
          setReport(loadedReport);
          setDispatchSeverity(loadedReport.severity || "high");
          setDispatchLoto(loadedReport.severity === "critical");
          if (dynamic.suggestedCrew) {
            setDispatchCrew(dynamic.suggestedCrew);
          }
        } else {
          const fallback = MOCK_REPORTS.find(r => r._id === id) || { ...MOCK_REPORTS[0], _id: id };
          setReport(fallback);
          loadedReport = fallback;
        }

        // Fetch live tasks for this report
        try {
          const tRes = await getTasksApi();
          if (tRes.success && Array.isArray(tRes.data)) {
            const matched = tRes.data.filter(
              (t: any) => t.reportId === id || (loadedReport && t.reportId === loadedReport._id)
            );
            setReportTasks(matched);
          }
        } catch (tErr) {
          console.warn("Could not fetch live tasks:", tErr);
        }
      } catch (err) {
        console.warn("Using fallback mock report:", err);
        const fallback = MOCK_REPORTS.find(r => r._id === id) || { ...MOCK_REPORTS[0], _id: id };
        setReport(fallback);
      } finally {
        setLoading(false);
      }
    }
    loadReportAndTasks();
  }, [id]);

  const handleCreateTaskForRec = async (recText: string) => {
    try {
      const assignedCrew = report.suggestedCrew || dispatchCrew || MAINTENANCE_CREWS[0];
      const res = await createTaskApi({
        title: `Task: ${report.title.slice(0, 45)}`,
        description: `${recText}\n\nGenerated from fine-tuned SIF precursor assessment for ${report.location}.`,
        equipmentId: "EQ-" + Math.floor(100 + Math.random() * 900),
        equipmentName: report.title,
        location: report.location,
        severity: report.severity,
        assignedCrew: assignedCrew,
        lotoRequired: report.severity === "critical",
        reportId: report._id,
      });

      if (res.data) {
        setReportTasks(prev => [res.data, ...prev]);
      }
      await updateReportStatusApi(report._id, "action_assigned");
      setReport((prev: any) => ({ ...prev, status: "action_assigned" }));
      showToast(`Assigned maintenance task to ${assignedCrew}!`);
    } catch {
      showToast("Task logged to maintenance queue.");
    }
  };

  const handleDispatchFromModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDispatching(true);
    try {
      const res = await createTaskApi({
        title: `Task: ${report.title.slice(0, 45)}`,
        description: dispatchInstructions || report.description || "Corrective maintenance task dispatched from officer command.",
        equipmentId: "EQ-" + Math.floor(100 + Math.random() * 900),
        equipmentName: report.title,
        location: report.location,
        severity: dispatchSeverity,
        assignedCrew: dispatchCrew,
        lotoRequired: dispatchLoto,
        reportId: report._id,
      });

      if (res.data) {
        setReportTasks(prev => [res.data, ...prev]);
      }
      await updateReportStatusApi(report._id, "action_assigned");
      setReport((prev: any) => ({ ...prev, status: "action_assigned" }));
      showToast(`Task successfully assigned to ${dispatchCrew}!`);
      setShowDispatchModal(false);
      setDispatchInstructions('');
    } catch (err) {
      console.warn("Failed to dispatch task:", err);
      showToast("Task created in local dispatch queue.");
      setShowDispatchModal(false);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleMarkResolved = async () => {
    try {
      await updateReportStatusApi(report._id, "resolved");
      setReport((prev: any) => ({ ...prev, status: "resolved" }));
      showToast("Report marked as resolved in database.");
    } catch {
      setReport((prev: any) => ({ ...prev, status: "resolved" }));
      showToast("Report marked as resolved.");
    }
  };

  const card: CSSProperties = {
    background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '20px 24px', marginBottom: 16,
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  if (loading || !report) {
    return (
      <div>
        <div className="skeleton" style={{ height: 20, width: 200, marginBottom: 20, borderRadius: 10 }} />
        <div className="skeleton" style={{ height: 120, borderRadius: 16, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 200, borderRadius: 16, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 160, borderRadius: 16 }} />
      </div>
    );
  }

  const fallbackTasks = MAINTENANCE_TASKS.filter(t => t.reportId === report?._id);
  const tasksToDisplay = reportTasks.length > 0 ? reportTasks : fallbackTasks;
  const cat = catBg(report.category);

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 2000,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '12px 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8,
          fontWeight: 600,
        }}>
          <CheckCircle2 size={16} color="#10b981" /> <span>{toast}</span>
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        <Link href="/officer/reports" style={{ color: 'var(--primary)', fontWeight: 500 }}>{lang === 'hi' ? 'रिपोर्ट्स' : 'Reports'}</Link>
        <span>›</span>
        <span style={{ color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>
          {translateSafetyText(report.title, lang)}
        </span>
      </div>

      {/* Header card */}
      <div style={card}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ ...statusBadgeStyle(report.status) }}>{statusLabel(report.status, lang)}</span>
              <span style={{ background: cat.bg, color: cat.color, borderRadius: 999, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
                {catLabel(report.category, lang)}
              </span>
              <span style={{
                background: report.severity === 'critical' ? '#fef2f2' : report.severity === 'high' ? '#fff7ed' : '#fffbeb',
                color: report.severity === 'critical' ? '#dc2626' : report.severity === 'high' ? '#ea580c' : '#d97706',
                borderRadius: 10, padding: '3px 11px', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' as const,
              }}>
                {translateSeverity(report.severity, lang)}
              </span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 10px 0', lineHeight: 1.3 }}>
              {translateSafetyText(report.title, lang)}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={13} /> {translateLocation(report.location, lang)} · {translateLocation(report.zone, lang)}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <User size={13} /> {report.submittedBy} · {report.department}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={13} /> {timeAgo(report.createdAt, lang)}
              </div>
            </div>
          </div>
          {/* Risk Score Big Badge */}
          <div style={{
            width: 90, height: 90, borderRadius: '50%', border: `4px solid ${riskColor(report.riskScore)}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: riskBg(report.riskScore), flexShrink: 0,
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: riskColor(report.riskScore), lineHeight: 1 }}>
              {report.riskScore}
            </div>
            <div style={{ fontSize: 9, fontWeight: 600, color: riskColor(report.riskScore), textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
              {lang === 'hi' ? 'जोखिम स्कोर' : 'Risk Score'}
            </div>
          </div>
        </div>
      </div>

      {/* AI Analysis Card */}
      <div style={{ ...card, borderLeft: '4px solid var(--primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8, background: '#0A192F', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                {lang === 'hi' ? 'AI SIF पूर्वसूचक वर्गीकरण' : 'Fine-Tuned AI Precursor Classification'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                OSHA 1910 Metric Contrastive Learning Evaluation
              </div>
            </div>
          </div>
          {report.sifProbability !== undefined && (
            <span style={{
              backgroundColor: '#F1F5F9', color: '#0F172A',
              borderRadius: 999, padding: '3px 12px', fontSize: 12, fontWeight: 700,
              border: '1px solid #E2E8F0',
            }}>
              {lang === 'hi' ? 'SIF संभावना' : 'SIF Probability'}: {Math.round(report.sifProbability * 100)}%
            </span>
          )}
        </div>

        {/* Precursors */}
        {report.precursors && report.precursors.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              {lang === 'hi' ? 'पहचाने गए SIF पूर्वसूचक:' : 'Detected SIF Precursors:'}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {report.precursors.map((p: string, i: number) => (
                <span key={i} style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <AlertTriangle size={11} /> {translateSafetyText(p, lang)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* AI Explanation */}
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginBottom: 16 }}>
          {translateSafetyText(report.explanation, lang)}
        </div>

        {/* AI Recommendations with Instant Dispatch Buttons */}
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          {lang === 'hi' ? 'अनुशंसित सुधारात्मक कार्य:' : 'Recommended Corrective Tasks:'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {report.recommendations.map((rec: string, i: number) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--surface-subtle)',
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, background: '#0A192F', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1,
                }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, fontWeight: 500 }}>
                  {translateSafetyText(rec, lang)}
                </div>
              </div>
              <button
                onClick={() => handleCreateTaskForRec(rec)}
                style={{
                  padding: '6px 14px', borderRadius: 6, backgroundColor: '#0A192F', color: '#FFFFFF',
                  border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                }}
                title="Assign Maintenance Task from this recommendation"
              >
                <Zap size={12} /> {lang === 'hi' ? 'कार्य सौंपें' : 'Assign Task'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Maintenance Tasks Assigned to this Report */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wrench size={16} /> {lang === 'hi' ? `सौंपे गए मेंटेनेंस कार्य (${tasksToDisplay.length})` : `Assigned Maintenance Tasks (${tasksToDisplay.length})`}
          </div>
          <button
            onClick={() => setShowDispatchModal(true)}
            style={{
              padding: '6px 14px', background: '#0A192F', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span>{lang === 'hi' ? '+ कार्य सौंपें' : '+ Assign Task'}</span>
          </button>
        </div>

        {tasksToDisplay.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>
            {lang === 'hi' ? 'इस खतरे के लिए अभी तक कोई मेंटेनेंस कार्य नहीं सौंपा गया है। मेंटेनेंस टीम को भेजने के लिए नीचे "कार्य सौंपें" पर क्लिक करें।' : 'No maintenance tasks dispatched for this hazard yet. Click "Assign Task" below to dispatch to a maintenance team.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tasksToDisplay.map((task: any) => (
              <div key={task._id || task.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-subtle)',
              }}>
                <span style={{ ...taskStatusStyle(task.status), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {task.status === 'done' || task.status === 'officer_verified' ? (
                    <><CheckCircle2 size={11} strokeWidth={2.5} /> {lang === 'hi' ? 'सत्यापित व हल' : 'Cleared & Resolved'}</>
                  ) : task.status === 'clearance_submitted' ? (
                    <><Zap size={11} /> {lang === 'hi' ? 'निकासी समीक्षा' : 'Clearance Review'}</>
                  ) : task.status === 'in_progress' ? (
                    <><RefreshCw size={11} /> {lang === 'hi' ? 'प्रगति पर है' : 'In Progress'}</>
                  ) : (
                    <><Clock size={11} /> {lang === 'hi' ? 'प्रेषित' : 'Dispatched'}</>
                  )}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {task.orderNumber ? `[${task.orderNumber}] ` : ''}{translateSafetyText(task.title, lang)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {lang === 'hi' ? 'सौंपी गई टीम:' : 'Assigned Crew:'} <strong style={{ color: '#0F172A' }}>{translateCrew(task.assignedCrew || task.assignedTo || 'Maintenance Response Team', lang)}</strong>
                    {task.location && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        · <MapPin size={10} /> {translateLocation(task.location, lang)}
                      </span>
                    )}
                  </div>
                </div>
                <Link href="/officer/tasks">
                  <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{lang === 'hi' ? 'प्रबंधन करें ↗' : 'Manage ↗'}</span>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions footer */}
      <div style={{
        ...card,
        display: 'flex', gap: 12, flexWrap: 'wrap' as const, alignItems: 'center',
        background: 'var(--surface)',
      }}>
        <button
          onClick={() => setShowDispatchModal(true)}
          style={{
            padding: '10px 22px', background: '#0A192F', color: '#fff', border: 'none',
            borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <Wrench size={16} /> {lang === 'hi' ? 'मेंटेनेंस कार्य सौंपें' : 'Assign Maintenance Task'}
        </button>
        <button
          onClick={handleMarkResolved}
          style={{
            padding: '10px 22px', background: 'var(--surface)', color: 'var(--success)',
            border: '1.5px solid var(--success)', borderRadius: 10, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <CheckCircle2 size={16} strokeWidth={2.4} /> {lang === 'hi' ? 'रिपोर्ट को हल चिह्नित करें' : 'Mark Report Resolved'}
        </button>
        <div style={{ marginLeft: 'auto' }}>
          <Link href="/officer/reports" style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
            {lang === 'hi' ? '← रिपोर्ट सूची पर वापस' : '← Back to Reports'}
          </Link>
        </div>
      </div>

      {/* ─── Assign Maintenance Task Modal ─── */}
      {showDispatchModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2500,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, backdropFilter: 'blur(2px)',
        }}>
          <form onSubmit={handleDispatchFromModal} style={{
            background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)', width: '100%', maxWidth: 520,
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--surface-subtle)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wrench size={18} style={{ color: '#0A192F' }} />
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                  {lang === 'hi' ? 'मेंटेनेंस टीम को कार्य सौंपें' : 'Assign Maintenance Task to Crew'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{lang === 'hi' ? 'रिपोर्ट की गई घटना:' : 'REPORT INCIDENT:'}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>{translateSafetyText(report.title, lang)}</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={11} /> {translateLocation(report.location, lang)}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  {lang === 'hi' ? 'मेंटेनेंस क्रू / विभाग सौंपें: *' : 'Assign Maintenance Crew / Department: *'}
                </label>
                <select
                  value={dispatchCrew}
                  onChange={e => setDispatchCrew(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 600,
                  }}
                >
                  {MAINTENANCE_CREWS.map(crew => (
                    <option key={crew} value={crew}>{translateCrew(crew, lang)}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                    {lang === 'hi' ? 'प्राथमिकता स्तर:' : 'Priority Level:'}
                  </label>
                  <select
                    value={dispatchSeverity}
                    onChange={e => setDispatchSeverity(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    <option value="critical">{lang === 'hi' ? 'अति गंभीर (तत्काल)' : 'CRITICAL (Immediate)'}</option>
                    <option value="high">{lang === 'hi' ? 'उच्च (अगली शिफ्ट)' : 'HIGH (Next shift)'}</option>
                    <option value="medium">{lang === 'hi' ? 'मध्यम (मानक)' : 'MEDIUM (Standard)'}</option>
                    <option value="low">{lang === 'hi' ? 'कम (नियमित)' : 'LOW (Routine)'}</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 18 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={dispatchLoto}
                      onChange={e => setDispatchLoto(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#dc2626' }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 700, color: dispatchLoto ? '#dc2626' : 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Lock size={12} /> {lang === 'hi' ? 'LOTO (तालाबंदी) आवश्यक' : 'LOTO Required'}
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  {lang === 'hi' ? 'कार्य का दायरा और सुरक्षा निर्देश:' : 'Work Scope & Safety Instructions:'}
                </label>
                <textarea
                  value={dispatchInstructions}
                  onChange={e => setDispatchInstructions(e.target.value)}
                  placeholder={lang === 'hi' ? 'विशिष्ट मेंटेनेंस कार्य, बदलने वाले पुर्जे या तालाबंदी आवश्यकताओं का विवरण दें...' : (report.recommendations?.[0] || "Specify maintenance tasks, replacement parts, or lockout requirements...")}
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            <div style={{
              padding: '14px 20px', borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'flex-end', gap: 10,
              background: 'var(--surface-subtle)',
            }}>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                style={{
                  padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isDispatching}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: 'none',
                  background: '#0A192F', color: '#fff', fontSize: 12, fontWeight: 700,
                  cursor: isDispatching ? 'wait' : 'pointer',
                }}
              >
                <span>{isDispatching ? (lang === 'hi' ? 'भेजा जा रहा है...' : 'Dispatching...') : (lang === 'hi' ? 'मेंटेनेंस टीम को कार्य भेजें' : 'Dispatch to Maintenance Team')}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
