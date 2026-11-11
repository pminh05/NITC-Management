import React, { useState } from 'react';
import {
  ListTodo,
  BarChart3,
  Plus,
  Calendar,
  Menu,
  X,
  Sparkles,
  FileText,
  AlertTriangle,
  Trophy,
  FolderClosed,
  Users,
  Database,
  Settings as SettingsIcon,
  LogOut,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { Member, Role } from '../types';

interface MobileBottomNavProps {
  authMember: Member;
  canManageMeetings: boolean;
  isLeadership: boolean;
  activeTasksCount: number;
  overdueCount: number;
  onOpenBBHParser: () => void;
  onOpenQuickAdd: () => void;
  onOpenDashboard: () => void;
  onOpenCalendar: () => void;
  onOpenLeaderboard: () => void;
  onOpenDocs: () => void;
  onOpenNag: () => void;
  onOpenMeetingHistory: () => void;
  onOpenRoster: () => void;
  onOpenDataSync: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  authMember,
  canManageMeetings,
  isLeadership,
  activeTasksCount,
  overdueCount,
  onOpenBBHParser,
  onOpenQuickAdd,
  onOpenDashboard,
  onOpenCalendar,
  onOpenLeaderboard,
  onOpenDocs,
  onOpenNag,
  onOpenMeetingHistory,
  onOpenRoster,
  onOpenDataSync,
  onOpenSettings,
  onLogout,
}) => {
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);

  const handleScrollToBoard = () => {
    const el = document.getElementById('task-board');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const roleBadge =
    authMember.role === 'Chủ nhiệm'
      ? 'Chủ nhiệm CLB'
      : authMember.role === 'Phó Chủ nhiệm'
      ? 'Phó Chủ nhiệm'
      : `${authMember.role} • ${authMember.department}`;

  return (
    <>
      {/* 1. FIXED BOTTOM NAVIGATION BAR */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] flex items-center justify-around select-none"
      >
        {/* Tab 1: Bảng việc */}
        <button
          type="button"
          onClick={handleScrollToBoard}
          className="flex-1 py-1 flex flex-col items-center justify-center text-slate-600 hover:text-[#2C69FF] active:scale-95 transition cursor-pointer relative"
        >
          <div className="relative">
            <ListTodo className="w-5 h-5 text-slate-700" />
            {activeTasksCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#2C69FF] text-white font-mono text-[9px] font-bold flex items-center justify-center shadow-xs">
                {activeTasksCount > 99 ? '99+' : activeTasksCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold text-slate-700 mt-0.5">Bảng việc</span>
        </button>

        {/* Tab 2: Dashboard */}
        <button
          type="button"
          onClick={onOpenDashboard}
          className="flex-1 py-1 flex flex-col items-center justify-center text-slate-600 hover:text-[#2C69FF] active:scale-95 transition cursor-pointer"
        >
          <BarChart3 className="w-5 h-5 text-slate-700" />
          <span className="text-[10px] font-bold text-slate-700 mt-0.5">Thống kê</span>
        </button>

        {/* Tab 3: Center Elevated Action Button (FAB) */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <button
            type="button"
            onClick={() => {
              setIsActionSheetOpen(!isActionSheetOpen);
              if (isMoreDrawerOpen) setIsMoreDrawerOpen(false);
            }}
            className={`w-12 h-12 -mt-5 rounded-full bg-gradient-to-tr from-[#1E4FC4] to-[#2C69FF] text-white shadow-lg shadow-blue-500/35 border-2 border-white flex items-center justify-center transition-all duration-200 active:scale-90 hover:scale-105 cursor-pointer ${
              isActionSheetOpen ? 'rotate-45' : 'rotate-0'
            }`}
            title="Thao tác nhanh"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
          <span className="text-[10px] font-bold text-[#1E4FC4] mt-0.5">Tạo mới</span>
        </div>

        {/* Tab 4: Lịch */}
        <button
          type="button"
          onClick={onOpenCalendar}
          className="flex-1 py-1 flex flex-col items-center justify-center text-slate-600 hover:text-[#2C69FF] active:scale-95 transition cursor-pointer"
        >
          <Calendar className="w-5 h-5 text-slate-700" />
          <span className="text-[10px] font-bold text-slate-700 mt-0.5">Lịch</span>
        </button>

        {/* Tab 5: Menu Khác */}
        <button
          type="button"
          onClick={() => {
            setIsMoreDrawerOpen(!isMoreDrawerOpen);
            if (isActionSheetOpen) setIsActionSheetOpen(false);
          }}
          className="flex-1 py-1 flex flex-col items-center justify-center text-slate-600 hover:text-[#2C69FF] active:scale-95 transition cursor-pointer relative"
        >
          <div className="relative">
            <Menu className="w-5 h-5 text-slate-700" />
            {overdueCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
            )}
          </div>
          <span className="text-[10px] font-bold text-slate-700 mt-0.5">Thêm</span>
        </button>
      </nav>

      {/* 2. QUICK ACTION SHEET (Nút ➕ ở giữa) */}
      {isActionSheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsActionSheetOpen(false)}
          />
          <div className="relative bg-white rounded-t-3xl border-t border-slate-200 p-5 shadow-2xl z-10 space-y-4 animate-in slide-in-from-bottom duration-250 max-h-[80vh] overflow-y-auto">
            {/* Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto" />

            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-[#2C69FF] rounded-xl font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Thao Tác Nhanh</h3>
                  <p className="text-[11px] text-slate-500">Chọn hành động cần thực hiện</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsActionSheetOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {/* Option 1: AI Parser (Lãnh đạo / Trưởng/Phó ban) */}
              {canManageMeetings && (
                <button
                  type="button"
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    onOpenBBHParser();
                  }}
                  className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 hover:border-blue-300 flex items-center justify-between transition cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#2C69FF] text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Nhập Biên Bản Họp (AI)</h4>
                      <p className="text-xs text-slate-600">Dán biên bản, AI tự trích xuất công việc & deadline</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-blue-600 shrink-0" />
                </button>
              )}

              {/* Option 2: Thêm việc phát sinh thủ công */}
              <button
                type="button"
                onClick={() => {
                  setIsActionSheetOpen(false);
                  onOpenQuickAdd();
                }}
                className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 flex items-center justify-between transition cursor-pointer text-left shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20 shrink-0">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Thêm Công Việc Phát Sinh</h4>
                    <p className="text-xs text-slate-600">Tạo nhiệm vụ mới nhanh và phân công trực tiếp</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
              </button>

              {/* Option 3: Kho biên bản & Xuất PDF */}
              <button
                type="button"
                onClick={() => {
                  setIsActionSheetOpen(false);
                  onOpenMeetingHistory();
                }}
                className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 hover:bg-sky-50/30 flex items-center justify-between transition cursor-pointer text-left shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold shadow-md shadow-sky-600/20 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Kho Biên Bản & Xuất PDF</h4>
                    <p className="text-xs text-slate-600">Tra cứu lưu trữ cuộc họp & in biên bản ký duyệt</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
              </button>

              {/* Option 4: Đôn đốc việc quá hạn (The Nag) */}
              <button
                type="button"
                onClick={() => {
                  setIsActionSheetOpen(false);
                  onOpenNag();
                }}
                className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 flex items-center justify-between transition cursor-pointer text-left shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-md shadow-amber-600/20 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900">Đôn Đốc Việc Quá Hạn</h4>
                      {overdueCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                          {overdueCount} trễ hạn
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">Xem danh sách trễ hạn và gửi email nhắc nhở tự động</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MORE DRAWER (Tab ☰ Thêm) */}
      {isMoreDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsMoreDrawerOpen(false)}
          />
          <div className="relative bg-white rounded-t-3xl border-t border-slate-200 p-5 shadow-2xl z-10 space-y-4 animate-in slide-in-from-bottom duration-250 max-h-[85vh] overflow-y-auto">
            {/* Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto" />

            {/* Profile Info Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#10192F] text-white flex items-center justify-center font-bold text-sm shadow-sm border-2 border-blue-400">
                  {authMember.role === 'Chủ nhiệm' ? '👑' : authMember.department.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{authMember.name}</h4>
                  <p className="text-xs text-blue-700 font-semibold">{roleBadge}</p>
                  <p className="text-[11px] text-slate-400">{authMember.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Features Menu Grid */}
            <div className="space-y-1 text-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                Tiện ích & Báo cáo
              </div>

              {/* Bảng xếp hạng */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreDrawerOpen(false);
                  onOpenLeaderboard();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-100 text-slate-800 font-bold transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-800">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <span>Bảng xếp hạng & Điểm KPI</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Kho tài liệu */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreDrawerOpen(false);
                  onOpenDocs();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-100 text-slate-800 font-bold transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                    <FolderClosed className="w-4 h-4" />
                  </div>
                  <span>Kho tài liệu CLB</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Việc quá hạn */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreDrawerOpen(false);
                  onOpenNag();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-100 text-slate-800 font-bold transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100 text-red-700">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <span>Nhắc việc & Quá hạn (The Nag)</span>
                </div>
                {overdueCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">
                    {overdueCount} việc
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Khu vực Quản trị dành cho Ban Lãnh đạo */}
              {isLeadership && (
                <>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-3 pb-1">
                    Quản trị CLB (Ban Lãnh Đạo)
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreDrawerOpen(false);
                      onOpenRoster();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-100 text-slate-800 font-bold transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-teal-100 text-teal-800">
                        <Users className="w-4 h-4" />
                      </div>
                      <span>Quản lý thành viên & Nhiệm kỳ</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreDrawerOpen(false);
                      onOpenDataSync();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-100 text-slate-800 font-bold transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                        <Database className="w-4 h-4" />
                      </div>
                      <span>Đồng bộ dữ liệu & Sao lưu</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreDrawerOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-100 text-slate-800 font-bold transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-200 text-slate-800">
                        <SettingsIcon className="w-4 h-4" />
                      </div>
                      <span>Cài đặt hệ thống & KPI</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                </>
              )}
            </div>

            {/* Logout Button */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsMoreDrawerOpen(false);
                  onLogout();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất khỏi hệ thống</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
