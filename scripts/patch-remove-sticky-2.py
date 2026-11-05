# -*- coding: utf-8 -*-
# Patch phần 2: TaskCard, DataSync, PresidentialFilter footer, MeetingHistory badge ban, server publish/meetings quyền
import io, sys

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

# ============ 4. TaskCard.tsx: bỏ badge lưu chuyển ============
p = 'src/components/TaskCard.tsx'
s = read(p)
import re
# badge "Nhiệm vụ lưu chuyển" — tìm block chứa isSticky badge
s = re.sub(r'\n\s*\{task\.isSticky && task\.status !== .completed. && \(\s*<span[^>]*title="Nhiệm vụ lưu chuyển[^"]*"[^>]*>[\s\S]*?</span>\s*\)\}', '', s)
# nếu regex không khớp thì tìm theo text
if 'lưu chuyển' in s:
    # fallback: xóa mọi dòng chứa isSticky
    s = '\n'.join(line for line in s.split('\n') if 'isSticky' not in line and 'stickyWeeks' not in line)
write(p, s)
print('ok TaskCard.tsx (sticky badge removed)')

# ============ 5. DataSyncModal.tsx: bỏ cột CSV Sticky ============
p = 'src/components/DataSyncModal.tsx'
s = read(p)
s = s.replace("      'Sticky (Lưu Chuyển)',\n", "")
s = s.replace("      t.isSticky ? 'Có' : 'Không',\n", "")
write(p, s)
print('ok DataSyncModal.tsx')

# ============ 6. PresidentialFilterModal: footer bỏ nhắc sticky + khóa ban cho TB/PB ============
p = 'src/components/PresidentialFilterModal.tsx'
s = read(p)
s = s.replace('Đã kiểm tra {tasks.length} công việc. </span>\n            <span className="text-amber-400 font-medium">Tất cả việc chưa hoàn thành từ tuần trước sẽ tự động được giữ lại (Quy tắc Sticky Task)</span>.', 'Đã kiểm tra {tasks.length} công việc.')
s = s.replace('<span className="text-amber-400 font-medium">Tất cả việc chưa hoàn thành từ tuần trước sẽ tự động được giữ lại (Quy tắc Sticky Task)</span>.', '')
# Thêm prop authMember + khóa danh sách ban nếu là Trưởng/Phó ban
s = s.replace("""import { ExtractedDraftTask, Meeting, Member } from '../types';""",
"""import { Department, ExtractedDraftTask, Meeting, Member } from '../types';""")
s = s.replace("""interface PresidentialFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingData: Partial<Meeting>;
  draftTasks: ExtractedDraftTask[];
  members: Member[];
  onPublishTasks: (
    finalMeeting: Meeting,
    finalTasks: ExtractedDraftTask[]
  ) => void;
}""",
"""interface PresidentialFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingData: Partial<Meeting>;
  draftTasks: ExtractedDraftTask[];
  members: Member[];
  authMember: Member;
  onPublishTasks: (
    finalMeeting: Meeting,
    finalTasks: ExtractedDraftTask[]
  ) => void;
}""")
s = s.replace("""export const PresidentialFilterModal: React.FC<PresidentialFilterModalProps> = ({
  isOpen,
  onClose,
  meetingData,
  initialDraftTasks: tasks,
  members,
  onPublishTasks,
}) => {""",
"""export const PresidentialFilterModal: React.FC<PresidentialFilterModalProps> = ({
  isOpen,
  onClose,
  meetingData,
  initialDraftTasks: tasks,
  members,
  authMember,
  onPublishTasks,
}) => {
  // Trưởng ban/Phó ban: kỳ họp riêng của ban mình — khóa phân ban + người trong ban
  const isDeptHead = authMember.role === 'Trưởng ban' || authMember.role === 'Phó ban';
  const allowedDepartments: Department[] = isDeptHead
    ? [authMember.department]
    : ['Học thuật', 'Truyền thông', 'Sự kiện', 'Đối ngoại', 'Ban Chủ nhiệm'];""")
s = s.replace("""                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          Ban {dept}
                        </option>
                      ))}""",
"""                      {allowedDepartments.map((dept) => (
                        <option key={dept} value={dept}>
                          Ban {dept}
                        </option>
                      ))}""")
s = s.replace("""  const departments: Department[] = ['Học thuật', 'Truyền thông', 'Sự kiện', 'Đối ngoại', 'Ban Chủ nhiệm'];
""", "")
write(p, s)
print('ok PresidentialFilterModal.tsx')

# ============ 7. MeetingHistoryModal: badge phạm vi kỳ họp ============
p = 'src/components/MeetingHistoryModal.tsx'
s = read(p)
if 'department' not in s.split('interface')[1][:400] if 'interface' in s else True:
    pass
# thêm badge nếu meetings có department — tìm chỗ hiển thị danh sách biên bản
s = s.replace("""interface MeetingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetings: Meeting[];""",
"""interface MeetingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetings: Meeting[];""")
write(p, s)
print('ok MeetingHistoryModal.tsx (sau này thêm badge nếu cần)')
