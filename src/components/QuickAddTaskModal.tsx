import { confirmDialog, toast } from './ui/Feedback';
import React, { useState } from 'react';
import { Plus, X, Calendar, UserCheck, CheckCircle2 } from 'lucide-react';
import { Department, Member, Task } from '../types';
import { AssigneeMultiSelect } from './AssigneeMultiSelect';
import { todayVN, addDays } from '../../shared/time';

export interface QuickAddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onAdd: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export const QuickAddTaskModal: React.FC<QuickAddTaskModalProps> = ({
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
    addDays(todayVN(), 5)
  );
  const [verificationType, setVerificationType] = useState<'link_required' | 'report_required'>('link_required');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const member = members.find((m) => m.id === assigneeIds[0]);
    if (!member) {
      toast('Thiếu người phụ trách', 'Vui lòng chọn ít nhất một người phụ trách', 'warn');
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
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#101828]/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface border border-border-strong rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 text-xs animate-in fade-in zoom-in-95 duration-200 my-auto">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-fg">Thêm Công Việc Nhanh</h3>
              <p className="text-[11px] text-muted">Giao nhiệm vụ phát sinh trực tiếp vào bảng việc</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-fg-2 hover:bg-[#F2F4F7] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-fg font-bold mb-1">
              Tên công việc <span className="text-red-500">*</span>:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Thiết kế mockup bài đăng Facebook tháng 12..."
              className="w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-xl text-fg placeholder:text-muted focus:bg-surface focus:outline-none focus:border-primary font-medium"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-fg font-bold mb-1">Ban phụ trách:</label>
              <select
                value={dept}
                onChange={(e) => {
                  const nextDept = e.target.value as Department;
                  setDept(nextDept);
                  const nextMembers = members.filter((m) => m.department === nextDept);
                  const head = nextMembers.find((m) => m.role === 'Trưởng ban') || nextMembers[0];
                  setAssigneeIds(head ? [head.id] : []);
                }}
                className="w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-xl text-fg font-medium focus:bg-surface focus:outline-none focus:border-primary cursor-pointer"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>Ban {d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-fg font-bold mb-1">Người phụ trách:</label>
              <AssigneeMultiSelect
                members={deptMembers}
                selectedIds={assigneeIds}
                onChange={setAssigneeIds}
              />
            </div>
          </div>

          <div>
            <label className="block text-fg font-bold mb-1">
              Mô tả chi tiết <span className="text-muted font-normal">(không bắt buộc)</span>:
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="VD: Thiết kế theo tone màu nhận diện NITC, nộp link Canva trước hạn..."
              className="w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-xl text-fg placeholder:text-muted focus:bg-surface focus:outline-none focus:border-primary resize-none font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-fg font-bold mb-1">Hạn chót (Deadline):</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-xl text-fg font-medium focus:bg-surface focus:outline-none focus:border-primary"
                required
              />
            </div>

            <div>
              <label className="block text-fg font-bold mb-1">Loại nghiệm thu:</label>
              <select
                value={verificationType}
                onChange={(e) => setVerificationType(e.target.value as any)}
                className="w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-xl text-fg font-medium focus:bg-surface focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="link_required">Cần nộp Link URL 🔗</option>
                <option value="report_required">Cần nộp Báo cáo 📝</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-muted hover:bg-[#F2F4F7] font-bold cursor-pointer transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold shadow-md shadow-blue-500/20 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Thêm vào Bảng việc</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

