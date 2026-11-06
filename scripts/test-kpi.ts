// Test S4: KPI khớp tính tay
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
  const kpi: any = await (await fetch(`${BASE}/api/kpi`, { headers: { Authorization: `Bearer ${president}` } })).json();

  console.log('=== Thang điểm ===', JSON.stringify(kpi.rules));
  console.log('\n=== Leaderboard cá nhân (top 8) ===');
  for (const [i, m] of kpi.members.slice(0, 8).entries()) {
    console.log(
      `${i + 1}. ${m.name.padEnd(25)} ${m.department.padEnd(15)} việc:${String(m.total).padStart(2)} xong:${String(m.completed).padStart(2)} quá hạn:${String(m.overdue).padStart(2)} điểm:${String(m.points).padStart(3)}`
    );
  }
  console.log('\n=== Theo ban ===');
  for (const d of kpi.departments) {
    console.log(`${d.department.padEnd(15)} điểm:${String(d.points).padStart(4)} hoàn thành:${d.completionRate}% quá hạn:${d.overdue}`);
  }

  console.log('\n=== Kiểm tay: Lê Ngọc Anh Thư (2 việc quá hạn -> kỳ vọng -4) ===');
  const thuong = kpi.members.find((m: any) => m.name === 'Lê Ngọc Anh Thư');
  if (thuong) {
    console.log(`Tổng:${thuong.total} Quá hạn:${thuong.overdue} Điểm:${thuong.points} (kỳ vọng điểm = ${thuong.overdue} x -2 = ${thuong.overdue * -2})`);
    console.log('KHỚP:', thuong.points === thuong.overdue * -2 ? '✓' : '✗ SAI');
  }

  console.log('\n=== Phân quyền: thành viên Truyền thông chỉ thấy ban mình ===');
  const memberTT = await login('loanhtien1@gmail.com');
  const kpiTT: any = await (await fetch(`${BASE}/api/kpi`, { headers: { Authorization: `Bearer ${memberTT}` } })).json();
  console.log('Các ban thấy:', kpiTT.departments.map((d: any) => d.department), '| thành viên:', kpiTT.members.length);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
