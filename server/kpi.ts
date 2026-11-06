import { prisma } from './db';
import { isLeadership, AuthMember } from './auth';

// ===== G3: KPI thành viên — tự tính từ dữ liệu công việc =====
// Thang điểm (quy tắc nghiệp vụ NITC, sẽ đưa vào Settings ở G5):
//   Hoàn thành đúng hạn          +3
//   Hoàn thành trễ hạn           +1
//   Đã nộp minh chứng chờ duyệt  +1
//   Quá hạn chưa hoàn thành      −2
//   Đang làm (chưa đến hạn)       0
// Công việc nhóm (nhiều người phụ trách): mỗi người đều được tính điểm công việc đó.

export const KPI_RULES = {
  completedOnTime: 3,
  completedLate: 1,
  submittedPending: 1,
  overdueUnfinished: -2,
};

function dateOf(iso?: string | null): string | null {
  if (!iso) return null;
  return iso.split('T')[0];
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

/** Điểm 1 công việc cho 1 người dựa trên trạng thái + ngày nộp/hạn */
function scoreTaskFor(deadline: string, status: string, evidenceSubmittedAt: string | null, updatedAt: Date): number {
  if (status === 'completed') {
    const submittedDate = dateOf(evidenceSubmittedAt) || updatedAt.toISOString().split('T')[0];
    return submittedDate <= deadline ? KPI_RULES.completedOnTime : KPI_RULES.completedLate;
  }
  if (status === 'pending_approval') {
    const submittedDate = dateOf(evidenceSubmittedAt) || updatedAt.toISOString().split('T')[0];
    return submittedDate <= deadline ? KPI_RULES.submittedPending : 0;
  }
  const today = new Date().toISOString().split('T')[0];
  if (deadline < today) return KPI_RULES.overdueUnfinished;
  return 0;
}

/** Tính KPI toàn CLB; người không phải Ban lãnh đạo chỉ thấy ban mình */
export async function computeKpi(me: AuthMember): Promise<{
  rules: typeof KPI_RULES;
  members: MemberKpiRow[];
  departments: DeptKpiRow[];
}> {
  const [members, tasks] = await Promise.all([
    prisma.member.findMany({
      where: { status: 'active', term: { isActive: true } },
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
    }),
    prisma.task.findMany(),
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
    const points = scoreTaskFor(t.deadline, t.status, t.evidenceSubmittedAt, t.updatedAt);
    for (const id of ids) {
      const row = rows.get(id);
      if (!row) continue;
      row.total += 1;
      row.points += points;
      if (t.status === 'completed') {
        row.completed += 1;
        const submittedDate = dateOf(t.evidenceSubmittedAt) || t.updatedAt.toISOString().split('T')[0];
        if (submittedDate <= t.deadline) row.onTime += 1;
        else row.late += 1;
      } else if (t.status === 'pending_approval') {
        row.pending += 1;
      } else if (t.deadline < new Date().toISOString().split('T')[0]) {
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

  return { rules: KPI_RULES, members: visibleMembers, departments: visibleDepts };
}
