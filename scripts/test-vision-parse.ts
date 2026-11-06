// Test G4: gửi ảnh biên bản -> OpenAI vision đọc -> trích xuất công việc
import 'dotenv/config';
import * as fs from 'fs';

const BASE = 'http://localhost:3000';

async function main() {
  const img = fs.readFileSync('scripts/test-bbh-image.png');
  const dataUrl = `data:image/png;base64,${img.toString('base64')}`;
  console.log('Ảnh:', img.length, 'bytes -> base64', dataUrl.length, 'chars');

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'phamphucminhlehong@gmail.com', password: 'nitc123' }),
  });
  const { token } = await login.json();

  console.log('Gửi ảnh cho AI đọc (OCR)... có thể mất 10-30 giây');
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/gemini/parse-bbh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      images: [dataUrl],
      members: [],
      meetingDate: '2026-11-04',
    }),
  });
  console.log('HTTP', res.status, `(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  const d: any = await res.json();
  if (!d.meeting) {
    console.log('LỖI:', JSON.stringify(d));
    process.exit(1);
  }
  console.log('\n=== KẾT QUẢ ĐỌC TỪ ẢNH ===');
  console.log('Tiêu đề:', d.meeting.title);
  console.log('Ngày họp:', d.meeting.date, '| Chủ trì:', d.meeting.chairperson, '| Thư ký:', d.meeting.secretary);
  console.log('Có mặt:', (d.meeting.attendees || []).length, '| Vắng:', (d.meeting.absentees || []).join(', '), '| Muộn:', (d.meeting.latecomers || []).join(', '));
  console.log('Mục tiêu:', (d.meeting.objectives || '').slice(0, 80));
  console.log('\n=== CÔNG VIỆC TRÍCH XUẤT:', (d.tasks || []).length, '===');
  for (const [i, t] of (d.tasks || []).entries()) {
    console.log(`${i + 1}. ${(t.title || '').slice(0, 55)}`);
    console.log(`   ban: ${t.suggestedDepartment} | người: ${t.suggestedAssigneeName || t.rawAssigneeText} | hạn: ${t.suggestedDeadline} (${t.rawDeadlinetext}) | ${t.verificationType}${t.isAbsentee ? ' | ⚠️ VẮNG HỌP' : ''}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
