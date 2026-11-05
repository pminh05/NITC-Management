// Test đa phụ trách: publish việc 2 người + chọn tất cả (cả ban)
import 'dotenv/config';

const BASE = 'http://localhost:3000';
async function login(email: string): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'nitc123' }),
  });
  const d: any = await r.json();
  return d.token;
}

async function main() {
  const president = await login('phamphucminhlehong@gmail.com');
  const members: any[] = await (await fetch(`${BASE}/api/members`, { headers: { Authorization: `Bearer ${president}` } })).json();
  const skMembers = members.filter((m) => m.department === 'Sự kiện');
  const [a, b, c] = skMembers;

  console.log('=== 1. Publish việc nhóm 2 người ===');
  let r = await fetch(`${BASE}/api/meetings/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${president}` },
    body: JSON.stringify({
      meeting: { title: 'BBH Test công việc nhóm', date: '2026-11-05', attendees: [], absentees: [] },
      tasks: [{
        title: 'Dọn dẹp và trang trí kho đồ Sự kiện',
        description: 'Kiểm kê đồ sau sự kiện NCD',
        suggestedDepartment: 'Sự kiện',
        suggestedAssigneeId: a.id,
        suggestedAssigneeIds: [a.id, b.id],
        suggestedDeadline: '2026-11-20',
        verificationType: 'report_required',
        priority: 'medium',
      }],
    }),
  });
  const d1: any = await r.json();
  console.log('HTTP', r.status, '| department:', d1.meeting?.department, '| assigneeIds:', d1.tasks?.[0]?.assigneeIds, '| primary:', d1.tasks?.[0]?.assigneeName);

  console.log('=== 2. Publish việc GIAO CẢ BAN (chọn tất cả) ===');
  r = await fetch(`${BASE}/api/meetings/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${president}` },
    body: JSON.stringify({
      meeting: { title: 'BBH Test cả ban', date: '2026-11-05', attendees: [], absentees: [] },
      tasks: [{
        title: 'Tổng hợp ý tưởng cho sự kiện tháng 12 (cả ban góp ý)',
        suggestedDepartment: 'Sự kiện',
        suggestedAssigneeId: skMembers[0].id,
        suggestedAssigneeIds: skMembers.map((m) => m.id),
        suggestedDeadline: '2026-11-25',
        verificationType: 'report_required',
        priority: 'normal',
      }],
    }),
  });
  const d2: any = await r.json();
  console.log('HTTP', r.status, '| assigneeIds count:', d2.tasks?.[0]?.assigneeIds?.length, '(cả ban:', skMembers.length, ')');

  console.log('=== 3. Người thứ 2 trong nhóm có được xem việc? ===');
  const second = await login(b.email);
  const tasksB: any[] = await (await fetch(`${BASE}/api/tasks`, { headers: { Authorization: `Bearer ${second}` } })).json();
  const found = tasksB.find((t) => t.title.includes('Dọn dẹp'));
  console.log('Thành viên', b.name, 'thấy việc nhóm:', !!found, '| +N badge data:', found?.assigneeIds);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
