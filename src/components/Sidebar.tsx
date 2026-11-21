import React from 'react';
import {
  LayoutDashboard,
  KanbanSquare,
  Inbox,
  Sparkles,
  CalendarDays,
  Trophy,
  BarChart3,
  FolderOpen,
  GraduationCap,
  Megaphone,
  PartyPopper,
  Handshake,
  Crown,
  PanelLeftClose,
  LucideIcon,
} from 'lucide-react';
import { Department, Member, Task } from '../types';

export type MainView = 'overview' | 'board';

interface SidebarProps {
  authMember: Member;
  tasks: Task[];
  loading: boolean;
  view: MainView;
  deptFilter: string;
  statusFilter: string;
  pendingCount: number;
  canManageMeetings: boolean;
  onGoOverview: () => void;
  onGoBoard: (dept: string, status: string) => void;
  onOpenParser: () => void;
  onOpenCalendar: () => void;
  onOpenLeaderboard: () => void;
  onOpenDashboard: () => void;
  onOpenDocs: () => void;
  onCollapse: () => void;
}

export const DEPARTMENTS: { name: Department; icon: LucideIcon }[] = [
  { name: 'Học thuật', icon: GraduationCap },
  { name: 'Truyền thông', icon: Megaphone },
  { name: 'Sự kiện', icon: PartyPopper },
  { name: 'Đối ngoại', icon: Handshake },
  { name: 'Ban Chủ nhiệm', icon: Crown },
];

const itemBase = 'flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[14px] transition cursor-pointer';
const itemIdle = 'text-fg/70 hover:bg-surface-2 hover:text-fg';
const itemActive = 'bg-primary-light font-medium text-primary';

const NavItem: React.FC<{
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
}> = ({ icon: Icon, label, active, onClick, trailing }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={`${itemBase} ${active ? itemActive : itemIdle}`}
  >
    <Icon className="size-4 shrink-0" />
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {trailing}
  </button>
);

const Count: React.FC<{ value: number | string; active?: boolean }> = ({ value, active }) => (
  <span className={`shrink-0 text-[12px] tabular-nums ${active ? 'text-primary' : 'text-muted'}`}>{value}</span>
);

export const Sidebar: React.FC<SidebarProps> = ({
  authMember,
  tasks,
  loading,
  view,
  deptFilter,
  statusFilter,
  pendingCount,
  canManageMeetings,
  onGoOverview,
  onGoBoard,
  onOpenParser,
  onOpenCalendar,
  onOpenLeaderboard,
  onOpenDashboard,
  onOpenDocs,
  onCollapse,
}) => {
  const onBoard = view === 'board';
  const boardAllActive = onBoard && deptFilter === 'all' && statusFilter !== 'pending_approval';
  const pendingActive = onBoard && deptFilter === 'all' && statusFilter === 'pending_approval';

  return (
    <aside
      className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-border bg-surface lg:flex"
      aria-label="Điều hướng chính"
    >
      <div className="flex h-16 items-center gap-2.5 pl-5 pr-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary font-display text-[15px] font-bold text-white">
          N
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-bold leading-tight text-fg">NITC</p>
          <p className="truncate text-[12px] text-muted">Command Center</p>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg cursor-pointer"
          title="Thu gọn thanh bên"
          aria-label="Thu gọn thanh bên"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <p className="px-3 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Điều hành</p>
        <NavItem icon={LayoutDashboard} label="Tổng quan" active={view === 'overview'} onClick={onGoOverview} />
        <NavItem
          icon={KanbanSquare}
          label="Bảng việc"
          active={boardAllActive}
          onClick={() => onGoBoard('all', 'all')}
          trailing={<Count value={loading ? '…' : tasks.length} active={boardAllActive} />}
        />
        <NavItem
          icon={Inbox}
          label="Chờ duyệt"
          active={pendingActive}
          onClick={() => onGoBoard('all', 'pending_approval')}
          trailing={
            pendingCount > 0 ? (
              <span className="shrink-0 rounded-full bg-warning-bg px-1.5 text-[12px] font-medium tabular-nums text-warning">
                {pendingCount}
              </span>
            ) : undefined
          }
        />
        {canManageMeetings && <NavItem icon={Sparkles} label="Biên bản họp (AI)" onClick={onOpenParser} />}
        <NavItem icon={CalendarDays} label="Lịch tổng" onClick={onOpenCalendar} />
        <NavItem icon={Trophy} label="Bảng xếp hạng" onClick={onOpenLeaderboard} />
        <NavItem icon={BarChart3} label="Phân tích" onClick={onOpenDashboard} />
        <NavItem icon={FolderOpen} label="Kho tài liệu" onClick={onOpenDocs} />

        <p className="px-3 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wider text-muted">Các ban</p>
        {DEPARTMENTS.map(({ name, icon }) => {
          const active = onBoard && deptFilter === name;
          const count = tasks.filter((t) => t.department === name).length;
          return (
            <NavItem
              key={name}
              icon={icon}
              label={name}
              active={active}
              onClick={() => onGoBoard(name, 'all')}
              trailing={<Count value={loading ? '…' : count} active={active} />}
            />
          );
        })}
      </nav>

      <p className="border-t border-border px-5 py-3 text-[12px] text-muted">CLB CNTT NITC · v3.0</p>
    </aside>
  );
};
