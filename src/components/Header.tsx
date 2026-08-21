import React from 'react';
import {
  ShieldAlert,
  FileText,
  Users,
  Bell,
  Sparkles,
  Database,
  Pin,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Department, Role, Task } from '../types';

interface HeaderProps {
  currentRole: Role;
  currentDepartment: Department;
  currentUserId: string;
  onRoleChange: (role: Role, department: Department, userId: string) => void;
  tasks: Task[];
  onOpenBBHParser: () => void;
  onOpenMeetingHistory: () => void;
  onOpenNagModal: () => void;
  onOpenRosterModal: () => void;
  onOpenDataSyncModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  currentDepartment,
  currentUserId,
  onRoleChange,
  tasks,
  onOpenBBHParser,
  onOpenMeetingHistory,
  onOpenNagModal,
  onOpenRosterModal,
  onOpenDataSyncModal,
}) => {
  // Compute global summary counts
  const totalTasks = tasks.length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const pendingCount = tasks.filter((t) => t.status === 'pending_approval').length;
  const overdueCount = tasks.filter((t) => t.status === 'overdue').length;
  const stickyCount = tasks.filter((t) => t.isSticky && t.status !== 'completed').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const currentUserName =
    currentRole === 'Chủ tịch'
      ? 'Lê Hồng Phúc Minh'
      : currentDepartment === 'Học thuật'
      ? 'Nguyễn Đức Minh'
      : currentDepartment === 'Truyền thông'
      ? 'Trần Thị Thảo Vy'
      : currentDepartment === 'Sự kiện'
      ? 'Võ Hoàng Dũng'
      : 'Phạm Quỳnh Nga';

  return (
    <header className="bg-[#1E293B] border-b border-slate-700 text-white sticky top-0 z-30 shadow-md">
      {/* Top Banner / Brand Header */}
      <div className="w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center font-bold text-white shadow-sm shrink-0">
              N
            </div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-white font-bold tracking-tight text-base sm:text-lg uppercase">
                NITC Command Center
              </h1>
              <span className="hidden sm:inline-flex bg-orange-500/20 text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded border border-orange-500/30 uppercase tracking-wide">
                v2.6 BĐH
              </span>
            </div>
          </div>

          {/* Quick Actions & User Profile */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={onOpenBBHParser}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                title="Trích xuất biên bản họp tự động với AI Brain"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Nhập BBH (AI)</span>
              </button>

              <button
                onClick={onOpenMeetingHistory}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
                title="Kho biên bản họp & Xuất PDF"
              >
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden lg:inline">Kho BBH</span>
              </button>

              <button
                onClick={onOpenNagModal}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition relative cursor-pointer"
                title="Báo cáo tuần & Nhắc nhở The Nag"
              >
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden lg:inline">Nhắc việc</span>
                {overdueCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 absolute -top-0.5 -right-0.5 animate-ping"></span>
                )}
              </button>

              <button
                onClick={onOpenRosterModal}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
                title="Danh bạ & Quản lý Ban"
              >
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden lg:inline">Danh bạ</span>
              </button>

              <button
                onClick={onOpenDataSyncModal}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
                title="Đồng bộ / Xuất Sheets, CSV, JSON"
              >
                <Database className="w-4 h-4" />
              </button>
            </div>

            {/* User Profile */}
            <div className="h-6 w-px bg-slate-700 hidden sm:block"></div>

            <div className="flex items-center gap-2.5 pl-1">
              <div className="flex flex-col items-end text-xs hidden sm:flex">
                <span className="text-slate-400 text-[10px]">
                  {currentRole === 'Chủ tịch' ? 'Chào Chủ tịch,' : `Trưởng ban ${currentDepartment},`}
                </span>
                <span className="text-white font-medium text-xs truncate max-w-[140px]">
                  {currentUserName}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-600 border-2 border-slate-400 flex items-center justify-center font-bold text-xs text-white uppercase shadow-sm">
                {currentRole === 'Chủ tịch' ? '👑' : currentDepartment.charAt(0)}
              </div>
            </div>

          </div>
        </div>

        {/* Secondary Bar: Active Role Switcher */}
        <div className="py-1.5 border-t border-slate-700/70 flex flex-col md:flex-row md:items-center md:justify-between text-xs gap-2">
          {/* Role Switcher */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider mr-1">
              Góc nhìn:
            </span>
            
            <button
              onClick={() => onRoleChange('Chủ tịch', 'Ban Chủ nhiệm', 'mem-1')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                currentRole === 'Chủ tịch'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              👑 Chủ tịch (Admin)
            </button>

            <button
              onClick={() => onRoleChange('Trưởng ban', 'Học thuật', 'mem-2')}
              className={`px-2 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                currentRole === 'Trưởng ban' && currentDepartment === 'Học thuật'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              💻 Học thuật
            </button>

            <button
              onClick={() => onRoleChange('Trưởng ban', 'Truyền thông', 'mem-3')}
              className={`px-2 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                currentRole === 'Trưởng ban' && currentDepartment === 'Truyền thông'
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              📢 Truyền thông
            </button>

            <button
              onClick={() => onRoleChange('Trưởng ban', 'Sự kiện', 'mem-4')}
              className={`px-2 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                currentRole === 'Trưởng ban' && currentDepartment === 'Sự kiện'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              📅 Sự kiện
            </button>

            <button
              onClick={() => onRoleChange('Trưởng ban', 'Đối ngoại', 'mem-5')}
              className={`px-2 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                currentRole === 'Trưởng ban' && currentDepartment === 'Đối ngoại'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              🤝 Đối ngoại
            </button>
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

            {stickyCount > 0 && (
              <div className="flex items-center gap-1 bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 font-semibold" title="Nhiệm vụ chưa xong từ kỳ họp trước">
                <Pin className="w-3 h-3 text-purple-400 rotate-45" />
                <span>Sticky: {stickyCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
