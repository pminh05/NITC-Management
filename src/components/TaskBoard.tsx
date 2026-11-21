import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  LayoutGrid,
  Kanban,
  Table as TableIcon,
  User,
  Users,
  Bell,
  Calendar,
  Link as LinkIcon,
  FileCheck,
  Send,
  ShieldCheck,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Star,
  Inbox,
} from 'lucide-react';
import { Department, Role, Task, Member } from '../types';
import { canReviewTask } from '../../shared/permissions';
import { UpdateRequestAction } from './UpdateRequestAction';
import { formatDateVN, getDaysRemaining } from '../utils/dateUtils';
import { AssigneeMultiSelect } from './AssigneeMultiSelect';
import { TaskCard } from './TaskCard';
import { QuickAddTaskModal } from './QuickAddTaskModal';
import { AssigneeLine, DeptLabel, DueText, StatusChip, btnPrimarySm, btnRemindSm, btnSoftSm, iconBtnSm } from './taskUi';

export type ViewMode = 'grid' | 'kanban' | 'table';

interface TaskBoardProps {
  tasks: Task[];
  members: Member[];
  currentRole: Role;
  currentDepartment: Department;
  currentUserId: string;
  selectedDeptProp?: string;
  selectedStatusProp?: string;
  onSelectDeptFilter?: (dept: string) => void;
  onSelectStatusFilter?: (status: string) => void;
  onOpenSubmitModal: (task: Task) => void;
  onOpenReviewModal: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onQuickApprove: (taskId: string) => void;
  onOpenBBHParser: () => void;
  onAddNewManualTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onOpenDetail?: (task: Task) => void;
  onUpdateRequest?: (task: Task) => void;
  onRemindTask?: (task: Task) => void;
}

type StatusKey = 'all' | 'in_progress' | 'pending_approval' | 'overdue' | 'completed';

/** Tab trạng thái: màu chấm, chữ và gạch chân khi đang chọn */
const STATUS_TABS: { key: StatusKey; label: string; dot?: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'in_progress', label: 'Đang làm', dot: 'bg-info-bar' },
  { key: 'pending_approval', label: 'Chờ duyệt', dot: 'bg-warning-bar' },
  { key: 'overdue', label: 'Quá hạn', dot: 'bg-danger-bar' },
  { key: 'completed', label: 'Đã xong', dot: 'bg-success-bar' },
];

const VIEW_OPTIONS: { mode: ViewMode; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { mode: 'grid', label: 'Lưới', Icon: LayoutGrid },
  { mode: 'kanban', label: 'Kanban', Icon: Kanban },
  { mode: 'table', label: 'Bảng', Icon: TableIcon },
];

const scopeChip =
  'flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition cursor-pointer';
const scopeActive = 'border-primary/30 bg-primary-light text-primary';
const scopeIdle = 'border-border bg-surface text-fg-2 hover:bg-surface-2 hover:text-fg';

const CountBadge: React.FC<{ value: number; active?: boolean }> = ({ value, active }) => (
  <span className={`text-[12px] tabular-nums ${active ? 'text-primary' : 'text-muted'}`}>{value}</span>
);

export const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  members,
  currentRole,
  currentDepartment,
  currentUserId,
  selectedDeptProp,
  selectedStatusProp,
  onSelectDeptFilter,
  onSelectStatusFilter,
  onOpenSubmitModal,
  onOpenReviewModal,
  onDeleteTask,
  onQuickApprove,
  onOpenBBHParser,
  onAddNewManualTask,
  onOpenDetail,
  onUpdateRequest,
  onRemindTask,
}) => {
  const [internalDept, setInternalDept] = useState<string>('all');
  const [internalStatus, setInternalStatus] = useState<string>('all');
  const [onlyMyTasks, setOnlyMyTasks] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showQuickAddModal, setShowQuickAddModal] = useState<boolean>(false);
  // Tab trạng thái chọn trên mobile trong chế độ Kanban
  const [mobileKanbanTab, setMobileKanbanTab] = useState<'in_progress' | 'pending_approval' | 'overdue' | 'completed'>('in_progress');

  // Lưu chế độ xem trong localStorage (mặc định: grid)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nitc_task_view') as ViewMode;
      if (saved === 'grid' || saved === 'kanban' || saved === 'table') return saved;
    }
    return 'grid';
  });

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('nitc_task_view', mode);
  };

  const selectedDept = selectedDeptProp !== undefined ? selectedDeptProp : internalDept;
  const selectedStatus = selectedStatusProp !== undefined ? selectedStatusProp : internalStatus;

  const setDept = (dept: string) => {
    if (onSelectDeptFilter) onSelectDeptFilter(dept);
    setInternalDept(dept);
  };

  const setStatus = (status: string) => {
    if (onSelectStatusFilter) onSelectStatusFilter(status);
    setInternalStatus(status);
  };

  // Đếm số việc được giao cho người dùng hiện tại
  const myTasksCount = useMemo(() => {
    return tasks.filter((t) => t.assigneeId === currentUserId || t.assigneeIds?.includes(currentUserId)).length;
  }, [tasks, currentUserId]);

  // Tập công việc cơ sở (Toàn CLB hoặc Việc của tôi)
  const baseTasks = useMemo(() => {
    if (!onlyMyTasks) return tasks;
    return tasks.filter((t) => t.assigneeId === currentUserId || t.assigneeIds?.includes(currentUserId));
  }, [tasks, onlyMyTasks, currentUserId]);

  // Lọc theo Ban, Trạng thái và Ô tìm kiếm
  const filteredTasks = useMemo(() => {
    return baseTasks.filter((task) => {
      // Bộ lọc Ban
      if (selectedDept !== 'all' && task.department !== selectedDept) {
        return false;
      }
      // Bộ lọc Trạng thái (chỉ áp dụng ở Grid và Table view)
      if (viewMode !== 'kanban' && selectedStatus !== 'all' && task.status !== selectedStatus) {
        return false;
      }
      // Tìm kiếm từ khóa
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(query);
        const matchAssignee = task.assigneeName.toLowerCase().includes(query);
        const matchDept = task.department.toLowerCase().includes(query);
        if (!matchTitle && !matchAssignee && !matchDept) return false;
      }
      return true;
    }).sort((a, b) => {
      // Việc đã hoàn thành đưa xuống cuối
      const aDone = a.status === 'completed';
      const bDone = b.status === 'completed';
      if (aDone !== bDone) return aDone ? 1 : -1;
      return a.deadline.localeCompare(b.deadline);
    });
  }, [baseTasks, selectedDept, selectedStatus, searchQuery, viewMode]);

  // Đếm cho các tab trạng thái (dựa theo baseTasks)
  const countAll = baseTasks.length;
  const countInProgress = baseTasks.filter((t) => t.status === 'in_progress').length;
  const countPending = baseTasks.filter((t) => t.status === 'pending_approval').length;
  const countOverdue = baseTasks.filter((t) => t.status === 'overdue').length;
  const countCompleted = baseTasks.filter((t) => t.status === 'completed').length;

  const departments: Department[] = ['Học thuật', 'Truyền thông', 'Sự kiện', 'Đối ngoại', 'Ban Chủ nhiệm'];

  // Tab ban cạnh "Việc của tôi": ban nhiều việc hơn đứng trước (bằng nhau thì giữ thứ tự gốc)
  const departmentTabs = useMemo(() => {
    const count = new Map<Department, number>(departments.map((d) => [d, 0]));
    for (const t of tasks) {
      const d = t.department as Department;
      if (count.has(d)) count.set(d, count.get(d)! + 1);
    }
    return departments
      .map((dept, order) => ({ dept, total: count.get(dept)!, order }))
      .sort((a, b) => b.total - a.total || a.order - b.order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const isPresident = currentRole === 'Chủ nhiệm';

  // Số việc mỗi trạng thái trong phạm vi đang xem (ban / Việc của tôi / từ khóa) — khớp với danh sách hiện ra
  const statusCounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const scoped = baseTasks.filter(
      (t) =>
        (selectedDept === 'all' || t.department === selectedDept) &&
        (!q || t.title.toLowerCase().includes(q) || t.assigneeName.toLowerCase().includes(q) || t.department.toLowerCase().includes(q))
    );
    const c: Record<StatusKey, number> = { all: scoped.length, in_progress: 0, pending_approval: 0, overdue: 0, completed: 0 };
    for (const t of scoped) if (t.status in c) c[t.status as StatusKey] += 1;
    return c;
  }, [baseTasks, selectedDept, searchQuery]);

  const hasActiveFilter =
    onlyMyTasks || selectedDept !== 'all' || Boolean(searchQuery.trim()) || (viewMode !== 'kanban' && selectedStatus !== 'all');

  const clearFilters = () => {
    setOnlyMyTasks(false);
    setDept('all');
    setStatus('all');
    setSearchQuery('');
  };

  // Nhãn màu ban
  const departmentColorMap: Record<Department, string> = {
    'Học thuật': 'bg-sky-50 text-sky-700 border-sky-200',
    'Truyền thông': 'bg-pink-50 text-pink-700 border-pink-200',
    'Sự kiện': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Đối ngoại': 'bg-purple-50 text-purple-700 border-purple-200',
    'Ban Chủ nhiệm': 'bg-amber-50 text-amber-800 border-amber-200',
  };

  // Nhãn trạng thái
  const statusBadgeMap = {
    draft: { label: 'Bản nháp', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    in_progress: { label: 'Đang làm', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    pending_approval: { label: 'Chờ duyệt', color: 'bg-amber-100 text-amber-800 border-amber-300 font-bold' },
    completed: { label: 'Đã hoàn thành', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
    overdue: { label: 'Quá hạn 🚨', color: 'bg-red-100 text-red-700 border-red-300 font-bold' },
  };

  return (
    <div id="task-board" className="space-y-4">

      {/* Thanh điều khiển bảng việc: 1) tìm kiếm + chế độ xem  2) phạm vi ban  3) trạng thái.
          Nút "Thêm việc" nằm trên header (một chỗ cho cả app). */}
      <div className="rounded-2xl border border-border bg-surface">

        {/* Hàng 1: Tìm kiếm · Chế độ xem */}
        <div className="flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center sm:p-4">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Tìm việc</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Tìm việc, người phụ trách, ban"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-[10px] border border-border-strong bg-surface pl-10 pr-10 text-[14px] text-fg outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-[var(--app-ring)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted transition hover:bg-surface-2 hover:text-fg cursor-pointer"
                title="Xóa từ khóa"
                aria-label="Xóa từ khóa"
              >
                <X className="size-3.5" />
              </button>
            )}
          </label>

          {/* Chế độ xem */}
          <div className="flex shrink-0 items-center gap-1 self-start rounded-[10px] bg-[#F2F4F7] p-1 sm:self-auto" role="tablist" aria-label="Chế độ xem">
            {VIEW_OPTIONS.map(({ mode, label, Icon }) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={viewMode === mode}
                onClick={() => handleSetViewMode(mode)}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition cursor-pointer ${
                  viewMode === mode ? 'bg-surface text-fg shadow-[0_1px_2px_rgba(16,24,40,0.08)]' : 'text-muted hover:text-fg'
                }`}
                title={label}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Hàng 2: Phạm vi — Việc của tôi · Toàn CLB · từng ban (ban nhiều việc đứng trước) */}
        <div className="flex items-center gap-2 overflow-x-auto px-3 pb-3 [scrollbar-width:none] sm:px-4 md:flex-wrap md:overflow-visible">
          <button
            type="button"
            onClick={() => {
              setOnlyMyTasks(!onlyMyTasks);
              if (!onlyMyTasks) setDept('all');
            }}
            aria-pressed={onlyMyTasks}
            className={`${scopeChip} ${onlyMyTasks ? scopeActive : scopeIdle}`}
            title="Chỉ hiển thị các công việc giao cho bạn"
          >
            <Star className={`size-3.5 ${onlyMyTasks ? 'fill-current' : ''}`} />
            <span>Việc của tôi</span>
            <CountBadge value={myTasksCount} active={onlyMyTasks} />
          </button>

          <span className="h-5 w-px shrink-0 bg-border" aria-hidden />

          <button
            type="button"
            onClick={() => {
              setOnlyMyTasks(false);
              setDept('all');
            }}
            aria-pressed={!onlyMyTasks && selectedDept === 'all'}
            className={`${scopeChip} ${!onlyMyTasks && selectedDept === 'all' ? scopeActive : scopeIdle}`}
          >
            <span>Toàn CLB</span>
            <CountBadge value={tasks.length} active={!onlyMyTasks && selectedDept === 'all'} />
          </button>

          {departmentTabs.map(({ dept, total }) => {
            const isActive = !onlyMyTasks && selectedDept === dept;
            return (
              <button
                key={dept}
                type="button"
                onClick={() => {
                  setOnlyMyTasks(false);
                  setDept(dept);
                }}
                aria-pressed={isActive}
                className={`${scopeChip} ${isActive ? scopeActive : total === 0 ? 'border-border bg-surface text-muted hover:bg-surface-2' : scopeIdle}`}
              >
                <span>{dept === 'Ban Chủ nhiệm' ? dept : `Ban ${dept}`}</span>
                <CountBadge value={total} active={isActive} />
              </button>
            );
          })}
        </div>

        {/* Hàng 3: Trạng thái — tab gạch chân; số đếm theo phạm vi đang chọn. Kanban đã chia cột theo trạng thái nên ẩn hàng này. */}
        {viewMode !== 'kanban' && (
          <div className="flex items-center gap-1 overflow-x-auto border-t border-border px-2 [scrollbar-width:none] sm:px-3" role="tablist" aria-label="Lọc theo trạng thái">
            {STATUS_TABS.map(({ key, label, dot }) => {
              const isActive = selectedStatus === key;
              const n = statusCounts[key];
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setStatus(key)}
                  className={`relative flex h-11 items-center gap-2 whitespace-nowrap px-3 text-[14px] font-medium transition cursor-pointer ${
                    isActive ? 'text-fg' : 'text-muted hover:text-fg'
                  }`}
                >
                  {dot && <span className={`size-2 rounded-full ${dot}`} aria-hidden />}
                  <span>{label}</span>
                  <span
                    className={`min-w-6 rounded-full px-1.5 text-center text-[12px] tabular-nums ${
                      isActive ? 'bg-fg text-white' : 'bg-[#F2F4F7] text-muted'
                    }`}
                  >
                    {n}
                  </span>
                  <span className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full ${isActive ? 'bg-primary' : 'bg-transparent'}`} aria-hidden />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Đang lọc → cho biết còn bao nhiêu việc và cách bỏ lọc nhanh */}
      {hasActiveFilter && (
        <div className="flex items-center justify-between gap-3 px-1 text-[14px] text-muted animate-in fade-in duration-150">
          <span>
            Đang hiển thị <strong className="font-semibold text-fg">{filteredTasks.length}</strong> việc
            {onlyMyTasks && ' được giao cho bạn'}
            {selectedDept !== 'all' && !onlyMyTasks && (
              <> của <strong className="font-semibold text-fg">{selectedDept === 'Ban Chủ nhiệm' ? selectedDept : `Ban ${selectedDept}`}</strong></>
            )}
            {searchQuery.trim() && (
              <> khớp “<strong className="font-semibold text-fg">{searchQuery.trim()}</strong>”</>
            )}
          </span>
          <button
            type="button"
            onClick={clearFilters}
            className="flex shrink-0 items-center gap-1 font-medium text-primary hover:underline cursor-pointer"
          >
            <X className="size-3.5" />
            Xóa bộ lọc
          </button>
        </div>
      )}

      {/* =========================================================================
          VIEW 1: GRID VIEW (CHẾ ĐỘ THẺ LƯỚI)
          ========================================================================= */}
      {viewMode === 'grid' && (
        <>
          {filteredTasks.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  members={members}
                  currentRole={currentRole}
                  currentDepartment={currentDepartment}
                  currentUserId={currentUserId}
                  onOpenDetail={onOpenDetail}
                  onUpdateRequest={onUpdateRequest}
                  onOpenSubmitModal={onOpenSubmitModal}
                  onOpenReviewModal={onOpenReviewModal}
                  onDeleteTask={onDeleteTask}
                  onQuickApprove={onQuickApprove}
                  onRemindTask={onRemindTask}
                />
              ))}
            </div>
          ) : (
            <EmptyTaskState
              onlyMyTasks={onlyMyTasks}
              searchQuery={searchQuery}
              selectedStatus={selectedStatus}
              selectedDept={selectedDept}
              onResetFilters={() => {
                setDept('all');
                setStatus('all');
                setSearchQuery('');
                setOnlyMyTasks(false);
              }}
              onOpenBBHParser={onOpenBBHParser}
            />
          )}
        </>
      )}

      {/* =========================================================================
          VIEW 2: KANBAN BOARD VIEW (4 CỘT TRẠNG THÁI)
          ========================================================================= */}
      {viewMode === 'kanban' && (
        <div className="space-y-3 pb-4">
          {/* Thanh chuyển tab cột trạng thái trên Mobile (sm:hidden) */}
          <div className="sticky top-16 z-10 flex items-center gap-1 overflow-x-auto rounded-[10px] bg-[#F2F4F7] p-1 [scrollbar-width:none] sm:hidden" role="tablist" aria-label="Cột trạng thái">
            {(
              [
                { key: 'in_progress', label: 'Đang làm', n: countInProgress, dot: 'bg-info-bar', on: 'bg-info-bg text-info' },
                { key: 'pending_approval', label: 'Chờ duyệt', n: countPending, dot: 'bg-warning-bar', on: 'bg-warning-bg text-warning' },
                { key: 'overdue', label: 'Quá hạn', n: countOverdue, dot: 'bg-danger-bar', on: 'bg-danger-bg text-danger' },
                { key: 'completed', label: 'Đã xong', n: countCompleted, dot: 'bg-success-bar', on: 'bg-success-bg text-success' },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={mobileKanbanTab === t.key}
                onClick={() => setMobileKanbanTab(t.key)}
                className={`flex h-8 shrink-0 grow items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[13px] font-medium transition cursor-pointer ${
                  mobileKanbanTab === t.key ? `${t.on} shadow-[0_1px_2px_rgba(16,24,40,0.08)]` : 'text-muted'
                }`}
              >
                <i className={`size-1.5 rounded-full ${t.dot}`} aria-hidden />
                <span>{t.label}</span>
                <span className="tabular-nums text-muted">{t.n}</span>
              </button>
            ))}
          </div>

          {/* Lưới cột Kanban: Trên mobile chỉ hiển thị cột đang chọn; trên tablet/desktop hiển thị đủ lưới */}
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Cột 1: Đang làm */}
            <div className={mobileKanbanTab === 'in_progress' ? 'block' : 'hidden sm:block'}>
              <KanbanColumn
                title="Đang làm"
                icon={<i className="size-2 rounded-full bg-info-bar" />}
                badgeCount={baseTasks.filter((t) => t.status === 'in_progress' && (selectedDept === 'all' || t.department === selectedDept)).length}
                headerColor="info"
                badgeColor=""
                tasks={filteredTasks.filter((t) => t.status === 'in_progress')}
                members={members}
                currentRole={currentRole}
                currentDepartment={currentDepartment}
                currentUserId={currentUserId}
                onOpenDetail={onOpenDetail}
                onOpenSubmitModal={onOpenSubmitModal}
                onOpenReviewModal={onOpenReviewModal}
                onDeleteTask={onDeleteTask}
                onQuickApprove={onQuickApprove}
                onRemindTask={onRemindTask}
                onUpdateRequest={onUpdateRequest}
                departmentColorMap={departmentColorMap}
              />
            </div>

            {/* Cột 2: Chờ duyệt */}
            <div className={mobileKanbanTab === 'pending_approval' ? 'block' : 'hidden sm:block'}>
              <KanbanColumn
                title="Chờ duyệt"
                icon={<i className="size-2 rounded-full bg-warning-bar" />}
                badgeCount={baseTasks.filter((t) => t.status === 'pending_approval' && (selectedDept === 'all' || t.department === selectedDept)).length}
                headerColor="warning"
                badgeColor=""
                tasks={filteredTasks.filter((t) => t.status === 'pending_approval')}
                members={members}
                currentRole={currentRole}
                currentDepartment={currentDepartment}
                currentUserId={currentUserId}
                onOpenDetail={onOpenDetail}
                onOpenSubmitModal={onOpenSubmitModal}
                onOpenReviewModal={onOpenReviewModal}
                onDeleteTask={onDeleteTask}
                onQuickApprove={onQuickApprove}
                onRemindTask={onRemindTask}
                onUpdateRequest={onUpdateRequest}
                departmentColorMap={departmentColorMap}
              />
            </div>

            {/* Cột 3: Quá hạn */}
            <div className={mobileKanbanTab === 'overdue' ? 'block' : 'hidden sm:block'}>
              <KanbanColumn
                title="Quá hạn"
                icon={<i className="size-2 rounded-full bg-danger-bar" />}
                badgeCount={baseTasks.filter((t) => t.status === 'overdue' && (selectedDept === 'all' || t.department === selectedDept)).length}
                headerColor="danger"
                badgeColor=""
                tasks={filteredTasks.filter((t) => t.status === 'overdue')}
                members={members}
                currentRole={currentRole}
                currentDepartment={currentDepartment}
                currentUserId={currentUserId}
                onOpenDetail={onOpenDetail}
                onOpenSubmitModal={onOpenSubmitModal}
                onOpenReviewModal={onOpenReviewModal}
                onDeleteTask={onDeleteTask}
                onQuickApprove={onQuickApprove}
                onRemindTask={onRemindTask}
                onUpdateRequest={onUpdateRequest}
                departmentColorMap={departmentColorMap}
              />
            </div>

            {/* Cột 4: Đã xong */}
            <div className={mobileKanbanTab === 'completed' ? 'block' : 'hidden sm:block'}>
              <KanbanColumn
                title="Đã xong"
                icon={<i className="size-2 rounded-full bg-success-bar" />}
                badgeCount={baseTasks.filter((t) => t.status === 'completed' && (selectedDept === 'all' || t.department === selectedDept)).length}
                headerColor="success"
                badgeColor=""
                tasks={filteredTasks.filter((t) => t.status === 'completed')}
                members={members}
                currentRole={currentRole}
                currentDepartment={currentDepartment}
                currentUserId={currentUserId}
                onOpenDetail={onOpenDetail}
                onOpenSubmitModal={onOpenSubmitModal}
                onOpenReviewModal={onOpenReviewModal}
                onDeleteTask={onDeleteTask}
                onQuickApprove={onQuickApprove}
                onRemindTask={onRemindTask}
                onUpdateRequest={onUpdateRequest}
                departmentColorMap={departmentColorMap}
              />
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: TABLE / LIST VIEW (DẠNG BẢNG DANH SÁCH RÀ SOÁT NHANH)
          ========================================================================= */}
      {viewMode === 'table' && (
        <>
          {filteredTasks.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="whitespace-nowrap border-b border-border bg-surface-2 text-[12px] font-medium text-muted">
                      <th className="px-4 py-3 font-medium">Tên việc</th>
                      <th className="px-3 py-3 font-medium">Ban</th>
                      <th className="px-3 py-3 font-medium">Người phụ trách</th>
                      <th className="px-3 py-3 font-medium">Hạn chót</th>
                      <th className="hidden px-3 py-3 font-medium 2xl:table-cell">Minh chứng</th>
                      <th className="px-3 py-3 font-medium">Trạng thái</th>
                      <th className="px-4 py-3 text-right font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTasks.map((task) => {
                      const daysInfo = getDaysRemaining(task.deadline);
                      const isPresident = currentRole === 'Chủ nhiệm';
                      const isVicePresident = currentRole === 'Phó Chủ nhiệm';
                      const isLeadership = isPresident || isVicePresident;
                      const isDeptHead =
                        (currentRole === 'Trưởng ban' || currentRole === 'Phó ban') && currentDepartment === task.department;
                      const isManager = isLeadership || isDeptHead;

                      // Lấy danh sách ID của tất cả người phụ trách
                      let rawIds: string[] = [];
                      if (Array.isArray(task.assigneeIds) && task.assigneeIds.length > 0) {
                        rawIds = task.assigneeIds.map((item: any) =>
                          typeof item === 'object' && item !== null && item.id ? String(item.id) : String(item)
                        );
                      } else if (task.assigneeId) {
                        rawIds = [task.assigneeId];
                      }
                      const assigneeIdList = Array.from(new Set(rawIds.filter(Boolean)));
                      const isAssignee = assigneeIdList.includes(currentUserId);

                      const allAssigneeNames = assigneeIdList
                        .map((id) => members.find((m) => m.id === id)?.name)
                        .filter(Boolean) as string[];
                      const finalAssigneeNames = allAssigneeNames.length > 0 ? allAssigneeNames : (task.assigneeName ? [task.assigneeName] : []);

                      const canSubmit = isAssignee;
                      const canRemind = isManager && !isAssignee;
                      const canReview = canReviewTask({ id: currentUserId, role: currentRole, department: currentDepartment }, task);

                      return (
                        <tr
                          key={task.id}
                          // Bấm vào bất kỳ đâu trên hàng → mở chi tiết (trừ khi bấm vào nút/đường dẫn trong hàng)
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('button, a, input, select, textarea, label')) return;
                            onOpenDetail?.(task);
                          }}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                              e.preventDefault();
                              onOpenDetail?.(task);
                            }
                          }}
                          tabIndex={onOpenDetail ? 0 : undefined}
                          title="Bấm để xem chi tiết"
                          className={`group transition ${
                            onOpenDetail
                              ? 'cursor-pointer hover:bg-surface-2 focus-visible:bg-primary-light/60 focus-visible:outline-none'
                              : 'hover:bg-surface-2'
                          }`}
                        >
                          {/* 1. Tên việc */}
                          <td className="max-w-[280px] px-4 py-3">
                            <div
                              className={`line-clamp-1 font-medium group-hover:text-primary ${task.status === 'completed' ? 'text-muted line-through' : 'text-fg'}`}
                              title={task.title}
                            >
                              {task.title}
                            </div>
                            {task.description && (
                              <div className="mt-0.5 truncate text-[12px] text-muted" title={task.description}>
                                {task.description}
                              </div>
                            )}
                          </td>

                          {/* 2. Ban */}
                          <td className="whitespace-nowrap px-3 py-3">
                            <DeptLabel department={task.department} />
                          </td>

                          {/* 3. Người phụ trách */}
                          <td className="max-w-[190px] whitespace-nowrap px-3 py-3">
                            <AssigneeLine names={finalAssigneeNames} />
                          </td>

                          {/* 4. Hạn chót & còn lại */}
                          <td className="whitespace-nowrap px-3 py-3">
                            <DueText deadline={task.deadline} status={task.status} />
                          </td>

                          {/* 5. Loại minh chứng */}
                          <td className="hidden whitespace-nowrap px-3 py-3 text-[12px] text-muted 2xl:table-cell">
                            <span className="inline-flex items-center gap-1">
                              {task.verificationType === 'link_required' ? <LinkIcon className="size-3.5" /> : <FileCheck className="size-3.5" />}
                              {task.verificationType === 'link_required' ? 'Link' : 'Báo cáo'}
                            </span>
                          </td>

                          {/* 6. Trạng thái */}
                          <td className="whitespace-nowrap px-3 py-3">
                            <StatusChip status={task.status} />
                          </td>

                          {/* 7. Thao tác */}
                          <td className="whitespace-nowrap px-4 py-3 align-middle">
                            {/* Các nút trên một hàng (bấm vào hàng đã mở chi tiết nên bỏ nút "Xem chi tiết") */}
                            <div className="flex flex-nowrap items-center justify-end gap-1">
                              {canSubmit && task.status !== 'completed' && task.status !== 'pending_approval' && (
                                <button type="button" onClick={() => onOpenSubmitModal(task)} className={btnPrimarySm} title="Nộp minh chứng">
                                  <Send className="size-3.5" />
                                  Nộp
                                </button>
                              )}
                              {canRemind && (task.status === 'in_progress' || task.status === 'overdue') && onRemindTask && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemindTask(task);
                                  }}
                                  className={btnRemindSm}
                                  title="Gửi thông báo nhắc nộp minh chứng"
                                >
                                  <Bell className="size-3.5" />
                                  Nhắc nộp
                                </button>
                              )}
                              {task.status === 'pending_approval' && canReview && (
                                <button type="button" onClick={() => onOpenReviewModal(task)} className={btnSoftSm} title="Kiểm tra minh chứng">
                                  <ShieldCheck className="size-3.5" />
                                  Kiểm tra
                                </button>
                              )}
                              <UpdateRequestAction task={task} isAssignee={isAssignee} canReview={canReview} onUpdateRequest={onUpdateRequest} compact />
                              {isPresident && task.status !== 'completed' && task.status !== 'pending_approval' && onQuickApprove && (
                                <button type="button" onClick={() => onQuickApprove(task.id)} className={`${iconBtnSm} hover:text-success`} title="Duyệt nhanh hoàn thành" aria-label="Duyệt nhanh hoàn thành">
                                  <CheckCircle2 className="size-4" />
                                </button>
                              )}
                              {isPresident && (
                                <button type="button" onClick={() => onDeleteTask(task.id)} className={`${iconBtnSm} hover:text-danger`} title="Xóa nhiệm vụ" aria-label="Xóa nhiệm vụ">
                                  <Trash2 className="size-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyTaskState
              onlyMyTasks={onlyMyTasks}
              searchQuery={searchQuery}
              selectedStatus={selectedStatus}
              selectedDept={selectedDept}
              onResetFilters={() => {
                setDept('all');
                setStatus('all');
                setSearchQuery('');
                setOnlyMyTasks(false);
              }}
              onOpenBBHParser={onOpenBBHParser}
            />
          )}
        </>
      )}

      {/* Quick Add Modal */}
      {showQuickAddModal && (
        <QuickAddTaskModal
          isOpen={showQuickAddModal}
          onClose={() => setShowQuickAddModal(false)}
          members={members}
          onAdd={(newTask) => {
            onAddNewManualTask(newTask);
            setShowQuickAddModal(false);
          }}
        />
      )}

    </div>
  );
};

// =========================================================================
// SUB-COMPONENT: KANBAN COLUMN
// =========================================================================
interface KanbanColumnProps {
  title: string;
  icon: React.ReactNode;
  badgeCount: number;
  headerColor: string;
  badgeColor: string;
  tasks: Task[];
  members: Member[];
  currentRole: Role;
  currentDepartment: Department;
  currentUserId: string;
  onOpenDetail?: (task: Task) => void;
  onOpenSubmitModal: (task: Task) => void;
  onOpenReviewModal: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onQuickApprove?: (taskId: string) => void;
  onRemindTask?: (task: Task) => void;
  onUpdateRequest?: (task: Task) => void;
  departmentColorMap: Record<Department, string>;
}

// Mỗi cột Kanban mang màu trạng thái của nó: nền nhạt + vạch đỉnh + tên cột cùng sắc.
// Thẻ bên trong giữ nền trắng nên vẫn nổi trên nền cột.
const KANBAN_TONES: Record<string, { column: string; title: string; dot: string; badge: string }> = {
  info: {
    column: 'bg-info-bg border-info-bar',
    title: 'text-info',
    dot: 'bg-info-bar',
    badge: 'bg-surface text-info ring-1 ring-info-bar/30',
  },
  warning: {
    column: 'bg-warning-bg border-warning-bar',
    title: 'text-warning',
    dot: 'bg-warning-bar',
    badge: 'bg-surface text-warning ring-1 ring-warning-bar/30',
  },
  danger: {
    column: 'bg-danger-bg border-danger-bar',
    title: 'text-danger',
    dot: 'bg-danger-bar',
    badge: 'bg-surface text-danger ring-1 ring-danger-bar/30',
  },
  success: {
    column: 'bg-success-bg border-success-bar',
    title: 'text-success',
    dot: 'bg-success-bar',
    badge: 'bg-surface text-success ring-1 ring-success-bar/30',
  },
  neutral: {
    column: 'bg-[#F2F4F7] border-transparent',
    title: 'text-fg',
    dot: 'bg-muted',
    badge: 'bg-surface text-muted ring-1 ring-border',
  },
};

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title,
  icon,
  badgeCount,
  headerColor,
  badgeColor,
  tasks,
  members,
  currentRole,
  currentDepartment,
  currentUserId,
  onOpenDetail,
  onOpenSubmitModal,
  onOpenReviewModal,
  onDeleteTask,
  onQuickApprove,
  onRemindTask,
  onUpdateRequest,
  departmentColorMap,
}) => {
  const isPresident = currentRole === 'Chủ nhiệm';
  const tone = KANBAN_TONES[headerColor] || KANBAN_TONES.neutral;
  const INITIAL_LIMIT = 5;
  const [displayLimit, setDisplayLimit] = useState(INITIAL_LIMIT);

  // Danh sách công việc hiển thị theo giới hạn để tránh kéo dài cột quá mức
  const visibleTasks = tasks.slice(0, displayLimit);
  const remainingCount = tasks.length - displayLimit;

  return (
    <div className={`flex min-w-[275px] flex-col rounded-2xl border-t-[3px] p-2.5 sm:min-w-[285px] xl:min-w-[290px] ${tone.column}`}>
      {/* Đầu cột: chấm màu trạng thái · tên · số việc */}
      <div className="mb-2.5 flex items-center justify-between px-1.5 pt-1">
        <div className={`flex items-center gap-2 text-[14px] font-semibold ${tone.title}`}>
          <i className={`size-2.5 rounded-full ${tone.dot}`} aria-hidden="true" />
          <span>{title}</span>
        </div>
        <span className={`rounded-full px-2 text-[12px] font-semibold tabular-nums ${tone.badge}`} title={`Tổng số công việc: ${tasks.length}`}>
          {tasks.length > displayLimit ? `${displayLimit}/${tasks.length}` : badgeCount}
        </span>
      </div>

      {/* Column Tasks Stack */}
      <div className="min-h-[220px] flex-1 space-y-2">
        {visibleTasks.length > 0 ? (
          visibleTasks.map((task) => {
            const daysInfo = getDaysRemaining(task.deadline);
            const isVicePresident = currentRole === 'Phó Chủ nhiệm';
            const isLeadership = isPresident || isVicePresident;
            const isDeptHead =
              (currentRole === 'Trưởng ban' || currentRole === 'Phó ban') && currentDepartment === task.department;
            const isManager = isLeadership || isDeptHead;

            let rawIds: string[] = [];
            if (Array.isArray(task.assigneeIds) && task.assigneeIds.length > 0) {
              rawIds = task.assigneeIds.map((item: any) =>
                typeof item === 'object' && item !== null && item.id ? String(item.id) : String(item)
              );
            } else if (task.assigneeId) {
              rawIds = [task.assigneeId];
            }
            const assigneeIdList = Array.from(new Set(rawIds.filter(Boolean)));
            const isAssignee = assigneeIdList.includes(currentUserId);

            const allAssigneeNames = assigneeIdList
              .map((id) => members.find((m) => m.id === id)?.name)
              .filter(Boolean) as string[];
            const finalAssigneeNames = allAssigneeNames.length > 0 ? allAssigneeNames : (task.assigneeName ? [task.assigneeName] : []);

            const canSubmit = isAssignee;
            const canRemind = isManager && !isAssignee;
            const canReview = canReviewTask({ id: currentUserId, role: currentRole, department: currentDepartment }, task);

            return (
              <div
                key={task.id}
                className={`space-y-2.5 rounded-xl border border-border p-3 transition hover:border-border-strong ${task.status === 'completed' ? 'bg-surface-2/70' : 'bg-surface'}`}
              >
                <DeptLabel department={task.department} />

                <button
                  type="button"
                  onClick={() => onOpenDetail && onOpenDetail(task)}
                  className={`block w-full text-left text-[13px] font-semibold leading-snug transition hover:text-primary cursor-pointer ${
                    task.status === 'completed' ? 'text-muted line-through' : 'text-fg'
                  }`}
                  title="Bấm để xem chi tiết"
                >
                  {task.title}
                </button>

                <div className="space-y-1.5">
                  <div className="flex min-w-0">
                    <AssigneeLine names={finalAssigneeNames} />
                  </div>
                  <div className="flex min-w-0">
                    <DueText deadline={task.deadline} status={task.status} />
                  </div>
                </div>

                {(canSubmit && task.status !== 'completed' && task.status !== 'pending_approval') ||
                (canRemind && (task.status === 'in_progress' || task.status === 'overdue') && onRemindTask) ||
                (task.status === 'pending_approval' && (canReview || isAssignee)) ||
                isPresident ? (
                  <div className="flex items-center justify-end gap-1 border-t border-border pt-2.5">
                    {canSubmit && task.status !== 'completed' && task.status !== 'pending_approval' && (
                      <button type="button" onClick={() => onOpenSubmitModal(task)} className={btnPrimarySm}>
                        <Send className="size-3.5" />
                        Nộp
                      </button>
                    )}
                    {canRemind && (task.status === 'in_progress' || task.status === 'overdue') && onRemindTask && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemindTask(task);
                        }}
                        className={btnRemindSm}
                        title="Gửi thông báo nhắc nộp minh chứng"
                      >
                        <Bell className="size-3.5" />
                        Nhắc nộp
                      </button>
                    )}
                    {task.status === 'pending_approval' && canReview && (
                      <button type="button" onClick={() => onOpenReviewModal(task)} className={btnSoftSm} title="Kiểm tra minh chứng">
                        <ShieldCheck className="size-3.5" />
                        Kiểm tra
                      </button>
                    )}
                    <UpdateRequestAction task={task} isAssignee={isAssignee} canReview={canReview} onUpdateRequest={onUpdateRequest} compact />
                    {isPresident && task.status !== 'completed' && task.status !== 'pending_approval' && onQuickApprove && (
                      <button type="button" onClick={() => onQuickApprove(task.id)} className={`${iconBtnSm} hover:text-success`} title="Duyệt nhanh" aria-label="Duyệt nhanh">
                        <CheckCircle2 className="size-4" />
                      </button>
                    )}
                    {isPresident && (
                      <button type="button" onClick={() => onDeleteTask(task.id)} className={`${iconBtnSm} hover:text-danger`} title="Xóa nhiệm vụ" aria-label="Xóa nhiệm vụ">
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="flex h-32 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-current/25 bg-surface/50 p-4 text-center text-[13px] text-muted">
            <Inbox className="size-5" />
            <span>Chưa có việc nào</span>
          </div>
        )}

        {/* Nút Xem thêm / Thu gọn khi số lượng công việc vượt quá giới hạn */}
        {tasks.length > INITIAL_LIMIT && (
          <div className="pt-2 flex flex-col gap-1.5 shrink-0">
            {remainingCount > 0 ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDisplayLimit((prev) => prev + 5)}
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[13px] font-medium text-fg-2 transition hover:bg-surface-2 hover:text-fg cursor-pointer"
                  title={`Hiển thị thêm 5 việc tiếp theo (còn ${remainingCount} việc)`}
                >
                  <span>Xem thêm ({Math.min(5, remainingCount)}/{remainingCount} việc)</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayLimit(tasks.length)}
                  className="h-9 whitespace-nowrap rounded-lg px-2.5 text-[13px] font-medium text-muted transition hover:bg-surface hover:text-fg cursor-pointer"
                  title="Hiện tất cả việc trong cột này"
                >
                  Tất cả ({tasks.length})
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDisplayLimit(INITIAL_LIMIT)}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-muted transition hover:bg-surface hover:text-fg cursor-pointer"
                title={`Thu gọn lại ${INITIAL_LIMIT} việc ban đầu`}
              >
                <span>Thu gọn về {INITIAL_LIMIT} việc</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// SUB-COMPONENT: EMPTY TASK STATE
// =========================================================================
interface EmptyTaskStateProps {
  onlyMyTasks: boolean;
  searchQuery: string;
  selectedStatus: string;
  selectedDept: string;
  onResetFilters: () => void;
  onOpenBBHParser: () => void;
}

const EmptyTaskState: React.FC<EmptyTaskStateProps> = ({
  onlyMyTasks,
  searchQuery,
  selectedStatus,
  selectedDept,
  onResetFilters,
  onOpenBBHParser,
}) => {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-surface px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted ring-1 ring-border">
        {onlyMyTasks ? <CheckCircle2 className="size-6 text-success" /> : <Layers className="size-6" />}
      </span>
      <h3 className="mt-4 font-display text-[18px] font-bold text-fg">
        {onlyMyTasks ? 'Bạn không còn việc nào tồn đọng' : 'Không có việc nào khớp bộ lọc'}
      </h3>
      <p className="mx-auto mt-1 max-w-md text-[14px] text-muted">
        {onlyMyTasks
          ? 'Tất cả việc của bạn đã xong hoặc chưa có việc mới được giao.'
          : searchQuery || selectedStatus !== 'all' || selectedDept !== 'all'
            ? 'Thử xoá bộ lọc hoặc chuyển sang ban khác.'
            : 'Chưa có việc nào trong hệ thống. Nhập biên bản họp để AI tự tách thành việc.'}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {(searchQuery || selectedStatus !== 'all' || selectedDept !== 'all' || onlyMyTasks) && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex h-10 items-center rounded-[10px] border border-border-strong bg-surface px-3.5 text-[14px] font-medium text-fg-2 transition hover:bg-surface-2 cursor-pointer"
          >
            {onlyMyTasks ? 'Xem toàn bộ việc CLB' : 'Xóa bộ lọc'}
          </button>
        )}

        {!onlyMyTasks && (
          <button
            type="button"
            onClick={onOpenBBHParser}
            className="btn-primary inline-flex h-10 items-center gap-2 rounded-[10px] px-3.5 text-[14px] font-medium transition cursor-pointer"
          >
            <Sparkles className="size-4" />
            Nhập biên bản họp
          </button>
        )}
      </div>
    </div>
  );
};
