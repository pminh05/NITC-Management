import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { isTaskOverdue } from './utils/dateUtils';
import {
  Department,
  ExtractedDraftTask,
  ImportSummary,
  Meeting,
  Member,
  NotificationLog,
  Role,
  Task,
  Term,
} from './types';
import { api, apiUpload, getToken, setToken } from './api/client';
import { AppNotification } from './types';
import { Header } from './components/Header';
import { LoginPage } from './components/LoginPage';
import { TaskBoard } from './components/TaskBoard';
import { MeetingParserModal } from './components/MeetingParserModal';
import { PresidentialFilterModal } from './components/PresidentialFilterModal';
import { EvidenceSubmitModal } from './components/EvidenceSubmitModal';
import { EvidenceReviewModal } from './components/EvidenceReviewModal';
import { TheNagWeeklyReport } from './components/TheNagWeeklyReport';
import { MeetingHistoryModal } from './components/MeetingHistoryModal';
import { RosterManagerModal } from './components/RosterManagerModal';
import { DataSyncModal } from './components/DataSyncModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { SettingsModal } from './components/SettingsModal';
import { CalendarModal } from './components/CalendarModal';
import { DocsModal } from './components/DocsModal';
import { DashboardModal } from './components/DashboardModal';
import { TaskDetailModal } from './components/TaskDetailModal';
import { UpdateRequestFlowModal } from './components/UpdateRequestFlowModal';
import {
  Pin,
  CheckCircle2,
} from 'lucide-react';

export function App() {
  // ===== 0. Auth state (đăng nhập thật qua JWT) =====
  const [authMember, setAuthMember] = useState<Member | null>(null);
  const [booting, setBooting] = useState(true);

  // ===== 1. Core State (nguồn sự thật: server, không còn localStorage) =====
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Vai trò hiện tại suy ra từ tài khoản đăng nhập
  const currentRole = (authMember?.role as Role) || 'Thành viên';
  const currentDepartment = (authMember?.department as Department) || 'Ban Chủ nhiệm';
  const currentUserId = authMember?.id || '';
  const isLeadership = currentRole === 'Chủ nhiệm' || currentRole === 'Phó Chủ nhiệm';
  // Ban quản lý được họp riêng & ban hành việc của ban mình
  const canManageMeetings = isLeadership || currentRole === 'Trưởng ban' || currentRole === 'Phó ban';

  // ===== 1b. Nhiệm kỳ & roster =====
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string>('active');
  const [importing, setImporting] = useState(false);

  // ===== 1c. Trung tâm thông báo =====
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationChannel, setNotificationChannel] = useState('in_app');

  // Boot: khôi phục phiên đăng nhập từ token
  useEffect(() => {
    const boot = async () => {
      if (!getToken()) {
        setBooting(false);
        return;
      }
      try {
        const res = await api<{ member: Member }>('/auth/me');
        setAuthMember(res.member);
      } catch {
        setToken(null);
      } finally {
        setBooting(false);
      }
    };
    boot();
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const res = await api<{ items: AppNotification[]; unread: number }>('/notifications');
      setNotifications(res.items);
      setUnreadCount(res.unread);
    } catch {
      // im lặng — polling sẽ thử lại
    }
  }, []);

  const loadNotificationPrefs = useCallback(async () => {
    try {
      const res = await api<{ channel: string }>('/notifications/prefs');
      setNotificationChannel(res.channel);
    } catch {
      // mặc định in_app
    }
  }, []);

  const handleMarkRead = useCallback(async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (target && !target.readAt) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    await api(`/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
  }, [notifications]);

  const handleMarkAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    setUnreadCount(0);
    await api('/notifications/read-all', { method: 'POST' }).catch(() => {});
  }, []);

  const handleChangeNotificationChannel = useCallback(async (channel: string) => {
    setNotificationChannel(channel);
    await api('/notifications/prefs', { method: 'PUT', body: { channel } }).catch(() => {});
    showToast('Đã lưu cài đặt', 'Kênh nhận thông báo của bạn đã được cập nhật.', 'info');
  }, []);

  const loadMembers = useCallback(async (termId: string) => {
    const query =
      termId === 'active' ? '' : termId === 'all' ? '?all=1' : `?termId=${encodeURIComponent(termId)}`;
    const mem = await api<Member[]>(`/members${query}`);
    setMembers(mem);
  }, []);

  const loadAllData = useCallback(async (me: Member, termId: string = 'active') => {
    setDataLoading(true);
    try {
      const [t, m] = await Promise.all([
        api<Task[]>('/tasks'),
        api<Meeting[]>('/meetings'),
      ]);
      setTasks(t);
      setMeetings(m);
      // Nhật ký nag: chỉ Ban lãnh đạo xem được
      if (me.role === 'Chủ nhiệm' || me.role === 'Phó Chủ nhiệm') {
        try {
          const l = await api<NotificationLog[]>('/logs');
          setLogs(l);
        } catch {
          setLogs([]);
        }
      } else {
        setLogs([]);
      }
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Tải terms + members khi đăng nhập hoặc đổi nhiệm kỳ
  useEffect(() => {
    if (!authMember) return;
    (async () => {
      try {
        const t = await api<Term[]>('/terms');
        setTerms(t);
      } catch {
        setTerms([]);
      }
      await loadMembers(selectedTermId);
    })();
  }, [authMember, selectedTermId, loadMembers]);

  // Cấu hình CLB (tên CLB hiển thị footer)
  useEffect(() => {
    if (!authMember) return;
    api<{ clubName: string }>('/settings')
      .then((s) => setClubName(s.clubName))
      .catch(() => {});
  }, [authMember]);

  // Trung tâm thông báo: tải ban đầu + SSE realtime + polling dự phòng 45s
  useEffect(() => {
    if (!authMember) return;
    refreshNotifications();
    loadNotificationPrefs();

    const token = getToken();
    let es: EventSource | null = null;
    if (token) {
      try {
        es = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
        es.onmessage = () => refreshNotifications(); // có sự kiện mới → tải lại danh sách
      } catch {
        // SSE lỗi → polling lo phần còn lại
      }
    }
    const poll = setInterval(refreshNotifications, 45000);
    return () => {
      es?.close();
      clearInterval(poll);
    };
  }, [authMember, refreshNotifications, loadNotificationPrefs]);

  useEffect(() => {
    if (authMember) {
      loadAllData(authMember);
    }
  }, [authMember, loadAllData]);

  const handleLogout = () => {
    setToken(null);
    setAuthMember(null);
    setTasks([]);
    setMeetings([]);
    setMembers([]);
    setLogs([]);
  };

  // ===== 2. Modals Control State =====
  const [isParserOpen, setIsParserOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isNagOpen, setIsNagOpen] = useState(false);
  const [isMeetingHistoryOpen, setIsMeetingHistoryOpen] = useState(false);
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [isDataSyncOpen, setIsDataSyncOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isDashOpen, setIsDashOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [updateReqTask, setUpdateReqTask] = useState<{ task: Task; mode: 'request' | 'respond' } | null>(null);
  const [clubName, setClubName] = useState('CLB Công nghệ thông tin NITC');

  // Modal payload state
  const [parsedMeetingData, setParsedMeetingData] = useState<Partial<Meeting> | null>(null);
  const [parsedDraftTasks, setParsedDraftTasks] = useState<ExtractedDraftTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string; type?: 'success' | 'info' | 'warn' } | null>(null);

  const showToast = (title: string, desc: string, type: 'success' | 'info' | 'warn' = 'success') => {
    setToastMessage({ title, desc, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const showError = (e: any) => {
    showToast('Có lỗi xảy ra', e?.message || 'Không thực hiện được thao tác', 'warn');
  };

  // ===== 3. Flow Handlers =====

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

  // Step 2 -> Step 3: President publishes tasks from Presidential Filter
  const handlePublishTasks = async (
    finalMeeting: Meeting,
    finalTasks: ExtractedDraftTask[]
  ) => {
    try {
      const res = await api<{ meeting: Meeting; tasks: Task[] }>('/meetings/publish', {
        method: 'POST',
        body: {
          meeting: {
            ...finalMeeting,
            rawContent: finalMeeting.rawContent || '',
          },
          tasks: finalTasks,
        },
      });

      setMeetings([res.meeting, ...meetings]);
      // Tải lại danh sách việc để cập nhật cả Sticky tasks cũ
      const freshTasks = await api<Task[]>('/tasks');
      setTasks(freshTasks);

      setIsFilterOpen(false);
      setParsedMeetingData(null);
      setParsedDraftTasks([]);

      try {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      } catch {
        // ignore
      }

      showToast(
        'Xuất bản việc thành công!',
        `Đã chuyển giao ${res.tasks.length} nhiệm vụ từ "${res.meeting.title}" vào Bảng điều hành.`
      );
    } catch (e) {
      showError(e);
    }
  };

  // Step 3: Evidence Submission by Member / Trưởng ban
  const handleOpenSubmitModal = (task: Task) => {
    setSelectedTask(task);
    setIsSubmitOpen(true);
  };

  const handleEvidenceSubmit = async (taskId: string, evidenceData: { link?: string; report?: string }) => {
    try {
      const updated = await api<Task>(`/tasks/${taskId}`, {
        method: 'PUT',
        body: { action: 'submit_evidence', ...evidenceData },
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setIsSubmitOpen(false);
      setSelectedTask(null);
      showToast(
        'Đã gửi minh chứng!',
        'Nhiệm vụ đã chuyển sang trạng thái "Chờ duyệt". Chủ nhiệm sẽ tiến hành nghiệm thu.',
        'info'
      );
    } catch (e) {
      showError(e);
    }
  };

  // Step 4: Evidence Review by President
  const handleUpdateRequestDone = async (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setUpdateReqTask(null);
    showToast(
      updated.updateRequestedAt ? 'Đã gửi yêu cầu cập nhật' : 'Đã phản hồi yêu cầu',
      updated.updateRequestedAt
        ? 'Ban lãnh đạo/Trưởng ban sẽ xem xét và phản hồi với feedback.'
        : 'Thành viên đã nhận được phản hồi qua thông báo.'
    );
  };

  const handleOpenReviewModal = (task: Task) => {
    setSelectedTask(task);
    setIsReviewOpen(true);
  };

  const handleApproveEvidence = async (taskId: string, approvalNote?: string) => {
    try {
      const updated = await api<Task>(`/tasks/${taskId}`, {
        method: 'PUT',
        body: { action: 'approve', note: approvalNote },
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setIsReviewOpen(false);
      setSelectedTask(null);

      try {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
      } catch {
        // ignore
      }
      showToast('Đã duyệt hoàn thành!', 'Nhiệm vụ đã được nghiệm thu và đánh dấu Hoàn thành ✅');
    } catch (e) {
      showError(e);
    }
  };

  const handleRejectEvidence = async (taskId: string, rejectReason: string) => {
    try {
      const updated = await api<Task>(`/tasks/${taskId}`, {
        method: 'PUT',
        body: { action: 'reject', reason: rejectReason },
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setIsReviewOpen(false);
      setSelectedTask(null);
      showToast(
        'Đã yêu cầu nộp lại!',
        'Nhiệm vụ đã được trả về cho thành viên kèm ghi chú chỉnh sửa.',
        'warn'
      );
    } catch (e) {
      showError(e);
    }
  };

  // Quick 1-click approve for president
  const handleQuickApprove = async (taskId: string) => {
    try {
      const updated = await api<Task>(`/tasks/${taskId}`, {
        method: 'PUT',
        body: { action: 'approve', note: 'Chủ nhiệm duyệt nhanh hoàn thành.' },
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      showToast('Duyệt nhanh!', 'Đã đánh dấu hoàn thành nhiệm vụ.');
    } catch (e) {
      showError(e);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa nhiệm vụ này?')) return;
    try {
      await api(`/tasks/${taskId}`, { method: 'DELETE' });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      showToast('Đã xóa', 'Nhiệm vụ đã được xóa khỏi hệ thống.', 'info');
    } catch (e) {
      showError(e);
    }
  };

  // Manual Quick Add Task
  const handleAddNewManualTask = async (newTaskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const created = await api<Task>('/tasks', { method: 'POST', body: newTaskData });
      setTasks((prev) => [created, ...prev]);
      showToast('Đã thêm việc', `Đã giao "${created.title}" cho ${created.assigneeName}.`);
    } catch (e) {
      showError(e);
    }
  };

  // The Nag / Notification
  const handleSendNotification = async (logData: Omit<NotificationLog, 'id' | 'sentAt'>) => {
    try {
      const created = await api<NotificationLog>('/logs', { method: 'POST', body: logData });
      setLogs((prev) => [created, ...prev]);
    } catch (e) {
      showError(e);
    }
  };

  // Roster Management
  const handleAddMember = async (newMem: Omit<Member, 'id'>) => {
    try {
      const member = await api<Member>('/members', { method: 'POST', body: newMem });
      showToast('Đã thêm thành viên', `${member.name} đã vào danh sách thành viên của nhiệm kỳ hiện hành (tài khoản: email của họ, mật khẩu mặc định nitc123).`);
      await loadMembers(selectedTermId);
    } catch (e) {
      showError(e);
    }
  };

  const handleUpdateMember = async (id: string, updates: Partial<Member>) => {
    try {
      await api<Member>(`/members/${id}`, { method: 'PUT', body: updates });
      showToast('Cập nhật thành công', 'Đã lưu thông tin thành viên.');
      await loadMembers(selectedTermId);
    } catch (e) {
      showError(e);
    }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      await api(`/members/${id}`, { method: 'DELETE' });
      showToast('Đã xóa thành viên', 'Đã xóa khỏi danh sách thành viên.', 'info');
      await loadMembers(selectedTermId);
    } catch (e) {
      showError(e);
    }
  };

  // Import Excel danh bạ nhiệm kỳ mới
  const handleImportExcel = async (file: File, termName: string): Promise<ImportSummary | void> => {
    setImporting(true);
    try {
      const res = await apiUpload<{ success: boolean; summary: ImportSummary }>(
        '/members/import',
        file,
        { termName }
      );
      const s = res.summary;
      showToast(
        'Import thành công!',
        `Nhiệm kỳ ${s.term}: +${s.created} thành viên mới, cập nhật ${s.updated}, bỏ qua ${s.skipped}.`
      );
      // Reload terms + về chế độ nhiệm kỳ vừa import để nhìn thấy ngay
      const t = await api<Term[]>('/terms');
      setTerms(t);
      const imported = t.find((x) => x.name === s.term);
      setSelectedTermId(imported ? imported.id : 'active');
      return s;
    } finally {
      setImporting(false);
    }
  };

  // Đặt nhiệm kỳ làm hiện hành
  const handleActivateTerm = async (termId: string) => {
    try {
      const res = await api<{ success: boolean; activeTerm: string }>(`/terms/${termId}/activate`, {
        method: 'PUT',
      });
      const t = await api<Term[]>('/terms');
      setTerms(t);
      setSelectedTermId('active');
      showToast('Đã đổi nhiệm kỳ', `Nhiệm kỳ ${res.activeTerm} giờ là nhiệm kỳ hiện hành.`);
    } catch (e) {
      showError(e);
    }
  };

  // Data Sync & Reset
  const handleImportAllData = async (data: {
    tasks?: Task[];
    meetings?: Meeting[];
    members?: Member[];
    logs?: NotificationLog[];
  }) => {
    try {
      await api('/admin/import', { method: 'POST', body: data });
      await loadAllData(authMember!);
      showToast('Đồng bộ thành công', 'Dữ liệu đã được ghi vào cơ sở dữ liệu trung tâm.');
    } catch (e) {
      showError(e);
    }
  };

  const handleResetToDemo = async () => {
    try {
      await api('/admin/reset', { method: 'POST' });
      await loadAllData(authMember!);
      showToast('Đã reset', 'Hệ thống đã về dữ liệu demo chuẩn.', 'info');
    } catch (e) {
      showError(e);
    }
  };

  // ===== 4. Stats for the KPI cards =====
  const totalTasksCount = tasks.length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const inProgressPct = totalTasksCount > 0 ? Math.round((inProgressCount / totalTasksCount) * 100) : 0;
  const pendingApprovalsCount = tasks.filter((t) => t.status === 'pending_approval').length;
  const overdueCount = tasks.filter(isTaskOverdue).length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const completionRate = totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 0;

  // Selected quick filter from sidebar
  const [sidebarDeptFilter, setSidebarDeptFilter] = useState<string>('all');
  const [sidebarStatusFilter, setSidebarStatusFilter] = useState<string>('all');

  // ===== Render =====

  if (booting) {
    return (
      <div className="min-h-screen bg-[#10192F] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-[#2C69FF]/100 rounded-xl flex items-center justify-center font-bold text-white text-xl mx-auto animate-pulse">
            N
          </div>
          <p className="text-slate-400 text-sm mt-3">Đang khởi động NITC Command Center...</p>
        </div>
      </div>
    );
  }

  if (!authMember) {
    return <LoginPage onLogin={(m) => setAuthMember(m)} />;
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased selection:bg-[#2C69FF]/100 selection:text-white">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className={`p-4 rounded-xl shadow-2xl border flex items-start gap-3 max-w-sm ${
            toastMessage.type === 'warn'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : toastMessage.type === 'info'
              ? 'bg-blue-50 border-blue-300 text-blue-900'
              : 'bg-white border-emerald-400 text-slate-900 dark:text-slate-100 shadow-emerald-100'
          }`}>
            <div className="p-1 rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h5 className="font-bold text-sm text-slate-900">{toastMessage.title}</h5>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{toastMessage.desc}</p>
            </div>
          </div>
        </div>
      )}

      {/* 1. Global Navigation Header */}
      <Header
        authMember={authMember}
        onLogout={handleLogout}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCalendar={() => setIsCalendarOpen(true)}
        clubName={clubName}
        tasks={tasks}
        notifications={notifications}
        unreadCount={unreadCount}
        notificationChannel={notificationChannel}
        onRefreshNotifications={refreshNotifications}
        onMarkAllRead={handleMarkAllRead}
        onMarkRead={handleMarkRead}
        onChangeNotificationChannel={handleChangeNotificationChannel}
        onOpenBBHParser={() => setIsParserOpen(true)}
        onOpenMeetingHistory={() => setIsMeetingHistoryOpen(true)}
        onOpenNagModal={() => setIsNagOpen(true)}
        onOpenRosterModal={() => setIsRosterOpen(true)}
        onOpenDataSyncModal={() => setIsDataSyncOpen(true)}
      />

      {/* 2. High Density Dashboard Layout: Sidebar + Main Area */}
      <div className="flex flex-1 w-full overflow-x-hidden">

        {/* High Density Desktop Sidebar */}
        <aside className="w-60 bg-white border-r border-slate-200 dark:border-slate-800 hidden lg:flex flex-col shrink-0">
          <div className="p-4 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
              Hệ thống
            </div>
            <button
              onClick={() => {
                setSidebarDeptFilter('all');
                setSidebarStatusFilter('all');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold transition cursor-pointer ${
                sidebarDeptFilter === 'all' && sidebarStatusFilter === 'all'
                  ? 'bg-[#2C69FF]/10 text-[#1E4FC4] font-bold border border-[#2C69FF]/30'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span>📊</span>
                <span>Tổng quan</span>
              </div>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono">
                {dataLoading ? '...' : totalTasksCount}
              </span>
            </button>

            {canManageMeetings && (
              <button
                onClick={() => setIsParserOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-900 rounded-md text-xs transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span>🤖</span>
                  <span>AI đọc biên bản họp</span>
                </div>
                <span className="text-[10px] bg-[#2C69FF]/15 text-[#1E4FC4] px-1.5 py-0.5 rounded font-bold">
                  Mới
                </span>
              </button>
            )}

            <button
              onClick={() => setIsNagOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-900 rounded-md text-xs transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span>🚨</span>
                <span>Việc quá hạn</span>
              </div>
              {overdueCount > 0 && (
                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold animate-pulse">
                  {overdueCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsDashOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-md text-xs transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span>📊</span>
                <span>Dashboard</span>
              </div>
            </button>

            <button
              onClick={() => setIsLeaderboardOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-900 rounded-md text-xs transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span>🏆</span>
                <span>Bảng xếp hạng</span>
              </div>
              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                KPI
              </span>
            </button>

            <button
              onClick={() => setIsCalendarOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-900 rounded-md text-xs transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span>📅</span>
                <span>Lịch tổng</span>
              </div>
            </button>

            <button
              onClick={() => setIsDocsOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-900 rounded-md text-xs transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span>📚</span>
                <span>Kho tài liệu</span>
              </div>
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
                    setSidebarStatusFilter('all');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition cursor-pointer ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span>{emoji}</span>
                    <span className="truncate">{dept}</span>
                  </span>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-slate-600">
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
              <span>Xuất PDF biên bản</span>
            </button>
            <div className="text-[11px] text-slate-400 text-center font-medium">
              CLB CNTT NITC &bull; v3.0
            </div>
          </div>
        </aside>

        {/* Main Content Pane */}
        <main className="flex-1 flex flex-col p-4 sm:p-6 gap-5 max-w-full overflow-x-hidden">

          {/* Top 4 KPI Metric Cards (High Density) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
            {/* Card 1: Total Tasks */}
            <div className="bg-white dark:bg-slate-900 dark:border-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
                  <span>Tổng nhiệm vụ</span>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-bold">
                    {currentRole === 'Chủ nhiệm' ? 'Toàn CLB' : currentDepartment}
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalTasksCount}</div>
              </div>
              <div className="text-[10px] text-emerald-600 font-medium mt-2 flex items-center gap-1">
                <span>↑ {completionRate}% hoàn thành toàn trình</span>
              </div>
            </div>

            {/* Card 2: In Progress */}
            <div className="bg-white dark:bg-slate-900 dark:border-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
                  <span>Đang thực hiện</span>
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">Active</span>
                </div>
                <div className="text-2xl font-bold text-blue-600 mt-1">{inProgressCount}</div>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${inProgressPct}%` }}></div>
              </div>
            </div>

            {/* Card 3: The Nag Overdue */}
            <div className="bg-white dark:bg-slate-900 dark:border-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-red-500 flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
                  <span>Việc quá hạn</span>
                  {overdueCount > 0 ? (
                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold animate-pulse">Cần nhắc</span>
                  ) : (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">Tốt</span>
                  )}
                </div>
                <div className="text-2xl font-bold text-red-600 mt-1">
                  {overdueCount}
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
            <div className="bg-white dark:bg-slate-900 dark:border-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
                  <span>Đợi duyệt bằng chứng</span>
                  <span className="text-[10px] bg-[#2C69FF]/15 text-[#1E4FC4] px-1.5 py-0.5 rounded font-bold">Chủ nhiệm</span>
                </div>
                <div className="text-2xl font-bold text-[#2C69FF] mt-1">
                  {pendingApprovalsCount}
                </div>
              </div>
              <div className="mt-2">
                {pendingApprovalsCount > 0 ? (
                  <button
                    onClick={() => {
                      const firstPending = tasks.find((t) => t.status === 'pending_approval');
                      if (firstPending) handleOpenReviewModal(firstPending);
                    }}
                    className="text-[11px] font-bold text-[#1F56D6] hover:text-[#1E4FC4] underline cursor-pointer"
                  >
                    Kiểm tra ngay &rarr;
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400">Không có việc tồn đọng</span>
                )}
              </div>
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
            onSelectDeptFilter={setSidebarDeptFilter}
            onSelectStatusFilter={setSidebarStatusFilter}
            onOpenSubmitModal={handleOpenSubmitModal}
            onOpenReviewModal={handleOpenReviewModal}
            onDeleteTask={handleDeleteTask}
            onQuickApprove={handleQuickApprove}
            onOpenBBHParser={() => setIsParserOpen(true)}
            onAddNewManualTask={handleAddNewManualTask}
            onOpenDetail={setDetailTask}
            onUpdateRequest={(task) => setUpdateReqTask({ task, mode: isLeadership ? 'respond' : 'request' })}
          />

        </main>
      </div>

      {/* 4. Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white py-3 text-center text-xs text-slate-500">
        <div className="w-full px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>NITC Command Center &copy; 2026 {clubName}</span>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="text-emerald-600 font-medium">● Server + AI Engine Active</span>
            <span>Phiên bản v3.0 Multi-user</span>
          </div>
        </div>
      </footer>

      {/* 5. Modals System */}

      {/* Modal 1: BBH Input & AI Parser (Ban lãnh đạo + Trưởng/Phó ban họp riêng) */}
      {canManageMeetings && (
        <MeetingParserModal
          isOpen={isParserOpen}
          onClose={() => setIsParserOpen(false)}
          members={members}
          onExtractionSuccess={handleParserSuccess}
        />
      )}

      {/* Modal 2: Presidential Filter (Quy tắc trùng tên, Cảnh báo vắng mặt, Phê duyệt) */}
      {canManageMeetings && (
        <PresidentialFilterModal
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          meetingData={parsedMeetingData || {}}
          draftTasks={parsedDraftTasks}
          members={members}
          authMember={authMember!}
          onPublishTasks={handlePublishTasks}
        />
      )}

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

      {/* Modal 7: Roster & Members Manager (Ban lãnh đạo) */}
      {isLeadership && (
        <RosterManagerModal
          isOpen={isRosterOpen}
          onClose={() => setIsRosterOpen(false)}
          members={members}
          terms={terms}
          selectedTermId={selectedTermId}
          importing={importing}
          onSelectTerm={setSelectedTermId}
          onImportExcel={handleImportExcel}
          onAddMember={handleAddMember}
          onUpdateMember={handleUpdateMember}
          onDeleteMember={handleDeleteMember}
          onActivateTerm={handleActivateTerm}
        />
      )}

      {/* Modal 8: Data Storage & Google Sheets Sync (chỉ Chủ nhiệm) */}
      {isLeadership && (
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
      )}

      {/* Modal: Luồng yêu cầu cập nhật minh chứng */}
      {updateReqTask && (
        <UpdateRequestFlowModal
          task={updateReqTask.task}
          mode={updateReqTask.mode}
          authMember={authMember}
          onClose={() => setUpdateReqTask(null)}
          onDone={handleUpdateRequestDone}
        />
      )}

      {/* Modal: Chi tiết công việc */}
      <TaskDetailModal task={detailTask} members={members} onClose={() => setDetailTask(null)} />

      {/* Modal: Lịch tổng deadline & họp */}
      <CalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        tasks={tasks}
        meetings={meetings}
      />

      {/* Modal: Dashboard phân tích */}
      <DashboardModal
        isOpen={isDashOpen}
        onClose={() => setIsDashOpen(false)}
        tasks={tasks}
        meetings={meetings}
        authMember={authMember}
      />

      {/* Modal: Kho tài liệu (mọi vai trò xem trong phạm vi) */}
      <DocsModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
        terms={terms}
        authMember={authMember}
      />

      {/* Modal 10: Cấu hình hệ thống (chỉ Ban lãnh đạo) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={() => showToast('Đã lưu cấu hình', 'Thang điểm KPI và lịch báo cáo đã được áp dụng.')}
      />

      {/* Modal 9: Bảng xếp hạng & KPI (mọi vai trò đều xem được trong phạm vi của mình) */}
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        authMember={authMember}
      />

    </div>
  );
}

export default App;
