# -*- coding: utf-8 -*-
# Patch frontend: đa phụ trách (Filter + QuickAdd + TaskCard) + cảnh báo hạn cũ trong Filter
import io, sys

def sub(path, old, new):
    s = io.open(path, encoding='utf-8').read()
    if old not in s:
        print('  (skip, da ap dung hoac khong tim thay) %s' % path); return
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s.replace(old, new))
    print('ok', path)

# ===== 1. types: assigneeIds / suggestedAssigneeIds =====
sub('src/types.ts',
    """export interface Task {
  id: string;
  title: string;
  description?: string;
  assigneeId: string;
  assigneeName: string;""",
    """export interface Task {
  id: string;
  title: string;
  description?: string;
  assigneeId: string; // phụ trách chính (người đầu tiên)
  assigneeName: string;
  assigneeIds?: string[]; // giao nhiều người / cả ban""")
sub('src/types.ts',
    """export interface ExtractedDraftTask {
  tempId: string;
  title: string;
  description?: string;
  rawAssigneeText: string;
  suggestedAssigneeId?: string;
  suggestedAssigneeName?: string;""",
    """export interface ExtractedDraftTask {
  tempId: string;
  title: string;
  description?: string;
  rawAssigneeText: string;
  suggestedAssigneeId?: string;
  suggestedAssigneeName?: string;
  suggestedAssigneeIds?: string[]; // giao nhiều người / cả ban""")

# ===== 2. PresidentialFilterModal: đa phụ trách + cảnh báo hạn cũ =====
sub('src/components/PresidentialFilterModal.tsx',
    """import { Department, ExtractedDraftTask, Meeting, Member } from '../types';""",
    """import { Department, ExtractedDraftTask, Meeting, Member } from '../types';
import { AssigneeMultiSelect } from './AssigneeMultiSelect';
import { todayISO } from '../utils/dateUtils';""")

sub('src/components/PresidentialFilterModal.tsx',
    """                {/* Assignee & Deadline Selectors Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Assignee */}
                  <div>
                    <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Người phụ trách (Gán theo thành viên NITC):</span>
                    </label>
                    <select
                      value={task.suggestedAssigneeId || ''}
                      onChange={(e) =>
                        handleUpdateTask(task.tempId, {
                          suggestedAssigneeId: e.target.value,
                        })
                      }
                      className={`w-full px-3 py-2 bg-slate-900 border rounded-lg text-xs font-medium focus:outline-none ${
                        !task.suggestedAssigneeId
                          ? 'border-amber-500 text-amber-300 bg-amber-950/30'
                          : 'border-slate-700 text-white'
                      }`}
                    >
                      <option value="">-- Chưa chọn người phụ trách --</option>
                      {members
                        .filter((m) => m.department === task.suggestedDepartment)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.role})
                          </option>
                        ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Chỉ hiển thị thành viên thuộc ban {task.suggestedDepartment}.
                    </p>
                  </div>""",
    """                {/* Assignee & Deadline Selectors Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Assignee — chọn nhiều người / cả ban */}
                  <div>
                    <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Người phụ trách (chọn nhiều được — người đầu là chính):</span>
                    </label>
                    <AssigneeMultiSelect
                      members={members.filter((m) => m.department === task.suggestedDepartment)}
                      selectedIds={task.suggestedAssigneeIds || (task.suggestedAssigneeId ? [task.suggestedAssigneeId] : [])}
                      onChange={(ids) =>
                        handleUpdateTask(task.tempId, {
                          suggestedAssigneeIds: ids,
                          suggestedAssigneeId: ids[0] || '',
                        })
                      }
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Thành viên ban {task.suggestedDepartment}. Bấm "Chọn tất cả" để giao cả ban.
                    </p>
                  </div>""")

# Cảnh báo hạn cũ trong draft task card
sub('src/components/PresidentialFilterModal.tsx',
    """          {tasks.map((task, index) => {
            const isMinhAmbiguity = task.hasAmbiguity;
            const isAbsent = task.isAbsentee;""",
    """          {tasks.map((task, index) => {
            const isMinhAmbiguity = task.hasAmbiguity;
            const isAbsent = task.isAbsentee;
            const isPastDeadline = !!task.suggestedDeadline && task.suggestedDeadline < todayISO();""")

sub('src/components/PresidentialFilterModal.tsx',
    """                {/* 2. Absentee Warning */}""",
    """                {/* 2b. Cảnh báo hạn chót đã qua — người ban hành tự kiểm */}
                {isPastDeadline && (
                  <div className="mb-3 p-2.5 bg-orange-500/10 border border-orange-500/40 rounded-xl text-xs flex items-center gap-2 text-orange-300 font-semibold">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>
                      ⚠️ Hạn chót <strong>{task.suggestedDeadline}</strong> đã ở quá khứ (AI có thể hiểu nhầm năm).
                      Hãy kiểm tra và sửa lại hạn đúng trước khi ban hành!
                    </span>
                  </div>
                )}

                {/* 2. Absentee Warning */}""")

# ===== 3. QuickAddTaskModal: đa phụ trách =====
sub('src/components/TaskBoard.tsx',
    "import { isTaskOverdue } from '../utils/dateUtils';",
    "import { isTaskOverdue } from '../utils/dateUtils';\nimport { AssigneeMultiSelect } from './AssigneeMultiSelect';")

sub('src/components/TaskBoard.tsx',
    """  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dept, setDept] = useState<Department>('Học thuật');
  const deptMembers = members.filter((m) => m.department === dept);
  const [assigneeId, setAssigneeId] = useState(
    (deptMembers.find((m) => m.role === 'Trưởng ban') || deptMembers[0])?.id || ''
  );""",
    """  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dept, setDept] = useState<Department>('Học thuật');
  const deptMembers = members.filter((m) => m.department === dept);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(() => {
    const head = deptMembers.find((m) => m.role === 'Trưởng ban') || deptMembers[0];
    return head ? [head.id] : [];
  });""")

sub('src/components/TaskBoard.tsx',
    """                onChange={(e) => {
                  const nextDept = e.target.value as Department;
                  setDept(nextDept);
                  const nextMembers = members.filter((m) => m.department === nextDept);
                  const head = nextMembers.find((m) => m.role === 'Trưởng ban') || nextMembers[0];
                  setAssigneeId(head?.id || '');
                }}""",
    """                onChange={(e) => {
                  const nextDept = e.target.value as Department;
                  setDept(nextDept);
                  const nextMembers = members.filter((m) => m.department === nextDept);
                  const head = nextMembers.find((m) => m.role === 'Trưởng ban') || nextMembers[0];
                  setAssigneeIds(head ? [head.id] : []);
                }}""")

sub('src/components/TaskBoard.tsx',
    """            <div>
              <label className="block text-slate-700 font-semibold mb-1">Người phụ trách:</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-[#2C69FF]"
              >
                {members
                  .filter((m) => m.department === dept)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
              </select>
            </div>""",
    """            <div>
              <label className="block text-slate-700 font-semibold mb-1">Người phụ trách:</label>
              <AssigneeMultiSelect
                members={deptMembers}
                selectedIds={assigneeIds}
                onChange={setAssigneeIds}
              />
            </div>""")

sub('src/components/TaskBoard.tsx',
    """    const member = members.find((m) => m.id === assigneeId);
    if (!member) return;

    onAdd({
      title: title.trim(),
      description: description.trim() || undefined,
      assigneeId: member.id,
      assigneeName: member.name,
      department: dept,""",
    """    const member = members.find((m) => m.id === assigneeIds[0]);
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
      department: dept,""")

# ===== 4. TaskCard: badge +N khi nhiều người phụ trách =====
sub('src/components/TaskCard.tsx',
    """            <span className="truncate font-semibold text-slate-800" title={task.assigneeName}>
              {task.assigneeName}
            </span>""",
    """            <span className="truncate font-semibold text-slate-800" title={task.assigneeName}>
              {task.assigneeName}
            </span>
            {(task.assigneeIds?.length || 0) > 1 && (
              <span
                className="px-1.5 py-0.5 rounded bg-[#2C69FF]/10 text-[#1E4FC4] text-[10px] font-bold shrink-0"
                title={`Công việc nhóm: ${task.assigneeIds.length} người cùng phụ trách`}
              >
                +{task.assigneeIds.length - 1}
              </span>
            )}""")

print('ALL PATCHES OK')
