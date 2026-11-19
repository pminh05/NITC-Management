// Thử nghiệm S4 (đối chiếu KPI) + đo thời gian phản hồi API.
// AN TOÀN: sao chép prisma/dev.db ra thư mục tạm, chạy máy chủ riêng ở cổng 3111 (DEMO_MODE, tắt AI và bộ lập lịch).
// Chạy: node scripts/s4-perf.cjs  -> in kết quả JSON ra màn hình
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJ = path.resolve(__dirname, '..');
const PORT = 3111;
const BASE = `http://localhost:${PORT}/api`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nitc-s4-'));
const DB = path.join(TMP, 'copy.db');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.copyFileSync(path.join(PROJ, 'prisma', 'dev.db'), DB);
const env = { ...process.env, DATABASE_URL: `file:${DB.replace(/\\/g, '/')}` };
execSync(`"${process.execPath}" "${path.join(PROJ, 'node_modules/prisma/build/index.js')}" migrate deploy`, { cwd: PROJ, env, stdio: 'pipe' });

const child = spawn(process.execPath, [path.join(PROJ, 'node_modules/tsx/dist/cli.mjs'), 'server.ts'], {
  cwd: PROJ,
  env: { ...env, PORT: String(PORT), SCHEDULER_ENABLED: 'false', NODE_ENV: 'production', OPENAI_API_KEY: '', DEMO_MODE: 'true',
    JWT_SECRET: 'test-only-secret-0123456789-abcdefghijklmnopqrstuvwxyz', ALLOW_DESTRUCTIVE_ADMIN: 'false' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const kill = () => { try { process.platform === 'win32' ? execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' }) : child.kill('SIGKILL'); } catch {} };

const ymdVN = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };

async function timed(token, method, p, body) {
  const t0 = performance.now();
  const r = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => null);
  return { ms: performance.now() - t0, status: r.status, data };
}

(async () => {
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/health')).ok) break; } catch {} await sleep(500); }
    const cfg = (await timed(null, 'GET', '/auth/config')).data;
    const president = cfg.demoAccounts.find((a) => a.label.startsWith('Chủ nhiệm'));
    const login = await timed(null, 'POST', '/auth/login', { email: president.email, password: cfg.demoPassword });
    const token = login.data.token;

    // --- S4: tính lại KPI độc lập từ dữ liệu việc
    const settings = (await timed(token, 'GET', '/settings')).data;
    const rules = { onTime: settings.kpiOnTime, late: settings.kpiLate, pending: settings.kpiPending, overdue: settings.kpiOverdue };
    const tasks = (await timed(token, 'GET', '/tasks')).data;
    const kpi = (await timed(token, 'GET', '/kpi')).data;
    const today = ymdVN(Date.now());
    const exp = new Map();
    const activeIds = new Set(kpi.members.map((m) => m.memberId));
    let counted = 0;
    for (const t of tasks) {
      if (t.termId && kpi.termId && t.termId !== kpi.termId) continue;
      const done = t.evidenceSubmittedAt ? ymdVN(t.evidenceSubmittedAt) : t.approvedAt ? ymdVN(t.approvedAt) : ymdVN(t.updatedAt);
      let pts = 0;
      if (t.status === 'completed') pts = done <= t.deadline ? rules.onTime : rules.late;
      else if (t.status === 'pending_approval') pts = done <= t.deadline ? rules.pending : 0;
      else if (t.deadline < today) pts = rules.overdue;
      const ids = Array.isArray(t.assigneeIds) && t.assigneeIds.length ? t.assigneeIds : [t.assigneeId];
      counted++;
      for (const id of ids) if (activeIds.has(id)) exp.set(id, (exp.get(id) || 0) + pts);
    }
    let match = 0, mismatch = [];
    for (const m of kpi.members) {
      const e = exp.get(m.memberId) || 0;
      if (e === m.points) match++; else mismatch.push({ name: m.name, api: m.points, expected: e });
    }
    const deptSumOk = kpi.departments.every((d) => d.points === kpi.members.filter((m) => m.department === d.department).reduce((s, m) => s + m.points, 0));

    // --- Hiệu năng: 30 lần mỗi API, tuần tự, sau 3 lần khởi động
    const eps = [['GET', '/tasks'], ['GET', '/meetings'], ['GET', '/members'], ['GET', '/kpi'], ['GET', '/notifications'], ['GET', '/docs']];
    const perf = {};
    for (const [m, p] of eps) {
      for (let i = 0; i < 3; i++) await timed(token, m, p);
      const ms = [];
      for (let i = 0; i < 30; i++) ms.push((await timed(token, m, p)).ms);
      perf[`${m} ${p}`] = { tb: +(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(1), p50: +pct(ms, 50).toFixed(1), p95: +pct(ms, 95).toFixed(1), max: +Math.max(...ms).toFixed(1) };
    }
    const lms = [];
    for (let i = 0; i < 10; i++) lms.push((await timed(null, 'POST', '/auth/login', { email: president.email, password: cfg.demoPassword })).ms);
    perf['POST /auth/login'] = { tb: +(lms.reduce((a, b) => a + b, 0) / lms.length).toFixed(1), p50: +pct(lms, 50).toFixed(1), p95: +pct(lms, 95).toFixed(1), max: +Math.max(...lms).toFixed(1) };

    // --- Đồng thời: 20 yêu cầu GET /tasks cùng lúc, 5 đợt
    const conc = [];
    for (let k = 0; k < 5; k++) {
      const t0 = performance.now();
      const rs = await Promise.all(Array.from({ length: 20 }, () => timed(token, 'GET', '/tasks')));
      conc.push({ tongMs: +(performance.now() - t0).toFixed(1), loi: rs.filter((r) => r.status !== 200).length, chamNhatMs: +Math.max(...rs.map((r) => r.ms)).toFixed(1) });
    }
    console.log(JSON.stringify({ ngay: today, soViec: tasks.length, soViecTinh: counted, soThanhVienKpi: kpi.members.length, kpiKhop: match, kpiLech: mismatch, tongBanKhop: deptSumOk, rules, perf, dongThoi: conc }, null, 1));
  } catch (e) {
    console.error(e);
  } finally {
    kill();
    process.exit(0);
  }
})();
