import React from 'react';
import {
  FileText,
  Users,
  Sparkles,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  LogOut,
} from 'lucide-react';
import { AppNotification, Member, Task } from '../types';
import { isTaskOverdue } from '../utils/dateUtils';
import { NotificationBell } from './NotificationBell';

interface HeaderProps {
  authMember: Member;
  onLogout: () => void;
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
  // Trưởng/Phó ban được đọc biên bản & họp riêng ban mình
  const canManageMeetings = isLeadership || authMember.role === 'Trưởng ban' || authMember.role === 'Phó ban';

  // Compute summary counts theo phạm vi dữ liệu mà vai trò được xem
  const totalTasks = tasks.length;
  const pendingCount = tasks.filter((t) => t.status === 'pending_approval').length;
  const overdueCount = tasks.filter(isTaskOverdue).length;
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

  return (
    <header className="bg-[#10192F] border-b border-slate-700 text-white sticky top-0 z-30 shadow-md">
      {/* Top Banner / Brand Header */}
      <div className="w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">

          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#2C69FF]/100 rounded flex items-center justify-center font-bold text-white shadow-sm shrink-0">
              N
            </div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-white font-bold tracking-tight text-base sm:text-lg uppercase">
                NITC Command Center
              </h1>
              <span className="hidden sm:inline-flex bg-[#2C69FF]/15 text-[#6C9BFF] text-[10px] font-bold px-2 py-0.5 rounded border border-[#2C69FF]/40 uppercase tracking-wide">
                v3.0 BĐH
              </span>
            </div>
          </div>

          {/* Quick Actions & User Profile */}
          <div className="flex items-center gap-2 sm:gap-4">

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {canManageMeetings && (
                <button
                  onClick={onOpenBBHParser}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2C69FF]/100 hover:bg-[#1F56D6] text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                  title="Dán biên bản họp — AI tự trích xuất công việc"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Nhập biên bản (AI)</span>
                </button>
              )}

              <button
                onClick={onOpenMeetingHistory}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
                title="Lưu trữ biên bản họp & Xuất PDF"
              >
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden lg:inline">Kho biên bản</span>
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

              {isLeadership && (
                <>
                  <button
                    onClick={onOpenRosterModal}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
                    title="Danh sách thành viên & Quản lý ban"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden lg:inline">Danh sách thành viên</span>
                  </button>

                  <button
                    onClick={onOpenDataSyncModal}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
                    title="Đồng bộ / Xuất Sheets, CSV, JSON"
                  >
                    <Database className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* User Profile + Logout */}
            <div className="h-6 w-px bg-slate-700 hidden sm:block"></div>

            <div className="flex items-center gap-2.5 pl-1">
              <div className="flex flex-col items-end text-xs hidden sm:flex">
                <span className="text-slate-400 text-[10px]">{roleLabel}</span>
                <span className="text-white font-medium text-xs truncate max-w-[140px]">
                  {authMember.name}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-600 border-2 border-slate-400 flex items-center justify-center font-bold text-xs text-white uppercase shadow-sm">
                {roleIcon}
              </div>
              <button
                onClick={onLogout}
                title="Đăng xuất"
                className="p-1.5 bg-slate-800 hover:bg-red-600/80 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>

        {/* Secondary Bar: Metrics (theo phạm vi vai trò) */}
        <div className="py-1.5 border-t border-slate-700/70 flex flex-col md:flex-row md:items-center md:justify-between text-xs gap-2">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-800 rounded border border-slate-700">
              <span>{isLeadership ? '👑 Toàn CLB' : `Phạm vi: ${authMember.department}`}</span>
            </span>
            <span className="italic">Đăng nhập bằng tài khoản cá nhân — dữ liệu đồng bộ thời gian thực qua máy chủ</span>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-3 text-slate-300 overflow-x-auto text-[11px]">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tiến độ: <strong className="text-white">{completionRate}%</strong></span>
            </div>

            {pendingCount > 0 && (
              <div className="flex items-center gap-1 bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 font-semibold">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>Chờ duyệt: {pendingCount}</span>
              </div>
            )}

            {overdueCount > 0 && (
              <div className="flex items-center gap-1 bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/30 font-semibold">
                <AlertTriangle className="w-3 h-3 text-red-400" />
                <span>Quá hạn: {overdueCount}</span>
              </div>
            )}

          </div>
        </div>
      </div>
    </header>
  );
};
