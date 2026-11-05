# -*- coding: utf-8 -*-
# Patch: dept-filtered assignee + deadline sort + description field
import io, sys

def patch(path, pairs):
    s = io.open(path, encoding='utf-8').read()
    for old, new in pairs:
        if old not in s:
            print('!! NOT FOUND in %s: %r' % (path, old[:70]))
            sys.exit(1)
        s = s.replace(old, new, 1)
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s)
    print('patched', path)

# ===== 1. types.ts: ExtractedDraftTask thêm description =====
patch('src/types.ts', [
    (
        'export interface ExtractedDraftTask {\n  tempId: string;\n  title: string;\n  rawAssigneeText: string;',
        'export interface ExtractedDraftTask {\n  tempId: string;\n  title: string;\n  description?: string;\n  rawAssigneeText: string;'
    ),
])

# ===== 2. PresidentialFilterModal =====
patch('src/components/PresidentialFilterModal.tsx', [
    # 2a. Đổi ban -> bỏ chọn người không thuộc ban mới
    (
        """        const updated = { ...t, ...updates };

        // If assignee changed, re-check absentee and clear ambiguity flag if manually resolved""",
        """        const updated = { ...t, ...updates };

        // Đổi ban: nếu người đang chọn không thuộc ban mới thì bỏ chọn (chỉ gán người trong ban)
        if (updates.suggestedDepartment && updates.suggestedDepartment !== t.suggestedDepartment) {
          const currentAssignee = members.find((m) => m.id === updated.suggestedAssigneeId);
          if (!currentAssignee || currentAssignee.department !== updates.suggestedDepartment) {
            updated.suggestedAssigneeId = '';
            updated.suggestedAssigneeName = '';
          }
        }

        // If assignee changed, re-check absentee and clear ambiguity flag if manually resolved"""
    ),
    # 2b. Dropdown người phụ trách chỉ trong cùng ban + ghi chú
    (
        """                      <option value="">-- Chưa chọn người phụ trách --</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.department} - {m.role})
                        </option>
                      ))}
                    </select>""",
        """                      <option value="">-- Chưa chọn người phụ trách --</option>
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
                    </p>"""
    ),
    # 2c. Textarea mô tả dưới tiêu đề
    (
        """                {/* Task Title Edit */}
                <div className="mb-3">
                  <input
                    type="text"
                    value={task.title}
                    onChange={(e) =>
                      handleUpdateTask(task.tempId, { title: e.target.value })
                    }
                    className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-700 rounded-lg text-sm text-white font-medium focus:outline-none focus:border-indigo-500"
                    placeholder="Tên đầu việc..."
                  />
                </div>""",
        """                {/* Task Title Edit */}
                <div className="mb-3 space-y-2">
                  <input
                    type="text"
                    value={task.title}
                    onChange={(e) =>
                      handleUpdateTask(task.tempId, { title: e.target.value })
                    }
                    className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-700 rounded-lg text-sm text-white font-medium focus:outline-none focus:border-indigo-500"
                    placeholder="Tên đầu việc..."
                  />
                  <textarea
                    value={task.description || ''}
                    onChange={(e) =>
                      handleUpdateTask(task.tempId, { description: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500 resize-none"
                    placeholder="Mô tả chi tiết công việc (không bắt buộc — AI tự điền nếu biên bản ghi rõ)..."
                  />
                </div>"""
    ),
])

# ===== 3. TaskBoard: sort deadline + QuickAdd (ban trước, người sau, mô tả) =====
patch('src/components/TaskBoard.tsx', [
    (
        """      return true;
    });
  }, [tasks, selectedDept, selectedStatus, onlySticky, searchQuery]);""",
        """      return true;
    }).sort((a, b) => a.deadline.localeCompare(b.deadline)); // việc sắp đến hạn nhất lên đầu
  }, [tasks, selectedDept, selectedStatus, onlySticky, searchQuery]);"""
    ),
    (
        """  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState(members[1]?.id || members[0]?.id || '');
  const [deadline, setDeadline] = useState(
    new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
  );
  const [verificationType, setVerificationType] = useState<'link_required' | 'report_required'>('link_required');
  const [isSticky, setIsSticky] = useState(false);

  if (!isOpen) return null;""",
        """  const departments: Department[] = ['Học thuật', 'Truyền thông', 'Sự kiện', 'Đối ngoại', 'Ban Chủ nhiệm'];
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dept, setDept] = useState<Department>('Học thuật');
  const deptMembers = members.filter((m) => m.department === dept);
  const [assigneeId, setAssigneeId] = useState(
    (deptMembers.find((m) => m.role === 'Trưởng ban') || deptMembers[0])?.id || ''
  );
  const [deadline, setDeadline] = useState(
    new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
  );
  const [verificationType, setVerificationType] = useState<'link_required' | 'report_required'>('link_required');
  const [isSticky, setIsSticky] = useState(false);

  if (!isOpen) return null;"""
    ),
    (
        """    const member = members.find((m) => m.id === assigneeId);
    if (!member) return;

    onAdd({
      title: title.trim(),
      assigneeId: member.id,
      assigneeName: member.name,
      department: member.department,""",
        """    const member = members.find((m) => m.id === assigneeId);
    if (!member) return;

    onAdd({
      title: title.trim(),
      description: description.trim() || undefined,
      assigneeId: member.id,
      assigneeName: member.name,
      department: dept,"""
    ),
    (
        """          <div>
            <label className="block text-slate-700 font-semibold mb-1">Người phụ trách:</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-[#2C69FF]"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.department} - {m.role})
                </option>
              ))}
            </select>
          </div>""",
        """          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Ban phụ trách:</label>
              <select
                value={dept}
                onChange={(e) => {
                  const nextDept = e.target.value as Department;
                  setDept(nextDept);
                  const nextMembers = members.filter((m) => m.department === nextDept);
                  const head = nextMembers.find((m) => m.role === 'Trưởng ban') || nextMembers[0];
                  setAssigneeId(head?.id || '');
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
          </div>"""
    ),
])

print('ALL PATCHES OK')
