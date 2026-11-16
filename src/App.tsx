import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
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
import {
  api,
  apiUpload,
  getToken,
  setToken,
  PASSWORD_CHANGE_REQUIRED_EVENT,
  SESSION_EXPIRED_EVENT,
} from './api/client';
import { AppNotification } from './types';
import { Header } from './components/Header';
import { LoginPage } from './components/LoginPage';
import { TaskBoard } from './components/TaskBoard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EvidenceSubmitModal } from './components/EvidenceSubmitModal';
import { EvidenceReviewModal } from './components/EvidenceReviewModal';
import { TaskDetailModal } from './components/TaskDetailModal';
import { UpdateRequestFlowModal } from './components/UpdateRequestFlowModal';
import { QuickAddTaskModal } from './components/QuickAddTaskModal';
import { RemindConfirmModal } from './components/RemindConfirmModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ChangePasswordModal } from './components/ChangePasswordModal';

// Các hộp thoại lớn tải theo nhu cầu (tách khỏi gói JS đầu vào) và được tải sẵn lúc trình duyệt rảnh
// sau khi đăng nhập — trang đầu nhẹ hơn mà lần mở đầu tiên vẫn không phải chờ.
const modalLoaders = {
  MeetingParserModal: () => import('./components/MeetingParserModal').then((m) => ({ default: m.MeetingParserModal })),
  PresidentialFilterModal: () => import('./components/PresidentialFilterModal').then((m) => ({ default: m.PresidentialFilterModal })),
  TheNagWeeklyReport: () => import('./components/TheNagWeeklyReport').then((m) => ({ default: m.TheNagWeeklyReport })),
  MeetingHistoryModal: () => import('./components/MeetingHistoryModal').then((m) => ({ default: m.MeetingHistoryModal })),
  RosterManagerModal: () => import('./components/RosterManagerModal').then((m) => ({ default: m.RosterManagerModal })),
  DataSyncModal: () => import('./components/DataSyncModal').then((m) => ({ default: m.DataSyncModal })),
  LeaderboardModal: () => import('./components/LeaderboardModal').then((m) => ({ default: m.LeaderboardModal })),
  SettingsModal: () => import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal })),
  CalendarModal: () => import('./components/CalendarModal').then((m) => ({ default: m.CalendarModal })),
  DocsModal: () => import('./components/DocsModal').then((m) => ({ default: m.DocsModal })),
  DashboardModal: () => import('./components/DashboardModal').then((m) => ({ default: m.DashboardModal })),
};
const MeetingParserModal = lazy(modalLoaders.MeetingParserModal);
const PresidentialFilterModal = lazy(modalLoaders.PresidentialFilterModal);
const TheNagWeeklyReport = lazy(modalLoaders.TheNagWeeklyReport);
const MeetingHistoryModal = lazy(modalLoaders.MeetingHistoryModal);
const RosterManagerModal = lazy(modalLoaders.RosterManagerModal);
const DataSyncModal = lazy(modalLoaders.DataSyncModal);
const LeaderboardModal = lazy(modalLoaders.LeaderboardModal);
const SettingsModal = lazy(modalLoaders.SettingsModal);
const CalendarModal = lazy(modalLoaders.CalendarModal);
const DocsModal = lazy(modalLoaders.DocsModal);
const DashboardModal = lazy(modalLoaders.DashboardModal);
function preloadModals() {
  Object.values(modalLoaders).forEach((load) => load().catch(() => {}));
}
import { confirmDialog, toast } from './components/ui/Feedback';
import {
  canDestructiveAdmin,
  canManageRoster,
  canPublishMeeting,
  canResetMemberPassword,
  canReviewTask,
  canViewLogs,
  canUseNag,
  canViewWeeklyReport,
  isLeadership as isLeadershipRole,
} from '../shared/permissions';
import {
  Pin,
  CheckCircle2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

export function App() {
  // ===== 0. Auth state (đăng nhập thật qua JWT) =====
  const [authMember, setAuthMember] = useState<Member | null>(null);
  const [booting, setBooting] = useState(true);
  // Đã đăng nhập nhưng còn dùng mật khẩu mặc định → phải đổi mật khẩu xong mới vào được hệ thống
  const [pendingMember, setPendingMember] = useState<Member | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);

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
  // Quyền suy ra từ shared/permissions.ts — đúng bộ quy tắc mà server đang áp dụng
  const actor = { id: currentUserId, role: currentRole, department: currentDepartment };
  const isLeadership = isLeadershipRole(actor);
  // Ban quản lý được họp riêng & ban hành việc của ban mình
  const canManageMeetings = canPublishMeeting(actor);

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
        const res = await api<{ member: Member; mustChangePassword?: boolean }>('/auth/me');
        if (res.mustChangePassword) setPendingMember(res.member);
        else setAuthMember(res.member);
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
    await api(`/notifications/${id}/read`, { method: 'POST' }).catch(() => { });
  }, [notifications]);

  // Bấm thông báo có gắn công việc -> mở chi tiết (tải lại nếu chưa có trong state)
  const openTaskFromNotification = useCallback(
    async (taskId: string) => {
      let t = tasks.find((x) => x.id === taskId);
      if (!t) {
        try {
          const all = await api<Task[]>('/tasks');
          setTasks(all);
          t = all.find((x) => x.id === taskId);
        } catch {
          return;
        }
      }
      if (t) setDetailTask(t);
    },
    [tasks]
  );

  const handleMarkAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    setUnreadCount(0);
    await api('/notifications/read-all', { method: 'POST' }).catch(() => { });
  }, []);

  const handleChangeNotificationChannel = useCallback(async (channel: string) => {
    setNotificationChannel(channel);
    await api('/notifications/prefs', { method: 'PUT', body: { channel } }).catch(() => { });
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
      if (canViewLogs(me)) {
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
      .catch(() => { });
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

  // Sau khi đăng nhập, tải sẵn mã các hộp thoại lúc trình duyệt rảnh → lần mở đầu tiên không phải chờ
  useEffect(() => {
    if (!authMember) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(preloadModals);
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(preloadModals, 1500);
    return () => window.clearTimeout(t);
  }, [authMember]);

  const handleLogout = useCallback(() => {
    setToken(null);
    setAuthMember(null);
    setPendingMember(null);
    setIsChangePasswordOpen(false);
    setTasks([]);
    setMeetings([]);
    setMembers([]);
    setLogs([]);
  }, []);

  // Phiên hết hiệu lực giữa chừng (token hết hạn, mật khẩu đã đổi, tài khoản bị ngưng) → về trang đăng nhập.
  // Server báo phải đổi mật khẩu mặc định → chuyển sang màn hình đổi mật khẩu bắt buộc.
  useEffect(() => {
    const onSessionExpired = (e: Event) => {
      handleLogout();
      setLoginNotice((e as CustomEvent<string>).detail || 'Phiên đăng nhập đã hết hiệu lực, vui lòng đăng nhập lại.');
    };
    const onPasswordChangeRequired = () => {
      setAuthMember((current) => {
        if (current) setPendingMember(current);
        return null;
      });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    window.addEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, onPasswordChangeRequired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
      window.removeEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, onPasswordChangeRequired);
    };
  }, [handleLogout]);

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
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [remindTask, setRemindTask] = useState<Task | null>(null);
  const [updateReqTask, setUpdateReqTask] = useState<{ task: Task; mode: 'request' | 'respond' } | null>(null);
  const [clubName, setClubName] = useState('CLB Công nghệ thông tin NITC');

  // Modal payload state
  const [parsedMeetingData, setParsedMeetingData] = useState<Partial<Meeting> | null>(null);
  const [parsedDraftTasks, setParsedDraftTasks] = useState<ExtractedDraftTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  // Thông báo góc màn hình: mỗi thông báo có đồng hồ riêng, xếp chồng tối đa 3 (components/ui/Feedback.tsx)
  const showToast = (title: string, desc: string, type: 'success' | 'info' | 'warn' = 'success') => toast(title, desc, type);

  const showError = (e: any) => {
    showToast('Có lỗi xảy ra', e?.message || 'Không thực hiện được thao tác', 'warn');
  };

  // ===== 3. Flow Handlers =====

  // Step 1 -> Step 2: AI Parser finished parsing BBH
  const handleParserSuccess = (
    meetingData: Partial<Meeting>,
    extractedTasks: ExtractedDraftTask[],
    rawText: string
  ) => {
    setParsedMeetingData({
      ...meetingData,
      rawContent: rawText || meetingData.rawContent || '',
    });
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

  /**
   * Cập nhật lạc quan: đổi thẻ công việc NGAY khi bấm (không chờ server), rồi thay bằng bản server trả về.
   * Server từ chối (sai quyền, sai trạng thái, mất mạng…) → trả thẻ về như cũ và báo lỗi.
   */
  const updateTaskOptimistic = async (
    taskId: string,
    patch: Partial<Task>,
    body: Record<string, unknown>
  ): Promise<Task | null> => {
    const previous = tasks.find((t) => t.id === taskId);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
    try {
      const updated = await api<Task>(`/tasks/${taskId}`, { method: 'PUT', body });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      return updated;
    } catch (e) {
      if (previous) setTasks((prev) => prev.map((t) => (t.id === taskId ? previous : t)));
      showError(e);
      return null;
    }
  };

  const handleEvidenceSubmit = async (taskId: string, evidenceData: { link?: string; report?: string }) => {
    // Đóng hộp nộp ngay — thẻ chuyển sang "Chờ duyệt" tức thì, không bấm được hai lần
    setIsSubmitOpen(false);
    setSelectedTask(null);
    const updated = await updateTaskOptimistic(
      taskId,
      {
        status: 'pending_approval',
        evidenceLink: evidenceData.link,
        evidenceReport: evidenceData.report,
        evidenceSubmittedAt: new Date().toISOString(),
      },
      { action: 'submit_evidence', ...evidenceData }
    );
    if (updated) {
      showToast(
        'Đã gửi minh chứng!',
        'Nhiệm vụ đã chuyển sang trạng thái "Chờ duyệt". Ban lãnh đạo hoặc Trưởng/Phó ban sẽ nghiệm thu.',
        'info'
      );
    }
  };

  // Step 4: Evidence Review by President
  const handleUpdateRequestDone = async (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setUpdateReqTask(null);
    if (updated.updateRequestedAt) {
      showToast('Đã gửi yêu cầu sửa minh chứng', 'Người duyệt sẽ xem xét và phản hồi qua thông báo.');
    } else {
      showToast(
        'Đã phản hồi yêu cầu',
        updated.status === 'in_progress'
          ? 'Việc trở về "Đang làm" — người làm có thể nộp lại minh chứng.'
          : 'Minh chứng hiện tại được giữ nguyên, việc vẫn chờ duyệt.'
      );
    }
  };

  const handleOpenReviewModal = (task: Task) => {
    setSelectedTask(task);
    setIsReviewOpen(true);
  };

  const celebrate = () => {
    try {
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
    } catch {
      // ignore
    }
  };

  const handleApproveEvidence = async (taskId: string, approvalNote?: string) => {
    setIsReviewOpen(false);
    setSelectedTask(null);
    const updated = await updateTaskOptimistic(
      taskId,
      { status: 'completed', updateRequestedAt: undefined },
      { action: 'approve', note: approvalNote }
    );
    if (updated) {
      celebrate();
      showToast('Đã duyệt hoàn thành!', 'Nhiệm vụ đã được nghiệm thu và đánh dấu Hoàn thành ✅');
    }
  };

  const handleRejectEvidence = async (taskId: string, rejectReason: string) => {
    setIsReviewOpen(false);
    setSelectedTask(null);
    const updated = await updateTaskOptimistic(
      taskId,
      { status: 'in_progress', rejectedReason: rejectReason, updateRequestedAt: undefined },
      { action: 'reject', reason: rejectReason }
    );
    if (updated) {
      showToast('Đã yêu cầu nộp lại!', 'Nhiệm vụ đã được trả về cho thành viên kèm ghi chú chỉnh sửa.', 'warn');
    }
  };

  // Quick 1-click approve for president
  const handleQuickApprove = async (taskId: string) => {
    const updated = await updateTaskOptimistic(
      taskId,
      { status: 'completed' },
      { action: 'approve', note: 'Chủ nhiệm duyệt nhanh hoàn thành.' }
    );
    if (updated) {
      celebrate();
      showToast('Duyệt nhanh!', 'Đã đánh dấu hoàn thành nhiệm vụ.');
    }
  };

  // Bấm nút Nhắc nộp -> mở Modal Xác nhận (tránh bấm nhầm)
  const handleOpenRemindConfirm = (task: Task) => {
    setRemindTask(task);
  };

  // Nhắc việc từ hộp "Nhắc việc quá hạn" (không hỏi lại — người dùng đã chủ động bấm trong hộp)
  const handleNagRemind = async (task: Task): Promise<boolean> => {
    try {
      await api(`/tasks/${task.id}/remind`, { method: 'POST', body: {} });
      try {
        setLogs(await api<NotificationLog[]>('/logs'));
      } catch {
        // không đọc được nhật ký thì bỏ qua
      }
      return true;
    } catch (e) {
      showError(e);
      return false;
    }
  };

  // Xác nhận gửi nhắc nộp từ Modal
  const handleConfirmRemind = async (task: Task, note?: string) => {
    try {
      const res = await api<{ success: boolean; message: string; remindedCount: number }>(
        `/tasks/${task.id}/remind`,
        { method: 'POST', body: { note } }
      );
      showToast('Đã gửi lời nhắc! 🔔', res.message || `Đã gửi thông báo đôn đốc cho ${task.assigneeName}!`, 'info');
      refreshNotifications();
    } catch (e) {
      showError(e);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    const ok = await confirmDialog({
      title: 'Xóa nhiệm vụ này?',
      message: 'Nhiệm vụ và minh chứng đã nộp sẽ bị xóa vĩnh viễn.',
      confirmText: 'Xóa',
      danger: true,
    });
    if (!ok) return;
    // Gỡ thẻ ngay; server từ chối thì đưa thẻ trở lại đúng vị trí cũ
    const index = tasks.findIndex((t) => t.id === taskId);
    const removed = tasks[index];
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await api(`/tasks/${taskId}`, { method: 'DELETE' });
      showToast('Đã xóa', 'Nhiệm vụ đã được xóa khỏi hệ thống.', 'info');
    } catch (e) {
      if (removed) {
        setTasks((prev) => {
          if (prev.some((t) => t.id === taskId)) return prev;
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, removed);
          return next;
        });
      }
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

  // Chủ nhiệm đặt lại mật khẩu của thành viên về mặc định (khi họ quên mật khẩu)
  const handleResetMemberPassword = async (member: Member) => {
    const ok = await confirmDialog({
      title: `Đặt lại mật khẩu của ${member.name}?`,
      message: 'Phiên đăng nhập hiện tại của họ sẽ hết hiệu lực và họ phải đổi mật khẩu ở lần đăng nhập tới.',
      confirmText: 'Đặt lại',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api<{ success: boolean; message: string }>(`/members/${member.id}/reset-password`, {
        method: 'POST',
      });
      showToast('Đã đặt lại mật khẩu', res.message, 'info');
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
        `Nhiệm kỳ ${s.term}${s.mode === 'archive' ? ' (lưu trữ — nhiệm kỳ hiện hành giữ nguyên)' : s.mode === 'newer' ? ' (đã thành nhiệm kỳ hiện hành)' : ''}: +${s.created} mới, cập nhật ${s.updated}, bỏ qua ${s.skipped}.`
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
  // Tạo nhiệm kỳ mới không cần file Excel — chưa đặt làm hiện hành (tránh danh bạ hiện hành bị rỗng)
  const handleCreateTerm = async (name: string): Promise<boolean> => {
    try {
      const created = await api<Term>('/terms', { method: 'POST', body: { name } });
      const t = await api<Term[]>('/terms');
      setTerms(t);
      setSelectedTermId(created.id);
      showToast(
        `Đã tạo nhiệm kỳ ${created.name}`,
        'Đang xem nhiệm kỳ mới (chưa có thành viên). Import danh bạ hoặc bấm "Đặt hiện hành" khi sẵn sàng chuyển nhiệm kỳ.',
        'info'
      );
      return true;
    } catch (e) {
      showError(e);
      return false;
    }
  };

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
  // Việc chờ duyệt mà CHÍNH người đang đăng nhập có quyền duyệt (cùng quy tắc với server)
  const reviewableCount = tasks.filter((t) => t.status === 'pending_approval' && canReviewTask(actor, t)).length;
  const overdueCount = tasks.filter(isTaskOverdue).length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const completionRate = totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 0;

  // Selected quick filter from sidebar
  const [sidebarDeptFilter, setSidebarDeptFilter] = useState<string>('all');
  const [sidebarStatusFilter, setSidebarStatusFilter] = useState<string>('all');

  // Trạng thái hiển thị thanh sidebar (cho phép ẩn/hiện, lưu vào localStorage)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('nitc_sidebar_open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('nitc_sidebar_open', String(next));
      } catch {}
      return next;
    });
  };

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

  if (pendingMember) {
    return (
      <ChangePasswordModal
        forced
        memberName={`${pendingMember.name} — ${pendingMember.role}`}
        onLogout={handleLogout}
        onChanged={(m) => {
          setPendingMember(null);
          setAuthMember(m);
        }}
      />
    );
  }

  if (!authMember) {
    return (
      <LoginPage
        notice={loginNotice}
        onLogin={(m, mustChangePassword) => {
          setLoginNotice(null);
          if (mustChangePassword) setPendingMember(m);
          else setAuthMember(m);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased selection:bg-[#2C69FF]/100 selection:text-white">

      {/* Toast Notification */}
      {/* 1. Global Navigation Header */}
      <Header
        authMember={authMember}
        onLogout={handleLogout}
        onChangePassword={() => setIsChangePasswordOpen(true)}
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
        onOpenNotificationTask={openTaskFromNotification}
        onChangeNotificationChannel={handleChangeNotificationChannel}
        onOpenBBHParser={() => setIsParserOpen(true)}
        onOpenMeetingHistory={() => setIsMeetingHistoryOpen(true)}
        onOpenNagModal={() => setIsNagOpen(true)}
        canNag={canUseNag(actor)}
        canWeeklyReport={canViewWeeklyReport(actor)}
        onOpenRosterModal={() => setIsRosterOpen(true)}
        onOpenDataSyncModal={() => setIsDataSyncOpen(true)}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={handleToggleSidebar}
      />

      {/* 2. High Density Dashboard Layout: Sidebar + Main Area */}
      <div className="flex flex-1 w-full relative">

        {/* Nút nổi mở nhanh thanh bên khi Sidebar bị ẩn */}
        {!isSidebarOpen && (
          <button
            onClick={handleToggleSidebar}
            className="hidden lg:flex fixed left-3 top-18 z-30 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md text-slate-700 dark:text-slate-200 hover:text-[#2C69FF] hover:border-[#2C69FF] transition items-center gap-2 text-xs font-semibold cursor-pointer animate-in fade-in slide-in-from-left-2 duration-150"
            title="Mở thanh bên (Sidebar)"
          >
            <PanelLeftOpen className="w-4 h-4 text-[#2C69FF]" />
            <span>Mở menu</span>
          </button>
        )}

        {/* High Density Desktop Sidebar - Cố định khi cuộn trang, cho phép ẩn/hiện */}
        {isSidebarOpen && (
          <aside className="w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 hidden lg:flex flex-col shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto z-20 animate-in fade-in duration-200">
            <div className="p-4 space-y-1">
              <div className="flex items-center justify-between mb-2 px-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Hệ thống
                </span>
                <button
                  onClick={handleToggleSidebar}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Thu gọn thanh bên"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>
            <button
              onClick={() => {
                setSidebarDeptFilter('all');
                setSidebarStatusFilter('all');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold transition cursor-pointer ${sidebarDeptFilter === 'all' && sidebarStatusFilter === 'all'
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

          <div className="p-4 space-y-1 border-t border-slate-100 dark:border-slate-800">
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
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition cursor-pointer ${isSelected
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

          {/* Xuất PDF biên bản & Phiên bản - Được đẩy lên ngay dưới danh sách ban, luôn hiển thị */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
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
      )}

        {/* Main Content Pane */}
        <main className="flex-1 min-w-0 flex flex-col p-3 sm:p-5 md:p-6 gap-4 sm:gap-5 max-w-full overflow-x-hidden pb-24 lg:pb-6">

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
            onUpdateRequest={(task) => setUpdateReqTask({ task, mode: 'request' })}
            onRemindTask={handleOpenRemindConfirm}
          />

        </main>
      </div>

      {/* 4. Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white py-3 pb-20 lg:pb-3 text-center text-xs text-slate-500">
        <div className="w-full px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>NITC Command Center &copy; 2026 {clubName}</span>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="text-emerald-600 font-medium">● Server + AI Engine Active</span>
            <span>Phiên bản v3.0 Multi-user</span>
          </div>
        </div>
      </footer>

      {/* 5. Modals System — modal tải theo nhu cầu nằm trong Suspense (chưa tải xong thì chưa hiện gì) */}
      <Suspense fallback={null}>

      {/* Modal 1: BBH Input & AI Parser (Ban lãnh đạo + Trưởng/Phó ban họp riêng) */}
      {canManageMeetings && isParserOpen && (
        <MeetingParserModal
          isOpen={isParserOpen}
          onClose={() => setIsParserOpen(false)}
          members={members}
          onExtractionSuccess={handleParserSuccess}
        />
      )}

      {/* Modal 2: Presidential Filter (Quy tắc trùng tên, Cảnh báo vắng mặt, Phê duyệt) */}
      {canManageMeetings && isFilterOpen && (
        <ErrorBoundary fallbackTitle="Lỗi hiển thị Màn hình Đối soát nhiệm vụ">
          <PresidentialFilterModal
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            meetingData={parsedMeetingData || {}}
            draftTasks={parsedDraftTasks}
            members={members}
            authMember={authMember!}
            onPublishTasks={handlePublishTasks}
          />
        </ErrorBoundary>
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
      {isNagOpen && canUseNag(actor) && (
      <TheNagWeeklyReport
        actor={actor}
        onRemindTask={handleNagRemind}
        isOpen={isNagOpen}
        onClose={() => setIsNagOpen(false)}
        tasks={tasks}
        members={members}
        logs={logs}
        onSendNotification={handleSendNotification}
      />
      )}

      {/* Modal 6: Meeting Minutes Archive & Official PDF Export */}
      {isMeetingHistoryOpen && (
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
      )}

      {/* Modal 7: Roster & Members Manager (Ban lãnh đạo) */}
      {canManageRoster(actor) && isRosterOpen && (
        <RosterManagerModal
          viewer={actor}
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
          onCreateTerm={handleCreateTerm}
          onResetPassword={canResetMemberPassword(actor) ? handleResetMemberPassword : undefined}
        />
      )}

      {/* Modal 8: Data Storage & Google Sheets Sync (chỉ Chủ nhiệm) */}
      {isLeadership && isDataSyncOpen && (
        <DataSyncModal
          isOpen={isDataSyncOpen}
          onClose={() => setIsDataSyncOpen(false)}
          tasks={tasks}
          meetings={meetings}
          members={members}
          logs={logs}
          onImportAllData={handleImportAllData}
          onResetToDemo={handleResetToDemo}
          canDestructive={canDestructiveAdmin(actor)}
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
      <TaskDetailModal
        task={detailTask}
        members={members}
        currentUserId={currentUserId}
        currentRole={currentRole}
        currentDepartment={currentDepartment}
        onClose={() => setDetailTask(null)}
        onOpenSubmitModal={(task) => {
          setDetailTask(null);
          handleOpenSubmitModal(task);
        }}
        onOpenReviewModal={(task) => {
          setDetailTask(null);
          handleOpenReviewModal(task);
        }}
        onRemindTask={handleOpenRemindConfirm}
      />

      {/* Modal: Xác nhận nhắc nộp minh chứng (tránh ấn nhầm) */}
      <RemindConfirmModal
        isOpen={Boolean(remindTask)}
        task={remindTask}
        members={members}
        onClose={() => setRemindTask(null)}
        onConfirm={handleConfirmRemind}
      />

      {/* Modal: Lịch tổng deadline & họp */}
      {isCalendarOpen && (
      <CalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        tasks={tasks}
        meetings={meetings}
        onOpenDetail={setDetailTask}
      />
      )}

      {/* Modal: Dashboard phân tích */}
      {isDashOpen && (
      <DashboardModal
        isOpen={isDashOpen}
        onClose={() => setIsDashOpen(false)}
        tasks={tasks}
        meetings={meetings}
        authMember={authMember}
      />
      )}

      {/* Modal: Kho tài liệu (mọi vai trò xem trong phạm vi) */}
      {isDocsOpen && (
      <DocsModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
        terms={terms}
        authMember={authMember}
      />
      )}

      {/* Modal 10: Cấu hình hệ thống (chỉ Ban lãnh đạo) */}
      {isSettingsOpen && (
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={() => showToast('Đã lưu cấu hình', 'Thang điểm KPI và lịch báo cáo đã được áp dụng.')}
      />
      )}

      {/* Modal 9: Bảng xếp hạng & KPI (mọi vai trò đều xem được trong phạm vi của mình) */}
      {isLeaderboardOpen && (
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        authMember={authMember}
      />
      )}

      </Suspense>

      {/* Modal: Quick Add Task (Mở từ FAB mobile hoặc thao tác nhanh) */}
      <QuickAddTaskModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        members={members}
        onAdd={handleAddNewManualTask}
      />

      {/* 11. Mobile Bottom Navigation Bar (Cố định ở đáy màn hình di động) */}
      <MobileBottomNav
        authMember={authMember}
        canManageMeetings={canManageMeetings}
        isLeadership={isLeadership}
        activeTasksCount={inProgressCount + pendingApprovalsCount}
        overdueCount={overdueCount}
        onOpenBBHParser={() => setIsParserOpen(true)}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenDashboard={() => setIsDashOpen(true)}
        onOpenCalendar={() => setIsCalendarOpen(true)}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        onOpenDocs={() => setIsDocsOpen(true)}
        onOpenNag={() => setIsNagOpen(true)}
        canNag={canUseNag(actor)}
        onOpenMeetingHistory={() => setIsMeetingHistoryOpen(true)}
        onOpenRoster={() => setIsRosterOpen(true)}
        onOpenDataSync={() => setIsDataSyncOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onChangePassword={() => setIsChangePasswordOpen(true)}
        onLogout={handleLogout}
      />

      {/* Modal: Đổi mật khẩu (tự nguyện — mở từ Header / menu di động) */}
      {isChangePasswordOpen && (
        <ChangePasswordModal
          memberName={`${authMember.name} — ${authMember.role}`}
          onClose={() => setIsChangePasswordOpen(false)}
          onChanged={() => {
            setIsChangePasswordOpen(false);
            showToast(
              'Đã đổi mật khẩu',
              'Mật khẩu mới có hiệu lực ngay. Các phiên đăng nhập cũ trên thiết bị khác đã bị đăng xuất.'
            );
          }}
        />
      )}

    </div>
  );
}

export default App;
