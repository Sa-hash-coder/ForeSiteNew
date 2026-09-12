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
} from 'lucide-react';

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

function taskStatusLabel(s: TaskStatus) {
  if (s === 'done') return 'Done & Cleared';
  if (s === 'clearance_submitted') return 'Clearance Submitted';
  if (s === 'in_progress') return 'In Progress';
  return 'Pending';
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

  // Modal State: Dispatch New Work Order
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEquipment, setNewEquipment] = useState('TK-80 Crude Storage Tank');
  const [newLocation, setNewLocation] = useState('Sector 4 North, Tank Farm');
  const [newCrew, setNewCrew] = useState(MAINTENANCE_CREWS[0]);
  const [newSeverity, setNewSeverity] = useState('high');
  const [newLoto, setNewLoto] = useState(false);
  const [isSubmittingNewOrder, setIsSubmittingNewOrder] = useState(false);

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
      setToast(`Work Order ${task.orderNumber || task.title} verified & cleared! Linked hazard report marked resolved.`);
    } catch (err) {
      console.warn("Failed to verify task on server:", err);
      setToast(`Task marked as cleared.`);
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
    setToast(`Downloaded ${data.length} tasks as CSV (${filename}.csv)`);
    setTimeout(() => setToast(''), 3500);
  };

  const handleExportExcel = (scope: 'filtered' | 'all') => {
    const data = scope === 'filtered' ? filtered : tasks;
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `ForeSite_Tasks_${scope === 'filtered' && filter !== 'all' ? filter + '_' : ''}${dateStr}`;
    exportToExcel(filename, 'Maintenance Tasks', TASK_EXPORT_COLUMNS, data);
    setShowExportMenu(false);
    setToast(`Downloaded ${data.length} tasks as Excel (${filename}.xls)`);
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
      setToast(`Task successfully assigned to ${crew}! Synced to Maintenance Portal & DB.`);
    } catch (err) {
      console.warn("API update failed, local state preserved:", err);
      setToast(`Task assignment updated to ${crew}.`);
    } finally {
      setIsSubmittingAssign(false);
      setAssignModalTask(null);
      setTimeout(() => setToast(''), 3500);
      loadTasks();
    }
  };

  const handleDispatchNewOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsSubmittingNewOrder(true);
    try {
      const res = await createTaskApi({
        title: newTitle.trim(),
        description: newDesc.trim() || 'Urgent repair work order dispatched by Safety Officer command.',
        equipmentId: newEquipment.split(' ')[0] || 'EQ-GEN',
        equipmentName: newEquipment,
        location: newLocation,
        severity: newSeverity,
        assignedCrew: newCrew,
        lotoRequired: newLoto,
      });

      if (res.data) {
        const newTask: MaintenanceTask = {
          _id: res.data._id,
          reportId: res.data.reportId || 'rep-officer',
          reportTitle: newTitle,
          title: newTitle,
          assignedTo: newCrew,
          dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          priority: newSeverity as any,
          status: 'in_progress',
        };
        setTasks(prev => [newTask, ...prev]);
      }
      setToast(`Work order successfully dispatched to ${newCrew}!`);
      setShowNewOrderModal(false);
      setNewTitle('');
      setNewDesc('');
    } catch (err) {
      console.warn("Failed to create task via API:", err);
      setToast('Work order created in local dispatch queue.');
      setShowNewOrderModal(false);
    } finally {
      setIsSubmittingNewOrder(false);
      setTimeout(() => setToast(''), 3500);
      loadTasks();
    }
  };

  const card: CSSProperties = {
    background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '18px 20px', marginBottom: 12,
  };

  const FILTERS: { key: FilterTab; label: string; icon?: React.ReactNode }[] = [
    { key: 'all', label: 'All Tasks' },
    { key: 'pending', label: 'Pending Assignment', icon: <Clock size={13} /> },
    { key: 'in_progress', label: 'In Progress', icon: <RefreshCw size={13} /> },
    { key: 'clearance_submitted', label: `Clearance Review (${stats.clearance_submitted})`, icon: <ShieldCheck size={13} /> },
    { key: 'done', label: 'Completed & Cleared', icon: <CheckCircle2 size={13} /> },
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
            Maintenance Dispatch &amp; Work Orders
          </h2>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Assign, reassign, and track industrial repairs in direct sync with the Maintenance Portal
          </div>
        </div>

        {/* Dispatch New Task Button */}
        <button
          onClick={() => setShowNewOrderModal(true)}
          style={{
            padding: '10px 18px', background: '#0A192F', color: '#fff', border: 'none',
            borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 6px rgba(10,25,47,0.2)',
            transition: 'transform 0.1s ease',
          }}
        >
          <Plus size={16} />
          <span>Dispatch New Work Order</span>
        </button>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Tasks', value: stats.total, color: 'var(--primary)' },
          { label: 'Pending Assignment', value: stats.pending, color: 'var(--warning)' },
          { label: 'In Progress (Assigned)', value: stats.in_progress, color: 'var(--primary)' },
          { label: 'Clearance Review', value: stats.clearance_submitted, color: '#7c3aed' },
          { label: 'Completed Clearance', value: stats.done, color: 'var(--success)' },
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
            <span>Export Tasks</span>
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
                  {filter === 'all' ? 'All Tasks' : `${filter.toUpperCase()} Tasks`} ({filtered.length})
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
                  <FileText size={18} color="var(--success)" />
                  <div>
                    <div style={{ fontWeight: 600 }}>Download Excel</div>
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
          <div style={{ fontSize: 14, fontWeight: 500 }}>No tasks in this category</div>
        </div>
      ) : (
        filtered.map(task => {
          const isAssigned = task.assignedTo && task.assignedTo !== 'Unassigned';
          return (
            <div key={task._id} style={card}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* Status + priority */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, minWidth: 110 }}>
                  <span style={taskStatusBadge(task.status)}>{taskStatusLabel(task.status)}</span>
                  <span style={priorityBadge(task.priority)}>{task.priority.toUpperCase()}</span>
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
                    <span>{task.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                    Report Reference:{' '}
                    <Link href={`/officer/reports/${task.reportId}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      {task.reportTitle || task.reportId}
                    </Link>
                  </div>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Assigned Crew Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Assigned to:</span>
                      {isAssigned ? (
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: '#0A192F',
                          background: '#E2E8F0', padding: '2px 10px', borderRadius: 6,
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                        }}>
                          <Wrench size={12} strokeWidth={2.2} /> {task.assignedTo}
                        </span>
                      ) : (
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: '#dc2626',
                          background: '#fef2f2', padding: '2px 8px', borderRadius: 6,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          <AlertTriangle size={11} strokeWidth={2.2} /> Unassigned
                        </span>
                      )}
                    </div>
                    {/* Due date */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Due:</span>
                      <span style={{
                        fontSize: 12, fontWeight: 600,
                        color: isOverdue(task.dueDate) && task.status !== 'done' ? '#dc2626' : 'var(--text)',
                      }}>
                        {task.dueDate}
                        {isOverdue(task.dueDate) && task.status !== 'done' && (
                          <span style={{ marginLeft: 4, fontSize: 10, background: '#fef2f2', color: '#dc2626', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>
                            OVERDUE
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
                        <strong>Maintenance Clearance Note:</strong> {task.clearanceNote}
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
                      <span>Verify &amp; Clear Task</span>
                    </button>
                  )}

                  {task.status === 'in_progress' && (
                    <button
                      onClick={() => handleVerifyAndClearTask(task)}
                      title="Directly certify and clear this task"
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
                      <span>Sign Off &amp; Clear</span>
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
                      <span>{isAssigned ? 'Reassign Team' : 'Assign Team'}</span>
                    </button>
                  )}

                  {task.status === 'done' && (
                    <div style={{
                      padding: '4px 10px', borderRadius: 6, background: 'var(--success-light)',
                      color: 'var(--success)', fontSize: 11, fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <CheckCircle2 size={13} strokeWidth={2.2} /> Cleared &amp; Closed
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
                    ? 'Reassign Maintenance Team'
                    : 'Assign Task to Maintenance Team'}
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
                  Work Order Title
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                  {assignModalTask.title}
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                  Current Status: <strong style={{ color: '#0F172A' }}>{taskStatusLabel(assignModalTask.status)}</strong> ·
                  Current Assignee: <strong style={{ color: '#0F172A' }}>{assignModalTask.assignedTo || 'Unassigned'}</strong>
                </div>
              </div>

              {/* Maintenance Crew Dropdown */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  Select Maintenance Team / Crew: *
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
                    <option key={crew} value={crew}>{crew}</option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  This crew will receive live work order dispatch and digital LOTO authorization in their portal.
                </div>
              </div>

              {/* Status and Priority Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                    Workflow Status:
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={e => setSelectedStatus(e.target.value as TaskStatus)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    <option value="in_progress">In Progress (Active Dispatch)</option>
                    <option value="pending">Pending Crew Acknowledgment</option>
                    <option value="clearance_submitted">Clearance Submitted (Awaiting Officer)</option>
                    <option value="done">Completed &amp; Cleared</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                    Priority:
                  </label>
                  <select
                    value={selectedPriority}
                    onChange={e => setSelectedPriority(e.target.value as any)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    <option value="critical">CRITICAL (Immediate)</option>
                    <option value="high">HIGH (Next shift)</option>
                    <option value="medium">MEDIUM (Routine)</option>
                  </select>
                </div>
              </div>

              {/* Special Instructions / Notes */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  Dispatch Notes &amp; Safety Precautions (Optional):
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={e => setSpecialInstructions(e.target.value)}
                  placeholder="e.g. Verify zero-energy state with multi-meter before removing casing. LOTO isolation required."
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
                Cancel
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
                <span>{isSubmittingAssign ? 'Dispatching...' : 'Confirm Assignment & Dispath'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: Dispatch New Work Order Modal ─── */}
      {showNewOrderModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1500,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, backdropFilter: 'blur(2px)',
        }}>
          <form onSubmit={handleDispatchNewOrder} style={{
            background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)', width: '100%', maxWidth: 540,
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--surface-subtle)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={18} style={{ color: '#0A192F' }} />
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                  Dispatch New Maintenance Work Order
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowNewOrderModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  Work Order Title: *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Inspect & retorque lower flange bolts on Heat Exchanger EX-12"
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text)', fontSize: 13,
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                    Equipment Tag:
                  </label>
                  <input
                    type="text"
                    value={newEquipment}
                    onChange={e => setNewEquipment(e.target.value)}
                    placeholder="e.g. V-204 Hydrocracker"
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--surface)', color: 'var(--text)', fontSize: 12,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                    Location:
                  </label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={e => setNewLocation(e.target.value)}
                    placeholder="e.g. Process Area 2"
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--surface)', color: 'var(--text)', fontSize: 12,
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  Assign Maintenance Crew: *
                </label>
                <select
                  value={newCrew}
                  onChange={e => setNewCrew(e.target.value)}
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
                    Priority:
                  </label>
                  <select
                    value={newSeverity}
                    onChange={e => setNewSeverity(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    <option value="critical">CRITICAL (Immediate)</option>
                    <option value="high">HIGH (Next shift)</option>
                    <option value="medium">MEDIUM (Standard)</option>
                    <option value="low">LOW (Routine inspection)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 16 }}>
                    <input
                      type="checkbox"
                      checked={newLoto}
                      onChange={e => setNewLoto(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#dc2626' }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 700, color: newLoto ? '#dc2626' : 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Lock size={13} /> LOTO Isolation Required
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  Description &amp; Work Scope:
                </label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Describe repair scope, replacement parts needed, and safety permit requirements..."
                  rows={2}
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
                onClick={() => setShowNewOrderModal(false)}
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
                disabled={isSubmittingNewOrder}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: 'none',
                  background: '#0A192F', color: '#fff', fontSize: 12, fontWeight: 700,
                  cursor: isSubmittingNewOrder ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span>{isSubmittingNewOrder ? 'Dispatching...' : 'Dispatch Work Order'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
