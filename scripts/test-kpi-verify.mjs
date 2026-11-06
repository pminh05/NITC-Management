// Kiểm chứng độc lập: tính lại KPI từ dữ liệu tasks thô, so khớp API


const BASE = 'http://localhost:3000';
const RULES = { onTime: 3, late: 1, pending: 1, overdue: -2 };

async function main() {
  const president = await login('phamphucminhlehong@gmail.com');
  const tasks = await (await fetch(`${BASE}/api/tasks`, { headers: { Authorization: `Bearer ${president}` } })).json();
  const kpi = await (await fetch(`${BASE}/api/kpi`, { headers: { Authorization: `Bearer ${president}` } })).json();
  const members = await (await fetch(`${BASE}/api/members?all=1`, { headers: { Authorization: `Bearer ${president}` } })).json();
  const memberById = new Map(members.map((m) => [m.id, m]));

  // Tính độc lập
  const expected = new Map();
  const expectedTotal = new Map();
  for (const t of tasks) {
    // assigneeIds từ API đã là array; chuỗi JSON thì parse
    let ids = [t.assigneeId];
    if (Array.isArray(t.assigneeIds) && t.assigneeIds.length) ids = t.assigneeIds;
    else if (typeof t.assigneeIds === 'string') {
      try {
        const p = JSON.parse(t.assigneeIds);
        if (Array.isArray(p) && p.length) ids = p;
      } catch {}
    }
    const today = new Date().toISOString().split('T')[0];
    let pts = 0;
    if (t.status === 'completed') {
      const sub = (t.evidenceSubmittedAt || t.updatedAt || '').split('T')[0];
      pts = sub <= t.deadline ? RULES.onTime : RULES.late;
    } else if (t.status === 'pending_approval') {
      const sub = (t.evidenceSubmittedAt || t.updatedAt || '').split('T')[0];
      pts = sub <= t.deadline ? RULES.pending : 0;
    } else if (t.deadline < today) {
      pts = RULES.overdue;
    }
    for (const id of ids) {
      if (!memberById.has(id)) continue;
      expected.set(id, (expected.get(id) || 0) + pts);
      expectedTotal.set(id, (expectedTotal.get(id) || 0) + 1);
    }
  }

  let allMatch = true;
  console.log('So khớp từng thành viên có việc:');
  for (const m of kpi.members) {
    const exp = expected.get(m.memberId) || 0;
    const expTotal = expectedTotal.get(m.memberId) || 0;
    const match = exp === m.points && expTotal === m.total;
    if (!match) allMatch = false;
    console.log(
      `${match ? '✓' : '✗'} ${m.name.padEnd(25)} API:${String(m.points).padStart(4)} | tính tay:${String(exp).padStart(4)} (việc API:${m.total} tay:${expTotal})`
    );
  }
  console.log(allMatch ? '\n✅ TẤT CẢ KHỚP — KPI tính đúng 100%' : '\n❌ CÓ LỊCH — cần kiểm lại');
  if (!allMatch) process.exit(1);
}

async function login(email) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'nitc123' }),
  });
  const d = await r.json();
  return d.token;
}
main().catch((e) => { console.error(e); process.exit(1); });
