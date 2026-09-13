'use client';

import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import { MAINTENANCE_TASKS, MaintenanceTask, TaskStatus } from '@/app/lib/officerMockData';
import { exportToCSV, exportToExcel, ExportColumn } from '@/app/lib/exportUtils';
import { getTasksApi, updateTaskApi, createTaskApi } from '@/app/lib/api';
import {
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  Plus,
  FileSpreadsheet,
  FileText,
  Wrench,
  AlertTriangle,
  X,
  Lock,
  Zap,
  Bot,
  Printer,
  Download,
  ChevronDown,
} from 'lucide-react';
import {
  openPrintableAIMaintenanceReport,
  downloadAIMaintenanceHtmlReport,
  downloadAIMaintenanceExcelReport,
  ReportTaskItem,
} from '@/app/lib/aiReportGenerator';
import { useLanguage } from '@/app/lib/LanguageContext';
import {
  translateSafetyText,
  translateLocation,
  translateCrew,
  translateStatus,
  translateSeverity,
} from '@/app/lib/hindiTranslator';

const TASK_EXPORT_COLUMNS: ExportColumn<MaintenanceTask>[] = [
  { header: 'Task ID', accessor: (t: MaintenanceTask) => t._id },
  { header: 'Task Title', accessor: (t: MaintenanceTask) => t.title },
  { header: 'Report Reference', accessor: (t: MaintenanceTask) => t.reportId },
  { header: 'Priority', accessor: (t: MaintenanceTask) => t.priority.toUpperCase() },
  { header: 'Status', accessor: (t: MaintenanceTask) => t.status.replace(/_/g, ' ').toUpperCase() },
  { header: 'Assigned Worker', accessor: (t: MaintenanceTask) => t.assignedTo || 'Unassigned' },
  { header: 'Due Date', accessor: (t: MaintenanceTask) => t.dueDate },
  { header: 'Overdue', accessor: (t: MaintenanceTask) => (new Date(t.dueDate) < new Date() && t.status !== 'done' ? 'YES' : 'NO') },
];

export const MAINTENANCE_CREWS = [
  "Rotating Machinery Team M-4",
  "Electrical & High-Voltage Crew E-2",
  "Hydraulics & Pressure Valve Crew H-1",
  "Scaffolding & Structural Rigging Team S-3",
  "Hazardous Material Containment Team C-1",
  "Pump Specialist Crew M-4",
  "General Plant Reliability Team G-5",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function taskStatusBadge(s: TaskStatus): CSSProperties {
  if (s === 'done') return { background: 'var(--success-light)', color: 'var(--success)', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 };
  if (s === 'clearance_submitted') return { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 };
  if (s === 'in_progress') return { background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 };
  return { background: 'var(--warning-light)', color: 'var(--warning)', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 };
}

function taskStatusLabel(s: TaskStatus, lang: string = 'en') {
  if (s === 'done') return lang === 'hi' ? 'सत्यापित व हल' : 'Done & Cleared';
  if (s === 'clearance_submitted') return lang === 'hi' ? 'निकासी समीक्षा प्रस्तुत' : 'Clearance Submitted';
  if (s === 'in_progress') return lang === 'hi' ? 'प्रगति पर है' : 'In Progress';
  return lang === 'hi' ? 'लंबित' : 'Pending';
}

function taskStatusIcon(s: TaskStatus) {
  if (s === 'done') return <CheckCircle2 size={12} />;
  if (s === 'clearance_submitted') return <ShieldCheck size={12} />;
  if (s === 'in_progress') return <RefreshCw size={11} />;
  return <Clock size={11} />;
}

function priorityBadge(p: string): CSSProperties {
  if (p === 'critical') return { background: '#fef2f2', color: '#dc2626', borderRadius: 999, padding: '2px 10px', fontSize: 10, fontWeight: 700, display: 'inline-block' };
  if (p === 'high') return { background: '#fff7ed', color: '#ea580c', borderRadius: 999, padding: '2px 10px', fontSize: 10, fontWeight: 700, display: 'inline-block' };
  return { background: '#fffbeb', color: '#d97706', borderRadius: 999, padding: '2px 10px', fontSize: 10, fontWeight: 700, display: 'inline-block' };
}

function isOverdue(dueDate: string) {
  return new Date(dueDate) < new Date();
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'pending' | 'in_progress' | 'clearance_submitted' | 'done';

export default function TasksPage() {
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [tasks, setTasks] = useState<MaintenanceTask[]>([...MAINTENANCE_TASKS]);
  const [toast, setToast] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Modal State: Assign / Reassign
  const [assignModalTask, setAssignModalTask] = useState<MaintenanceTask | null>(null);
  const [selectedCrew, setSelectedCrew] = useState(MAINTENANCE_CREWS[0]);
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>('in_progress');
  const [selectedPriority, setSelectedPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('high');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  // AI Report Menu State
  const [showAiReportMenu, setShowAiReportMenu] = useState(false);

  const toReportTasks = (taskList: MaintenanceTask[]): ReportTaskItem[] => {
    return taskList.map((t, idx) => ({
      id: t._id,
      orderNumber: t.orderNumber || `TSK-${String(idx + 1).padStart(3, '0')}`,
      title: t.title,
      reportId: t.reportId,
      severity: t.priority,
      status: t.status,
      assignedCrew: t.assignedTo,
      dueDate: t.dueDate,
      clearanceNote: t.clearanceNote,
      lotoRequired: t.priority === 'critical' || t.priority === 'high',
      riskScore: t.priority === 'critical' ? 91 : t.priority === 'high' ? 74 : 42,
    }));
  };

  const loadTasks = async () => {
    try {
      const res = await getTasksApi();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const liveTasks: MaintenanceTask[] = res.data.map((t: any) => ({
          _id: t._id || t.id,
          orderNumber: t.orderNumber || t.taskNumber,
          reportId: t.reportId || 'rep-live',
          reportTitle: t.title,
          title: t.title,
          assignedTo: t.assignedCrew || t.assignedTo || 'Unassigned',
          dueDate: t.createdAt ? new Date(new Date(t.createdAt).getTime() + 86400000).toISOString().split('T')[0] : '2026-09-15',
          priority: (t.severity === 'critical' ? 'critical' : t.severity === 'high' ? 'high' : 'medium') as any,
          status: (t.status === 'completed' || t.status === 'officer_verified'
            ? 'done'
            : t.status === 'clearance_submitted'
            ? 'clearance_submitted'
            : t.status === 'in_progress'
            ? 'in_progress'
            : 'pending') as TaskStatus,
          clearanceNote: t.clearanceNote,
          updatedAt: t.updatedAt,
        }));
        // Merge live tasks at top with mock tasks
        const liveIds = new Set(liveTasks.map(lt => lt._id));
        const filteredMock = MAINTENANCE_TASKS.filter(mt => !liveIds.has(mt._id));
        setTasks([...liveTasks, ...filteredMock]);
      }
    } catch (err) {
      console.warn('Failed to fetch live tasks, using local store:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndClearTask = async (task: MaintenanceTask) => {
    const taskId = task._id;
    // Optimistic UI update: move directly to 'done'
    setTasks(prev => prev.map(t => t._id === taskId ? { ...t, status: 'done' } : t));
    try {
      await updateTaskApi(taskId, {
        status: 'officer_verified',
      });
      setToast(lang === 'hi' ? `कार्य ${task.orderNumber || task.title} सत्यापित व हल हो गया! लिंक की गई खतरा रिपोर्ट हल चिह्नित हुई।` : `Task ${task.orderNumber || task.title} verified & cleared! Linked hazard report marked resolved.`);
    } catch (err) {
      console.warn("Failed to verify task on server:", err);
      setToast(lang === 'hi' ? 'कार्य हल चिह्नित किया गया।' : `Task marked as cleared.`);
    } finally {
      setTimeout(() => setToast(''), 3500);
      loadTasks();
    }
  };

  const handleExportCSV = (scope: 'filtered' | 'all') => {
    const data = scope === 'filtered' ? filtered : tasks;
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `ForeSite_Tasks_${scope === 'filtered' && filter !== 'all' ? filter + '_' : ''}${dateStr}`;
    exportToCSV(filename, TASK_EXPORT_COLUMNS, data);
    setShowExportMenu(false);
    setToast(lang === 'hi' ? `${data.length} कार्य CSV के रूप में डाउनलोड हुए (${filename}.csv)` : `Downloaded ${data.length} tasks as CSV (${filename}.csv)`);
    setTimeout(() => setToast(''), 3500);
  };

  const handleExportExcel = (scope: 'filtered' | 'all') => {
    const data = scope === 'filtered' ? filtered : tasks;
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `ForeSite_Tasks_${scope === 'filtered' && filter !== 'all' ? filter + '_' : ''}${dateStr}`;
    exportToExcel(filename, 'Maintenance Tasks', TASK_EXPORT_COLUMNS, data);
    setShowExportMenu(false);
    setToast(lang === 'hi' ? `${data.length} कार्य Excel के रूप में डाउनलोड हुए (${filename}.xls)` : `Downloaded ${data.length} tasks as Excel (${filename}.xls)`);
    setTimeout(() => setToast(''), 3500);
  };

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 4000);
    return () => clearInterval(interval);
  }, []);

  const filtered = tasks.filter(t => filter === 'all' || t.status === filter);

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    clearance_submitted: tasks.filter(t => t.status === 'clearance_submitted').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  const openAssignModal = (task: MaintenanceTask) => {
    setAssignModalTask(task);
    setSelectedCrew(
      task.assignedTo && task.assignedTo !== 'Unassigned' && MAINTENANCE_CREWS.includes(task.assignedTo)
        ? task.assignedTo
        : MAINTENANCE_CREWS[0]
    );
    setSelectedStatus(task.status === 'done' ? 'in_progress' : (task.status || 'in_progress'));
    setSelectedPriority(task.priority || 'high');
    setSpecialInstructions('');
  };

  const handleConfirmAssignment = async () => {
    if (!assignModalTask) return;
    setIsSubmittingAssign(true);
    const taskId = assignModalTask._id;
    const crew = selectedCrew;
    const nextStatus = selectedStatus;
    const priority = selectedPriority;

    // Optimistic UI update
    setTasks(prev => prev.map(t => t._id === taskId ? {
      ...t,
      assignedTo: crew,
      status: nextStatus,
      priority,
    } : t));

    try {
      await updateTaskApi(taskId, {
        assignedCrew: crew,
        status: nextStatus === 'done' ? 'officer_verified' : (nextStatus === 'clearance_submitted' ? 'clearance_submitted' : nextStatus === 'in_progress' ? 'in_progress' : 'dispatched'),
        severity: priority,
        clearanceNote: specialInstructions ? `[Officer Dispatch Note]: ${specialInstructions}` : undefined,
      });
      setToast(lang === 'hi' ? `कार्य सफलतापूर्वक ${translateCrew(crew, lang)} को सौंपा गया! मेंटेनेंस पोर्टल और DB में सिंक हुआ।` : `Task successfully assigned to ${crew}! Synced to Maintenance Portal & DB.`);
    } catch (err) {
      console.warn("API update failed, local state preserved:", err);
      setToast(lang === 'hi' ? `कार्य असाइनमेंट ${translateCrew(crew, lang)} में अपडेट हुआ।` : `Task assignment updated to ${crew}.`);
    } finally {
      setIsSubmittingAssign(false);
      setAssignModalTask(null);
      setTimeout(() => setToast(''), 3500);
      loadTasks();
    }
  };

  const handlePrintAiReport = () => {
    const reportTasks = toReportTasks(filtered.length > 0 && filter !== 'all' ? filtered : tasks);
    openPrintableAIMaintenanceReport(reportTasks, {
      facilityName: 'ForeSite Industrial Facility - Sector 4 & Plant Main',
      officerName: 'Safety Command Lead',
    });
    setShowAiReportMenu(false);
  };

  const handleDownloadAiReportHtml = () => {
    const reportTasks = toReportTasks(filtered.length > 0 && filter !== 'all' ? filtered : tasks);
    downloadAIMaintenanceHtmlReport(reportTasks, {
      facilityName: 'ForeSite Industrial Facility - Sector 4 & Plant Main',
      officerName: 'Safety Command Lead',
    });
    setShowAiReportMenu(false);
    setToast(lang === 'hi' ? 'ForeSite MiniLM AI मेंटेनेंस रिपोर्ट डाउनलोड हुई (.html)' : 'ForeSite MiniLM AI Maintenance Report downloaded (.html)');
    setTimeout(() => setToast(''), 3500);
  };

  const handleDownloadAiReportExcel = () => {
    const reportTasks = toReportTasks(filtered.length > 0 && filter !== 'all' ? filtered : tasks);
    downloadAIMaintenanceExcelReport(reportTasks, 'ForeSite_AI_Maintenance_Audit');
    setShowAiReportMenu(false);
    setToast(lang === 'hi' ? 'ForeSite AI मेंटेनेंस ऑडिट स्प्रेडशीट डाउनलोड हुई (.xls)' : 'ForeSite AI Maintenance Audit spreadsheet downloaded (.xls)');
    setTimeout(() => setToast(''), 3500);
  };

  const card: CSSProperties = {
    background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '18px 20px', marginBottom: 12,
  };

  const FILTERS: { key: FilterTab; label: string; icon?: React.ReactNode }[] = [
    { key: 'all', label: lang === 'hi' ? 'सभी कार्य' : 'All Tasks' },
    { key: 'pending', label: lang === 'hi' ? 'असाइनमेंट लंबित' : 'Pending Assignment', icon: <Clock size={13} /> },
    { key: 'in_progress', label: lang === 'hi' ? 'प्रगति पर' : 'In Progress', icon: <RefreshCw size={13} /> },
    { key: 'clearance_submitted', label: lang === 'hi' ? `निकासी समीक्षा (${stats.clearance_submitted})` : `Clearance Review (${stats.clearance_submitted})`, icon: <ShieldCheck size={13} /> },
    { key: 'done', label: lang === 'hi' ? 'पूर्ण व हल' : 'Completed & Cleared', icon: <CheckCircle2 size={13} /> },
  ];

  if (loading) {
    return (
      <div>
        <div className="skeleton" style={{ height: 80, borderRadius: 16, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 40, borderRadius: 12, marginBottom: 16 }} />
        {[0,1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 16, marginBottom: 12 }} />)}
      </div>
    );
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 2000,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '12px 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8,
          fontWeight: 600,
        }}>
          <CheckCircle2 size={16} color="var(--success)" /> {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text)' }}>
            {lang === 'hi' ? 'सौंपे गए मेंटेनेंस कार्य' : 'Assigned Maintenance Tasks'}
          </h2>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {lang === 'hi' ? 'मेंटेनेंस पोर्टल के साथ प्रत्यक्ष सिंक में औद्योगिक मरम्मत सौंपें, पुनः सौंपें और ट्रैक करें' : 'Assign, reassign, and track industrial repairs in direct sync with the Maintenance Portal'}
          </div>
        </div>

        {/* AI Maintenance Report Export Button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAiReportMenu(!showAiReportMenu)}
            style={{
              padding: '10px 18px', background: '#0A192F', color: '#fff', border: 'none',
              borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 6px rgba(10,25,47,0.2)',
              transition: 'transform 0.1s ease',
            }}
          >
            <Bot size={17} color="#38bdf8" />
            <span>{lang === 'hi' ? 'AI मेंटेनेंस रिपोर्ट डाउनलोड करें' : 'Download AI Maintenance Report'}</span>
            <ChevronDown size={14} style={{ transform: showAiReportMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
          </button>

          {showAiReportMenu && (
            <>
              <div
                onClick={() => setShowAiReportMenu(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 90 }}
              />
              <div
                style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 100,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '8px', minWidth: 260,
                  boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 4,
                }}
              >
                <div style={{ padding: '6px 10px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {lang === 'hi' ? `ForeSite MiniLM AI रिपोर्ट (${tasks.length} कार्य)` : `ForeSite MiniLM AI Report (${tasks.length} Tasks)`}
                </div>
                <button
                  onClick={handlePrintAiReport}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
                    border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13,
                    fontWeight: 600, cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <Printer size={17} color="var(--primary)" />
                  <div>
                    <div>{lang === 'hi' ? 'प्रिंट / PDF के रूप में सहेजें' : 'Print / Save as PDF'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{lang === 'hi' ? 'आधिकारिक OSHA ऑडिट प्रारूप' : 'Official OSHA Audit Layout'}</div>
                  </div>
                </button>
                <button
                  onClick={handleDownloadAiReportHtml}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
                    border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13,
                    fontWeight: 600, cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <Download size={17} color="#059669" />
                  <div>
                    <div>{lang === 'hi' ? 'HTML ऑडिट फ़ाइल डाउनलोड करें' : 'Download HTML Audit File'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{lang === 'hi' ? 'स्व-निहित रिपोर्ट पैकेज' : 'Self-contained report package'}</div>
                  </div>
                </button>
                <button
                  onClick={handleDownloadAiReportExcel}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
                    border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13,
                    fontWeight: 600, cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <FileSpreadsheet size={17} color="#2563eb" />
                  <div>
                    <div>{lang === 'hi' ? 'Excel (.xls) ऑडिट डाउनलोड करें' : 'Download Excel (.xls) Audit'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{lang === 'hi' ? 'MiniLM जोखिम स्कोर और LOTO के साथ' : 'With MiniLM Risk Scores & LOTO'}</div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: lang === 'hi' ? 'कुल कार्य' : 'Total Tasks', value: stats.total, color: 'var(--primary)' },
          { label: lang === 'hi' ? 'असाइनमेंट लंबित' : 'Pending Assignment', value: stats.pending, color: 'var(--warning)' },
          { label: lang === 'hi' ? 'प्रगति पर (सौंपे गए)' : 'In Progress (Assigned)', value: stats.in_progress, color: 'var(--primary)' },
          { label: lang === 'hi' ? 'निकासी समीक्षा' : 'Clearance Review', value: stats.clearance_submitted, color: '#7c3aed' },
          { label: lang === 'hi' ? 'पूर्ण व हल' : 'Completed Clearance', value: stats.done, color: 'var(--success)' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px 18px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls row: Filter tabs & Export */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        {/* Filter tabs */}
        <div style={{
          display: 'flex', gap: 0, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', width: 'fit-content',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          {FILTERS.map((f, i) => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: '9px 16px', border: 'none', fontSize: 12, fontWeight: 600,
              background: filter === f.key ? 'var(--primary)' : 'var(--surface)',
              color: filter === f.key ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
              borderRight: i < FILTERS.length - 1 ? '1px solid var(--border)' : 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}>
              {f.icon}
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        {/* Export Button & Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            style={{
              padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'var(--text)',
              transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>{lang === 'hi' ? 'कार्य निर्यात करें' : 'Export Tasks'}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showExportMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {showExportMenu && (
            <>
              <div
                onClick={() => setShowExportMenu(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 90 }}
              />
              <div
                style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 100,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '6px', minWidth: 230,
                  boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 2,
                }}
              >
                <div style={{ padding: '6px 10px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {filter === 'all' ? (lang === 'hi' ? 'सभी कार्य' : 'All Tasks') : `${filter.toUpperCase()} ${lang === 'hi' ? 'कार्य' : 'Tasks'}`} ({filtered.length})
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
                  <FileSpreadsheet size={18} color="var(--primary)" />
                  <div>
                    <div style={{ fontWeight: 600 }}>{lang === 'hi' ? 'CSV डाउनलोड करें' : 'Download CSV'}</div>
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
                  <FileText size={18} color="var(--success)" />
                  <div>
                    <div style={{ fontWeight: 600 }}>{lang === 'hi' ? 'Excel डाउनलोड करें' : 'Download Excel'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Styled workbook (.xls)</div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
          padding: '48px', textAlign: 'center', color: 'var(--text-muted)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <CheckCircle2 size={36} color="var(--success)" style={{ margin: '0 auto 8px', opacity: 0.8 }} />
          <div style={{ fontSize: 14, fontWeight: 500 }}>{lang === 'hi' ? 'इस श्रेणी में कोई कार्य नहीं है' : 'No tasks in this category'}</div>
        </div>
      ) : (
        filtered.map(task => {
          const isAssigned = task.assignedTo && task.assignedTo !== 'Unassigned';
          return (
            <div key={task._id} style={card}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* Status + priority */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, minWidth: 110 }}>
                  <span style={taskStatusBadge(task.status)}>{taskStatusLabel(task.status, lang)}</span>
                  <span style={priorityBadge(task.priority)}>{translateSeverity(task.priority, lang).toUpperCase()}</span>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {task.orderNumber && (
                      <span style={{
                        fontSize: 11, fontWeight: 800, color: 'var(--primary)',
                        background: 'var(--surface-subtle)', padding: '2px 8px', borderRadius: 6,
                        border: '1px solid var(--border)', fontFamily: 'monospace',
                      }}>
                        {task.orderNumber}
                      </span>
                    )}
                    <span>{translateSafetyText(task.title, lang)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                    {lang === 'hi' ? 'संदर्भ रिपोर्ट:' : 'Report Reference:'}{' '}
                    <Link href={`/officer/reports/${task.reportId}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      {translateSafetyText(task.reportTitle || task.reportId, lang)}
                    </Link>
                  </div>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Assigned Crew Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lang === 'hi' ? 'सौंपा गया:' : 'Assigned to:'}</span>
                      {isAssigned ? (
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: '#0A192F',
                          background: '#E2E8F0', padding: '2px 10px', borderRadius: 6,
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                        }}>
                          <Wrench size={12} strokeWidth={2.2} /> {translateCrew(task.assignedTo || undefined, lang)}
                        </span>
                      ) : (
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: '#dc2626',
                          background: '#fef2f2', padding: '2px 8px', borderRadius: 6,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          <AlertTriangle size={11} strokeWidth={2.2} /> {lang === 'hi' ? 'अनअसाइन' : 'Unassigned'}
                        </span>
                      )}
                    </div>
                    {/* Due date */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lang === 'hi' ? 'नियत तारीख:' : 'Due:'}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 600,
                        color: isOverdue(task.dueDate) && task.status !== 'done' ? '#dc2626' : 'var(--text)',
                      }}>
                        {task.dueDate}
                        {isOverdue(task.dueDate) && task.status !== 'done' && (
                          <span style={{ marginLeft: 4, fontSize: 10, background: '#fef2f2', color: '#dc2626', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>
                            {lang === 'hi' ? 'अतिदेय' : 'OVERDUE'}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Maintenance Clearance Note Callout */}
                  {task.clearanceNote && (
                    <div style={{
                      marginTop: 10, padding: '8px 12px', background: '#faf5ff',
                      border: '1px solid #e9d5ff', borderRadius: 8, fontSize: 12, color: '#6b21a8',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <FileText size={15} style={{ flexShrink: 0 }} />
                      <div>
                        <strong>{lang === 'hi' ? 'मेंटेनेंस निकासी नोट:' : 'Maintenance Clearance Note:'}</strong> {translateSafetyText(task.clearanceNote, lang)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  {task.status === 'clearance_submitted' && (
                    <button
                      onClick={() => handleVerifyAndClearTask(task)}
                      style={{
                        padding: '9px 18px',
                        border: 'none',
                        borderRadius: 10,
                        background: 'var(--success)',
                        color: '#fff',
                        fontSize: 12, fontWeight: 800,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
                        transition: 'transform 0.1s ease',
                      }}
                    >
                      <CheckCircle2 size={15} strokeWidth={2.4} />
                      <span>{lang === 'hi' ? 'सत्यापित व हल करें' : 'Verify & Clear Task'}</span>
                    </button>
                  )}

                  {task.status === 'in_progress' && (
                    <button
                      onClick={() => handleVerifyAndClearTask(task)}
                      title={lang === 'hi' ? 'इस कार्य को सीधे प्रमाणित और हल करें' : 'Directly certify and clear this task'}
                      style={{
                        padding: '6px 14px',
                        border: '1px solid #10b981',
                        borderRadius: 8,
                        background: '#ecfdf5',
                        color: '#065f46',
                        fontSize: 11, fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <Zap size={13} strokeWidth={2.4} />
                      <span>{lang === 'hi' ? 'मंजूरी दें व हल करें' : 'Sign Off & Clear'}</span>
                    </button>
                  )}

                  {task.status !== 'done' && (
                    <button
                      onClick={() => openAssignModal(task)}
                      style={{
                        padding: '7px 14px',
                        border: isAssigned ? '1.5px solid #0A192F' : '1.5px solid var(--primary)',
                        borderRadius: 8,
                        background: isAssigned ? '#0A192F' : 'var(--primary)',
                        color: '#fff',
                        fontSize: 12, fontWeight: 700,
                        transition: 'all 0.15s ease', whiteSpace: 'nowrap' as const,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      }}
                    >
                      {isAssigned ? <RefreshCw size={13} strokeWidth={2.2} /> : <Wrench size={13} strokeWidth={2.2} />}
                      <span>{isAssigned ? (lang === 'hi' ? 'टीम पुनः सौंपें' : 'Reassign Team') : (lang === 'hi' ? 'टीम सौंपें' : 'Assign Team')}</span>
                    </button>
                  )}

                  {task.status === 'done' && (
                    <div style={{
                      padding: '4px 10px', borderRadius: 6, background: 'var(--success-light)',
                      color: 'var(--success)', fontSize: 11, fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <CheckCircle2 size={13} strokeWidth={2.2} /> {lang === 'hi' ? 'हल व बंद' : 'Cleared & Closed'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* ─── MODAL 1: Assign / Reassign Task Modal ─── */}
      {assignModalTask && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1500,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, backdropFilter: 'blur(2px)',
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)', width: '100%', maxWidth: 520,
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--surface-subtle)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wrench size={18} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                  {assignModalTask.assignedTo && assignModalTask.assignedTo !== 'Unassigned'
                    ? (lang === 'hi' ? 'मेंटेनेंस टीम पुनः सौंपें' : 'Reassign Maintenance Team')
                    : (lang === 'hi' ? 'मेंटेनेंस टीम को कार्य सौंपें' : 'Assign Task to Maintenance Team')}
                </span>
              </div>
              <button
                onClick={() => setAssignModalTask(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Task Summary Banner */}
              <div style={{
                background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10,
                padding: '12px 14px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {lang === 'hi' ? 'कार्य शीर्षक' : 'Task Title'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                  {translateSafetyText(assignModalTask.title, lang)}
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                  {lang === 'hi' ? 'वर्तमान स्थिति:' : 'Current Status:'} <strong style={{ color: '#0F172A' }}>{taskStatusLabel(assignModalTask.status, lang)}</strong> ·{' '}
                  {lang === 'hi' ? 'वर्तमान टीम:' : 'Current Assignee:'} <strong style={{ color: '#0F172A' }}>{translateCrew(assignModalTask.assignedTo || 'Unassigned', lang)}</strong>
                </div>
              </div>

              {/* Maintenance Crew Dropdown */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  {lang === 'hi' ? 'मेंटेनेंस टीम / क्रू चुनें: *' : 'Select Maintenance Team / Crew: *'}
                </label>
                <select
                  value={selectedCrew}
                  onChange={e => setSelectedCrew(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 600,
                  }}
                >
                  {MAINTENANCE_CREWS.map(crew => (
                    <option key={crew} value={crew}>{translateCrew(crew, lang)}</option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {lang === 'hi' ? 'इस क्रू को उनके पोर्टल में लाइव कार्य असाइनमेंट और डिजिटल LOTO प्राधिकरण प्राप्त होगा।' : 'This crew will receive live task assignment and digital LOTO authorization in their portal.'}
                </div>
              </div>

              {/* Status and Priority Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                    {lang === 'hi' ? 'कार्यप्रवाह स्थिति:' : 'Workflow Status:'}
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={e => setSelectedStatus(e.target.value as TaskStatus)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    <option value="in_progress">{lang === 'hi' ? 'प्रगति पर है (सक्रिय)' : 'In Progress (Active Dispatch)'}</option>
                    <option value="pending">{lang === 'hi' ? 'स्वीकृति लंबित' : 'Pending Crew Acknowledgment'}</option>
                    <option value="clearance_submitted">{lang === 'hi' ? 'निकासी समीक्षा प्रस्तुत (अधिकारी समीक्षा)' : 'Clearance Submitted (Awaiting Officer)'}</option>
                    <option value="done">{lang === 'hi' ? 'पूर्ण व हल' : 'Completed & Cleared'}</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                    {lang === 'hi' ? 'प्राथमिकता:' : 'Priority:'}
                  </label>
                  <select
                    value={selectedPriority}
                    onChange={e => setSelectedPriority(e.target.value as any)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    <option value="critical">{lang === 'hi' ? 'अति गंभीर (तत्काल)' : 'CRITICAL (Immediate)'}</option>
                    <option value="high">{lang === 'hi' ? 'उच्च (अगली शिफ्ट)' : 'HIGH (Next shift)'}</option>
                    <option value="medium">{lang === 'hi' ? 'मध्यम (नियमित)' : 'MEDIUM (Routine)'}</option>
                  </select>
                </div>
              </div>

              {/* Special Instructions / Notes */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  {lang === 'hi' ? 'प्रेषण नोट और सुरक्षा सावधानियां (वैकल्पिक):' : 'Dispatch Notes & Safety Precautions (Optional):'}
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={e => setSpecialInstructions(e.target.value)}
                  placeholder={lang === 'hi' ? 'उदा. केसिंग हटाने से पहले मल्टी-मीटर से शून्य-ऊर्जा स्थिति सत्यापित करें। LOTO तालाबंदी आवश्यक है।' : 'e.g. Verify zero-energy state with multi-meter before removing casing. LOTO isolation required.'}
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 20px', borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'flex-end', gap: 10,
              background: 'var(--surface-subtle)',
            }}>
              <button
                onClick={() => setAssignModalTask(null)}
                style={{
                  padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmAssignment}
                disabled={isSubmittingAssign}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: 'none',
                  background: '#0A192F', color: '#fff', fontSize: 12, fontWeight: 700,
                  cursor: isSubmittingAssign ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span>{isSubmittingAssign ? (lang === 'hi' ? 'भेजा जा रहा है...' : 'Dispatching...') : (lang === 'hi' ? 'असाइनमेंट पुष्टि करें और भेजें' : 'Confirm Assignment & Dispatch')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
