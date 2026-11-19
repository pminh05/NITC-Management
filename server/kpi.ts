import { prisma } from './db';
import { AuthMember } from './auth';
import { isLeadership } from './permissions';
import { getSettings } from './settings';
import { todayVN, ymdVN } from '../shared/time';

// ===== G3: KPI thành viên — tự tính từ dữ liệu công việc =====
// Thang điểm (quy tắc nghiệp vụ NITC, sẽ đưa vào Settings ở G5):
//   Hoàn thành đúng hạn          +3
//   Hoàn thành trễ hạn           +1
//   Đã nộp minh chứng chờ duyệt  +1
//   Quá hạn chưa hoàn thành      −2
//   Đang làm (chưa đến hạn)       0
// Công việc nhóm (nhiều người phụ trách): mỗi người đều được tính điểm công việc đó.

// Mặc định — giá trị thật đọc từ bảng Settings (PUT /api/settings để chỉnh)
export const KPI_RULES = {
  completedOnTime: 3,
  completedLate: 1,
  submittedPending: 1,
  overdueUnfinished: -2,
};

/** Ngày nộp theo giờ Việt Nam (mốc thời gian lưu dạng ISO/UTC — cắt chuỗi sẽ lệch ngày với lượt nộp trước 7h sáng) */
function dateOf(iso?: string | null): string | null {
  if (!iso) return null;
  return ymdVN(iso) || null;
}

export interface MemberKpiRow {
  memberId: string;
  name: string;
  role: string;
  department: string;
  total: number;
  completed: number;
  onTime: number;
  late: number;
  pending: number;
  overdue: number;
  inProgress: number;
  points: number;
  completionRate: number;
}

export interface DeptKpiRow {
  department: string;
  total: number;
  completed: number;
  overdue: number;
  points: number;
  completionRate: number;
  memberCount: number;
}

type ScoredTask = { deadline: string; status: string; evidenceSubmittedAt: string | null; approvedAt: Date | null; updatedAt: Date };

/**
 * Ngày hoàn thành dùng để xét đúng/trễ hạn: ngày nộp minh chứng → ngày duyệt (Chủ nhiệm duyệt nhanh, không minh chứng)
 * → ngày sửa cuối (chỉ cho dữ liệu cũ chưa có hai mốc trên). Không dùng updatedAt trước tiên vì sửa tiêu đề/mô tả
 * sau khi xong cũng làm nó đổi, khiến việc đúng hạn bị tính thành trễ hạn.
 */
function doneDateOf(t: ScoredTask): string {
  return dateOf(t.evidenceSubmittedAt) || (t.approvedAt ? ymdVN(t.approvedAt) : '') || ymdVN(t.updatedAt);
}

/** Điểm 1 công việc cho 1 người dựa trên trạng thái + ngày nộp/hạn */
function scoreTaskFor(t: ScoredTask, rules: typeof KPI_RULES): number {
  const { deadline, status } = t;
  if (status === 'completed') {
    return doneDateOf(t) <= deadline ? rules.completedOnTime : rules.completedLate;
  }
  if (status === 'pending_approval') {
    return doneDateOf(t) <= deadline ? rules.submittedPending : 0;
  }
  const today = todayVN();
  if (deadline < today) return rules.overdueUnfinished;
  return 0;
}

/** Tính KPI toàn CLB; người không phải Ban lãnh đạo chỉ thấy ban mình */
export async function computeKpi(me: AuthMember): Promise<{
  rules: typeof KPI_RULES;
  members: MemberKpiRow[];
  departments: DeptKpiRow[];
}> {
  const settings = await getSettings();
  const rules: typeof KPI_RULES = {
    completedOnTime: settings.kpiOnTime,
    completedLate: settings.kpiLate,
    submittedPending: settings.kpiPending,
    overdueUnfinished: settings.kpiOverdue,
  };

  const [members, tasks] = await Promise.all([
    prisma.member.findMany({
      where: { status: 'active', term: { isActive: true } },
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
    }),
    // Chỉ việc của nhiệm kỳ hiện hành — sang nhiệm kỳ mới bảng thi đua bắt đầu lại từ đầu
    prisma.task.findMany({ where: { term: { isActive: true } } }),
  ]);

  const rows = new Map<string, MemberKpiRow>();
  for (const m of members) {
    rows.set(m.id, {
      memberId: m.id,
      name: m.name,
      role: m.role,
      department: m.department,
      total: 0,
      completed: 0,
      onTime: 0,
      late: 0,
      pending: 0,
      overdue: 0,
      inProgress: 0,
      points: 0,
      completionRate: 0,
    });
  }

  for (const t of tasks) {
    let ids: string[] = [t.assigneeId];
    try {
      const parsed = JSON.parse(t.assigneeIds);
      if (Array.isArray(parsed) && parsed.length > 0) ids = parsed;
    } catch {
      // fallback 1 người
    }
    const points = scoreTaskFor(t, rules);
    for (const id of ids) {
      const row = rows.get(id);
      if (!row) continue;
      row.total += 1;
      row.points += points;
      if (t.status === 'completed') {
        row.completed += 1;
        if (doneDateOf(t) <= t.deadline) row.onTime += 1;
        else row.late += 1;
      } else if (t.status === 'pending_approval') {
        row.pending += 1;
      } else if (t.deadline < todayVN()) {
        row.overdue += 1;
      } else {
        row.inProgress += 1;
      }
    }
  }

  const allMemberRows = [...rows.values()].map((r) => ({
    ...r,
    completionRate: r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0,
  }));

  // Phân quyền: không phải Ban lãnh đạo -> chỉ ban mình (vẫn giữ dòng của chính mình)
  const visibleMembers = isLeadership(me)
    ? allMemberRows
    : allMemberRows.filter((r) => r.department === me.department || r.memberId === me.id);

  // Tổng hợp theo ban (từ dữ liệu toàn CLB để lãnh đạo nhìn đúng; thành viên chỉ thấy ban mình)
  const deptMap = new Map<string, DeptKpiRow>();
  for (const r of allMemberRows) {
    const d = deptMap.get(r.department) || {
      department: r.department,
      total: 0,
      completed: 0,
      overdue: 0,
      points: 0,
      completionRate: 0,
      memberCount: 0,
    };
    d.total += r.total;
    d.completed += r.completed;
    d.overdue += r.overdue;
    d.points += r.points;
    d.memberCount += 1;
    deptMap.set(r.department, d);
  }
  const allDepts = [...deptMap.values()].map((d) => ({
    ...d,
    completionRate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
  }));
  const visibleDepts = isLeadership(me) ? allDepts : allDepts.filter((d) => d.department === me.department);

  // Sắp xếp: điểm giảm dần
  visibleMembers.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'vi'));
  visibleDepts.sort((a, b) => b.points - a.points);

  return { rules, members: visibleMembers, departments: visibleDepts };
}
