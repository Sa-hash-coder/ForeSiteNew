'use client';

import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import { MOCK_REPORTS, OfficerReport, ReportStatus, Severity } from '@/app/lib/officerMockData';
import { exportToCSV, exportToExcel, ExportColumn } from '@/app/lib/exportUtils';
import { getAllReportsApi, getTasksApi, createTaskApi } from '@/app/lib/api';
import { FileSpreadsheet, FileText, Download, Eye, Wrench, CheckCircle2, X, Zap, Loader2, MapPin } from 'lucide-react';
import { useLanguage } from '@/app/lib/LanguageContext';
import {
  translateSafetyText,
  translateLocation,
  translateCategory,
  translateStatus,
  translateCrew,
} from '@/app/lib/hindiTranslator';
import { MAINTENANCE_CREWS } from '@/app/officer/tasks/page';

const REPORT_EXPORT_COLUMNS: ExportColumn<OfficerReport>[] = [
  { header: 'Report ID', accessor: r => r._id },
  { header: 'Title', accessor: r => r.title },
  { header: 'Category', accessor: r => r.category },
  { header: 'Severity', accessor: r => r.severity.toUpperCase() },
  { header: 'Status', accessor: r => r.status.replace(/_/g, ' ').toUpperCase() },
  { header: 'Risk Score', accessor: r => r.riskScore },
  { header: 'Facility Zone', accessor: r => r.zone },
  { header: 'Location Details', accessor: r => r.location },
  { header: 'Submitted By', accessor: r => r.submittedBy },
  { header: 'Department', accessor: r => r.department },
  { header: 'Date Submitted', accessor: r => new Date(r.createdAt).toLocaleString() },
  { header: 'Description', accessor: r => r.description },
  { header: 'Immediate Actions', accessor: r => r.immediateActions?.join('; ') || 'None' },
  { header: 'Recommendations', accessor: r => r.recommendations?.join('; ') || 'None' },
];

function inferSuggestedCrew(title: string, category?: string): string {
  const combined = `${title} ${category || ''}`.toLowerCase();
  if (/scaffold|fall|height|ladder|roof|barrier|guardrail/i.test(combined) || category === 'fall') {
    return "Scaffolding & Structural Rigging Team S-3";
  }
  if (/wire|electric|voltage|conduit|breaker|loto|cable|shock|energiz|tube|light|bulb/i.test(combined) || category === 'electrical') {
    return "Electrical & High-Voltage Crew E-2";
  }
  if (/steam|boiler|pressure|flange|pipe|leak|valve|hydraulic|water|drain/i.test(combined)) {
    return "Hydraulics & Pressure Valve Crew H-1";
  }
  if (/bearing|vibration|pump|motor|gear|shaft|conveyor|rotating/i.test(combined) || category === 'machinery') {
    return "Rotating Machinery Team M-4";
  }
  if (/chemical|acid|toxic|spill|fume|gas|corrosive/i.test(combined) || category === 'chemical') {
    return "Hazardous Material Containment Team C-1";
  }
  return "General Plant Reliability Team G-5";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskPillStyle(score: number): CSSProperties {
  const bg = score >= 80 ? '#fef2f2' : score >= 60 ? '#fff7ed' : score >= 40 ? '#fffbeb' : '#f0fdf4';
  const color = score >= 80 ? '#dc2626' : score >= 60 ? '#ea580c' : score >= 40 ? '#d97706' : '#16a34a';
  const border = score >= 80 ? '#fca5a5' : score >= 60 ? '#fdba74' : score >= 40 ? '#fcd34d' : '#86efac';
  return { background: bg, color, border: `1px solid ${border}`, borderRadius: 999, padding: '3px 10px', fontSize: 13, fontWeight: 700, display: 'inline-block' };
}

function statusLabel(s: ReportStatus, lang: string = 'en') {
  if (lang === 'hi') return translateStatus(s, 'hi');
  const map: Record<ReportStatus, string> = {
    pending: 'Pending', under_review: 'Under Review', action_assigned: 'Action Assigned',
    analysis_complete: 'Analysis Complete', resolved: 'Resolved',
  };
  return map[s] || s;
}

function statusBadgeStyle(status: ReportStatus): CSSProperties {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    pending: { bg: '#fef9c3', color: '#854d0e', border: '#fde047' }, 
    under_review: { bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' },
    action_assigned: { bg: '#fff7ed', color: '#9a3412', border: '#fdba74' }, 
    analysis_complete: { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' },
    resolved: { bg: '#dcfce7', color: '#14532d', border: '#86efac' },
  };
  const s = map[status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
  return { background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700, display: 'inline-block', whiteSpace: 'nowrap' as const };
}

function categoryLabel(c: string, lang: string = 'en') {
  if (lang === 'hi') return translateCategory(c, 'hi');
  const map: Record<string, string> = {
    electrical: 'Electrical', fall: 'Fall Risk', chemical: 'Chemical',
    fire: 'Fire', machinery: 'Machinery', structural: 'Structural', ppe: 'PPE',
  };
  return map[c] || c;
}

function catColor(c: string): CSSProperties {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    electrical: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' }, 
    fall: { bg: 'var(--primary-light)', color: 'var(--primary)', border: 'var(--border)' },
    chemical: { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' }, 
    fire: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
    machinery: { bg: '#e0e7ff', color: '#3730a3', border: '#a5b4fc' }, 
    structural: { bg: '#f5f5f4', color: '#44403c', border: '#d6d3d1' },
    ppe: { bg: '#dcfce7', color: '#14532d', border: '#86efac' },
  };
  const s = map[c] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
  return { background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600, display: 'inline-block' };
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

const PAGE_SIZE = 8;

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[60, 200, 130, 90, 70, 110, 110, 80, 60].map((w, i) => (
        <td key={i} style={{ padding: '12px 14px' }}>
          <div className="skeleton" style={{ height: 14, width: w, borderRadius: 4 }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function OfficerReportsPage() {
  const { lang, t } = useLanguage();
  const [reportsList, setReportsList] = useState<OfficerReport[]>(MOCK_REPORTS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest_risk' | 'lowest_risk'>('newest');
  const [page, setPage] = useState(1);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Dispatch Modal State
  const [selectedReportForDispatch, setSelectedReportForDispatch] = useState<OfficerReport | null>(null);
  const [dispatchCrew, setDispatchCrew] = useState<string>(MAINTENANCE_CREWS[0]);
  const [dispatchInstructions, setDispatchInstructions] = useState<string>('');
  const [dispatchSeverity, setDispatchSeverity] = useState<string>('high');
  const [dispatchLoto, setDispatchLoto] = useState<boolean>(false);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [assignedReports, setAssignedReports] = useState<Record<string, { orderNumber: string; crew: string }>>({});

  useEffect(() => {
    let isMounted = true;
    async function loadReports() {
      try {
        const res = await getAllReportsApi();
        if (res.data && res.data.length > 0 && isMounted) {
          const mapped: OfficerReport[] = res.data.map((r: any) => {
            const fullTitle = (r.description && r.description.length > (r.title || "").length) ? r.description : (r.title || r.description || "Hazard Report");
            return {
              _id: r._id,
              title: fullTitle,
              category: (r.category || "machinery") as any,
              severity: (r.severity?.toLowerCase() || "high") as any,
              status: (r.status || "analysis_complete") as any,
              riskScore: r.riskAssessment?.riskScore ?? (r.risk_score || 75),
              zone: "Sector 4",
              location: r.location || "Sector 4 North",
              submittedBy: r.submittedBy?.name || "Site Worker",
              department: r.submittedBy?.department || "Plant Operations",
              createdAt: r.createdAt || new Date().toISOString(),
              description: r.description || "",
              immediateActions: r.recommendations?.slice(0, 2) || ["Perimeter isolation"],
              recommendations: r.recommendations || ["Supervisor review"],
              hasImage: Boolean(r.imageUrl),
              hasAudio: Boolean(r.audioUrl),
            };
          });

          const liveIds = new Set(mapped.map(m => m._id));
          const rest = MOCK_REPORTS.filter(m => !liveIds.has(m._id));
          setReportsList([...mapped, ...rest]);
        }
      } catch (err) {
        console.warn("Using fallback reports list:", err);
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
            if (t.title) map[t.title] = info;
          });
          setAssignedReports(prev => ({ ...map, ...prev }));
        }
      } catch (tErr) {
        console.warn("Could not preload tasks:", tErr);
      }
    }

    loadReports();
    loadTasks();
    const interval = setInterval(() => {
      loadReports();
      loadTasks();
    }, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const openDispatchModal = (report: OfficerReport) => {
    setSelectedReportForDispatch(report);
    setDispatchCrew(inferSuggestedCrew(report.title, report.category));
    const defaultInstruction = (report.recommendations && report.recommendations.length > 0)
      ? report.recommendations[0]
      : (report.immediateActions && report.immediateActions.length > 0)
      ? report.immediateActions[0]
      : `Perform corrective inspection and maintenance for reported hazard: ${report.title}`;
    setDispatchInstructions(defaultInstruction);
    setDispatchSeverity(report.severity || 'medium');
    setDispatchLoto(report.severity === 'critical' || report.category === 'electrical');
  };

  const handleConfirmDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReportForDispatch) return;
    setIsDispatching(true);
    try {
      const res = await createTaskApi({
        title: `Corrective Action: ${selectedReportForDispatch.title.slice(0, 50)}`,
        description: `${dispatchInstructions}\n\nInitiated from Safety Report [${selectedReportForDispatch._id}]. Location: ${selectedReportForDispatch.location}.`,
        equipmentId: "EQ-" + Math.floor(100 + Math.random() * 900),
        equipmentName: selectedReportForDispatch.title,
        location: selectedReportForDispatch.location,
        severity: dispatchSeverity,
        assignedCrew: dispatchCrew,
        lotoRequired: dispatchLoto,
        reportId: selectedReportForDispatch._id,
      });

      const orderNumber = res.data?.orderNumber || "WO-" + Math.floor(9040 + Math.random() * 50);

      // Mark assigned locally
      setAssignedReports(prev => ({
        ...prev,
        [selectedReportForDispatch._id]: { orderNumber, crew: dispatchCrew },
        [selectedReportForDispatch.title]: { orderNumber, crew: dispatchCrew },
      }));

      setToastMsg(
        lang === 'hi'
          ? `मेंटेनेंस कार्य आदेश सौंपा गया [${orderNumber}]: ${translateCrew(dispatchCrew, lang)}`
          : `Work Order [${orderNumber}] assigned to ${dispatchCrew}!`
      );
      setSelectedReportForDispatch(null);
      setTimeout(() => setToastMsg(null), 5000);
    } catch (err) {
      console.warn("Failed to dispatch task:", err);
      setToastMsg(lang === 'hi' ? "कार्य आदेश कतार में दर्ज किया गया।" : "Maintenance task logged to dispatch queue.");
      setTimeout(() => setToastMsg(null), 3500);
    } finally {
      setIsDispatching(false);
    }
  };

  const filtered = reportsList.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.title.toLowerCase().includes(q) || r.location.toLowerCase().includes(q) || r.zone.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchSeverity = severityFilter === 'all' || r.severity === severityFilter;
    return matchSearch && matchStatus && matchSeverity;
  }).sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sortBy === 'highest_risk') return b.riskScore - a.riskScore;
    return a.riskScore - b.riskScore;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExportCSV = (scope: 'filtered' | 'all') => {
    const data = scope === 'filtered' ? filtered : reportsList;
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `ForeSite_Reports_${scope === 'filtered' ? 'Filtered_' : 'All_'}${dateStr}`;
    exportToCSV(filename, REPORT_EXPORT_COLUMNS, data);
    setShowExportMenu(false);
    setToastMsg(`Downloaded ${data.length} reports as CSV (${filename}.csv)`);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleExportExcel = (scope: 'filtered' | 'all') => {
    const data = scope === 'filtered' ? filtered : reportsList;
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `ForeSite_Reports_${scope === 'filtered' ? 'Filtered_' : 'All_'}${dateStr}`;
    exportToExcel(filename, 'Safety Reports', REPORT_EXPORT_COLUMNS, data);
    setShowExportMenu(false);
    setToastMsg(`Downloaded ${data.length} reports as Excel (${filename}.xls)`);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const inputStyle: CSSProperties = {
    padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14,
    background: 'var(--surface)', color: 'var(--text)', outline: 'none', transition: 'border-color 0.15s ease',
  };

  const selectStyle: CSSProperties = { ...inputStyle, cursor: 'pointer' };

  const thStyle: CSSProperties = {
    padding: '14px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase' as const, letterSpacing: '0.05em', textAlign: 'left',
    background: 'transparent', whiteSpace: 'nowrap',
  };

  const tdStyle: CSSProperties = { padding: '14px 16px', fontSize: 14, color: 'var(--text)', verticalAlign: 'middle' };

  return (
    <div>
      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 1000,
          background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 12,
          padding: '12px 20px', boxShadow: '0 8px 24px rgba(79, 70, 229, 0.18)',
          fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Download size={18} style={{ color: 'var(--primary)' }} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text)' }}>All Reports</h2>
          <span style={{
            background: 'var(--primary)', color: '#fff', borderRadius: 999,
            fontSize: 13, fontWeight: 700, padding: '2px 10px',
          }}>
            {reportsList.length}
          </span>
        </div>

        {/* Export Dropdown Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowExportMenu(prev => !prev)}
            style={{
              padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 10,
              background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
          >
            <Download size={15} />
            <span>Export Reports</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>▼</span>
          </button>

          {showExportMenu && (
            <>
              {/* Backdrop */}
              <div
                onClick={() => setShowExportMenu(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 400 }}
              />
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 500,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
                boxShadow: '0 10px 30px rgba(0,0,0,0.14)', padding: 6, minWidth: 230,
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <div style={{ padding: '6px 10px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Current View ({filtered.length})
                </div>
                <button
                  onClick={() => handleExportCSV('filtered')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
                    border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13,
                    fontWeight: 500, cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <FileText size={16} color="#0284c7" />
                  <div>
                    <div style={{ fontWeight: 600 }}>Download CSV</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Universal tabular (.csv)</div>
                  </div>
                </button>
                <button
                  onClick={() => handleExportExcel('filtered')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
                    border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13,
                    fontWeight: 500, cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <FileSpreadsheet size={16} color="#16a34a" />
                  <div>
                    <div style={{ fontWeight: 600 }}>Download Excel</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Styled workbook (.xls)</div>
                  </div>
                </button>

                {filtered.length !== MOCK_REPORTS.length && (
                  <>
                    <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                    <div style={{ padding: '6px 10px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      All Reports ({MOCK_REPORTS.length})
                    </div>
                    <button
                      onClick={() => handleExportCSV('all')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
                        border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13,
                        fontWeight: 500, cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <FileText size={16} color="#0284c7" />
                      <div>
                        <div style={{ fontWeight: 600 }}>All Reports (CSV)</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Complete archive (.csv)</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExportExcel('all')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
                        border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13,
                        fontWeight: 500, cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <FileSpreadsheet size={16} color="#16a34a" />
                      <div>
                        <div style={{ fontWeight: 600 }}>All Reports (Excel)</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Complete archive (.xls)</div>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
        padding: '16px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input
            type="text"
            placeholder={t.searchReportsPlaceholder}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ ...inputStyle, paddingLeft: 36, width: '100%', height: 38 }}
          />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{...selectStyle, height: 38}}>
          <option value="all">{lang === 'hi' ? 'सभी स्थितियां' : 'All Statuses'}</option>
          <option value="pending">{lang === 'hi' ? 'लंबित' : 'Pending'}</option>
          <option value="under_review">{lang === 'hi' ? 'जांच के अधीन' : 'Under Review'}</option>
          <option value="action_assigned">{lang === 'hi' ? 'सुधार कार्य जारी है' : 'Action Assigned'}</option>
          <option value="analysis_complete">{lang === 'hi' ? 'सत्यापित' : 'Analysis Complete'}</option>
          <option value="resolved">{lang === 'hi' ? 'हल किया गया' : 'Resolved'}</option>
        </select>
        <select value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); setPage(1); }} style={{...selectStyle, height: 38}}>
          <option value="all">{lang === 'hi' ? 'सभी गंभीरता' : 'All Severities'}</option>
          <option value="critical">{lang === 'hi' ? 'गंभीर' : 'Critical'}</option>
          <option value="high">{lang === 'hi' ? 'उच्च' : 'High'}</option>
          <option value="medium">{lang === 'hi' ? 'मध्यम' : 'Medium'}</option>
          <option value="low">{lang === 'hi' ? 'कम' : 'Low'}</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} style={{...selectStyle, height: 38}}>
          <option value="newest">{lang === 'hi' ? 'नवीनतम पहले' : 'Newest First'}</option>
          <option value="oldest">{lang === 'hi' ? 'पुराने पहले' : 'Oldest First'}</option>
          <option value="highest_risk">{lang === 'hi' ? 'उच्चतम जोखिम' : 'Highest Risk'}</option>
          <option value="lowest_risk">{lang === 'hi' ? 'न्यूनतम जोखिम' : 'Lowest Risk'}</option>
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ background: 'var(--surface-subtle)', borderBottom: '2px solid var(--border)' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>{t.tableColTitle}</th>
                <th style={thStyle}>{t.tableColLocation}</th>
                <th style={thStyle}>{t.tableColCategory}</th>
                <th style={thStyle}>{t.tableColRiskScore}</th>
                <th style={thStyle}>{t.tableColStatus}</th>
                <th style={thStyle}>{lang === 'hi' ? 'रिपोर्टकर्ता' : 'Submitted By'}</th>
                <th style={thStyle}>{t.tableColTime}</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>{t.tableColAction}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [0,1,2,3,4].map(i => <SkeletonRow key={i} />)
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '64px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'inline-block', marginBottom: 12, padding: 16, background: 'var(--surface-subtle)', borderRadius: '50%' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                      {lang === 'hi' ? 'कोई रिपोर्ट आपके फ़िल्टर से मेल नहीं खाती।' : 'No reports match your filters.'}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13 }}>
                      {lang === 'hi' ? 'कृपया ऊपर दिए गए फ़िल्टर विकल्प बदलें।' : 'Try adjusting the search or filter options above.'}
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((r, idx) => (
                  <tr key={r._id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
                  >
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 220 }}>
                      <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
                        {translateSafetyText(r.title, lang)}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: 13, color: 'var(--text)' }}>{translateLocation(r.location, lang)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{translateLocation(r.zone, lang)}</div>
                    </td>
                    <td style={tdStyle}><span style={catColor(r.category)}>{categoryLabel(r.category, lang)}</span></td>
                    <td style={tdStyle}><span style={riskPillStyle(r.riskScore)}>{r.riskScore}</span></td>
                    <td style={tdStyle}><span style={statusBadgeStyle(r.status)}>{statusLabel(r.status, lang)}</span></td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>{r.submittedBy}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{timeAgo(r.createdAt, lang)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        {assignedReports[r._id] || assignedReports[r.title] ? (
                          <Link href="/officer/tasks">
                            <button
                              style={{
                                padding: '5px 10px', borderRadius: 8,
                                border: '1px solid #86efac', background: '#f0fdf4', color: '#16a34a',
                                fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4,
                                cursor: 'pointer', transition: 'all 0.15s ease',
                              }}
                              title={`Assigned: ${assignedReports[r._id]?.orderNumber || assignedReports[r.title]?.orderNumber}`}
                            >
                              <CheckCircle2 size={12} strokeWidth={2.5} />
                              <span>{assignedReports[r._id]?.orderNumber || assignedReports[r.title]?.orderNumber}</span>
                            </button>
                          </Link>
                        ) : (
                          <button
                            onClick={() => openDispatchModal(r)}
                            style={{
                              padding: '5px 10px', borderRadius: 8,
                              border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
                              fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4,
                              cursor: 'pointer', transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLElement).style.background = '#0A192F';
                              (e.currentTarget as HTMLElement).style.color = '#fff';
                              (e.currentTarget as HTMLElement).style.borderColor = '#0A192F';
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
                              (e.currentTarget as HTMLElement).style.color = 'var(--text)';
                              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                            }}
                            title={lang === 'hi' ? 'मेंटेनेंस टीम को कार्य सौंपें' : 'Assign to Maintenance Crew'}
                          >
                            <Wrench size={11} />
                            <span>{lang === 'hi' ? 'कार्य सौंपें' : 'Assign'}</span>
                          </button>
                        )}
                        <Link href={`/officer/reports/${r._id}`}>
                          <button style={{
                            width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border)',
                            background: '#fff', fontSize: 14, transition: 'all 0.15s ease',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                            title={t.viewDetailsBtn}
                          >
                            <Eye size={14} color="var(--primary)" />
                          </button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div style={{
            padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} reports
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                style={{
                  padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 10,
                  background: page === 1 ? 'var(--surface-subtle)' : 'var(--surface)', color: page === 1 ? 'var(--text-muted)' : 'var(--text)',
                  fontSize: 13, transition: 'all 0.15s ease',
                }}
              >
                ← Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)} style={{
                  width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 10,
                  background: p === page ? 'var(--primary)' : 'var(--surface)', color: p === page ? '#fff' : 'var(--text)',
                  fontSize: 13, fontWeight: p === page ? 600 : 400, transition: 'all 0.15s ease',
                }}>
                  {p}
                </button>
              ))}
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                style={{
                  padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 10,
                  background: page === totalPages ? 'var(--surface-subtle)' : 'var(--surface)', color: page === totalPages ? 'var(--text-muted)' : 'var(--text)',
                  fontSize: 13, transition: 'all 0.15s ease',
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dispatch Maintenance Work Order Modal */}
      {selectedReportForDispatch && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 520,
            border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              background: '#0A192F', color: '#fff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wrench size={18} style={{ color: '#38BDF8' }} />
                <span style={{ fontWeight: 800, fontSize: 15 }}>
                  {lang === 'hi' ? 'मेंटेनेंस कार्य आदेश सौंपें' : 'Assign Maintenance Work Order'}
                </span>
              </div>
              <button
                onClick={() => setSelectedReportForDispatch(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmDispatch} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Report Summary */}
              <div style={{
                background: 'var(--surface-subtle)', borderRadius: 10, padding: '12px 14px',
                border: '1px solid var(--border)'
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {lang === 'hi' ? 'रिपोर्ट सारांश' : 'Incident Hazard Report'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                  {translateSafetyText(selectedReportForDispatch.title, lang)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={11} /> {translateLocation(selectedReportForDispatch.location, lang)}
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
                  onClick={() => setSelectedReportForDispatch(null)}
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
