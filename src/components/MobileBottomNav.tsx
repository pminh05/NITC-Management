import React, { useState } from 'react';
import {
  ListTodo,
  BarChart3,
  LayoutDashboard,
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
  KeyRound,
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
  /** Màn Tổng quan và Bảng việc (giao diện mới); thiếu thì dùng hành vi cũ */
  onOpenOverview?: () => void;
  onOpenBoard?: () => void;
  activeView?: string;
  onOpenCalendar: () => void;
  onOpenLeaderboard: () => void;
  onOpenDocs: () => void;
  onOpenNag: () => void;
  /** Có quyền mở hộp Nhắc việc quá hạn (Ban lãnh đạo, Trưởng/Phó ban) */
  canNag?: boolean;
  onOpenMeetingHistory: () => void;
  onOpenRoster: () => void;
  onOpenDataSync: () => void;
  onOpenSettings: () => void;
  onChangePassword?: () => void;
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
  onOpenOverview,
  onOpenBoard,
  activeView,
  onOpenCalendar,
  onOpenLeaderboard,
  onOpenDocs,
  onOpenNag,
  canNag = false,
  onOpenMeetingHistory,
  onOpenRoster,
  onOpenDataSync,
  onOpenSettings,
  onChangePassword,
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
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-border px-2 py-1 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] flex items-center justify-around select-none"
      >
        {/* Tab 1: Bảng việc */}
        <button
          type="button"
          onClick={onOpenBoard ?? handleScrollToBoard}
          aria-current={activeView === 'board' ? 'page' : undefined}
          className="flex-1 py-1 flex flex-col items-center justify-center text-muted hover:text-primary active:scale-95 transition cursor-pointer relative"
        >
          <div className="relative">
            <ListTodo className={`w-5 h-5 ${activeView === 'board' ? 'text-primary' : 'text-fg-2'}`} />
            {activeTasksCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-primary text-white font-mono text-[9px] font-bold flex items-center justify-center shadow-xs">
                {activeTasksCount > 99 ? '99+' : activeTasksCount}
              </span>
            )}
          </div>
          <span className={`text-[10px] font-bold mt-0.5 ${activeView === 'board' ? 'text-primary' : 'text-fg-2'}`}>Bảng việc</span>
        </button>

        {/* Tab 2: Tổng quan (giao diện mới) — hoặc Thống kê nếu chưa nối màn Tổng quan */}
        <button
          type="button"
          onClick={onOpenOverview ?? onOpenDashboard}
          aria-current={activeView === 'overview' ? 'page' : undefined}
          className="flex-1 py-1 flex flex-col items-center justify-center text-muted hover:text-primary active:scale-95 transition cursor-pointer"
        >
          {onOpenOverview ? (
            <LayoutDashboard className={`w-5 h-5 ${activeView === 'overview' ? 'text-primary' : 'text-fg-2'}`} />
          ) : (
            <BarChart3 className="w-5 h-5 text-fg-2" />
          )}
          <span className={`text-[10px] font-bold mt-0.5 ${activeView === 'overview' ? 'text-primary' : 'text-fg-2'}`}>
            {onOpenOverview ? 'Tổng quan' : 'Thống kê'}
          </span>
        </button>

        {/* Tab 3: Center Elevated Action Button (FAB) */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <button
            type="button"
            onClick={() => {
              setIsActionSheetOpen(!isActionSheetOpen);
              if (isMoreDrawerOpen) setIsMoreDrawerOpen(false);
            }}
            className={`w-12 h-12 -mt-5 rounded-full bg-primary text-white shadow-lg shadow-primary/30 border-2 border-white flex items-center justify-center transition-all duration-200 active:scale-90 hover:scale-105 cursor-pointer ${
              isActionSheetOpen ? 'rotate-45' : 'rotate-0'
            }`}
            title="Thao tác nhanh"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
          <span className="text-[10px] font-bold text-primary mt-0.5">Tạo mới</span>
        </div>

        {/* Tab 4: Lịch */}
        <button
          type="button"
          onClick={onOpenCalendar}
          className="flex-1 py-1 flex flex-col items-center justify-center text-muted hover:text-primary active:scale-95 transition cursor-pointer"
        >
          <Calendar className="w-5 h-5 text-fg-2" />
          <span className="text-[10px] font-bold text-fg-2 mt-0.5">Lịch</span>
        </button>

        {/* Tab 5: Menu Khác */}
        <button
          type="button"
          onClick={() => {
            setIsMoreDrawerOpen(!isMoreDrawerOpen);
            if (isActionSheetOpen) setIsActionSheetOpen(false);
          }}
          className="flex-1 py-1 flex flex-col items-center justify-center text-muted hover:text-primary active:scale-95 transition cursor-pointer relative"
        >
          <div className="relative">
            <Menu className="w-5 h-5 text-fg-2" />
            {overdueCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
            )}
          </div>
          <span className="text-[10px] font-bold text-fg-2 mt-0.5">Thêm</span>
        </button>
      </nav>

      {/* 2. QUICK ACTION SHEET (Nút ➕ ở giữa) */}
      {isActionSheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-[#101828]/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsActionSheetOpen(false)}
          />
          <div className="relative bg-surface rounded-t-3xl border-t border-border p-5 shadow-2xl z-10 space-y-4 animate-in slide-in-from-bottom duration-250 max-h-[80vh] overflow-y-auto">
            {/* Drag Handle */}
            <div className="w-12 h-1.5 bg-[#D0D5DD] rounded-full mx-auto" />

            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-primary rounded-xl font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-fg">Thao Tác Nhanh</h3>
                  <p className="text-[11px] text-muted">Chọn hành động cần thực hiện</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsActionSheetOpen(false)}
                className="p-1.5 text-muted hover:text-fg-2 rounded-lg hover:bg-[#F2F4F7] transition"
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
                    <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-fg">Nhập Biên Bản Họp (AI)</h4>
                      <p className="text-xs text-muted">Dán biên bản, AI tự trích xuất công việc & deadline</p>
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
                className="w-full p-3.5 rounded-2xl bg-surface border border-border hover:border-emerald-300 hover:bg-emerald-50/30 flex items-center justify-between transition cursor-pointer text-left shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20 shrink-0">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-fg">Thêm Công Việc Phát Sinh</h4>
                    <p className="text-xs text-muted">Tạo nhiệm vụ mới nhanh và phân công trực tiếp</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted shrink-0" />
              </button>

              {/* Option 3: Kho biên bản & Xuất PDF */}
              <button
                type="button"
                onClick={() => {
                  setIsActionSheetOpen(false);
                  onOpenMeetingHistory();
                }}
                className="w-full p-3.5 rounded-2xl bg-surface border border-border hover:border-sky-300 hover:bg-sky-50/30 flex items-center justify-between transition cursor-pointer text-left shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold shadow-md shadow-sky-600/20 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-fg">Kho Biên Bản & Xuất PDF</h4>
                    <p className="text-xs text-muted">Tra cứu lưu trữ cuộc họp & in biên bản ký duyệt</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted shrink-0" />
              </button>

              {/* Option 4: Đôn đốc việc quá hạn (The Nag) — không có với thành viên */}
              {canNag && (
              <button
                type="button"
                onClick={() => {
                  setIsActionSheetOpen(false);
                  onOpenNag();
                }}
                className="w-full p-3.5 rounded-2xl bg-surface border border-border hover:border-amber-300 hover:bg-amber-50/30 flex items-center justify-between transition cursor-pointer text-left shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-md shadow-amber-600/20 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-fg">Đôn Đốc Việc Quá Hạn</h4>
                      {overdueCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                          {overdueCount} trễ hạn
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted">Xem danh sách trễ hạn và gửi email nhắc nhở tự động</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted shrink-0" />
              </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. MORE DRAWER (Tab ☰ Thêm) */}
      {isMoreDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-[#101828]/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsMoreDrawerOpen(false)}
          />
          <div className="relative bg-surface rounded-t-3xl border-t border-border p-5 shadow-2xl z-10 space-y-4 animate-in slide-in-from-bottom duration-250 max-h-[85vh] overflow-y-auto">
            {/* Drag Handle */}
            <div className="w-12 h-1.5 bg-[#D0D5DD] rounded-full mx-auto" />

            {/* Profile Info Card */}
            <div className="p-3.5 rounded-2xl bg-surface-2 border border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#E0EAFF] text-[#3538CD] flex items-center justify-center font-bold text-sm">
                  {authMember.role === 'Chủ nhiệm' ? '👑' : authMember.department.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-fg">{authMember.name}</h4>
                  <p className="text-xs text-blue-700 font-semibold">{roleBadge}</p>
                  <p className="text-[11px] text-muted">{authMember.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreDrawerOpen(false)}
                className="p-1.5 text-muted hover:text-fg-2 rounded-lg hover:bg-[#EAECF0] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Features Menu Grid */}
            <div className="space-y-1 text-xs">
              <div className="text-[10px] font-bold text-muted uppercase tracking-wider px-2 py-1">
                Tiện ích & Báo cáo
              </div>

              {/* Bảng xếp hạng */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreDrawerOpen(false);
                  onOpenLeaderboard();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#F2F4F7] text-fg font-bold transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-800">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <span>Bảng xếp hạng & Điểm KPI</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted" />
              </button>

              {/* Kho tài liệu */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreDrawerOpen(false);
                  onOpenDocs();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#F2F4F7] text-fg font-bold transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                    <FolderClosed className="w-4 h-4" />
                  </div>
                  <span>Kho tài liệu CLB</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted" />
              </button>

              {/* Việc quá hạn — không có với thành viên */}
              {canNag && (
              <button
                type="button"
                onClick={() => {
                  setIsMoreDrawerOpen(false);
                  onOpenNag();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#F2F4F7] text-fg font-bold transition cursor-pointer"
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
                  <ChevronRight className="w-4 h-4 text-muted" />
                )}
              </button>
              )}

              {/* Khu vực Quản trị dành cho Ban Lãnh đạo */}
              {isLeadership && (
                <>
                  <div className="text-[10px] font-bold text-muted uppercase tracking-wider px-2 pt-3 pb-1">
                    Quản trị CLB (Ban Lãnh Đạo)
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreDrawerOpen(false);
                      onOpenRoster();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#F2F4F7] text-fg font-bold transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-teal-100 text-teal-800">
                        <Users className="w-4 h-4" />
                      </div>
                      <span>Quản lý thành viên & Nhiệm kỳ</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreDrawerOpen(false);
                      onOpenDataSync();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#F2F4F7] text-fg font-bold transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                        <Database className="w-4 h-4" />
                      </div>
                      <span>Đồng bộ dữ liệu & Sao lưu</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted" />
                  </button>

                  {authMember.role === 'Chủ nhiệm' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreDrawerOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#F2F4F7] text-fg font-bold transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#EAECF0] text-fg">
                        <SettingsIcon className="w-4 h-4" />
                      </div>
                      <span>Cài đặt hệ thống & KPI</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted" />
                  </button>
                  )}
                </>
              )}
            </div>

            {/* Đổi mật khẩu + Đăng xuất */}
            <div className="pt-2 border-t border-border space-y-2">
              {onChangePassword && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreDrawerOpen(false);
                    onChangePassword();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#F2F4F7] hover:bg-[#EAECF0] text-fg font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Đổi mật khẩu</span>
                </button>
              )}
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

