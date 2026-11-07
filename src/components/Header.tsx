import React, { useState } from 'react';
import {
  FileText,
  Bell,
  Sparkles,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  LogOut,
  Calendar,
  Sun,
  Moon,
  Settings as SettingsIcon,
} from 'lucide-react';
import { AppNotification, Member, Task } from '../types';
import { NotificationBell } from './NotificationBell';

interface HeaderProps {
  authMember: Member;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenCalendar: () => void;
  tasks: Task[];
  notifications: AppNotification[];
  unreadCount: number;
  notificationChannel: string;
  onRefreshNotifications: () => void;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onChangeNotificationChannel: (channel: string) => void;
  onOpenBBHParser: () => void;
  onOpenMeetingHistory: () => void;
  onOpenNagModal: () => void;
  onOpenRosterModal: () => void;
  onOpenDataSyncModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  authMember,
  onLogout,
  onOpenSettings,
  onOpenCalendar,
  tasks,
  notifications,
  unreadCount,
  notificationChannel,
  onRefreshNotifications,
  onMarkAllRead,
  onMarkRead,
  onChangeNotificationChannel,
  onOpenBBHParser,
  onOpenMeetingHistory,
  onOpenNagModal,
  onOpenRosterModal,
  onOpenDataSyncModal,
}) => {
  const isPresident = authMember.role === 'Chủ nhiệm';
  const isLeadership = authMember.role === 'Chủ nhiệm' || authMember.role === 'Phó Chủ nhiệm';
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('nitc_theme', next ? 'dark' : 'light');
  };

  // Thống kê phạm vi vai trò (ngày là nguồn sự thật)
  const today = new Date().toISOString().split('T')[0];
  const totalTasks = tasks.length;
  const pendingCount = tasks.filter((t) => t.status === 'pending_approval').length;
  const overdueCount = tasks.filter((t) => t.status !== 'completed' && t.deadline < today).length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const roleLabel = isPresident
    ? 'Chào Chủ nhiệm,'
    : authMember.role === 'Phó Chủ nhiệm'
    ? 'Chào Phó Chủ nhiệm,'
    : authMember.role === 'Trưởng ban' || authMember.role === 'Phó ban'
    ? `${authMember.role} ${authMember.department},`
    : `Thành viên ${authMember.department},`;
  const roleIcon = isPresident ? '👑' : authMember.department.charAt(0);

  const ghostBtn =
    'inline-flex items-center gap-1.5 px-2 py-1.5 md:px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer whitespace-nowrap shrink-0';

  return (
    <header className="bg-[#10192F] border-b border-slate-700 dark:border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="w-full px-3 sm:px-4 md:px-6">
        {/* Hàng chính */}
        <div className="flex items-center justify-between gap-2 h-14">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-8 h-8 bg-[#2C69FF] rounded flex items-center justify-center font-bold text-white shadow-sm shrink-0">
              N
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-bold tracking-tight text-sm sm:text-base md:text-lg uppercase whitespace-nowrap">
                NITC Command Center
              </h1>
              <span className="hidden lg:inline-flex bg-[#2C69FF]/20 text-[#8FB2FF] text-[10px] font-bold px-2 py-0.5 rounded border border-[#2C69FF]/30 uppercase tracking-wide whitespace-nowrap">
                v3.0
              </span>
            </div>
          </div>

          {/* Nhóm nút — icon-only trên mobile, cuộn ngang khi chật */}
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-nowrap overflow-x-auto md:overflow-visible max-w-[62vw] sm:max-w-[70vw] md:max-w-none [scrollbar-width:none]">
            {isLeadership && (
              <button
                onClick={onOpenBBHParser}
                className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-[#2C69FF] hover:bg-[#1F56D6] text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                title="Dán biên bản họp — AI tự trích xuất công việc"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Nhập biên bản (AI)</span>
              </button>
            )}

            <button onClick={onOpenMeetingHistory} className={ghostBtn} title="Lưu trữ biên bản họp & Xuất PDF">
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden md:inline">Kho biên bản</span>
            </button>

            <NotificationBell
              notifications={notifications}
              unread={unreadCount}
              onRefresh={onRefreshNotifications}
              onMarkAllRead={onMarkAllRead}
              onMarkRead={onMarkRead}
              channel={notificationChannel}
              onChangeChannel={onChangeNotificationChannel}
            />

            <button onClick={onOpenCalendar} className={ghostBtn} title="Lịch deadline & kỳ họp">
              <Calendar className="w-3.5 h-3.5 text-violet-400" />
              <span className="hidden md:inline">Lịch</span>
            </button>

            <button
              onClick={toggleTheme}
              className="p-1.5 md:p-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg border border-slate-700 transition cursor-pointer shrink-0"
              title={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            >
              {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {isLeadership && (
              <>
                <button
                  onClick={onOpenSettings}
                  className="hidden md:inline-flex p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer shrink-0"
                  title="Cấu hình hệ thống (điểm KPI, lịch báo cáo tuần...)"
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                </button>
                <button onClick={onOpenRosterModal} className={ghostBtn} title="Danh sách thành viên & Quản lý ban">
                  <span className="hidden md:inline">Danh sách thành viên</span>
                  <span className="md:hidden text-sm">👥</span>
                </button>
                <button
                  onClick={onOpenDataSyncModal}
                  className="hidden md:inline-flex p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer shrink-0"
                  title="Đồng bộ / Xuất Sheets, CSV, JSON"
                >
                  <Database className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Người dùng + đăng xuất */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <div className="hidden lg:flex flex-col items-end text-xs">
              <span className="text-slate-400 text-[10px]">{roleLabel}</span>
              <span className="text-white font-medium text-xs truncate max-w-[140px]">{authMember.name}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-600 border-2 border-slate-400 flex items-center justify-center font-bold text-xs text-white uppercase shadow-sm shrink-0">
              {roleIcon}
            </div>
            <button
              onClick={onLogout}
              title="Đăng xuất"
              className="p-1.5 bg-slate-800 hover:bg-red-600/80 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hàng phụ: phạm vi + chỉ số */}
        <div className="py-1.5 border-t border-slate-700/70 flex items-center justify-between gap-2 text-xs overflow-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800 rounded border border-slate-700 whitespace-nowrap shrink-0 text-[11px]">
              {isLeadership ? '👑 Toàn CLB' : `Phạm vi: ${authMember.department}`}
            </span>
            <span className="italic hidden md:inline">Dữ liệu đồng bộ thời gian thực qua máy chủ</span>
          </div>

          <div className="flex items-center gap-2 md:gap-3 text-slate-300 text-[11px] overflow-x-auto whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Tiến độ: <strong className="text-white">{completionRate}%</strong>
              </span>
            </div>
            {pendingCount > 0 && (
              <div className="flex items-center gap-1 bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 font-semibold">
                <Clock className="w-3 h-3" />
                Chờ duyệt: {pendingCount}
              </div>
            )}
            {overdueCount > 0 && (
              <div className="flex items-center gap-1 bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/30 font-semibold">
                <AlertTriangle className="w-3 h-3" />
                Quá hạn: {overdueCount}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
