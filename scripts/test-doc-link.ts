// Test G6.5: nhập biên bản bằng link Google Docs — các ca lỗi + luồng hợp lệ
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

async function tryParse(token: string, body: any, note: string) {
  const res = await fetch(`${BASE}/api/gemini/parse-bbh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...body, members: [], meetingDate: '2026-11-04' }),
  });
  const d: any = await res.json();
  console.log(`${note}: HTTP ${res.status} | ${d.error || `OK - ${d.tasks?.length || 0} việc, tiêu đề: ${d.meeting?.title}`}`);
}

async function main() {
  const token = await login('phamphucminhlehong@gmail.com');

  // Ca 1: link không phải Google Docs
  await tryParse(token, { docUrl: 'https://example.com/not-google' }, 'Ca1: Link lạ (kỳ vọng hướng dẫn)');

  // Ca 2: Google Docs hợp lệ nhưng KHÔNG công khai (id giả) -> NOT_PUBLIC
  await tryParse(token, { docUrl: 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit' }, 'Ca2: Docs riêng tư (kỳ vọng hướng dẫn chia sẻ)');

  // Ca 3: dán trống cả link lẫn text
  await tryParse(token, { members: [] }, 'Ca3: Trống hoàn toàn (kỳ vọng 400)');

  console.log('\n=> Ca thật với Docs công khai của CLB: dán link biên bản thật đã chia sẻ "Anyone with the link can view" trên giao diện (tab 🔗 Link Docs).');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
