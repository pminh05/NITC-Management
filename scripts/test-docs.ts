// Test G6: Kho tài liệu — CRUD + phân quyền xem/ghi
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
const st = (r: Response, note: string) => console.log(`${note}: HTTP ${r.status}`);

async function main() {
  const president = await login('phamphucminhlehong@gmail.com');
  const tbSK = await login('anhtud143@gmail.com'); // Đoàn Anh Tú - TB Sự kiện
  const tbTT = await login('huynchang124@gmail.com'); // TB Truyền thông
  const memberSK = await login('anhhphamne@gmail.com'); // Thành viên Sự kiện
  const memberTT = await login('loanhtien1@gmail.com'); // Thành viên Truyền thông

  console.log('=== 1. Chủ nhiệm tạo tài liệu CHUNG (ghim) + riêng ban ===');
  let r = await fetch(`${BASE}/api/docs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${president}` },
    body: JSON.stringify({ name: 'Nội quy CLB NITC', url: 'https://docs.google.com/document/d/noiquy', docType: 'doc', department: 'Ban Chủ nhiệm', label: 'Quy chế' }),
  });
  st(r, 'Tạo chung');
  const chung: any = await r.json();

  r = await fetch(`${BASE}/api/docs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${president}` },
    body: JSON.stringify({ name: 'Giáo án Coding Fundamental', url: 'https://drive.google.com/drive/giaoan-cf', docType: 'drive', department: 'Học thuật', label: 'Giáo án' }),
  });
  st(r, 'Tạo riêng Học thuật');

  console.log('=== 2. TB Sự kiện tạo tài liệu riêng ban Sự kiện ===');
  r = await fetch(`${BASE}/api/docs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tbSK}` },
    body: JSON.stringify({ name: 'Kịch bản talkshow tháng 12', url: 'https://docs.google.com/document/d/kichban', docType: 'doc', department: 'Sự kiện', label: 'Kịch bản' }),
  });
  st(r, 'TB SK tạo riêng ban');
  const rieng: any = await r.json();

  console.log('=== 3. TB Sự kiện cố tạo cho ban Truyền thông (kỳ vọng bị ép về ban SK hoặc chặn) ===');
  r = await fetch(`${BASE}/api/docs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberSK}` },
    body: JSON.stringify({ name: 'Key visualTT', url: 'https://drive.google.com/file/kv', docType: 'image', department: 'Truyền thông' }),
  });
  const forced: any = await r.json();
  st(r, 'Thành viên tạo (thành viên không có quyền ghi)');
  console.log('  department thực tế:', forced.department, '(nếu 403 là đúng quyền)');

  console.log('=== 4. Quyền xem ===');
  const seenTT: any[] = await (await fetch(`${BASE}/api/docs`, { headers: { Authorization: `Bearer ${memberTT}` } })).json();
  console.log('Member TT thấy:', seenTT.map((d) => `[${d.department}] ${d.name}`), '(kỳ vọng: chung + Truyền thông, KHÔNG có Sự kiện/Học thuật)');
  const seenSK: any[] = await (await fetch(`${BASE}/api/docs`, { headers: { Authorization: `Bearer ${memberSK}` } })).json();
  console.log('Member SK thấy:', seenSK.map((d) => `[${d.department}] ${d.name}`));
  const seenPres: any[] = await (await fetch(`${BASE}/api/docs`, { headers: { Authorization: `Bearer ${president}` } })).json();
  console.log('Chủ nhiệm thấy:', seenPres.length, 'tài liệu (tất cả)');

  console.log('=== 5. Sửa/xóa chéo ban (kỳ vọng 403) ===');
  r = await fetch(`${BASE}/api/docs/${rieng.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tbTT}` },
  });
  st(r, 'TB TT xóa tài liệu SK');

  console.log('=== 6. Ghim — chỉ lãnh đạo ===');
  r = await fetch(`${BASE}/api/docs/${chung.id}/pin`, { method: 'POST', headers: { Authorization: `Bearer ${tbSK}` } });
  st(r, 'TB SK ghim (kỳ vọng 403)');
  r = await fetch(`${BASE}/api/docs/${chung.id}/pin`, { method: 'POST', headers: { Authorization: `Bearer ${president}` } });
  st(r, 'Chủ nhiệm ghim');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
