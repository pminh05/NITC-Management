// Test phân quyền họp riêng theo ban (G2.8)
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
const fmt = (r: Response, note: string) => console.log(`${note}: HTTP ${r.status}`);

async function main() {
  const president = await login('phamphucminhlehong@gmail.com');
  const ttHead = await login('huynchang124@gmail.com'); // Trần Thị Huyền Trang - TB Truyền thông
  const htHead = await login('anhthulengoc00@gmail.com'); // Lê Ngọc Anh Thư - TB Học thuật
  const memberTT = await login('loanhtien1@gmail.com'); // Lô Anh Tiến - Thành viên Truyền thông
  const memberSK = await login('anhhphamne@gmail.com'); // Phạm Tuấn Anh - Thành viên Sự kiện

  // Lấy id thành viên Truyền thông
  const memRes = await fetch(`${BASE}/api/members`, { headers: { Authorization: `Bearer ${president}` } });
  const members: any[] = await memRes.json();
  const hamy = members.find((m) => m.name === 'Chu Hà My'); // Truyền thông
  const anhtu = members.find((m) => m.name === 'Đoàn Anh Tú'); // Sự kiện

  console.log('=== 1. TB Truyền thông parse BBH riêng (được phép) ===');
  fmt(
    await fetch(`${BASE}/api/gemini/parse-bbh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ttHead}` },
      body: JSON.stringify({ bbhText: 'BBH Ban Truyền thông riêng\nKế hoạch sắp tới\nChuẩn bị key visual', members: [], meetingDate: '2026-11-05' }),
    }),
    'TB TT parse BBH'
  );
  fmt(
    await fetch(`${BASE}/api/gemini/parse-bbh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberTT}` },
      body: JSON.stringify({ bbhText: 'x', members: [], meetingDate: '2026-11-05' }),
    }),
    'Thành viên parse BBH (kỳ vọng 403)'
  );

  console.log('=== 2. TB TT ban hành việc có cross-dept (kỳ vọng 403) ===');
  const cross = await fetch(`${BASE}/api/meetings/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ttHead}` },
    body: JSON.stringify({
      meeting: { title: 'BBH riêng Truyền thông 11/11', date: '2026-11-05', attendees: [], absentees: [] },
      tasks: [{ title: 'Việc của ban Sự kiện', suggestedDepartment: 'Sự kiện', suggestedAssigneeId: anhtu.id, suggestedDeadline: '2026-11-12', verificationType: 'report_required' }],
    }),
  });
  fmt(cross, 'Cross-dept publish');
  console.log('  body:', JSON.stringify(await cross.json()));

  console.log('=== 3. TB TT ban hành việc đúng ban (kỳ vọng 201) ===');
  const ok = await fetch(`${BASE}/api/meetings/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ttHead}` },
    body: JSON.stringify({
      meeting: { title: 'BBH riêng Truyền thông 11/11', date: '2026-11-05', attendees: [], absentees: [] },
      tasks: [{ title: 'Thiết kế backdrop NCD', suggestedDepartment: 'Truyền thông', suggestedAssigneeId: hamy.id, suggestedDeadline: '2026-11-12', verificationType: 'link_required', description: 'Backdrop dựng ở Canva' }],
    }),
  });
  fmt(ok, 'Own-dept publish');
  const okBody: any = await ok.json();
  console.log('  meeting.department:', okBody.meeting?.department, '| tasks:', okBody.tasks?.length, '| desc:', okBody.tasks?.[0]?.description);

  console.log('=== 4. Quyền xem meetings ===');
  const seenTT: any[] = await (await fetch(`${BASE}/api/meetings`, { headers: { Authorization: `Bearer ${memberTT}` } })).json();
  console.log('  Member TT thấy:', seenTT.map((m) => `${m.title} [${m.department}]`));
  const seenSK: any[] = await (await fetch(`${BASE}/api/meetings`, { headers: { Authorization: `Bearer ${memberSK}` } })).json();
  console.log('  Member SK thấy:', seenSK.map((m) => `${m.title} [${m.department}]`), '(kỳ vọng KHÔNG có BBH riêng Truyền thông)');
  const seenPres: any[] = await (await fetch(`${BASE}/api/meetings`, { headers: { Authorization: `Bearer ${president}` } })).json();
  console.log('  Chủ tịch thấy:', seenPres.map((m) => `${m.title} [${m.department}]`));

  console.log('=== 5. Quyền xem tasks ===');
  const tasksTT: any[] = await (await fetch(`${BASE}/api/tasks`, { headers: { Authorization: `Bearer ${memberTT}` } })).json();
  console.log('  Member TT thấy tasks:', tasksTT.map((t) => `${t.department}/${t.assigneeName}`));
  const tasksSK: any[] = await (await fetch(`${BASE}/api/tasks`, { headers: { Authorization: `Bearer ${memberSK}` } })).json();
  console.log('  Member SK thấy tasks:', tasksSK.map((t) => `${t.department}/${t.assigneeName}`), '(kỳ vọng không có việc Truyền thông của Hà My)');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
