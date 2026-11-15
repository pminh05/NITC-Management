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
} from 'lucide-react';
import { Department, Role, Task, Member } from '../types';
import { canReviewTask } from '../../shared/permissions';
import { UpdateRequestAction } from './UpdateRequestAction';
import { formatDateVN, getDaysRemaining } from '../utils/dateUtils';
import { AssigneeMultiSelect } from './AssigneeMultiSelect';
import { TaskCard } from './TaskCard';
import { QuickAddTaskModal } from './QuickAddTaskModal';

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
const STATUS_TABS: { key: StatusKey; label: string; dot?: string; activeText: string; activeBar: string; badge: string }[] = [
  { key: 'all', label: 'Tất cả', activeText: 'text-slate-900', activeBar: 'bg-slate-900', badge: 'bg-slate-900 text-white' },
  { key: 'in_progress', label: 'Đang làm', dot: 'bg-blue-500', activeText: 'text-blue-700', activeBar: 'bg-blue-600', badge: 'bg-blue-100 text-blue-800' },
  { key: 'pending_approval', label: 'Chờ duyệt', dot: 'bg-amber-500', activeText: 'text-amber-700', activeBar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800' },
  { key: 'overdue', label: 'Quá hạn', dot: 'bg-red-500', activeText: 'text-red-700', activeBar: 'bg-red-600', badge: 'bg-red-100 text-red-700' },
  { key: 'completed', label: 'Đã xong', dot: 'bg-emerald-500', activeText: 'text-emerald-700', activeBar: 'bg-emerald-600', badge: 'bg-emerald-100 text-emerald-800' },
];

const VIEW_OPTIONS: { mode: ViewMode; label: string; Icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { mode: 'grid', label: 'Lưới', Icon: LayoutGrid, color: 'text-[#2C69FF]' },
  { mode: 'kanban', label: 'Kanban', Icon: Kanban, color: 'text-amber-600' },
  { mode: 'table', label: 'Bảng', Icon: TableIcon, color: 'text-emerald-600' },
];

const scopeChip =
  'px-3.5 py-2 rounded-xl border text-sm font-semibold transition shrink-0 cursor-pointer flex items-center gap-2 whitespace-nowrap';

const CountBadge: React.FC<{ value: number; active?: boolean }> = ({ value, active }) => (
  <span
    className={`min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-bold text-center tabular-nums ${
      active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
    }`}
  >
    {value}
  </span>
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

      {/* Thanh điều khiển bảng việc: 1) tìm kiếm + chế độ xem + giao việc  2) phạm vi ban  3) trạng thái */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">

        {/* Hàng 1: Tìm kiếm · Chế độ xem · Thêm việc */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 p-3 sm:p-4">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm theo tên việc, người phụ trách hoặc ban…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#2C69FF] focus:ring-2 focus:ring-[#2C69FF]/15 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition cursor-pointer"
                title="Xóa từ khóa"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Chế độ xem */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl" role="tablist" aria-label="Chế độ xem">
              {VIEW_OPTIONS.map(({ mode, label, Icon, color }) => (
                <button
                  key={mode}
                  role="tab"
                  aria-selected={viewMode === mode}
                  onClick={() => handleSetViewMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title={label}
                >
                  <Icon className={`w-4 h-4 ${viewMode === mode ? color : ''}`} />
                  <span className="hidden md:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Giao việc nhanh: Ban lãnh đạo + Trưởng/Phó ban */}
            {['Chủ nhiệm', 'Phó Chủ nhiệm', 'Trưởng ban', 'Phó ban'].includes(currentRole) && (
              <button
                onClick={() => setShowQuickAddModal(true)}
                className="ml-auto sm:ml-0 px-3.5 py-2.5 rounded-xl bg-[#2C69FF] hover:bg-[#1F56D6] text-white text-sm font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm việc</span>
              </button>
            )}
          </div>
        </div>

        {/* Hàng 2: Phạm vi — Việc của tôi · Toàn CLB · từng ban (ban nhiều việc đứng trước) */}
        <div className="px-3 sm:px-4 pb-3 flex items-center gap-2 overflow-x-auto md:flex-wrap md:overflow-visible [scrollbar-width:none]">
          <button
            onClick={() => {
              setOnlyMyTasks(!onlyMyTasks);
              if (!onlyMyTasks) setDept('all');
            }}
            className={`${scopeChip} ${
              onlyMyTasks
                ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
            }`}
            title="Chỉ hiển thị các công việc giao cho bạn"
          >
            <span aria-hidden>⭐</span>
            <span>Việc của tôi</span>
            <CountBadge value={myTasksCount} active={onlyMyTasks} />
          </button>

          <span className="h-6 w-px bg-slate-200 shrink-0" aria-hidden />

          <button
            onClick={() => {
              setOnlyMyTasks(false);
              setDept('all');
            }}
            className={`${scopeChip} ${
              !onlyMyTasks && selectedDept === 'all'
                ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span>Toàn CLB</span>
            <CountBadge value={tasks.length} active={!onlyMyTasks && selectedDept === 'all'} />
          </button>

          {departmentTabs.map(({ dept, total }) => {
            const isActive = !onlyMyTasks && selectedDept === dept;
            return (
              <button
                key={dept}
                onClick={() => {
                  setOnlyMyTasks(false);
                  setDept(dept);
                }}
                className={`${scopeChip} ${
                  isActive
                    ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                    : total === 0
                    ? 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>{dept === 'Ban Chủ nhiệm' ? dept : `Ban ${dept}`}</span>
                <CountBadge value={total} active={isActive} />
              </button>
            );
          })}
        </div>

        {/* Hàng 3: Trạng thái — tab gạch chân; số đếm theo phạm vi đang chọn. Kanban đã chia cột theo trạng thái nên ẩn hàng này. */}
        {viewMode !== 'kanban' && (
          <div className="border-t border-slate-100 px-1.5 sm:px-2.5 flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Lọc theo trạng thái">
            {STATUS_TABS.map(({ key, label, dot, activeText, activeBar, badge }) => {
              const isActive = selectedStatus === key;
              const n = statusCounts[key];
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setStatus(key)}
                  className={`relative px-3 py-3 text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                    isActive ? activeText : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {dot && <span className={`w-2 h-2 rounded-full ${dot}`} aria-hidden />}
                  <span>{label}</span>
                  <span
                    className={`min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-bold text-center tabular-nums ${
                      isActive ? badge : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {n}
                  </span>
                  <span
                    className={`absolute left-2 right-2 -bottom-px h-0.5 rounded-full transition ${isActive ? activeBar : 'bg-transparent'}`}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Đang lọc → cho biết còn bao nhiêu việc và cách bỏ lọc nhanh */}
      {hasActiveFilter && (
        <div className="flex items-center justify-between gap-3 px-1 text-sm text-slate-600 animate-in fade-in duration-150">
          <span>
            {onlyMyTasks && <span className="mr-1">⭐</span>}
            Đang hiển thị <strong className="text-slate-900">{filteredTasks.length}</strong> việc
            {onlyMyTasks && ' được giao cho bạn'}
            {selectedDept !== 'all' && !onlyMyTasks && (
              <> của <strong className="text-slate-900">{selectedDept === 'Ban Chủ nhiệm' ? selectedDept : `Ban ${selectedDept}`}</strong></>
            )}
            {searchQuery.trim() && (
              <> khớp “<strong className="text-slate-900">{searchQuery.trim()}</strong>”</>
            )}
          </span>
          <button
            onClick={clearFilters}
            className="shrink-0 text-[#1F56D6] font-semibold hover:underline cursor-pointer flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
          <div className="sm:hidden flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto [scrollbar-width:none] sticky top-14 z-10 shadow-xs">
            <button
              type="button"
              onClick={() => setMobileKanbanTab('in_progress')}
              className={`flex-1 min-w-[75px] py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                mobileKanbanTab === 'in_progress'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Đang làm</span>
              <span className={`text-[10px] px-1 rounded-full font-mono ${mobileKanbanTab === 'in_progress' ? 'bg-blue-700 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {countInProgress}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileKanbanTab('pending_approval')}
              className={`flex-1 min-w-[75px] py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                mobileKanbanTab === 'pending_approval'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Chờ duyệt</span>
              <span className={`text-[10px] px-1 rounded-full font-mono ${mobileKanbanTab === 'pending_approval' ? 'bg-amber-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {countPending}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileKanbanTab('overdue')}
              className={`flex-1 min-w-[75px] py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                mobileKanbanTab === 'overdue'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Quá hạn</span>
              <span className={`text-[10px] px-1 rounded-full font-mono ${mobileKanbanTab === 'overdue' ? 'bg-red-700 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {countOverdue}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileKanbanTab('completed')}
              className={`flex-1 min-w-[75px] py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                mobileKanbanTab === 'completed'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Đã xong</span>
              <span className={`text-[10px] px-1 rounded-full font-mono ${mobileKanbanTab === 'completed' ? 'bg-emerald-700 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {countCompleted}
              </span>
            </button>
          </div>

          {/* Lưới cột Kanban: Trên mobile chỉ hiển thị cột đang chọn; trên tablet/desktop hiển thị đủ lưới */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5 sm:gap-5 xl:gap-6 items-start">
            {/* Cột 1: Đang làm */}
            <div className={mobileKanbanTab === 'in_progress' ? 'block' : 'hidden sm:block'}>
              <KanbanColumn
                title="Đang thực hiện"
                icon={<Clock className="w-4 h-4 text-blue-600" />}
                badgeCount={baseTasks.filter((t) => t.status === 'in_progress' && (selectedDept === 'all' || t.department === selectedDept)).length}
                headerColor="bg-blue-50 border-blue-200 text-blue-800"
                badgeColor="bg-blue-100 text-blue-800"
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
                title="Chờ duyệt minh chứng"
                icon={<Clock className="w-4 h-4 text-amber-600" />}
                badgeCount={baseTasks.filter((t) => t.status === 'pending_approval' && (selectedDept === 'all' || t.department === selectedDept)).length}
                headerColor="bg-amber-50 border-amber-200 text-amber-900"
                badgeColor="bg-amber-100 text-amber-800"
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
                icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
                badgeCount={baseTasks.filter((t) => t.status === 'overdue' && (selectedDept === 'all' || t.department === selectedDept)).length}
                headerColor="bg-red-50 border-red-200 text-red-900"
                badgeColor="bg-red-100 text-red-700"
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
                title="Đã hoàn thành"
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                badgeCount={baseTasks.filter((t) => t.status === 'completed' && (selectedDept === 'all' || t.department === selectedDept)).length}
                headerColor="bg-emerald-50 border-emerald-200 text-emerald-900"
                badgeColor="bg-emerald-100 text-emerald-800"
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
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Tên nhiệm vụ</th>
                      <th className="py-3 px-3">Ban</th>
                      <th className="py-3 px-3">Người phụ trách</th>
                      <th className="py-3 px-3">Hạn chót</th>
                      <th className="py-3 px-3">Xác minh</th>
                      <th className="py-3 px-3">Trạng thái</th>
                      <th className="py-3 px-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
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
                          className={`transition group ${
                            onOpenDetail
                              ? 'cursor-pointer hover:bg-blue-50/50 focus-visible:outline-none focus-visible:bg-blue-50/70'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* 1. Tên nhiệm vụ */}
                          <td className="py-3 px-4 max-w-xs">
                            <div
                              className={`font-semibold text-slate-900 group-hover:text-[#2C69FF] line-clamp-1 ${task.status === 'completed' ? 'line-through text-slate-400' : ''
                                }`}
                              title={task.title}
                            >
                              {task.title}
                            </div>
                            {task.description && (
                              <div className="text-[11px] text-slate-500 truncate mt-0.5" title={task.description}>
                                {task.description}
                              </div>
                            )}
                          </td>

                          {/* 2. Ban */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${departmentColorMap[task.department] || 'bg-slate-100 text-slate-700'}`}>
                              {task.department}
                            </span>
                          </td>

                          {/* 3. Người phụ trách */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {finalAssigneeNames.length > 1 ? (
                                <Users className="w-3.5 h-3.5 text-[#2C69FF] shrink-0" />
                              ) : (
                                <User className="w-3.5 h-3.5 text-[#2C69FF] shrink-0" />
                              )}
                              {finalAssigneeNames.length > 0 && (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-[#1F56D6] border border-blue-200 text-[11px] font-semibold truncate max-w-[130px]"
                                  title={finalAssigneeNames[0]}
                                >
                                  {finalAssigneeNames[0]}
                                </span>
                              )}
                              {finalAssigneeNames.length > 1 && (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 hover:bg-blue-200 text-[#1F56D6] border border-blue-300 text-[10px] font-bold cursor-help transition shadow-2xs shrink-0"
                                  title={`Còn lại ${finalAssigneeNames.length - 1} người phụ trách:\n• ${finalAssigneeNames.slice(1).join('\n• ')}`}
                                >
                                  +{finalAssigneeNames.length - 1}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 4. Hạn chót & Còn lại */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono text-slate-700 font-medium">
                                {formatDateVN(task.deadline)}
                              </span>
                              {task.status !== 'completed' && (
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border w-fit ${daysInfo.badgeColor}`}>
                                  {daysInfo.label}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 5. Loại xác minh */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            {task.verificationType === 'link_required' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-semibold">
                                <LinkIcon className="w-3 h-3" />
                                <span>Link URL</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-semibold">
                                <FileCheck className="w-3 h-3" />
                                <span>Báo cáo 2 câu</span>
                              </span>
                            )}
                          </td>

                          {/* 6. Trạng thái */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadgeMap[task.status]?.color || 'bg-slate-100 text-slate-700'}`}>
                              {statusBadgeMap[task.status]?.label || task.status}
                            </span>
                          </td>

                          {/* 7. Thao tác */}
                          <td className="py-3 px-4 whitespace-nowrap align-middle">
                            {/* Các nút trên một hàng, căn giữa ô (bấm vào hàng đã mở chi tiết nên bỏ nút "Xem chi tiết") */}
                            <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                              {/* 1. Nộp minh chứng (chỉ cho người phụ trách) */}
                              {canSubmit && task.status !== 'completed' && task.status !== 'pending_approval' && (
                                <button
                                  onClick={() => onOpenSubmitModal(task)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 bg-[#2C69FF] hover:bg-[#1F56D6] text-white shadow-xs transition active:scale-95 cursor-pointer"
                                  title="Nộp minh chứng"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>Nộp</span>
                                </button>
                              )}

                              {/* 2. Nhắc nộp (cho Ban quản lý khi chưa hoàn thành) */}
                              {canRemind && (task.status === 'in_progress' || task.status === 'overdue') && onRemindTask && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemindTask(task);
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer ${
                                    task.status === 'overdue'
                                      ? 'bg-red-500 hover:bg-red-600 text-white'
                                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                                  }`}
                                  title="Gửi thông báo nhắc nộp minh chứng"
                                >
                                  <Bell className="w-3 h-3" />
                                  <span>Nhắc nộp</span>
                                </button>
                              )}

                              {/* 3. Kiểm tra (cho Ban quản lý khi chờ duyệt) */}
                              {task.status === 'pending_approval' && canReview && (
                                <button
                                  onClick={() => onOpenReviewModal(task)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
                                  title="Kiểm tra minh chứng"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Kiểm tra</span>
                                </button>
                              )}

                              {/* 3b. Xin sửa / phản hồi yêu cầu sửa minh chứng */}
                              <UpdateRequestAction task={task} isAssignee={isAssignee} canReview={canReview} onUpdateRequest={onUpdateRequest} compact />

                              {/* Duyệt nhanh (Chủ nhiệm) */}
                              {isPresident && task.status !== 'completed' && task.status !== 'pending_approval' && onQuickApprove && (
                                <button
                                  onClick={() => onQuickApprove(task.id)}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-700 border border-slate-200 transition cursor-pointer"
                                  title="Duyệt nhanh hoàn thành"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Xóa việc (Chủ nhiệm) */}
                              {isPresident && (
                                <button
                                  onClick={() => onDeleteTask(task.id)}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-600 border border-slate-200 transition cursor-pointer"
                                  title="Xóa nhiệm vụ"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
  const INITIAL_LIMIT = 5;
  const [displayLimit, setDisplayLimit] = useState(INITIAL_LIMIT);

  // Danh sách công việc hiển thị theo giới hạn để tránh kéo dài cột quá mức
  const visibleTasks = tasks.slice(0, displayLimit);
  const remainingCount = tasks.length - displayLimit;

  return (
    <div className="bg-slate-50/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col p-3 sm:p-3.5 min-w-[275px] sm:min-w-[285px] xl:min-w-[305px]">
      {/* Column Header */}
      <div className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between mb-3 shadow-2xs ${headerColor}`}>
        <div className="flex items-center gap-1.5 font-bold text-xs sm:text-[13px]">
          {icon}
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${badgeColor}`}
            title={`Tổng số công việc: ${tasks.length}`}
          >
            {tasks.length > displayLimit ? `${displayLimit}/${tasks.length}` : badgeCount}
          </span>
        </div>
      </div>

      {/* Column Tasks Stack */}
      <div className="flex-1 space-y-2.5 sm:space-y-3 min-h-[220px]">
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
                className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-3.5 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm transition-all duration-150 space-y-2.5 relative"
              >
                {/* Top strip: Department & Countdown */}
                <div className="flex items-center justify-between gap-1 text-[11px]">
                  <span className={`px-2 py-0.5 rounded-md font-semibold border ${departmentColorMap[task.department] || 'bg-slate-100 text-slate-700'}`}>
                    {task.department}
                  </span>
                  {task.status !== 'completed' && (
                    <span className={`px-1.5 py-0.5 rounded-md font-semibold border text-[11px] flex items-center gap-1 ${daysInfo.badgeColor}`}>
                      <Clock className="w-2.5 h-2.5 shrink-0" />
                      <span>{daysInfo.label}</span>
                    </span>
                  )}
                </div>

                {/* Task Title */}
                <h4
                  onClick={() => onOpenDetail && onOpenDetail(task)}
                  className={`font-semibold text-xs leading-snug cursor-pointer hover:text-[#2C69FF] transition ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'
                    }`}
                  title="Bấm để xem chi tiết"
                >
                  {task.title}
                </h4>

                {/* Assignee & Deadline row */}
                <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700/60 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {finalAssigneeNames.length > 1 ? (
                      <Users className="w-3 h-3 text-[#2C69FF] shrink-0" />
                    ) : (
                      <User className="w-3 h-3 text-[#2C69FF] shrink-0" />
                    )}
                    {finalAssigneeNames.length > 0 && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-[#1F56D6] dark:text-[#8FB2FF] border border-blue-200 dark:border-blue-800 text-[10px] font-medium truncate max-w-[170px]"
                        title={finalAssigneeNames[0]}
                      >
                        {finalAssigneeNames[0]}
                      </span>
                    )}
                    {finalAssigneeNames.length > 1 && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 hover:bg-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 text-[#1F56D6] dark:text-[#8FB2FF] border border-blue-300 dark:border-blue-700 text-[10px] font-bold cursor-help transition shadow-2xs shrink-0"
                        title={`Còn lại ${finalAssigneeNames.length - 1} người phụ trách:\n• ${finalAssigneeNames.slice(1).join('\n• ')}`}
                      >
                        +{finalAssigneeNames.length - 1}
                      </span>
                    )}
                    {/* Trạng thái chờ duyệt (chỉ là nhãn, không bấm được) — đặt cạnh người phụ trách cho gọn hàng nút */}
                    {task.status === 'pending_approval' && !canReview && (
                      <span className="ml-auto px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 text-[10px] font-semibold flex items-center gap-0.5 shrink-0">
                        <Clock className="w-2.5 h-2.5 text-amber-600" />
                        <span>Chờ duyệt</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/50 text-[10px]">
                    <span className="text-slate-400 flex items-center gap-1 font-medium">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Hạn chót:</span>
                    </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{formatDateVN(task.deadline)}</span>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 text-[11px]">
                  <div className="text-[10px] text-slate-400 truncate max-w-[90px]" title={task.sourceMeetingTitle}>
                    {task.verificationType === 'link_required' ? '🔗 Link URL' : '📝 Báo cáo'}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Nộp bài */}
                    {canSubmit && task.status !== 'completed' && task.status !== 'pending_approval' && (
                      <button
                        onClick={() => onOpenSubmitModal(task)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 bg-[#2C69FF] hover:bg-[#1F56D6] text-white shadow-2xs transition active:scale-95 cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>Nộp</span>
                      </button>
                    )}

                    {/* Nhắc nộp (cho Ban quản lý khi chưa xong) */}
                    {canRemind && (task.status === 'in_progress' || task.status === 'overdue') && onRemindTask && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemindTask(task);
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-2xs ${
                          task.status === 'overdue'
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-amber-500 hover:bg-amber-600 text-white'
                        }`}
                        title="Gửi thông báo nhắc nộp minh chứng"
                      >
                        <Bell className="w-3 h-3" />
                        <span>Nhắc nộp</span>
                      </button>
                    )}

                    {/* Kiểm tra */}
                    {task.status === 'pending_approval' && canReview && (
                      <button
                        onClick={() => onOpenReviewModal(task)}
                        className="px-2.5 py-1 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 dark:hover:bg-amber-500/25 text-[11px] font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
                        title="Kiểm tra minh chứng"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        <span>Kiểm tra</span>
                      </button>
                    )}

                    {/* Xin sửa / phản hồi yêu cầu sửa minh chứng */}
                    <UpdateRequestAction task={task} isAssignee={isAssignee} canReview={canReview} onUpdateRequest={onUpdateRequest} compact />

                    {/* Duyệt nhanh (Chủ nhiệm) */}
                    {isPresident && task.status !== 'completed' && task.status !== 'pending_approval' && onQuickApprove && (
                      <button
                        onClick={() => onQuickApprove(task.id)}
                        className="p-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                        title="Duyệt nhanh"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                      </button>
                    )}

                    {/* Xóa việc (Chủ nhiệm) */}
                    {isPresident && (
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="p-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                        title="Xóa nhiệm vụ"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-32 flex flex-col items-center justify-center text-slate-400 text-xs text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-base mb-1">📭</span>
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
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#2C69FF] hover:text-[#2C69FF] text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer shadow-2xs"
                  title={`Hiển thị thêm 5 việc tiếp theo (còn ${remainingCount} việc)`}
                >
                  <span>Xem thêm ({Math.min(5, remainingCount)}/{remainingCount} việc)</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayLimit(tasks.length)}
                  className="py-1.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold transition active:scale-98 cursor-pointer whitespace-nowrap"
                  title="Hiện tất cả việc trong cột này"
                >
                  Tất cả ({tasks.length})
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDisplayLimit(INITIAL_LIMIT)}
                className="w-full py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer"
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
    <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-4 shadow-sm">
      <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
        {onlyMyTasks ? <span className="text-2xl">🎉</span> : <Layers className="w-6 h-6" />}
      </div>
      <div>
        <h3 className="text-base font-bold text-slate-800">
          {onlyMyTasks
            ? 'Tuyệt vời! Bạn không có nhiệm vụ nào tồn đọng'
            : 'Không tìm thấy công việc nào phù hợp'}
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          {onlyMyTasks
            ? 'Tất cả nhiệm vụ của bạn đã hoàn thành hoặc chưa có việc mới được giao.'
            : searchQuery || selectedStatus !== 'all' || selectedDept !== 'all'
              ? 'Thử xóa bộ lọc tìm kiếm hoặc chuyển sang ban khác để xem công việc.'
              : 'Chưa có công việc nào trong hệ thống. Hãy tải lên Biên bản họp để AI tự động trích xuất!'}
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 pt-2">
        {(searchQuery || selectedStatus !== 'all' || selectedDept !== 'all' || onlyMyTasks) && (
          <button
            onClick={onResetFilters}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            {onlyMyTasks ? 'Xem toàn bộ công việc CLB →' : 'Xóa tất cả bộ lọc'}
          </button>
        )}

        {!onlyMyTasks && (
          <button
            onClick={onOpenBBHParser}
            className="px-4 py-2 rounded-lg bg-[#2C69FF] hover:bg-[#1F56D6] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Nhập Biên bản họp mới</span>
          </button>
        )}
      </div>
    </div>
  );
};
