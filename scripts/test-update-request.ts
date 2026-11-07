// Test luồng yêu cầu cập nhật: thành viên gửi -> lãnh đạo phản hồi (approve/reject)
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
  const memberTT = await login('chuhamy1107@gmail.com'); // Chu Hà My - TV Truyền thông

  // Tìm 1 task pending_approval của Truyền thông
  const tasks: any[] = await (await fetch(`${BASE}/api/tasks`, { headers: { Authorization: `Bearer ${president}` } })).json();
  const pending = tasks.find((t) => t.department === 'Truyền thông' && t.status === 'pending_approval');
  if (!pending) {
    console.log('Không có task pending của Truyền thông — nộp minh chứng trước...');
    const ttTask = tasks.find((t) => t.department === 'Truyền thông' && t.status === 'in_progress');
    if (ttTask) {
      await fetch(`${BASE}/api/tasks/${ttTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${president}` },
        body: JSON.stringify({ action: 'submit_evidence', link: 'https://drive.google.com/file/test', report: 'Đã hoàn thành.' }),
      });
    }
  }

  const current: any = await (await fetch(`${BASE}/api/tasks`, { headers: { Authorization: `Bearer ${president}` } })).json();
  const target = current.find((t) => t.department === 'Truyền thông' && t.status === 'pending_approval');
  console.log('Task test:', target.title.slice(0, 50));

  console.log('\n=== 1. Thành viên gửi yêu cầu cập nhật ===');
  let r = await fetch(`${BASE}/api/tasks/${target.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberTT}` },
    body: JSON.stringify({ action: 'request_update', note: 'Cần chỉnh lại link minh chứng — standee đã đổi thiết kế' }),
  });
  console.log('HTTP', r.status, JSON.stringify(await r.json()));

  console.log('=== 2. Trưởng ban Truyền thông phản hồi + feedback (approve) ===');
  const tbTT = await login('huynchang124@gmail.com');
  r = await fetch(`${BASE}/api/tasks/${target.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tbTT}` },
    body: JSON.stringify({ action: 'respond_update', decision: 'approve', feedback: 'Ừ standee mới đẹp hơn, sửa link nộp lại nhé' }),
  });
  const d2: any = await r.json();
  console.log('HTTP', r.status, '| status:', d2.status, '| feedback:', d2.updateFeedback);

  console.log('=== 3. Phản hồi khi KHÔNG có yêu cầu (kỳ vọng 400) ===');
  r = await fetch(`${BASE}/api/tasks/${target.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${president}` },
    body: JSON.stringify({ action: 'respond_update', decision: 'approve', feedback: 'test' }),
  });
  console.log('HTTP', r.status, JSON.stringify(await r.json()));

  console.log('=== 4. Feedback thiếu (kỳ vọng 400) ===');
  // Tạo yêu cầu lại
  await fetch(`${BASE}/api/tasks/${target.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberTT}` },
    body: JSON.stringify({ action: 'request_update', note: 'test' }),
  });
  // Thành viên tự phản hồi (không phải lãnh đạo/TB) — kỳ vọng 403
  r = await fetch(`${BASE}/api/tasks/${target.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberTT}` },
    body: JSON.stringify({ action: 'respond_update', decision: 'approve', feedback: 'tự duyệt' }),
  });
  console.log('Thành viên tự phản hồi: HTTP', r.status, JSON.stringify(await r.json()));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
