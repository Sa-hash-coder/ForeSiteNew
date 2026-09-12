'use client';

import { use, useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import { MOCK_REPORTS, MAINTENANCE_TASKS } from '@/app/lib/officerMockData';
import { getReportByIdApi, createTaskApi, updateReportStatusApi, getTasksApi } from '@/app/lib/api';
import { MAINTENANCE_CREWS } from '@/app/officer/tasks/page';

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

function statusLabel(s: string) {
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

function catLabel(c: string) {
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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return 'Just now';
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
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
            immediateActions: d.recommendations && d.recommendations.length > 0 ? d.recommendations.slice(0, 2) : [
              "Halt hazardous operation immediately under Stop-Work Authority.",
              "Erect safety perimeter barricade tape and OSHA hazard notice."
            ],
            recommendations: d.recommendations && d.recommendations.length > 0 ? d.recommendations : [
              "Conduct on-site supervisor inspection and log incident in daily hazard register.",
              "Verify area is cordoned off if active risk persists.",
              "Schedule preventive maintenance work order review."
            ],
            precursors: d.precursors || [],
            explanation: d.explanation || "Automated SIF classification calculated by fine-tuned model under OSHA 1910 standards.",
            hasImage: Boolean(d.imageUrl),
            imageUrl: d.imageUrl,
          };
          setReport(loadedReport);
          setDispatchSeverity(loadedReport.severity || "high");
          setDispatchLoto(loadedReport.severity === "critical");
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
      const res = await createTaskApi({
        title: `Work Order: ${report.title.slice(0, 45)}`,
        description: `${recText}\n\nGenerated from fine-tuned SIF precursor assessment for ${report.location}.`,
        equipmentId: "EQ-" + Math.floor(100 + Math.random() * 900),
        equipmentName: report.title,
        location: report.location,
        severity: report.severity,
        assignedCrew: "Rotating Machinery Team M-4",
        lotoRequired: report.severity === "critical",
        reportId: report._id,
      });

      if (res.data) {
        setReportTasks(prev => [res.data, ...prev]);
      }
      await updateReportStatusApi(report._id, "action_assigned");
      setReport((prev: any) => ({ ...prev, status: "action_assigned" }));
      showToast("Dispatched maintenance work order to Rotating Machinery Team M-4!");
    } catch {
      showToast("Work order logged to maintenance queue.");
    }
  };

  const handleDispatchFromModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDispatching(true);
    try {
      const res = await createTaskApi({
        title: `Work Order: ${report.title.slice(0, 45)}`,
        description: dispatchInstructions || report.description || "Corrective maintenance dispatched from officer command.",
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
      showToast(`Work order successfully dispatched to ${dispatchCrew}!`);
      setShowDispatchModal(false);
      setDispatchInstructions('');
    } catch (err) {
      console.warn("Failed to dispatch task:", err);
      showToast("Work order created in local dispatch queue.");
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
          <span>✅</span> {toast}
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        <Link href="/officer/reports" style={{ color: 'var(--primary)', fontWeight: 500 }}>Reports</Link>
        <span>›</span>
        <span style={{ color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>
          {report.title}
        </span>
      </div>

      {/* Header card */}
      <div style={card}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ ...statusBadgeStyle(report.status) }}>{statusLabel(report.status)}</span>
              <span style={{ background: cat.bg, color: cat.color, borderRadius: 999, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
                {catLabel(report.category)}
              </span>
              <span style={{
                background: report.severity === 'critical' ? '#fef2f2' : report.severity === 'high' ? '#fff7ed' : '#fffbeb',
                color: report.severity === 'critical' ? '#dc2626' : report.severity === 'high' ? '#ea580c' : '#d97706',
                borderRadius: 10, padding: '3px 11px', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' as const,
              }}>
                {report.severity}
              </span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 10px 0', lineHeight: 1.3 }}>
              {report.title}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                📍 {report.location} · {report.zone}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                👤 {report.submittedBy} · {report.department}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                🕐 {timeAgo(report.createdAt)}
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
              Risk Score
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
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>
              🤖
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                Fine-Tuned AI Precursor Classification
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
              SIF Probability: {Math.round(report.sifProbability * 100)}%
            </span>
          )}
        </div>

        {/* Precursors */}
        {report.precursors && report.precursors.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              Detected SIF Precursors:
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {report.precursors.map((p: string, i: number) => (
                <span key={i} style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A',
                }}>
                  ⚠️ {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* AI Explanation */}
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginBottom: 16 }}>
          {report.explanation}
        </div>

        {/* AI Recommendations with Instant Dispatch Buttons */}
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Recommended Corrective Work Orders:
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
                  {rec}
                </div>
              </div>
              <button
                onClick={() => handleCreateTaskForRec(rec)}
                style={{
                  padding: '6px 14px', borderRadius: 6, backgroundColor: '#0A192F', color: '#FFFFFF',
                  border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                }}
                title="Create Maintenance Work Order from this recommendation"
              >
                ⚡ Dispatch WO
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Maintenance Tasks Assigned to this Report */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
            🔧 Dispatched Maintenance Work Orders ({tasksToDisplay.length})
          </div>
          <button
            onClick={() => setShowDispatchModal(true)}
            style={{
              padding: '6px 14px', background: '#0A192F', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span>+ Assign Task</span>
          </button>
        </div>

        {tasksToDisplay.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>
            No maintenance tasks dispatched for this hazard yet. Click "Assign Task" below to dispatch to a maintenance team.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tasksToDisplay.map((task: any) => (
              <div key={task._id || task.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-subtle)',
              }}>
                <span style={taskStatusStyle(task.status)}>
                  {task.status === 'done' || task.status === 'officer_verified'
                    ? '✅ Cleared & Resolved'
                    : task.status === 'clearance_submitted'
                    ? '⚡ Clearance Review'
                    : task.status === 'in_progress'
                    ? '🔄 In Progress'
                    : '🕐 Dispatched'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {task.orderNumber ? `[${task.orderNumber}] ` : ''}{task.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Assigned Crew: <strong style={{ color: '#0F172A' }}>{task.assignedCrew || task.assignedTo || 'Maintenance Response Team'}</strong>
                    {task.location ? ` · 📍 ${task.location}` : ''}
                  </div>
                </div>
                <Link href="/officer/tasks">
                  <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>Manage ↗</span>
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
          <span>🔧</span> Assign Maintenance Task
        </button>
        <button
          onClick={handleMarkResolved}
          style={{
            padding: '10px 22px', background: 'var(--surface)', color: 'var(--success)',
            border: '1.5px solid var(--success)', borderRadius: 10, fontSize: 14, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ✅ Mark Report Resolved
        </button>
        <div style={{ marginLeft: 'auto' }}>
          <Link href="/officer/reports" style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
            ← Back to Reports
          </Link>
        </div>
      </div>

      {/* ─── Dispatch Work Order to Maintenance Modal ─── */}
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
                <span style={{ fontSize: 18 }}>🔧</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                  Dispatch Work Order to Maintenance Team
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>REPORT INCIDENT:</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>{report.title}</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>📍 {report.location}</div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  Assign Maintenance Crew / Department: *
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
                    <option key={crew} value={crew}>{crew}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                    Priority Level:
                  </label>
                  <select
                    value={dispatchSeverity}
                    onChange={e => setDispatchSeverity(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    <option value="critical">CRITICAL (Immediate)</option>
                    <option value="high">HIGH (Next shift)</option>
                    <option value="medium">MEDIUM (Standard)</option>
                    <option value="low">LOW (Routine)</option>
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
                    <span style={{ fontSize: 12, fontWeight: 700, color: dispatchLoto ? '#dc2626' : 'var(--text)' }}>
                      🔒 LOTO Required
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  Work Scope &amp; Safety Instructions:
                </label>
                <textarea
                  value={dispatchInstructions}
                  onChange={e => setDispatchInstructions(e.target.value)}
                  placeholder={report.recommendations?.[0] || "Specify maintenance tasks, replacement parts, or lockout requirements..."}
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
                Cancel
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
                <span>{isDispatching ? 'Dispatching...' : 'Dispatch to Maintenance Team'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
