import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Department,
  ExtractedDraftTask,
  Meeting,
  Member,
  NotificationLog,
  Role,
  Task,
} from './types';
import {
  INITIAL_MEMBERS,
  INITIAL_MEETINGS,
  INITIAL_TASKS,
  INITIAL_LOGS,
} from './data/initialData';
import { Header } from './components/Header';
import { TaskBoard } from './components/TaskBoard';
import { MeetingParserModal } from './components/MeetingParserModal';
import { PresidentialFilterModal } from './components/PresidentialFilterModal';
import { EvidenceSubmitModal } from './components/EvidenceSubmitModal';
import { EvidenceReviewModal } from './components/EvidenceReviewModal';
import { TheNagWeeklyReport } from './components/TheNagWeeklyReport';
import { MeetingHistoryModal } from './components/MeetingHistoryModal';
import { RosterManagerModal } from './components/RosterManagerModal';
import { DataSyncModal } from './components/DataSyncModal';
import {
  Sparkles,
  Shield,
  Layers,
  AlertTriangle,
  Pin,
  Clock,
  CheckCircle2,
  FileText,
  Mail,
  Users,
} from 'lucide-react';

const STORAGE_KEYS = {
  TASKS: 'nitc_tasks_v2',
  MEETINGS: 'nitc_meetings_v2',
  MEMBERS: 'nitc_members_v2',
  LOGS: 'nitc_logs_v2',
  ROLE: 'nitc_current_role_v2',
  DEPT: 'nitc_current_dept_v2',
};

export function App() {
  // 1. Core State
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [meetings, setMeetings] = useState<Meeting[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MEETINGS);
    return saved ? JSON.parse(saved) : INITIAL_MEETINGS;
  });

  const [members, setMembers] = useState<Member[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    return saved ? JSON.parse(saved) : INITIAL_MEMBERS;
  });

  const [logs, setLogs] = useState<NotificationLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LOGS);
    return saved ? JSON.parse(saved) : INITIAL_LOGS;
  });

  // Current logged in persona
  const [currentRole, setCurrentRole] = useState<Role>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ROLE);
    return (saved as Role) || 'Chủ tịch';
  });

  const [currentDepartment, setCurrentDepartment] = useState<Department>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DEPT);
    return (saved as Department) || 'Ban Chủ nhiệm';
  });

  const [currentUserId, setCurrentUserId] = useState<string>('mem-1');

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MEETINGS, JSON.stringify(meetings));
  }, [meetings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ROLE, currentRole);
  }, [currentRole]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DEPT, currentDepartment);
  }, [currentDepartment]);

  // Update current user ID based on role & dept
  useEffect(() => {
    if (currentRole === 'Chủ tịch') {
      const pres = members.find((m) => m.role === 'Chủ tịch');
      if (pres) setCurrentUserId(pres.id);
    } else {
      const officer = members.find((m) => m.department === currentDepartment && m.role === 'Trưởng ban');
      if (officer) setCurrentUserId(officer.id);
    }
  }, [currentRole, currentDepartment, members]);

  // 2. Modals Control State
  const [isParserOpen, setIsParserOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isNagOpen, setIsNagOpen] = useState(false);
  const [isMeetingHistoryOpen, setIsMeetingHistoryOpen] = useState(false);
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [isDataSyncOpen, setIsDataSyncOpen] = useState(false);

  // Modal payload state
  const [parsedMeetingData, setParsedMeetingData] = useState<Partial<Meeting> | null>(null);
  const [parsedDraftTasks, setParsedDraftTasks] = useState<ExtractedDraftTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string; type?: 'success' | 'info' | 'warn' } | null>(null);

  const showToast = (title: string, desc: string, type: 'success' | 'info' | 'warn' = 'success') => {
    setToastMessage({ title, desc, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 3. Flow Handlers:
  // Step 1 -> Step 2: AI Parser finished parsing BBH
  const handleParserSuccess = (
    meetingData: Partial<Meeting>,
    extractedTasks: ExtractedDraftTask[],
    _rawText: string
  ) => {
    setParsedMeetingData(meetingData);
    setParsedDraftTasks(extractedTasks);
    setIsParserOpen(false);
    setIsFilterOpen(true);
  };

  // Step 2 -> Step 3: President approved tasks from Presidential Filter
  const handlePublishTasks = (
    finalMeeting: Meeting,
    finalTasks: ExtractedDraftTask[]
  ) => {
    // Convert approved draft tasks to official tasks
    const newTasks: Task[] = finalTasks.map((d, index) => ({
      id: `task_${Date.now()}_${index}`,
      title: d.title,
      department: d.suggestedDepartment,
      assigneeName: d.suggestedAssigneeName || d.rawAssigneeText || 'Chưa gán',
      assigneeId: d.suggestedAssigneeId || 'mem-1',
      deadline: d.suggestedDeadline,
      status: 'in_progress',
      verificationType: d.verificationType,
      isSticky: false,
      priority: d.priority || 'medium',
      sourceMeetingId: finalMeeting.id,
      sourceMeetingTitle: finalMeeting.title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    // Apply "Sticky Task" Rule:
    // Any existing incomplete tasks from previous meetings are carried forward and tagged as sticky
    const updatedExistingTasks = tasks.map((t) => {
      if (t.status !== 'completed') {
        return {
          ...t,
          isSticky: true,
        };
      }
      return t;
    });

    setMeetings([finalMeeting, ...meetings]);
    setTasks([...newTasks, ...updatedExistingTasks]);
    setIsFilterOpen(false);
    setParsedMeetingData(null);
    setParsedDraftTasks([]);

    // Fire celebratory confetti!
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }

    showToast(
      'Xuất bản việc thành công!',
      `Đã chuyển giao ${newTasks.length} nhiệm vụ từ "${finalMeeting.title}" vào Bảng điều hành.`
    );
  };

  // Step 3: Evidence Submission by Member / Trưởng ban
  const handleOpenSubmitModal = (task: Task) => {
    setSelectedTask(task);
    setIsSubmitOpen(true);
  };

  const handleEvidenceSubmit = (taskId: string, evidenceData: { link?: string; report?: string }) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            evidenceLink: evidenceData.link || t.evidenceLink,
            evidenceReport: evidenceData.report || t.evidenceReport,
            evidenceSubmittedAt: new Date().toISOString(),
            status: 'pending_approval',
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );
    setIsSubmitOpen(false);
    setSelectedTask(null);

    showToast(
      'Đã gửi minh chứng!',
      'Nhiệm vụ đã chuyển sang trạng thái "Chờ duyệt". Chủ tịch sẽ tiến hành nghiệm thu.',
      'info'
    );
  };

  // Step 4: Evidence Review by President
  const handleOpenReviewModal = (task: Task) => {
    setSelectedTask(task);
    setIsReviewOpen(true);
  };

  const handleApproveEvidence = (taskId: string, approvalNote?: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            status: 'completed',
            approvalNote: approvalNote || 'Chủ tịch đã duyệt hoàn thành.',
            rejectedReason: undefined,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );
    setIsReviewOpen(false);
    setSelectedTask(null);

    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.7 },
      });
    } catch {
      // ignore
    }

    showToast('Đã duyệt hoàn thành!', 'Nhiệm vụ đã được nghiệm thu và đánh dấu Hoàn thành ✅');
  };

  const handleRejectEvidence = (taskId: string, rejectReason: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            status: 'in_progress',
            rejectedReason: rejectReason,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );
    setIsReviewOpen(false);
    setSelectedTask(null);

    showToast(
      'Đã yêu cầu nộp lại!',
      'Nhiệm vụ đã được trả về cho thành viên kèm ghi chú chỉnh sửa.',
      'warn'
    );
  };

  // Quick 1-click approve for president
  const handleQuickApprove = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            status: 'completed',
            approvalNote: 'Chủ tịch duyệt nhanh hoàn thành.',
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );
    showToast('Duyệt nhanh!', 'Đã đánh dấu hoàn thành nhiệm vụ.');
  };

  // Delete Task
  const handleDeleteTask = (taskId: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa nhiệm vụ này?')) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      showToast('Đã xóa', 'Nhiệm vụ đã được xóa khỏi hệ thống.', 'info');
    }
  };

  // Manual Quick Add Task
  const handleAddNewManualTask = (newTaskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask: Task = {
      ...newTaskData,
      id: `task_manual_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks([newTask, ...tasks]);
    showToast('Đã thêm việc', `Đã giao "${newTask.title}" cho ${newTask.assigneeName}.`);
  };

  // The Nag / Notification
  const handleSendNotification = (logData: Omit<NotificationLog, 'id' | 'sentAt'>) => {
    const newLog: NotificationLog = {
      ...logData,
      id: `log_${Date.now()}`,
      sentAt: new Date().toISOString(),
    };
    setLogs([newLog, ...logs]);
  };

  // Roster Management
  const handleAddMember = (newMem: Omit<Member, 'id'>) => {
    const member: Member = {
      ...newMem,
      id: `m_${Date.now()}`,
    };
    setMembers([...members, member]);
    showToast('Đã thêm thành viên', `Thành viên ${member.name} đã được thêm vào danh bạ.`);
  };

  const handleUpdateMember = (id: string, updates: Partial<Member>) => {
    setMembers(members.map((m) => (m.id === id ? { ...m, ...updates } : m)));
    showToast('Cập nhật thành công', 'Đã lưu thông tin thành viên.');
  };

  const handleDeleteMember = (id: string) => {
    setMembers(members.filter((m) => m.id !== id));
    showToast('Đã xóa thành viên', 'Đã xóa khỏi danh bạ NITC.', 'info');
  };

  // Data Sync & Reset
  const handleImportAllData = (data: {
    tasks?: Task[];
    meetings?: Meeting[];
    members?: Member[];
    logs?: NotificationLog[];
  }) => {
    if (data.tasks) setTasks(data.tasks);
    if (data.meetings) setMeetings(data.meetings);
    if (data.members) setMembers(data.members);
    if (data.logs) setLogs(data.logs);
  };

  const handleResetToDemo = () => {
    setTasks(INITIAL_TASKS);
    setMeetings(INITIAL_MEETINGS);
    setMembers(INITIAL_MEMBERS);
    setLogs(INITIAL_LOGS);
  };

  // Stats for the KPI cards
  const totalTasksCount = tasks.length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const inProgressPct = totalTasksCount > 0 ? Math.round((inProgressCount / totalTasksCount) * 100) : 0;
  const pendingApprovalsCount = tasks.filter((t) => t.status === 'pending_approval').length;
  const overdueCount = tasks.filter((t) => t.status === 'overdue').length;
  const stickyCount = tasks.filter((t) => t.isSticky && t.status !== 'completed').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const completionRate = totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 0;

  // Selected quick filter from sidebar
  const [sidebarDeptFilter, setSidebarDeptFilter] = useState<string>('all');
  const [sidebarStatusFilter, setSidebarStatusFilter] = useState<string>('all');
  const [sidebarOnlySticky, setSidebarOnlySticky] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 flex flex-col font-sans antialiased selection:bg-orange-500 selection:text-white">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className={`p-4 rounded-xl shadow-2xl border flex items-start gap-3 max-w-sm ${
            toastMessage.type === 'warn'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : toastMessage.type === 'info'
              ? 'bg-blue-50 border-blue-300 text-blue-900'
              : 'bg-white border-emerald-400 text-slate-900 shadow-emerald-100'
          }`}>
            <div className="p-1 rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h5 className="font-bold text-sm text-slate-900">{toastMessage.title}</h5>
              <p className="text-xs text-slate-600 mt-0.5">{toastMessage.desc}</p>
            </div>
          </div>
        </div>
      )}

      {/* 1. Global Navigation Header */}
      <Header
        currentRole={currentRole}
        currentDepartment={currentDepartment}
        currentUserId={currentUserId}
        onRoleChange={(role, dept, userId) => {
          setCurrentRole(role);
          setCurrentDepartment(dept);
          setCurrentUserId(userId);
        }}
        tasks={tasks}
        onOpenBBHParser={() => setIsParserOpen(true)}
        onOpenMeetingHistory={() => setIsMeetingHistoryOpen(true)}
        onOpenNagModal={() => setIsNagOpen(true)}
        onOpenRosterModal={() => setIsRosterOpen(true)}
        onOpenDataSyncModal={() => setIsDataSyncOpen(true)}
      />

      {/* 2. High Density Dashboard Layout: Sidebar + Main Area */}
      <div className="flex flex-1 w-full overflow-x-hidden">
        
        {/* High Density Desktop Sidebar */}
        <aside className="w-60 bg-white border-r border-slate-200 hidden lg:flex flex-col shrink-0">
          <div className="p-4 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
              Hệ thống
            </div>
            <button
              onClick={() => {
                setSidebarDeptFilter('all');
                setSidebarStatusFilter('all');
                setSidebarOnlySticky(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold transition cursor-pointer ${
                sidebarDeptFilter === 'all' && sidebarStatusFilter === 'all' && !sidebarOnlySticky
                  ? 'bg-orange-50 text-orange-700 font-bold border border-orange-200/60'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span>📊</span>
                <span>Tổng quan</span>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                {totalTasksCount}
              </span>
            </button>

            <button
              onClick={() => setIsParserOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-md text-xs transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span>🤖</span>
                <span>Duyệt AI Brain</span>
              </div>
              <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">
                Mới
              </span>
            </button>

            <button
              onClick={() => {
                setSidebarOnlySticky(true);
                setSidebarDeptFilter('all');
                setSidebarStatusFilter('all');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition cursor-pointer ${
                sidebarOnlySticky
                  ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200/60'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span>📋</span>
                <span>Nhiệm vụ 'Dính'</span>
              </div>
              {stickyCount > 0 && (
                <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">
                  {stickyCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsNagOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-md text-xs transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span>🚨</span>
                <span>Quá hạn (The Nag)</span>
              </div>
              {overdueCount > 0 && (
                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold animate-pulse">
                  {overdueCount}
                </span>
              )}
            </button>
          </div>

          <div className="p-4 space-y-1 border-t border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
              Ban Điều Hành
            </div>
            
            {(['Học thuật', 'Truyền thông', 'Sự kiện', 'Đối ngoại', 'Ban Chủ nhiệm'] as Department[]).map((dept) => {
              const count = tasks.filter((t) => t.department === dept).length;
              const isSelected = sidebarDeptFilter === dept;
              const emoji =
                dept === 'Học thuật'
                  ? '💻'
                  : dept === 'Truyền thông'
                  ? '📢'
                  : dept === 'Sự kiện'
                  ? '📅'
                  : dept === 'Đối ngoại'
                  ? '🤝'
                  : '👑';

              return (
                <button
                  key={dept}
                  onClick={() => {
                    setSidebarDeptFilter(dept);
                    setSidebarOnlySticky(false);
                    setSidebarStatusFilter('all');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition cursor-pointer ${
                    isSelected
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span>{emoji}</span>
                    <span className="truncate">{dept}</span>
                  </span>
                  <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-600">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-auto p-4 border-t border-slate-100 space-y-2">
            <button
              onClick={() => setIsMeetingHistoryOpen(true)}
              className="w-full py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-900 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-sm"
            >
              <span>📤</span>
              <span>XUẤT PDF BBH</span>
            </button>
            <div className="text-[11px] text-slate-400 text-center font-medium">
              CLB CNTT NITC &bull; v2.6
            </div>
          </div>
        </aside>

        {/* Main Content Pane */}
        <main className="flex-1 flex flex-col p-4 sm:p-6 gap-5 max-w-full overflow-x-hidden">
          
          {/* Top 4 KPI Metric Cards (High Density) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
            {/* Card 1: Total Tasks */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
                  <span>Tổng nhiệm vụ</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">Toàn CLB</span>
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{totalTasksCount}</div>
              </div>
              <div className="text-[10px] text-emerald-600 font-medium mt-2 flex items-center gap-1">
                <span>↑ {completionRate}% hoàn thành toàn trình</span>
              </div>
            </div>

            {/* Card 2: In Progress */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
                  <span>Đang thực hiện</span>
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">Active</span>
                </div>
                <div className="text-2xl font-bold text-blue-600 mt-1">{inProgressCount}</div>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${inProgressPct}%` }}></div>
              </div>
            </div>

            {/* Card 3: The Nag Overdue */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-red-500 flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
                  <span>Quá hạn (The Nag)</span>
                  {overdueCount > 0 ? (
                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold animate-pulse">Cần nhắc</span>
                  ) : (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">Tốt</span>
                  )}
                </div>
                <div className="text-2xl font-bold text-red-600 mt-1">
                  {overdueCount < 10 ? `0${overdueCount}` : overdueCount}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 italic">Nhắc tự động hàng ngày</span>
                {overdueCount > 0 && (
                  <button
                    onClick={() => setIsNagOpen(true)}
                    className="font-bold text-red-600 hover:underline cursor-pointer"
                  >
                    Gửi mail ngay &rarr;
                  </button>
                )}
              </div>
            </div>

            {/* Card 4: Evidence Review Pending */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
                  <span>Đợi duyệt bằng chứng</span>
                  <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">Chủ tịch</span>
                </div>
                <div className="text-2xl font-bold text-orange-500 mt-1">
                  {pendingApprovalsCount < 10 ? `0${pendingApprovalsCount}` : pendingApprovalsCount}
                </div>
              </div>
              <div className="mt-2">
                {pendingApprovalsCount > 0 ? (
                  <button
                    onClick={() => {
                      const firstPending = tasks.find((t) => t.status === 'pending_approval');
                      if (firstPending) handleOpenReviewModal(firstPending);
                    }}
                    className="text-[11px] font-bold text-orange-600 hover:text-orange-700 underline cursor-pointer"
                  >
                    Kiểm tra ngay &rarr;
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400">Không có việc tồn đọng</span>
                )}
              </div>
            </div>
          </div>

          {/* Core Rules Quick Summary Banner */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 text-[10px] font-bold uppercase tracking-wide">
                  Quy Chuẩn Điều Hành NITC
                </span>
                <h2 className="text-sm font-bold text-slate-900">
                  Trích xuất BBH & Giám sát Trách nhiệm Toàn CLB
                </h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
                Tự động hóa toàn trình: <strong className="text-slate-800">BBH &rarr; To-do List</strong> &bull; Thực thi nghiêm ngặt <strong className="text-amber-700">Quy tắc Minh (Không tự ý gán người mơ hồ)</strong> &bull; <strong className="text-red-600">Cảnh báo vắng mặt</strong> &bull; <strong className="text-purple-700">Nhiệm vụ Dính (Sticky Tasks không tự ý mất)</strong> &bull; <strong className="text-emerald-700">Xác minh Bằng chứng (Link/Báo cáo 2 câu)</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsParserOpen(true)}
                className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>+ Nạp BBH Mới</span>
              </button>
            </div>
          </div>

          {/* 3. Task Management Board */}
          <TaskBoard
            tasks={tasks}
            members={members}
            currentRole={currentRole}
            currentDepartment={currentDepartment}
            currentUserId={currentUserId}
            selectedDeptProp={sidebarDeptFilter}
            selectedStatusProp={sidebarStatusFilter}
            onlyStickyProp={sidebarOnlySticky}
            onSelectDeptFilter={setSidebarDeptFilter}
            onSelectStatusFilter={setSidebarStatusFilter}
            onSelectStickyFilter={setSidebarOnlySticky}
            onOpenSubmitModal={handleOpenSubmitModal}
            onOpenReviewModal={handleOpenReviewModal}
            onDeleteTask={handleDeleteTask}
            onQuickApprove={handleQuickApprove}
            onOpenBBHParser={() => setIsParserOpen(true)}
            onAddNewManualTask={handleAddNewManualTask}
          />

        </main>
      </div>

      {/* 4. Footer */}
      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-500">
        <div className="w-full px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>NITC Command Center &copy; 2026 CLB Công Nghệ Thông Tin NITC &bull; Chủ tịch Lê Hồng Phúc Minh</span>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="text-emerald-600 font-medium">● AI Engine Active</span>
            <span>Phiên bản v2.6 Enterprise</span>
          </div>
        </div>
      </footer>

      {/* 5. Modals System */}

      {/* Modal 1: BBH Input & AI Parser */}
      <MeetingParserModal
        isOpen={isParserOpen}
        onClose={() => setIsParserOpen(false)}
        members={members}
        onExtractionSuccess={handleParserSuccess}
      />

      {/* Modal 2: Presidential Filter (Quy tắc Minh, Cảnh báo vắng mặt, Phê duyệt) */}
      <PresidentialFilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        meetingData={parsedMeetingData || {}}
        draftTasks={parsedDraftTasks}
        members={members}
        onPublishTasks={handlePublishTasks}
      />

      {/* Modal 3: Evidence Submission (Link URL vs 2-Sentence Report) */}
      <EvidenceSubmitModal
        isOpen={isSubmitOpen}
        onClose={() => {
          setIsSubmitOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onSubmit={handleEvidenceSubmit}
      />

      {/* Modal 4: President Evidence Review (Approve / Reject) */}
      <EvidenceReviewModal
        isOpen={isReviewOpen}
        onClose={() => {
          setIsReviewOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onApprove={handleApproveEvidence}
        onReject={handleRejectEvidence}
      />

      {/* Modal 5: The Nag & Sunday Weekly Report */}
      <TheNagWeeklyReport
        isOpen={isNagOpen}
        onClose={() => setIsNagOpen(false)}
        tasks={tasks}
        members={members}
        logs={logs}
        onSendNotification={handleSendNotification}
      />

      {/* Modal 6: Meeting Minutes Archive & Official PDF Export */}
      <MeetingHistoryModal
        isOpen={isMeetingHistoryOpen}
        onClose={() => setIsMeetingHistoryOpen(false)}
        meetings={meetings}
        tasks={tasks}
        onOpenBBHParser={() => {
          setIsMeetingHistoryOpen(false);
          setIsParserOpen(true);
        }}
      />

      {/* Modal 7: Roster & Members Manager */}
      <RosterManagerModal
        isOpen={isRosterOpen}
        onClose={() => setIsRosterOpen(false)}
        members={members}
        onAddMember={handleAddMember}
        onUpdateMember={handleUpdateMember}
        onDeleteMember={handleDeleteMember}
      />

      {/* Modal 8: Data Storage & Google Sheets Sync */}
      <DataSyncModal
        isOpen={isDataSyncOpen}
        onClose={() => setIsDataSyncOpen(false)}
        tasks={tasks}
        meetings={meetings}
        members={members}
        logs={logs}
        onImportAllData={handleImportAllData}
        onResetToDemo={handleResetToDemo}
      />

    </div>
  );
}

export default App;
