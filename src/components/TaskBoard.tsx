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
}) => {
  const [internalDept, setInternalDept] = useState<string>('all');
  const [internalStatus, setInternalStatus] = useState<string>('all');

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


  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
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
    }).sort((a, b) => a.deadline.localeCompare(b.deadline)); // việc sắp đến hạn nhất lên đầu
  }, [tasks, selectedDept, selectedStatus, searchQuery]);

  // Counts for tabs
  const countAll = tasks.length;
  const countInProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const countPending = tasks.filter((t) => t.status === 'pending_approval').length;
  const countOverdue = tasks.filter((t) => t.status === 'overdue').length;
  const countCompleted = tasks.filter((t) => t.status === 'completed').length;

  const departments: Department[] = ['Học thuật', 'Truyền thông', 'Sự kiện', 'Đối ngoại', 'Ban Chủ nhiệm'];

  return (
    <div className="space-y-4">
      
      {/* Top Filter & Command Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
        
        {/* Row 1: Search, Department pills & Quick Add */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Department Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs">
            <button
              onClick={() => setDept('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 cursor-pointer ${
                selectedDept === 'all'
                  ? 'bg-[#2C69FF]/100 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Toàn CLB ({tasks.length})
            </button>

            {departments.map((dept) => {
              const deptTasks = tasks.filter((t) => t.department === dept);
              const isActive = selectedDept === dept;
              return (
                <button
                  key={dept}
                  onClick={() => setDept(dept)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm việc hoặc người làm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#2C69FF] transition"
              />
            </div>

          </div>
        </div>

        {/* Row 2: Status tabs */}
        <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-slate-100 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              onClick={() => setStatus('all')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                selectedStatus === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Tất cả ({countAll})
            </button>

            <button
              onClick={() => setStatus('in_progress')}
              className={`px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1 cursor-pointer ${
                selectedStatus === 'in_progress'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:text-blue-700 hover:bg-slate-100'
              }`}
            >
              <span>Đang làm</span>
              <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 rounded font-mono">
                {countInProgress}
              </span>
            </button>

            <button
              onClick={() => setStatus('pending_approval')}
              className={`px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1 cursor-pointer ${
                selectedStatus === 'pending_approval'
                  ? 'bg-amber-50 text-amber-800 border border-amber-300'
                  : 'text-slate-600 hover:text-amber-700 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3 h-3 text-amber-600" />
              <span>Chờ duyệt</span>
              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 rounded font-bold">
                {countPending}
              </span>
            </button>

            <button
              onClick={() => setStatus('overdue')}
              className={`px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1 cursor-pointer ${
                selectedStatus === 'overdue'
                  ? 'bg-red-50 text-red-700 border border-red-300'
                  : 'text-slate-600 hover:text-red-700 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-red-500" />
              <span>Quá hạn</span>
              {countOverdue > 0 && (
                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 rounded font-bold animate-pulse">
                  {countOverdue}
                </span>
              )}
            </button>

            <button
              onClick={() => setStatus('completed')}
              className={`px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1 cursor-pointer ${
                selectedStatus === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                  : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-100'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Đã xong ({countCompleted})</span>
            </button>
          </div>

          {/* Giao việc nhanh: Ban lãnh đạo + Trưởng/Phó ban */}
          {['Chủ tịch', 'Phó Chủ tịch', 'Trưởng ban', 'Phó ban'].includes(currentRole) && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowQuickAddModal(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-[#6C9BFF]" />
                <span>Thêm việc nhanh</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Task Cards Grid */}
      {filteredTasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              currentRole={currentRole}
              currentDepartment={currentDepartment}
              currentUserId={currentUserId}
              onOpenSubmitModal={onOpenSubmitModal}
              onOpenReviewModal={onOpenReviewModal}
              onDeleteTask={onDeleteTask}
              onQuickApprove={onQuickApprove}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Không tìm thấy công việc nào phù hợp
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {searchQuery || selectedStatus !== 'all' || selectedDept !== 'all'
                ? 'Thử xóa bộ lọc tìm kiếm hoặc chuyển sang ban khác để xem công việc.'
                : 'Chưa có công việc nào trong hệ thống. Hãy tải lên Biên bản họp để AI tự động trích xuất!'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            {(searchQuery || selectedStatus !== 'all' || selectedDept !== 'all') && (
              <button
                onClick={() => {
                  setDept('all');
                  setStatus('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
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
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-2xl space-y-4 text-xs">
        <h3 className="text-base font-bold text-slate-900">Thêm Công Việc Phát Sinh Nhanh</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Tên công việc:</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Thiết kế mockup bài đăng..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#2C69FF]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Ban phụ trách:</label>
              <select
                value={dept}
                onChange={(e) => {
                  const nextDept = e.target.value as Department;
                  setDept(nextDept);
                  const nextMembers = members.filter((m) => m.department === nextDept);
                  const head = nextMembers.find((m) => m.role === 'Trưởng ban') || nextMembers[0];
                  setAssigneeIds(head ? [head.id] : []);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-[#2C69FF]"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>Ban {d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Người phụ trách:</label>
              <AssigneeMultiSelect
                members={deptMembers}
                selectedIds={assigneeIds}
                onChange={setAssigneeIds}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Mô tả công việc <span className="text-slate-400 font-normal">(không bắt buộc)</span>:
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="VD: Thiết kế trên Canva theo bộ màu NITC, gửi link duyệt..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#2C69FF] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Hạn chót:</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-[#2C69FF]"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Loại xác minh:</label>
              <select
                value={verificationType}
                onChange={(e) => setVerificationType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-[#2C69FF]"
              >
                <option value="link_required">Cần Link 🔗</option>
                <option value="report_required">Cần Báo cáo 📝</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#2C69FF]/100 hover:bg-[#1F56D6] text-white font-bold shadow-sm transition active:scale-95 cursor-pointer"
            >
              Thêm vào Bảng việc
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
