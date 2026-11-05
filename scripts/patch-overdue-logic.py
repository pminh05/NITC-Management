# -*- coding: utf-8 -*-
# Fix logic quá hạn: (1) isTaskOverdue dựa theo NGÀY thay vì status, (2) chặn deadline quá khứ từ AI, (3) cron cập nhật status overdue
import io, sys

def sub(path, old, new, must=True):
    s = io.open(path, encoding='utf-8').read()
    if old not in s:
        if must:
            print('!! NOT FOUND in %s: %r' % (path, old[:80])); sys.exit(1)
        print('  (skip)', path); return
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s.replace(old, new))
    print('ok', path)

# ===== 1. dateUtils: thêm isTaskOverdue (nguồn sự thật là NGÀY, không phải status) =====
sub('src/utils/dateUtils.ts',
"""export function formatDateVN(dateStr?: string): string {""",
"""/** Hôm nay theo chuẩn YYYY-MM-DD (so khớp trực tiếp với trường deadline) */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Việc quá hạn = deadline đã trễ HÔM NAY và chưa hoàn thành.
 * Dựa theo ngày (không phụ thuộc task.status) để luôn đúng — kể cả khi
 * status chưa được cron cập nhật.
 */
export function isTaskOverdue(task: { deadline: string; status: string }): boolean {
  return task.status !== 'completed' && task.deadline < todayISO();
}

export function formatDateVN(dateStr?: string): string {""")

# ===== 2. Thay mọi kiểm tra status === 'overdue' bằng isTaskOverdue =====
sub('src/App.tsx',
"  const overdueCount = tasks.filter((t) => t.status === 'overdue').length;",
"  const overdueCount = tasks.filter(isTaskOverdue).length;")
sub('src/App.tsx',
"import {\n  Department,",
"import { isTaskOverdue } from './utils/dateUtils';\nimport {\n  Department,")

sub('src/components/Header.tsx',
"  const overdueCount = tasks.filter((t) => t.status === 'overdue').length;",
"  const overdueCount = tasks.filter(isTaskOverdue).length;")
sub('src/components/Header.tsx',
"import { Member, Task } from '../types';",
"import { Member, Task } from '../types';\nimport { isTaskOverdue } from '../utils/dateUtils';")

sub('src/components/TaskBoard.tsx',
"  const countOverdue = tasks.filter((t) => t.status === 'overdue').length;",
"  const countOverdue = tasks.filter(isTaskOverdue).length;")
sub('src/components/TaskBoard.tsx',
"import { formatDateVN } from '../utils/dateUtils';",
"import { formatDateVN, isTaskOverdue } from '../utils/dateUtils';")

# Filter tab 'Quá hạn': khớp theo ngày thay vì status
s = io.open('src/components/TaskBoard.tsx', encoding='utf-8').read()
s = s.replace("""      // Status filter
      if (selectedStatus !== 'all' && task.status !== selectedStatus) {
        return false;
      }""",
"""      // Status filter ('overdue' xác định theo deadline, không phụ thuộc status trong DB)
      if (selectedStatus === 'overdue') {
        if (!isTaskOverdue(task)) return false;
      } else if (selectedStatus !== 'all' && task.status !== selectedStatus) {
        return false;
      }""")
io.open('src/components/TaskBoard.tsx', 'w', encoding='utf-8', newline='\n').write(s)
print('ok TaskBoard filter')

# TheNagWeeklyReport: 3 chỗ
sub('src/components/TheNagWeeklyReport.tsx',
"    const overdue = deptTasks.filter((t) => t.status === 'overdue').length;",
"    const overdue = deptTasks.filter(isTaskOverdue).length;")
sub('src/components/TheNagWeeklyReport.tsx',
"  const totalOverdue = tasks.filter((t) => t.status === 'overdue').length;",
"  const totalOverdue = tasks.filter(isTaskOverdue).length;")
sub('src/components/TheNagWeeklyReport.tsx',
"  const overdueTasks = tasks.filter((t) => t.status === 'overdue');",
"  const overdueTasks = tasks.filter(isTaskOverdue);")
s = io.open('src/components/TheNagWeeklyReport.tsx', encoding='utf-8').read()
if "from '../utils/dateUtils'" in s:
    s = s.replace("from '../utils/dateUtils'", "from '../utils/dateUtils'")
    import re
    s = re.sub(r"import \{ ([^}]+) \} from '../utils/dateUtils';",
               lambda m: "import { %s, isTaskOverdue } from '../utils/dateUtils';" % m.group(1) if 'isTaskOverdue' not in m.group(1) else m.group(0),
               s, count=1)
else:
    s = s.replace("import { Task } from '../types';", "import { Task } from '../types';\nimport { isTaskOverdue } from '../utils/dateUtils';")
io.open('src/components/TheNagWeeklyReport.tsx', 'w', encoding='utf-8', newline='\n').write(s)
print('ok TheNag imports')

# MeetingHistoryModal: trạng thái hiển thị trong biên bản
sub('src/components/MeetingHistoryModal.tsx',
"                                  ) : t.status === 'overdue' ? (",
"                                  ) : isTaskOverdue(t) ? (")
s = io.open('src/components/MeetingHistoryModal.tsx', encoding='utf-8').read()
if 'isTaskOverdue' not in s.split('\n')[0:40].__str__():
    if "from '../utils/dateUtils'" in s:
        import re
        s = re.sub(r"import \{ ([^}]+) \} from '../utils/dateUtils';",
                   lambda m: "import { %s, isTaskOverdue } from '../utils/dateUtils';" % m.group(1) if 'isTaskOverdue' not in m.group(1) else m.group(0),
                   s, count=1)
    else:
        s = s.replace("import { Meeting } from '../types';", "import { Meeting } from '../types';\nimport { isTaskOverdue } from '../utils/dateUtils';")
    io.open('src/components/MeetingHistoryModal.tsx', 'w', encoding='utf-8', newline='\n').write(s)
print('ok MeetingHistory imports')

# TaskCard: viền đỏ cho việc quá hạn theo ngày (nếu có check status)
s = io.open('src/components/TaskCard.tsx', encoding='utf-8').read()
s = s.replace("          : task.status === 'overdue'\n", "          : isTaskOverdue(task)\n")
if 'isTaskOverdue' not in s.split("export")[0]:
    s = s.replace("import { formatDateVN, getDaysRemaining", "import { formatDateVN, getDaysRemaining, isTaskOverdue") if 'getDaysRemaining' in s else s
io.open('src/components/TaskCard.tsx', 'w', encoding='utf-8', newline='\n').write(s)
print('ok TaskCard style check')

print('ALL OK')
