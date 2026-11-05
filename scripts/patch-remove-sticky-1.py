# -*- coding: utf-8 -*-
# Patch: bỏ Sticky (việc lưu chuyển) toàn hệ thống + phân quyền họp riêng theo ban
import io, sys, re

def read(p): return io.open(p, encoding='utf-8').read()
def write(p, s): io.open(p, 'w', encoding='utf-8', newline='\n').write(s)

def sub(path, old, new, must=True):
    s = read(path)
    if old not in s:
        if must:
            print('!! NOT FOUND in %s: %r' % (path, old[:80])); sys.exit(1)
        print('  (skip) %s' % path); return
    s = s.replace(old, new)
    write(path, s)
    print('ok', path)

# ============ 1. App.tsx: bỏ sticky UI + mở AI parser cho Trưởng/Phó ban ============
p = 'src/App.tsx'
s = read(p)
s = s.replace("""  const [selectedTermId, setSelectedTermId] = useState<string>('active');""", """  const [selectedTermId, setSelectedTermId] = useState<string>('active');""")
# sidebarOnlySticky state + stickyCount + sidebar button
s = s.replace("""  const [sidebarDeptFilter, setSidebarDeptFilter] = useState<string>('all');
  const [sidebarStatusFilter, setSidebarStatusFilter] = useState<string>('all');
  const [sidebarOnlySticky, setSidebarOnlySticky] = useState<boolean>(false);""",
"""  const [sidebarDeptFilter, setSidebarDeptFilter] = useState<string>('all');
  const [sidebarStatusFilter, setSidebarStatusFilter] = useState<string>('all');""")
s = s.replace("  const stickyCount = tasks.filter((t) => t.isSticky && t.status !== 'completed').length;\n", "")
s = s.replace("""            {isLeadership && (
              <button
                onClick={() => setIsParserOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-md text-xs transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span>🤖</span>
                  <span>AI đọc biên bản họp</span>
                </div>
                <span className="text-[10px] bg-[#2C69FF]/15 text-[#1E4FC4] px-1.5 py-0.5 rounded font-bold">
                  Mới
                </span>
              </button>
            )}

            <button
              onClick={() => {
                setSidebarOnlySticky(true);
                setSidebarDeptFilter('all');
                setSidebarStatusFilter('all');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition cursor-pointer ${
                sidebarOnlySticky
                  ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200/60'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span>📋</span>
                <span>Việc lưu chuyển</span>
              </div>
              {stickyCount > 0 && (
                <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">
                  {stickyCount}
                </span>
              )}
            </button>""",
"""            {canManageMeetings && (
              <button
                onClick={() => setIsParserOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-md text-xs transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span>🤖</span>
                  <span>AI đọc biên bản họp</span>
                </div>
                <span className="text-[10px] bg-[#2C69FF]/15 text-[#1E4FC4] px-1.5 py-0.5 rounded font-bold">
                  Mới
                </span>
              </button>
            )}""")
s = s.replace("""              onClick={() => {
                setSidebarDeptFilter('all');
                setSidebarStatusFilter('all');
                setSidebarOnlySticky(false);
              }}""",
"""              onClick={() => {
                setSidebarDeptFilter('all');
                setSidebarStatusFilter('all');
              }}""")
s = s.replace("""                  onClick={() => {
                    setSidebarDeptFilter(dept);
                    setSidebarOnlySticky(false);
                    setSidebarStatusFilter('all');
                  }}""",
"""                  onClick={() => {
                    setSidebarDeptFilter(dept);
                    setSidebarStatusFilter('all');
                  }}""")
# canManageMeetings definition
s = s.replace("""  const isLeadership = currentRole === 'Chủ tịch' || currentRole === 'Phó Chủ tịch';""",
"""  const isLeadership = currentRole === 'Chủ tịch' || currentRole === 'Phó Chủ tịch';
  // Ban quản lý được họp riêng & ban hành việc của ban mình
  const canManageMeetings = isLeadership || currentRole === 'Trưởng ban' || currentRole === 'Phó ban';""")
# TaskBoard props: bỏ sticky filter
s = s.replace("""            onlyStickyProp={sidebarOnlySticky}
            onSelectDeptFilter={setSidebarDeptFilter}
            onSelectStatusFilter={setSidebarStatusFilter}
            onSelectStickyFilter={setSidebarOnlySticky}""",
"""            onSelectDeptFilter={setSidebarDeptFilter}
            onSelectStatusFilter={setSidebarStatusFilter}""")
# Banner button mở parser cho canManageMeetings
s = s.replace("""            {isLeadership && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsParserOpen(true)
                  }""", """XXX-noop""")
s = s.replace("""            {isLeadership && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsParserOpen(true)}""",
"""            {canManageMeetings && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsParserOpen(true)}""")
# Modals: parser + filter cho canManageMeetings
s = s.replace("""      {/* Modal 1: BBH Input & AI Parser (chỉ Chủ tịch) */}
      {isLeadership && (""",
"""      {/* Modal 1: BBH Input & AI Parser (Ban lãnh đạo + Trưởng/Phó ban họp riêng) */}
      {canManageMeetings && (""")
s = s.replace("""      {/* Modal 2: Presidential Filter (Quy tắc Minh, Cảnh báo vắng mặt, Phê duyệt) */}
      {isLeadership && (""",
"""      {/* Modal 2: Presidential Filter (Quy tắc trùng tên, Cảnh báo vắng mặt, Phê duyệt) */}
      {canManageMeetings && (""")
# Banner text: bỏ nhắc 'Việc lưu chuyển'
s = s.replace(' <strong className="text-purple-700">Việc lưu chuyển (không tự biến mất giữa các kỳ họp)</strong> &bull; ', '')
# Truyền role cho filter modal (khóa ban cho TB/PB)
s = s.replace("""        <PresidentialFilterModal
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          meetingData={parsedMeetingData || {}}
          draftTasks={parsedDraftTasks}
          members={members}
          onPublishTasks={handlePublishTasks}
        />""",
"""        <PresidentialFilterModal
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          meetingData={parsedMeetingData || {}}
          draftTasks={parsedDraftTasks}
          members={members}
          authMember={authMember!}
          onPublishTasks={handlePublishTasks}
        />""")
write(p, s)
print('ok App.tsx')

# ============ 2. Header.tsx: bỏ badge sticky ============
p = 'src/components/Header.tsx'
s = read(p)
s = s.replace("  const stickyCount = tasks.filter((t) => t.isSticky && t.status !== 'completed').length;\n", "")
s = s.replace("""            {stickyCount > 0 && (
              <div className="flex items-center gap-1 bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 font-semibold" title="Nhiệm vụ chưa xong từ kỳ họp trước">
                <Pin className="w-3 h-3 text-purple-400 rotate-45" />
                <span>Lưu chuyển: {stickyCount}</span>
              </div>
            )}
""", "")
s = s.replace("  Pin,\n", "")
write(p, s)
print('ok Header.tsx')

# ============ 3. TaskBoard.tsx: bỏ sticky filter/checkbox + mở QuickAdd cho TB/PB ============
p = 'src/components/TaskBoard.tsx'
s = read(p)
s = s.replace("  onlyStickyProp?: boolean;\n", "")
s = s.replace("  onSelectStickyFilter?: (sticky: boolean) => void;\n", "")
s = s.replace("""  onlyStickyProp,
""", "")
s = s.replace("""  onSelectStickyFilter,
""", "")
s = s.replace("""  const [internalSticky, setInternalSticky] = useState<boolean>(false);""", "")
s = s.replace("""  const onlySticky = onlyStickyProp !== undefined ? onlyStickyProp : internalSticky;
""", "")
s = s.replace("""  const setSticky = (val: boolean) => {
    if (onSelectStickyFilter) onSelectStickyFilter(val);
    setInternalSticky(val);
  };
""", "")
# filter logic sticky
s = s.replace("""      // Sticky filter
      if (onlySticky && (!task.isSticky || task.status === 'completed')) {
        return false;
      }
""", "")
# countSticky
s = s.replace("  const countSticky = tasks.filter((t) => t.isSticky && t.status !== 'completed').length;\n", "")
# clear-filter button condition
s = s.replace("(searchQuery || selectedStatus !== 'all' || selectedDept !== 'all' || onlySticky)", "(searchQuery || selectedStatus !== 'all' || selectedDept !== 'all')")
s = s.replace("""                  setSticky(false);
""", "")
# Sticky filter button UI
s = s.replace("""            <button
              onClick={() => setSticky(!onlySticky)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
                onlySticky
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
              title="Chỉ hiển thị các nhiệm vụ chưa hoàn thành từ tuần trước chuyển sang"
            >
              <Pin className="w-3.5 h-3.5 text-purple-400 rotate-45" />
              <span>Lưu chuyển ({countSticky})</span>
            </button>
""", "")
# QuickAdd sticky checkbox
s = s.replace("""          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="stickyCheck"
              checked={isSticky}
              onChange={(e) => setIsSticky(e.target.checked)}
              className="rounded bg-slate-100 border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="stickyCheck" className="text-slate-700 font-medium cursor-pointer">
              Đánh dấu là việc lưu chuyển từ kỳ họp trước
            </label>
          </div>

""", "")
s = s.replace("""  const [isSticky, setIsSticky] = useState(false);

  if (!isOpen) return null;""", "\n  if (!isOpen) return null;")
s = s.replace("""      status: 'in_progress',
      verificationType,
      isSticky,
      priority: 'high',""", """      status: 'in_progress',
      verificationType,
      priority: 'high',""")
# QuickAdd: mở cho Ban lãnh đạo + TB/PB (thay vì chỉ Chủ tịch)
s = s.replace("""          {/* President Action Buttons */}
          {currentRole === 'Chủ tịch' && (""",
"""          {/* Giao việc nhanh: Ban lãnh đạo + Trưởng/Phó ban */}
          {['Chủ tịch', 'Phó Chủ tịch', 'Trưởng ban', 'Phó ban'].includes(currentRole) && (""")
# Pin import nếu không còn dùng
if '<Pin' not in s and 'Pin,' in s:
    s = s.replace("  Pin,\n", "")
write(p, s)
print('ok TaskBoard.tsx')
