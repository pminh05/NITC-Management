import React, { useState, useMemo } from 'react';
import {
  Filter,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Department, Role, Task, Member } from '../types';
import { isTaskOverdue } from '../utils/dateUtils';
import { AssigneeMultiSelect } from './AssigneeMultiSelect';
import { TaskCard } from './TaskCard';

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
}

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
}) => {
  const [internalDept, setInternalDept] = useState<string>('all');
  const [internalStatus, setInternalStatus] = useState<string>('all');
  const [onlyMyTasks, setOnlyMyTasks] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showQuickAddModal, setShowQuickAddModal] = useState<boolean>(false);

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

  // Số lượng việc được giao cho người dùng hiện tại
  const myTasksCount = useMemo(() => {
    return tasks.filter((t) => t.assigneeId === currentUserId || t.assigneeIds?.includes(currentUserId)).length;
  }, [tasks, currentUserId]);

  // Tập công việc cơ sở (Toàn CLB hoặc Việc của tôi)
  const baseTasks = useMemo(() => {
    if (!onlyMyTasks) return tasks;
    return tasks.filter((t) => t.assigneeId === currentUserId || t.assigneeIds?.includes(currentUserId));
  }, [tasks, onlyMyTasks, currentUserId]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return baseTasks.filter((task) => {
      // Dept filter
      if (selectedDept !== 'all' && task.department !== selectedDept) {
        return false;
      }
      // Status filter
      if (selectedStatus !== 'all' && task.status !== selectedStatus) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(query);
        const matchAssignee = task.assigneeName.toLowerCase().includes(query);
        const matchDept = task.department.toLowerCase().includes(query);
        if (!matchTitle && !matchAssignee && !matchDept) return false;
      }
      return true;
    }).sort((a, b) => {
      // Việc đã hoàn thành luôn đẩy xuống cuối bảng
      const aDone = a.status === 'completed';
      const bDone = b.status === 'completed';
      if (aDone !== bDone) return aDone ? 1 : -1;
      return a.deadline.localeCompare(b.deadline); // còn lại: sắp đến hạn nhất lên đầu
    });
  }, [baseTasks, selectedDept, selectedStatus, searchQuery]);

  // Counts for tabs (phản ánh theo Toàn CLB hoặc Việc của tôi)
  const countAll = baseTasks.length;
  const countInProgress = baseTasks.filter((t) => t.status === 'in_progress').length;
  const countPending = baseTasks.filter((t) => t.status === 'pending_approval').length;
  const countOverdue = baseTasks.filter((t) => t.status === 'overdue').length;
  const countCompleted = baseTasks.filter((t) => t.status === 'completed').length;

  const departments: Department[] = ['Học thuật', 'Truyền thông', 'Sự kiện', 'Đối ngoại', 'Ban Chủ nhiệm'];

  return (
    <div id="task-board" className="space-y-4">
      
      {/* Top Filter & Command Bar */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 shadow-sm space-y-3 transition-colors duration-150">
        
        {/* Row 1: Search, Department pills & Quick Add */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Department Pills & My Tasks Switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs">
            {/* Nút 'Việc của tôi' — phân biệt rõ với Toàn CLB */}
            <button
              onClick={() => {
                setOnlyMyTasks(!onlyMyTasks);
                if (!onlyMyTasks) {
                  setDept('all'); // reset dept để xem tất cả việc được giao cho mình
                }
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                onlyMyTasks
                  ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300 dark:ring-amber-500'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/40'
              }`}
              title="Chỉ hiển thị các công việc giao cho bạn"
            >
              <span>⭐</span>
              <span>Việc của tôi ({myTasksCount})</span>
            </button>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />

            <button
              onClick={() => {
                setOnlyMyTasks(false);
                setDept('all');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 cursor-pointer ${
                !onlyMyTasks && selectedDept === 'all'
                  ? 'bg-[#2C69FF] text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent dark:border-slate-600/40'
              }`}
            >
              Toàn CLB ({tasks.length})
            </button>

            {departments.map((dept) => {
              const deptTasks = tasks.filter((t) => t.department === dept);
              const isActive = !onlyMyTasks && selectedDept === dept;
              return (
                <button
                  key={dept}
                  onClick={() => {
                    setOnlyMyTasks(false);
                    setDept(dept);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm font-bold'
                      : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent dark:border-slate-600/40'
                  }`}
                >
                  Ban {dept} ({deptTasks.length})
                </button>
              );
            })}
          </div>

          {/* Search Box & Sticky Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Tìm việc hoặc người làm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-[#2C69FF] transition"
              />
            </div>

          </div>
        </div>

        {/* Row 2: Status tabs */}
        <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/60 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              onClick={() => setStatus('all')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                selectedStatus === 'all'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/60'
              }`}
            >
              Tất cả ({countAll})
            </button>

            <button
              onClick={() => setStatus('in_progress')}
              className={`px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1 cursor-pointer ${
                selectedStatus === 'in_progress'
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
              }`}
            >
              <span>Đang làm</span>
              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 px-1.5 rounded font-mono">
                {countInProgress}
              </span>
            </button>

            <button
              onClick={() => setStatus('pending_approval')}
              className={`px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1 cursor-pointer ${
                selectedStatus === 'pending_approval'
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
              }`}
            >
              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Chờ duyệt</span>
              <span className="text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-1.5 rounded font-bold">
                {countPending}
              </span>
            </button>

            <button
              onClick={() => setStatus('overdue')}
              className={`px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1 cursor-pointer ${
                selectedStatus === 'overdue'
                  ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700/60 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-red-500 dark:text-red-400" />
              <span>Quá hạn</span>
              {countOverdue > 0 && (
                <span className="text-[10px] bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-200 px-1.5 rounded font-bold animate-pulse">
                  {countOverdue}
                </span>
              )}
            </button>

            <button
              onClick={() => setStatus('completed')}
              className={`px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1 cursor-pointer ${
                selectedStatus === 'completed'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Đã xong ({countCompleted})</span>
            </button>
          </div>

          {/* Giao việc nhanh: Ban lãnh đạo + Trưởng/Phó ban */}
          {['Chủ nhiệm', 'Phó Chủ nhiệm', 'Trưởng ban', 'Phó ban'].includes(currentRole) && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowQuickAddModal(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-[#6C9BFF]" />
                <span>Thêm việc nhanh</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Banner thông báo khi đang lọc "Việc của tôi" */}
      {onlyMyTasks && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="text-base">⭐</span>
            <span>
              Đang xem <strong>Việc của tôi</strong> —{' '}
              {filteredTasks.length === 0 ? 'Hiện không có việc nào' : `${filteredTasks.length} nhiệm vụ được giao cho bạn`}
            </span>
          </div>
          <button
            onClick={() => setOnlyMyTasks(false)}
            className="text-amber-700 dark:text-amber-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>Xem toàn CLB</span>
            <span>&times;</span>
          </button>
        </div>
      )}

      {/* Main Task Cards Grid */}
      {filteredTasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl p-12 text-center space-y-4 shadow-sm transition-colors duration-150">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-400 dark:text-slate-300 flex items-center justify-center mx-auto">
            {onlyMyTasks ? <span className="text-2xl">🎉</span> : <Layers className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {onlyMyTasks
                ? 'Tuyệt vời! Bạn không có nhiệm vụ nào tồn đọng'
                : 'Không tìm thấy công việc nào phù hợp'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              {onlyMyTasks
                ? 'Tất cả nhiệm vụ của bạn đã hoàn thành hoặc chưa có việc mới được giao.'
                : searchQuery || selectedStatus !== 'all' || selectedDept !== 'all'
                ? 'Thử xóa bộ lọc tìm kiếm hoặc chuyển sang ban khác để xem công việc.'
                : 'Chưa có công việc nào trong hệ thống. Hãy tải lên Biên bản họp để AI tự động trích xuất!'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            {onlyMyTasks ? (
              <button
                onClick={() => setOnlyMyTasks(false)}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition cursor-pointer shadow-sm"
              >
                Xem toàn bộ công việc CLB &rarr;
              </button>
            ) : (
              <>
                {(searchQuery || selectedStatus !== 'all' || selectedDept !== 'all') && (
                  <button
                    onClick={() => {
                      setDept('all');
                      setStatus('all');
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
                  >
                    Xóa tất cả bộ lọc
                  </button>
                )}

                <button
                  onClick={onOpenBBHParser}
                  className="px-4 py-2 rounded-lg bg-[#2C69FF]/100 hover:bg-[#1F56D6] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Nhập Biên bản họp mới</span>
                </button>
              </>
            )}
          </div>
        </div>
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

interface QuickAddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onAdd: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

const QuickAddTaskModal: React.FC<QuickAddTaskModalProps> = ({
  isOpen,
  onClose,
  members,
  onAdd,
}) => {
  const departments: Department[] = ['Học thuật', 'Truyền thông', 'Sự kiện', 'Đối ngoại', 'Ban Chủ nhiệm'];
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dept, setDept] = useState<Department>('Học thuật');
  const deptMembers = members.filter((m) => m.department === dept);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(() => {
    const head = deptMembers.find((m) => m.role === 'Trưởng ban') || deptMembers[0];
    return head ? [head.id] : [];
  });
  const [deadline, setDeadline] = useState(
    new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
  );
  const [verificationType, setVerificationType] = useState<'link_required' | 'report_required'>('link_required');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const member = members.find((m) => m.id === assigneeIds[0]);
    if (!member) {
      alert('Vui lòng chọn ít nhất một người phụ trách');
      return;
    }

    onAdd({
      title: title.trim(),
      description: description.trim() || undefined,
      assigneeIds,
      assigneeId: member.id,
      assigneeName: member.name,
      department: dept,
      deadline,
      status: 'in_progress',
      verificationType,
      priority: 'high',
      sourceMeetingTitle: 'Giao việc phát sinh trực tiếp',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl w-full max-w-md p-6 shadow-2xl space-y-4 text-xs transition-colors duration-150">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Thêm Công Việc Phát Sinh Nhanh</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Tên công việc:</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Thiết kế mockup bài đăng..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-[#2C69FF]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Ban phụ trách:</label>
              <select
                value={dept}
                onChange={(e) => {
                  const nextDept = e.target.value as Department;
                  setDept(nextDept);
                  const nextMembers = members.filter((m) => m.department === nextDept);
                  const head = nextMembers.find((m) => m.role === 'Trưởng ban') || nextMembers[0];
                  setAssigneeIds(head ? [head.id] : []);
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-[#2C69FF]"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>Ban {d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Người phụ trách:</label>
              <AssigneeMultiSelect
                members={deptMembers}
                selectedIds={assigneeIds}
                onChange={setAssigneeIds}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Mô tả công việc <span className="text-slate-400 dark:text-slate-500 font-normal">(không bắt buộc)</span>:
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="VD: Thiết kế trên Canva theo bộ màu NITC, gửi link duyệt..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-[#2C69FF] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Hạn chót:</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-[#2C69FF]"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Loại xác minh:</label>
              <select
                value={verificationType}
                onChange={(e) => setVerificationType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-[#2C69FF]"
              >
                <option value="link_required">Cần Link 🔗</option>
                <option value="report_required">Cần Báo cáo 📝</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#2C69FF] hover:bg-[#1F56D6] text-white font-bold shadow-sm transition active:scale-95 cursor-pointer"
            >
              Thêm vào Bảng việc
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
