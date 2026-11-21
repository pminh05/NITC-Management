import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Plus,
  LayoutGrid,
  AlarmClock,
  Users,
  RefreshCw,
  FileDown,
  Settings as SettingsIcon,
  KeyRound,
  LogOut,
  PanelLeftOpen,
} from 'lucide-react';
import { AppNotification, Member, Task } from '../types';
import { NotificationBell } from './NotificationBell';

interface HeaderProps {
  authMember: Member;
  onLogout: () => void;
  onChangePassword?: () => void;
  onOpenSettings: () => void;
  onOpenCalendar: () => void;
  clubName?: string;
  tasks: Task[];
  notifications: AppNotification[];
  unreadCount: number;
  notificationChannel: string;
  onRefreshNotifications: () => void;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onOpenNotificationTask: (taskId: string) => void;
  onChangeNotificationChannel: (channel: string) => void;
  onOpenBBHParser: () => void;
  onOpenMeetingHistory: () => void;
  onOpenNagModal: () => void;
  /** Hiện mục Nhắc việc (Ban Chủ nhiệm, Trưởng/Phó ban) */
  canNag?: boolean;
  /** Ban Chủ nhiệm: hộp có thêm Báo cáo tuần */
  canWeeklyReport?: boolean;
  onOpenRosterModal: () => void;
  onOpenDataSyncModal: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  /** Nút "Thêm việc" trên header (ẩn nếu người dùng không được tạo việc) */
  onOpenQuickAdd?: () => void;
  canCreateTask?: boolean;
}

/** Menu thả nhỏ: bấm ngoài hay nhấn Esc thì đóng */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

/** Chữ cái đầu của hai chữ cuối trong tên: "Phạm Phúc Minh" → "PM" */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const menuItem =
  'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[14px] text-fg-2 transition hover:bg-surface-2 hover:text-fg cursor-pointer';

export const Header: React.FC<HeaderProps> = ({
  authMember,
  onLogout,
  onChangePassword,
  onOpenSettings,
  notifications,
  unreadCount,
  notificationChannel,
  onRefreshNotifications,
  onMarkAllRead,
  onMarkRead,
  onOpenNotificationTask,
  onChangeNotificationChannel,
  onOpenBBHParser,
  onOpenMeetingHistory,
  onOpenNagModal,
  canNag = false,
  canWeeklyReport = false,
  onOpenRosterModal,
  onOpenDataSyncModal,
  isSidebarOpen = true,
  onToggleSidebar,
  onOpenQuickAdd,
  canCreateTask = false,
}) => {
  const isPresident = authMember.role === 'Chủ nhiệm';
  const isLeadership = authMember.role === 'Chủ nhiệm' || authMember.role === 'Phó Chủ nhiệm';
  const tools = useDropdown();
  const account = useDropdown();

  const roleLabel =
    authMember.role === 'Trưởng ban' || authMember.role === 'Phó ban'
      ? `${authMember.role} ${authMember.department}`
      : authMember.role === 'Thành viên'
        ? `Thành viên ${authMember.department}`
        : authMember.role;

  const runTool = (fn: () => void) => () => {
    tools.setOpen(false);
    fn();
  };

  return (
    <header className="glass-header sticky top-0 z-30 flex h-16 items-center gap-1.5 px-3 sm:gap-2 sm:px-6 lg:px-8">
      {/* Mở lại sidebar khi đã thu gọn (máy tính) */}
      {onToggleSidebar && !isSidebarOpen && (
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden size-10 items-center justify-center rounded-lg text-fg-2 transition hover:bg-black/5 lg:inline-flex cursor-pointer"
          title="Mở thanh bên"
          aria-label="Mở thanh bên"
        >
          <PanelLeftOpen className="size-5" />
        </button>
      )}

      {/* Tên sản phẩm: chỉ hiện khi không có sidebar (điện thoại, hoặc sidebar đã thu gọn) */}
      <div className={`flex min-w-0 items-center gap-2 ${isSidebarOpen ? 'lg:hidden' : ''}`}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary font-display text-[15px] font-bold text-white">
          N
        </span>
        <span className="truncate font-display text-[15px] font-bold text-fg">NITC</span>
      </div>

      <div className="flex-1" />

      {isLeadership && (
        <button
          type="button"
          onClick={onOpenBBHParser}
          className="hidden h-10 shrink-0 items-center gap-2 rounded-[10px] border border-border-strong bg-surface px-3.5 text-[14px] font-medium text-fg-2 transition hover:bg-surface-2 sm:inline-flex cursor-pointer"
          title="Dán biên bản họp — AI tự trích xuất công việc"
        >
          <Sparkles className="size-4" />
          <span className="hidden xl:inline">Nhập biên bản AI</span>
          <span className="xl:hidden">Biên bản AI</span>
        </button>
      )}

      {canCreateTask && onOpenQuickAdd && (
        <button
          type="button"
          onClick={onOpenQuickAdd}
          className="btn-primary hidden h-10 shrink-0 items-center gap-2 rounded-[10px] px-3.5 text-[14px] font-medium transition sm:inline-flex cursor-pointer"
        >
          <Plus className="size-4" />
          Thêm việc
        </button>
      )}

      <NotificationBell
        notifications={notifications}
        unread={unreadCount}
        onRefresh={onRefreshNotifications}
        onMarkAllRead={onMarkAllRead}
        onMarkRead={onMarkRead}
        onOpenTask={onOpenNotificationTask}
        channel={notificationChannel}
        onChangeChannel={onChangeNotificationChannel}
      />

      {/* Công cụ: gom các nút cũ trên header (điện thoại đã có ở thanh dưới) */}
      <div className="relative hidden sm:block" ref={tools.ref}>
        <button
          type="button"
          onClick={() => tools.setOpen((v) => !v)}
          className="inline-flex size-10 items-center justify-center rounded-lg text-fg-2 transition hover:bg-black/5 cursor-pointer"
          title="Công cụ"
          aria-label="Công cụ"
          aria-expanded={tools.open}
        >
          <LayoutGrid className="size-5" />
        </button>
        <div
          data-open={tools.open}
          className="menu-pop absolute right-0 top-12 z-50 w-64 rounded-xl border border-border bg-surface p-1.5 shadow-[0_16px_40px_-12px_rgba(16,24,40,0.22)]"
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Công cụ</p>
          <button type="button" className={menuItem} onClick={runTool(onOpenMeetingHistory)}>
            <FileDown className="size-4" />
            Kho biên bản & xuất PDF
          </button>
          {canNag && (
            <button type="button" className={menuItem} onClick={runTool(onOpenNagModal)}>
              <AlarmClock className="size-4" />
              {canWeeklyReport ? 'Nhắc việc & báo cáo tuần' : 'Nhắc việc quá hạn'}
            </button>
          )}
          {isLeadership && (
            <>
              <button type="button" className={menuItem} onClick={runTool(onOpenRosterModal)}>
                <Users className="size-4" />
                Danh sách thành viên
              </button>
              <button type="button" className={menuItem} onClick={runTool(onOpenDataSyncModal)}>
                <RefreshCw className="size-4" />
                Đồng bộ dữ liệu
              </button>
            </>
          )}
          {isPresident && (
            <button type="button" className={menuItem} onClick={runTool(onOpenSettings)}>
              <SettingsIcon className="size-4" />
              Cài đặt hệ thống
            </button>
          )}
        </div>
      </div>

      {/* Tài khoản */}
      <div className="relative shrink-0" ref={account.ref}>
        <button
          type="button"
          onClick={() => account.setOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-full p-0.5 transition hover:bg-black/5 lg:rounded-xl lg:py-1 lg:pl-1 lg:pr-3 cursor-pointer"
          aria-label="Tài khoản"
          aria-expanded={account.open}
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-[#E0EAFF] text-[12px] font-semibold text-[#3538CD]">
            {initialsOf(authMember.name)}
          </span>
          <span className="hidden min-w-0 text-left lg:block">
            <span className="block max-w-[160px] truncate text-[13px] font-medium leading-tight text-fg">{authMember.name}</span>
            <span className="block max-w-[160px] truncate text-[12px] leading-tight text-muted">{roleLabel}</span>
          </span>
        </button>
        <div
          data-open={account.open}
          className="menu-pop absolute right-0 top-12 z-50 w-60 rounded-xl border border-border bg-surface p-1.5 shadow-[0_16px_40px_-12px_rgba(16,24,40,0.22)]"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-[14px] font-medium text-fg">{authMember.name}</p>
            <p className="truncate text-[12px] text-muted">{roleLabel}</p>
          </div>
          {onChangePassword && (
            <button
              type="button"
              className={menuItem}
              onClick={() => {
                account.setOpen(false);
                onChangePassword();
              }}
            >
              <KeyRound className="size-4" />
              Đổi mật khẩu
            </button>
          )}
          <button
            type="button"
            className={`${menuItem} hover:!text-danger`}
            onClick={() => {
              account.setOpen(false);
              onLogout();
            }}
          >
            <LogOut className="size-4" />
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
};
