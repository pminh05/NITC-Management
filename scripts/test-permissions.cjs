// Bộ thử hồi quy: phân quyền + bảo mật tài khoản + chống sập.
// AN TOÀN: tự sao chép prisma/dev.db ra thư mục tạm và chạy server riêng ở cổng 3111/3112 —
// không đụng CSDL thật, không đụng server đang chạy ở cổng 3000.
// Chạy: npm run test:perm
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJ = path.resolve(__dirname, '..');
const PASS = 'nitc123'; // mật khẩu mặc định của dự án (server/config.ts)
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nitc-test-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dbUrl = (file) => `file:${file.replace(/\\/g, '/')}`;
/** Sao chép prisma/dev.db rồi áp mọi migration còn thiếu lên BẢN SAO (không đụng CSDL thật). */
function copyAndMigrate(target) {
  fs.copyFileSync(path.join(PROJ, 'prisma', 'dev.db'), target);
  execSync(`"${process.execPath}" "${path.join(PROJ, 'node_modules/prisma/build/index.js')}" migrate deploy`, {
    cwd: PROJ,
    env: { ...process.env, DATABASE_URL: dbUrl(target) },
    stdio: 'pipe',
  });
}

function startServer(port, dbName, extraEnv) {
  const db = path.join(TMP, dbName);
  copyAndMigrate(db);
  const child = spawn(process.execPath, [path.join(PROJ, 'node_modules/tsx/dist/cli.mjs'), 'server.ts'], {
    cwd: PROJ,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: `file:${db.replace(/\\/g, '/')}`,
      SCHEDULER_ENABLED: 'false',
      NODE_ENV: 'production', // không khởi động Vite thứ hai
      OPENAI_API_KEY: '',
      JWT_SECRET: 'test-only-secret-0123456789-abcdefghijklmnopqrstuvwxyz',
      ALLOW_DESTRUCTIVE_ADMIN: 'false',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const srv = { child, log: '', exited: null, base: `http://localhost:${port}/api` };
  child.stdout.on('data', (d) => (srv.log += d));
  child.stderr.on('data', (d) => (srv.log += d));
  child.on('exit', (code) => (srv.exited = code));
  srv.kill = () => {
    try {
      if (process.platform === 'win32') execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
      else child.kill('SIGKILL');
    } catch {}
  };
  srv.call = async (token, method, p, body, raw) => {
    try {
      const res = await fetch(srv.base + p, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined || raw ? { 'Content-Type': 'application/json' } : {}) },
        body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
      });
      let data = null;
      try { data = await res.json(); } catch {}
      return { status: res.status, data };
    } catch (e) {
      return { status: 0, data: null };
    }
  };
  srv.ready = async () => {
    for (let i = 0; i < 80; i++) {
      if (srv.exited !== null) return false;
      if ((await srv.call(null, 'GET', '/health')).status === 200) return true;
      await sleep(500);
    }
    return false;
  };
  return srv;
}

const rows = [];
/** expect: mã HTTP mong đợi ("200" hoặc "400|409"), null = chỉ ghi nhận. pending: giai đoạn sẽ sửa nếu hiện còn lệch. */
function rec(id, who, what, expect, r, note = '', pending = '') {
  let ok = '·';
  if (expect !== null) {
    const pass = String(expect).split('|').includes(String(r.status));
    ok = pass ? 'OK' : pending ? `CHỜ ${pending}` : 'LỆCH';
  }
  rows.push({ id, who, what, expect: expect ?? '-', actual: r.status, ok, note: note || (r.status >= 400 ? (r.data?.error || '').slice(0, 60) : '') });
}
function check(id, who, what, cond, note = '') {
  rows.push({ id, who, what, expect: 'đúng', actual: cond ? 'đúng' : 'sai', ok: cond ? 'OK' : 'LỆCH', note });
}

async function mainSuite() {
  const s = startServer(3111, 'main.db', { DEMO_MODE: 'true' });
  try {
    if (!(await s.ready())) { console.log('SERVER KHÔNG KHỞI ĐỘNG\n' + s.log); process.exitCode = 1; return; }
    const call = s.call;
    const login = async (email) => (await call(null, 'POST', '/auth/login', { email, password: PASS })).data?.token;

    const cfg = await call(null, 'GET', '/auth/config');
    check('C1', '(công khai)', 'auth/config ở chế độ demo trả tài khoản đăng nhập nhanh', cfg.data?.demoMode === true && cfg.data.demoAccounts.length >= 3, `${cfg.data?.demoAccounts?.length} tài khoản`);
    const presidentEmail = cfg.data.demoAccounts[0].email;
    const CN = await login(presidentEmail);
    const members = (await call(CN, 'GET', '/members')).data;
    const find = (role, dept, skip = 0) => members.filter((m) => m.role === role && (!dept || m.department === dept))[skip];
    const mPCN = find('Phó Chủ nhiệm'), mTB_SK = find('Trưởng ban', 'Sự kiện'), mPB_SK = find('Phó ban', 'Sự kiện'), mTB_HT = find('Trưởng ban', 'Học thuật');
    const mTV_TT = find('Thành viên', 'Truyền thông'), mTV_SK = find('Thành viên', 'Sự kiện'), mTV_SK2 = find('Thành viên', 'Sự kiện', 1), mTV_HT = find('Thành viên', 'Học thuật');
    const me0 = members.find((m) => m.email === presidentEmail);
    const T = { CN, PCN: await login(mPCN.email), TB_SK: await login(mTB_SK.email), PB_SK: await login(mPB_SK.email), TB_HT: await login(mTB_HT.email), TV_TT: await login(mTV_TT.email), TV_SK: await login(mTV_SK.email), TV_HT: await login(mTV_HT.email) };
    check('C2', '(8 vai trò)', 'đăng nhập được ở chế độ demo', Object.values(T).every(Boolean));

    // ---- Xác thực
    rec('A1', '(không token)', 'GET /tasks', 401, await call(null, 'GET', '/tasks'));
    rec('A2', '(token rác)', 'GET /tasks', 401, await call('abc.def.ghi', 'GET', '/tasks'));
    rec('A3', '(sai mật khẩu)', 'POST /auth/login', 401, await call(null, 'POST', '/auth/login', { email: mTV_TT.email, password: 'sai' }));
    rec('A4', '(không token)', 'GET /api/khong-ton-tai', 401, await call(null, 'GET', '/khong-ton-tai'));
    rec('A5', 'CN', 'GET /api/khong-ton-tai → 404 JSON', 404, await call(CN, 'GET', '/khong-ton-tai'));

    // ---- Phạm vi xem
    const all = (await call(CN, 'GET', '/tasks')).data;
    { const r = await call(T.PCN, 'GET', '/tasks'); check('V1', 'PCN', 'Phó Chủ nhiệm thấy toàn bộ công việc', r.data?.length === all.length, `${r.data?.length}/${all.length} việc`); }
    { const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10); const wrong = all.filter((t) => (t.status === 'overdue') !== (t.status !== 'completed' && t.status !== 'pending_approval' && t.deadline < today)); check('E1', 'CN', 'trạng thái "quá hạn" khớp đúng hạn chót theo ngày Việt Nam (không chờ cron)', wrong.length === 0, `${all.filter((t) => t.status === 'overdue').length} việc quá hạn, ${wrong.length} việc sai trạng thái`); }
    for (const k of ['TB_SK', 'TV_TT']) { const r = await call(T[k], 'GET', '/tasks'); rec('V1', k, 'GET /tasks', 200, r, `${r.data?.length}/${all.length} việc`); }
    { const r = await call(T.TV_TT, 'GET', '/members'); check('V3', 'TV_TT', 'thành viên thường KHÔNG thấy SĐT/ngày sinh/MSV người khác', !r.data.some((x) => x.id !== mTV_TT.id && (x.phone || x.birthday || x.studentId))); check('V3', 'TV_TT', 'vẫn thấy tên/ban/chức vụ/email của mọi người và đủ hồ sơ của chính mình', r.data.length === members.length && r.data.every((x) => x.name && x.email && x.role) && r.data.find((x) => x.id === mTV_TT.id)?.phone === mTV_TT.phone); }
    { const r = await call(T.TB_SK, 'GET', '/members'); const priv = (x) => x.phone || x.birthday || x.studentId; check('V4', 'TB_SK', 'Trưởng ban thấy hồ sơ đầy đủ của ban mình, không thấy của ban khác', r.data.some((x) => x.department === 'Sự kiện' && x.id !== mTB_SK.id && priv(x)) && !r.data.some((x) => x.department !== 'Sự kiện' && priv(x))); }
    { const r = await call(T.PCN, 'GET', '/members'); check('V4', 'PCN', 'Ban lãnh đạo thấy hồ sơ đầy đủ', r.data.filter((x) => x.phone).length === members.filter((x) => x.phone).length); }
    { const r = await call(T.PCN, 'GET', '/auth/me'); const c = r.data?.capabilities || {}; check('V7', 'PCN', '/auth/me trả capabilities đúng ma trận (toàn CLB, không cấu hình/xóa/nhiệm kỳ)', c.scope === 'all' && c.manageRoster === true && c.manageSettings === false && c.deleteTask === false && c.manageTerms === false && c.destructiveAdmin === false); }
    { const r = await call(T.TV_TT, 'GET', '/auth/me'); const c = r.data?.capabilities || {}; check('V7', 'TV_TT', 'capabilities của thành viên thường: không có quyền quản lý, không nhắc việc, không báo cáo tuần', c.scope === 'department' && !c.createTask && !c.manageRoster && !c.viewLogs && !c.nag && !c.weeklyReport); }
    rec('V5', 'TV_TT', 'GET /logs', 403, await call(T.TV_TT, 'GET', '/logs'));
    rec('V5', 'PCN', 'GET /logs', 200, await call(T.PCN, 'GET', '/logs'));
    rec('V6', 'TB_SK', 'POST /logs (nhật ký tự do / báo cáo tuần — chỉ lãnh đạo)', 403, await call(T.TB_SK, 'POST', '/logs', { subject: 'test', recipientEmail: 'x@y.z' }));
    rec('V6', 'PCN', 'POST /logs', 201, await call(T.PCN, 'POST', '/logs', { subject: '[TEST] nhật ký', recipientEmail: 'x@y.z' }));

    // ---- Dữ liệu thử
    const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const mk = async (dept, assignee, title) => (await call(CN, 'POST', '/tasks', { title, department: dept, deadline: future, assigneeId: assignee.id, verificationType: 'report_required' })).data;
    const tSK = await mk('Sự kiện', mTV_SK, '[TEST] việc SK');
    const tSK2 = await mk('Sự kiện', mTV_SK, '[TEST] việc SK 2');
    const tHT = await mk('Học thuật', mTV_HT, '[TEST] việc HT');
    const tHT2 = await mk('Học thuật', mTV_HT, '[TEST] việc HT 2');

    // ---- Giao việc
    // ---- Phạm vi xem việc: thành viên chỉ thấy việc giao cho mình; Trưởng/Phó ban thấy cả ban
    { const r = await call(T.TV_SK, 'GET', '/tasks'); const notMine = r.data.filter((t) => !(t.assigneeIds || []).includes(mTV_SK.id) && t.assigneeId !== mTV_SK.id); check('V8', 'TV_SK', 'thành viên chỉ thấy việc được giao cho mình', r.status === 200 && r.data.length > 0 && notMine.length === 0, `${r.data.length} việc, ${notMine.length} việc không phải của mình`); }
    { const r = await call(T.TV_SK2 || await login(mTV_SK2.email), 'GET', `/tasks`); check('V8', 'TV cùng ban', 'không thấy việc của thành viên khác trong ban', !r.data.some((t) => t.id === tSK.id)); }
    { const r = await call(T.TB_SK, 'GET', '/tasks'); const sk = all.filter((t) => t.department === 'Sự kiện').length; check('V8', 'TB_SK', 'Trưởng ban thấy mọi việc của ban mình', r.data.filter((t) => t.department === 'Sự kiện').length >= sk && r.data.some((t) => t.id === tSK.id)); }
    rec('V8', 'TV cùng ban', 'PUT việc của người khác (không xem được)', 403, await call(await login(mTV_SK2.email), 'PUT', `/tasks/${tSK2.id}`, { action: 'request_update' }));
    rec('G1', 'TV_SK', 'POST /tasks', 403, await call(T.TV_SK, 'POST', '/tasks', { title: 'x', department: 'Sự kiện', deadline: future, assigneeId: mTV_SK.id }));
    rec('G2', 'TB_SK', 'POST /tasks ban mình', 201, await call(T.TB_SK, 'POST', '/tasks', { title: '[TEST] TB giao', department: 'Sự kiện', deadline: future, assigneeId: mTV_SK.id }));
    rec('G3', 'TB_SK', 'POST /tasks ban khác', 403, await call(T.TB_SK, 'POST', '/tasks', { title: 'x', department: 'Học thuật', deadline: future, assigneeId: mTV_HT.id }));
    rec('G4', 'TB_SK', 'POST /tasks người ban khác', 400, await call(T.TB_SK, 'POST', '/tasks', { title: 'x', department: 'Sự kiện', deadline: future, assigneeId: mTV_HT.id }));
    rec('G5', 'TB_SK', 'POST /tasks hạn quá khứ', 400, await call(T.TB_SK, 'POST', '/tasks', { title: '[TEST] quá khứ', department: 'Sự kiện', deadline: '2020-01-01', assigneeId: mTV_SK.id }));
    rec('G6', 'TB_SK', 'POST /tasks deadline="abc"', 400, await call(T.TB_SK, 'POST', '/tasks', { title: 'x', department: 'Sự kiện', deadline: 'abc', assigneeId: mTV_SK.id }));
    rec('G6', 'TB_SK', 'POST /tasks deadline=2026-02-31', 400, await call(T.TB_SK, 'POST', '/tasks', { title: 'x', department: 'Sự kiện', deadline: '2026-02-31', assigneeId: mTV_SK.id }));
    let tOwn = null;
    { const r = await call(T.TB_SK, 'POST', '/tasks', { title: '[TEST] gửi status=completed', department: 'Sự kiện', deadline: future, assigneeId: mTB_SK.id, status: 'completed' }); check('G7', 'TB_SK', 'tạo việc kèm status=completed bị bỏ qua (luôn in_progress)', r.status === 201 && r.data?.status === 'in_progress', `status lưu = ${r.data?.status}`); tOwn = r.data; }
    rec('G8', 'PCN', 'POST /tasks ban bất kỳ', 201, await call(T.PCN, 'POST', '/tasks', { title: '[TEST] PCN giao', department: 'Học thuật', deadline: future, assigneeId: mTV_HT.id }));

    // ---- Sửa / xóa
    rec('S1', 'TV_SK', 'PUT update việc của mình', 403, await call(T.TV_SK, 'PUT', `/tasks/${tSK.id}`, { action: 'update', deadline: '2030-01-01' }));
    rec('S2', 'TB_SK', 'PUT update việc ban mình', 200, await call(T.TB_SK, 'PUT', `/tasks/${tSK.id}`, { action: 'update', priority: 'high' }));
    rec('S3', 'TB_SK', 'PUT update việc ban khác', 403, await call(T.TB_SK, 'PUT', `/tasks/${tHT.id}`, { action: 'update', priority: 'high' }));
    rec('S4', 'TB_SK', 'update: đổi người sang ban khác', 400, await call(T.TB_SK, 'PUT', `/tasks/${tSK2.id}`, { action: 'update', assigneeId: mTV_HT.id }));
    rec('S5', 'TB_SK', 'DELETE việc', 403, await call(T.TB_SK, 'DELETE', `/tasks/${tSK2.id}`));

    // ---- Nộp minh chứng
    rec('N1', 'TV_TT', 'submit_evidence việc ban khác', 403, await call(T.TV_TT, 'PUT', `/tasks/${tSK.id}`, { action: 'submit_evidence', report: 'x' }));
    rec('N2', 'TV cùng ban, không được giao', 'submit_evidence', 403, await call(await login(mTV_SK2.email), 'PUT', `/tasks/${tSK.id}`, { action: 'submit_evidence', report: 'nộp hộ' }));
    rec('N5', 'TB_SK (quản lý, không được giao)', 'submit_evidence nộp hộ thành viên', 403, await call(T.TB_SK, 'PUT', `/tasks/${tSK.id}`, { action: 'submit_evidence', report: 'nộp hộ' }));
    rec('N5', 'CN (không được giao)', 'submit_evidence nộp hộ', 403, await call(T.CN, 'PUT', `/tasks/${tSK.id}`, { action: 'submit_evidence', report: 'nộp hộ' }));
    await call(T.TV_HT, 'PUT', `/tasks/${tHT.id}`, { action: 'submit_evidence', report: 'xong' });
    await call(T.TV_HT, 'PUT', `/tasks/${tHT2.id}`, { action: 'submit_evidence', report: 'xong' });
    rec('N3', 'TV_SK', 'submit_evidence việc của mình', 200, await call(T.TV_SK, 'PUT', `/tasks/${tSK.id}`, { action: 'submit_evidence', report: 'đã xong' }));
    rec('N4', 'TV_SK', 'submit_evidence link=javascript:', 400, await call(T.TV_SK, 'PUT', `/tasks/${tSK.id}`, { action: 'submit_evidence', link: 'javascript:alert(1)', report: 'x' }));

    // ---- Duyệt
    rec('D1', 'TV_SK', 'approve việc của mình', 403, await call(T.TV_SK, 'PUT', `/tasks/${tSK.id}`, { action: 'approve' }));
    rec('D3', 'TB_HT', 'approve việc ban khác', 403, await call(T.TB_HT, 'PUT', `/tasks/${tSK.id}`, { action: 'approve' }));
    rec('D3', 'TB_HT', 'reject việc ban khác', 403, await call(T.TB_HT, 'PUT', `/tasks/${tSK.id}`, { action: 'reject', reason: 'x' }));
    rec('D2', 'PB_SK', 'reject việc ban mình', 200, await call(T.PB_SK, 'PUT', `/tasks/${tSK.id}`, { action: 'reject', reason: 'cần bổ sung' }));
    await call(T.TV_SK, 'PUT', `/tasks/${tSK.id}`, { action: 'submit_evidence', report: 'đã bổ sung' });
    rec('D2', 'TB_SK', 'approve việc ban mình', 200, await call(T.TB_SK, 'PUT', `/tasks/${tSK.id}`, { action: 'approve' }));
    rec('D5', 'TB_SK', 'nộp minh chứng việc giao cho chính mình', 200, await call(T.TB_SK, 'PUT', `/tasks/${tOwn.id}`, { action: 'submit_evidence', report: 'tự làm xong', link: 'https://example.com/san-pham' }));
    rec('D5', 'TB_SK', 'TỰ DUYỆT việc của chính mình', 403, await call(T.TB_SK, 'PUT', `/tasks/${tOwn.id}`, { action: 'approve' }));
    rec('D5', 'PB_SK', 'Phó ban duyệt việc của Trưởng ban cùng ban', 200, await call(T.PB_SK, 'PUT', `/tasks/${tOwn.id}`, { action: 'approve' }));
    rec('D4', 'PCN', 'approve việc ban Học thuật', 200, await call(T.PCN, 'PUT', `/tasks/${tHT.id}`, { action: 'approve' }));
    rec('D6', 'CN', 'approve việc đang chờ duyệt', 200, await call(T.CN, 'PUT', `/tasks/${tHT2.id}`, { action: 'approve' }));

    // ---- Máy trạng thái (GĐ3): mỗi hành động chỉ hợp lệ ở đúng trạng thái
    rec('D7', 'TV_HT', 'submit_evidence trên việc ĐÃ hoàn thành', 409, await call(T.TV_HT, 'PUT', `/tasks/${tHT.id}`, { action: 'submit_evidence', report: 'nộp lại' }));
    rec('D8', 'CN', 'approve việc đã hoàn thành', 409, await call(T.CN, 'PUT', `/tasks/${tHT.id}`, { action: 'approve' }));
    rec('D8', 'CN', 'reject việc đã hoàn thành', 409, await call(T.CN, 'PUT', `/tasks/${tHT.id}`, { action: 'reject', reason: 'x' }));
    const tQ = await mk('Sự kiện', mTV_SK, '[TEST] duyệt nhanh');
    rec('D10', 'PCN', 'approve việc CHƯA nộp minh chứng', 409, await call(T.PCN, 'PUT', `/tasks/${tQ.id}`, { action: 'approve' }));
    rec('D10', 'TB_SK', 'reject việc chưa nộp minh chứng', 409, await call(T.TB_SK, 'PUT', `/tasks/${tQ.id}`, { action: 'reject', reason: 'x' }));
    rec('D10', 'TV_SK', 'request_update khi chưa nộp', 409, await call(T.TV_SK, 'PUT', `/tasks/${tQ.id}`, { action: 'request_update' }));
    await call(T.TV_SK, 'PUT', `/tasks/${tQ.id}`, { action: 'submit_evidence', report: 'xong' });
    rec('D11', 'TV_SK', 'nộp lần hai khi đang chờ duyệt', 409, await call(T.TV_SK, 'PUT', `/tasks/${tQ.id}`, { action: 'submit_evidence', report: 'nộp đè' }));
    rec('D11', 'TB_SK', 'nhắc việc đang chờ duyệt', 409, await call(T.TB_SK, 'POST', `/tasks/${tQ.id}/remind`, {}));
    { const r = await call(T.TV_SK, 'PUT', `/tasks/${tQ.id}`, { action: 'request_update', note: 'sửa link' }); check('D12', 'TV_SK', 'request_update khi chờ duyệt → trả về nhiệm vụ có yêu cầu đang chờ', r.status === 200 && r.data?.id === tQ.id && Boolean(r.data?.updateRequestedAt), `HTTP ${r.status}`); }
    rec('D12', 'TB_HT', 'respond_update việc ban khác', 403, await call(T.TB_HT, 'PUT', `/tasks/${tQ.id}`, { action: 'respond_update', feedback: 'x', decision: 'approve' }));
    rec('D12', 'PB_SK', 'respond_update cho phép sửa', 200, await call(T.PB_SK, 'PUT', `/tasks/${tQ.id}`, { action: 'respond_update', feedback: 'ok sửa đi', decision: 'approve' }));
    rec('D12', 'TV_SK', 'nộp lại sau khi được phép cập nhật', 200, await call(T.TV_SK, 'PUT', `/tasks/${tQ.id}`, { action: 'submit_evidence', report: 'bản mới' }));
    const tQ2 = await mk('Sự kiện', mTV_SK, '[TEST] duyệt nhanh 2');
    { const r = await call(T.CN, 'PUT', `/tasks/${tQ2.id}`, { action: 'approve' }); check('D13', 'CN', 'Chủ nhiệm duyệt nhanh việc chưa nộp; lưu người duyệt', r.status === 200 && r.data?.status === 'completed' && r.data?.approvedById === me0.id && Boolean(r.data?.approvedAt), `người duyệt lưu ${r.data?.approvedById ? 'có' : 'KHÔNG'}`); }
    { const r = await call(T.TB_SK, 'GET', '/notifications'); const n = (r.data?.items || []).filter((x) => x.type === 'evidence_submitted' && x.taskId === tSK.id).length; check('T1', 'TB_SK', 'nộp lại sau khi bị trả vẫn báo người duyệt (2 lần nộp = 2 thông báo)', n === 2, `${n} thông báo`); }

    // ---- Sửa việc: đồng bộ người phụ trách, hạn chót, khóa việc đã hoàn thành
    { const r = await call(T.TB_SK, 'PUT', `/tasks/${tSK2.id}`, { action: 'update', assigneeId: mTV_SK2.id }); check('S6', 'TB_SK', 'đổi phụ trách chính: assigneeId, assigneeIds, assigneeName cùng đổi', r.status === 200 && r.data?.assigneeId === mTV_SK2.id && r.data.assigneeIds.join() === mTV_SK2.id && r.data.assigneeName === mTV_SK2.name, `assigneeIds = ${r.data?.assigneeIds?.length} người`); }
    { const r = await call(T.TB_SK, 'PUT', `/tasks/${tSK2.id}`, { action: 'update', assigneeIds: [mTV_SK2.id, mTV_SK.id] }); check('S6', 'TB_SK', 'thêm đồng phụ trách qua assigneeIds', r.status === 200 && r.data?.assigneeIds.length === 2 && r.data.assigneeId === mTV_SK2.id); }
    rec('S6', 'TB_SK', 'đổi ban khi người phụ trách không thuộc ban mới', '400|403', await call(T.CN, 'PUT', `/tasks/${tSK2.id}`, { action: 'update', department: 'Học thuật' }));
    rec('S7', 'TB_SK', 'update hạn chót về quá khứ', 400, await call(T.TB_SK, 'PUT', `/tasks/${tSK2.id}`, { action: 'update', deadline: '2020-01-01' }));
    rec('S7', 'TB_SK', 'gia hạn hợp lệ', 200, await call(T.TB_SK, 'PUT', `/tasks/${tSK2.id}`, { action: 'update', deadline: '2031-01-01' }));
    rec('S8', 'CN', 'đổi hạn chót việc đã hoàn thành', 409, await call(T.CN, 'PUT', `/tasks/${tHT.id}`, { action: 'update', deadline: '2031-01-01' }));
    rec('S8', 'CN', 'sửa tiêu đề việc đã hoàn thành', 200, await call(T.CN, 'PUT', `/tasks/${tHT.id}`, { action: 'update', title: '[TEST] việc HT (đã sửa tên)' }));
    rec('R3', 'TB_HT', 'nhắc việc đã hoàn thành', 409, await call(T.TB_HT, 'POST', `/tasks/${tHT.id}/remind`, {}));
    { const r1 = await call(T.TB_SK, 'POST', '/notifications/scan'); const r2 = await call(T.TB_SK, 'POST', '/notifications/scan'); check('T2', 'TB_SK', 'quét hạn chót chạy được, chạy lại không lỗi (chống trùng)', r1.status === 200 && r2.status === 200, `quá hạn được nhắc: ${r1.data?.overdue}`); }
    rec('D9', 'CN', 'reject thiếu lý do', 400, await call(T.CN, 'PUT', `/tasks/${tHT2.id}`, { action: 'reject' }));
    rec('D9', 'CN', 'action lạ', 400, await call(T.CN, 'PUT', `/tasks/${tHT2.id}`, { action: 'hack' }));

    // ---- Nhắc việc / quản trị
    rec('R1', 'TV_SK', 'POST remind', 403, await call(T.TV_SK, 'POST', `/tasks/${tSK2.id}/remind`, {}));
    rec('R2', 'PB_SK', 'POST remind ban mình', 200, await call(T.PB_SK, 'POST', `/tasks/${tSK2.id}/remind`, {}));
    await call(T.TB_HT, 'POST', `/tasks/${tHT2.id}/remind`, {});
    { const r = await call(T.TB_SK, 'GET', '/logs'); check('L1', 'TB_SK', 'Trưởng ban xem nhật ký: chỉ nhật ký của ban mình', r.status === 200 && r.data.length > 0 && r.data.every((l) => l.department === 'Sự kiện'), `${r.data?.length} dòng`); }
    { const r = await call(T.PCN, 'GET', '/logs'); check('L1', 'PCN', 'Ban lãnh đạo xem nhật ký mọi ban', r.status === 200 && r.data.some((l) => l.department === 'Sự kiện') && r.data.some((l) => l.department === 'Học thuật')); }
    { const r = await call(T.TB_SK, 'GET', '/auth/me'); const c = r.data?.capabilities || {}; check('L2', 'TB_SK', 'Trưởng ban: có Nhắc việc + Nhật ký, không có Báo cáo tuần', c.nag === true && c.viewLogs === true && c.weeklyReport === false); }
    { const r = await call(T.PCN, 'GET', '/auth/me'); const c = r.data?.capabilities || {}; check('L2', 'PCN', 'Ban lãnh đạo: có Báo cáo tuần', c.nag === true && c.weeklyReport === true); }
    rec('Q1', 'PCN', 'PUT /settings (chỉ Chủ nhiệm; UI đã ẩn nút)', 403, await call(T.PCN, 'PUT', '/settings', { clubName: 'x' }));
    rec('Q1', 'CN', 'PUT /settings', 200, await call(T.CN, 'PUT', '/settings', { clubName: 'CLB Công nghệ thông tin NITC' }));
    rec('Q2', 'PCN', 'DELETE việc', 403, await call(T.PCN, 'DELETE', `/tasks/${tSK2.id}`));
    rec('Q2', 'PCN', 'POST /terms', 403, await call(T.PCN, 'POST', '/terms', { name: '2030-2031' }));
    rec('Q2', 'PCN', 'đặt lại mật khẩu thành viên', 403, await call(T.PCN, 'POST', `/members/${mTV_SK.id}/reset-password`));
    rec('Q2', 'PCN', 'POST /admin/reset', 403, await call(T.PCN, 'POST', '/admin/reset'));
    rec('Q3', 'TB_SK', 'PUT /settings', 403, await call(T.TB_SK, 'PUT', '/settings', { clubName: 'x' }));
    rec('Q4', 'CN', 'POST /admin/reset khi chưa bật cờ', 403, await call(T.CN, 'POST', '/admin/reset'));
    rec('Q5', 'CN', 'POST /admin/import khi chưa bật cờ', 403, await call(T.CN, 'POST', '/admin/import', {}));
    check('Q6', 'CN', 'dữ liệu còn nguyên sau khi reset bị chặn', (await call(T.CN, 'GET', '/members')).data?.length === members.length);
    // ---- Import Excel: file không hợp lệ không được tạo/đổi nhiệm kỳ
    {
      const XLSX = require(path.join(PROJ, 'node_modules/xlsx'));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['a', 'b'], ['1', '2']]), 'Học thuật');
      const termsBefore = JSON.stringify((await call(T.CN, 'GET', '/terms')).data);
      const fd = new FormData();
      fd.append('file', new Blob([XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })]), 'rong.xlsx');
      fd.append('termName', '2030-2031');
      const r = await fetch(s.base + '/members/import', { method: 'POST', headers: { Authorization: 'Bearer ' + T.CN }, body: fd });
      const termsAfter = JSON.stringify((await call(T.CN, 'GET', '/terms')).data);
      check('E2', 'CN', 'import file không có cột Tên/Email: báo lỗi, không tạo/đổi nhiệm kỳ', r.status === 400 && termsBefore === termsAfter, `HTTP ${r.status}`);
      const fd2 = new FormData();
      fd2.append('file', new Blob([XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })]), 'x.xlsx');
      fd2.append('termName', '2030-2032');
      const r2 = await fetch(s.base + '/members/import', { method: 'POST', headers: { Authorization: 'Bearer ' + T.CN }, body: fd2 });
      check('E2', 'CN', 'import tên nhiệm kỳ sai (2030-2032) bị từ chối', r2.status === 400);
    }
    rec('Q7', 'TB_SK', 'đặt lại mật khẩu người khác', 403, await call(T.TB_SK, 'POST', `/members/${mTV_SK.id}/reset-password`));

    // ---- Kho tài liệu
    rec('K1', 'TV_SK', 'POST /docs', 403, await call(T.TV_SK, 'POST', '/docs', { name: 'x', url: 'https://example.com' }));
    const dSK = await call(T.PB_SK, 'POST', '/docs', { name: '[TEST] doc', url: 'https://example.com/sk', department: 'Học thuật' });
    check('K2', 'PB_SK', 'POST /docs luôn lưu vào ban mình', dSK.status === 201 && dSK.data?.department === 'Sự kiện', `ban: ${dSK.data?.department}`);
    rec('K3', 'TB_HT', 'PUT /docs ban khác', 403, await call(T.TB_HT, 'PUT', `/docs/${dSK.data?.id}`, { name: 'hack' }));
    rec('K7', 'PB_SK', 'POST /docs url=javascript:', 400, await call(T.PB_SK, 'POST', '/docs', { name: 'x', url: 'javascript:alert(1)' }));

    // ---- Ban hành kỳ họp
    const pub = (dept, a, extra = {}) => ({ meeting: { title: '[TEST] họp', date: future }, tasks: [{ title: '[TEST] việc họp', suggestedDepartment: dept, suggestedAssigneeId: a.id, suggestedDeadline: future, ...extra }] });
    rec('P1', 'TV_SK', 'POST /meetings/publish', 403, await call(T.TV_SK, 'POST', '/meetings/publish', pub('Sự kiện', mTV_SK)));
    rec('P2', 'TB_SK', 'publish việc ban khác', 403, await call(T.TB_SK, 'POST', '/meetings/publish', pub('Học thuật', mTV_HT)));
    rec('P6', 'TB_SK', 'publish việc có hạn chót trước ngày họp', 400, await call(T.TB_SK, 'POST', '/meetings/publish', pub('Sự kiện', mTV_SK, { suggestedDeadline: '2020-01-01' })));
    rec('P3', 'TB_SK', 'publish việc ban mình', 201, await call(T.TB_SK, 'POST', '/meetings/publish', pub('Sự kiện', mTV_SK)));
    rec('P4', 'TV_SK', 'POST /ai/parse-bbh', 403, await call(T.TV_SK, 'POST', '/ai/parse-bbh', { bbhText: 'x' }));
    rec('P5', 'TB_SK', 'parse-bbh bằng parser dự phòng', 200, await call(T.TB_SK, 'POST', '/ai/parse-bbh', { bbhText: 'BBH tuần\nIV. DEADLINES\n1. Ban Sự kiện làm kịch bản. Deadline: 20/11/2026', members, meetingDate: future }));

    // ---- Tài khoản & danh bạ
    await call(T.CN, 'PUT', `/members/${mTV_TT.id}`, { status: 'inactive' });
    rec('I1', 'TV_TT (vừa bị inactive)', 'GET /tasks bằng token cũ', 401, await call(T.TV_TT, 'GET', '/tasks'));
    rec('I2', 'TV_TT (vừa bị inactive)', 'đăng nhập lại', 403, await call(null, 'POST', '/auth/login', { email: mTV_TT.email, password: PASS }));
    rec('M1', 'CN', 'PUT /members role ngoài danh mục', 400, await call(T.CN, 'PUT', `/members/${mTV_SK2.id}`, { role: 'Vua' }));
    rec('M1', 'CN', 'PUT /members ban ngoài danh mục', 400, await call(T.CN, 'PUT', `/members/${mTV_SK2.id}`, { department: 'Ban Không Tồn Tại' }));
    const me = members.find((m) => m.email === presidentEmail);
    rec('M3', 'CN', 'tự hạ vai trò Chủ nhiệm duy nhất', 409, await call(T.CN, 'PUT', `/members/${me.id}`, { role: 'Thành viên' }));
    rec('M4', 'CN', 'tự ngưng hoạt động chính mình', 409, await call(T.CN, 'PUT', `/members/${me.id}`, { status: 'inactive' }));
    rec('M5', 'CN', 'POST /members email đã tồn tại', 409, await call(T.CN, 'POST', '/members', { name: 'Trùng', role: 'Thành viên', department: 'Sự kiện', email: mTB_SK.email }));
    rec('M7', 'PCN', 'POST /members thành viên thường', 201, await call(T.PCN, 'POST', '/members', { name: 'PCN thêm', role: 'Thành viên', department: 'Học thuật', email: 'pcn-them@example.com' }));
    rec('M7', 'PCN', 'PUT /members sửa thành viên thường', 200, await call(T.PCN, 'PUT', `/members/${mTV_SK2.id}`, { className: 'CNTT 66A' }));
    rec('M8', 'PCN', 'bổ nhiệm người khác làm Phó Chủ nhiệm', 403, await call(T.PCN, 'PUT', `/members/${mTV_SK2.id}`, { role: 'Phó Chủ nhiệm' }));
    rec('M8', 'PCN', 'tự nâng mình lên Chủ nhiệm', 403, await call(T.PCN, 'PUT', `/members/${mPCN.id}`, { role: 'Chủ nhiệm' }));
    rec('M8', 'PCN', 'sửa hồ sơ Chủ nhiệm', 403, await call(T.PCN, 'PUT', `/members/${me.id}`, { name: 'x' }));
    rec('M8', 'PCN', 'tạo thành viên vai trò Chủ nhiệm', 403, await call(T.PCN, 'POST', '/members', { name: 'x', role: 'Chủ nhiệm', department: 'Ban Chủ nhiệm', email: 'cn2@example.com' }));
    rec('M9', 'PCN', 'DELETE thành viên', 403, await call(T.PCN, 'DELETE', `/members/${mTV_SK2.id}`));
    rec('M9', 'TB_SK', 'PUT /members', 403, await call(T.TB_SK, 'PUT', `/members/${mTV_SK2.id}`, { name: 'x' }));
    rec('M6', 'CN', 'POST /members hợp lệ', 201, await call(T.CN, 'POST', '/members', { name: 'Thành viên thử', role: 'Thành viên', department: 'Sự kiện', email: 'thu-nghiem@example.com' }));

    // ---- Chống sập: dữ liệu sai kiểu phải trả 4xx, server vẫn sống
    rec('X1', 'CN', 'đổi email trùng người khác', 409, await call(T.CN, 'PUT', `/members/${mTV_SK.id}`, { email: mTB_SK.email }));
    rec('X2', 'TV_SK', 'submit_evidence link là object', 400, await call(T.TV_SK, 'PUT', `/tasks/${tSK2.id}`, { action: 'submit_evidence', link: { a: 1 }, report: ['x'] }));
    rec('X3', 'TB_SK', 'update deadline là số', 400, await call(T.TB_SK, 'PUT', `/tasks/${tSK2.id}`, { action: 'update', deadline: 20261120 }));
    rec('X4', 'TV_SK', 'body không phải JSON', 400, await call(T.TV_SK, 'PUT', `/tasks/${tSK2.id}`, undefined, '{"action": '));
    rec('X5', 'TB_SK', 'publish thiếu hạn chót', 400, await call(T.TB_SK, 'POST', '/meetings/publish', pub('Sự kiện', mTV_SK, { suggestedDeadline: undefined })));
    rec('X6', 'TB_SK', 'publish tasks không phải mảng', 400, await call(T.TB_SK, 'POST', '/meetings/publish', { meeting: { title: 'x', date: future }, tasks: 'abc' }));
    rec('X7', 'TV_SK', 'prefs kênh sai', 400, await call(T.TV_SK, 'PUT', '/notifications/prefs', { channel: { x: 1 } }));
    rec('X8', '(công khai)', 'login body rỗng', 400, await call(null, 'POST', '/auth/login', {}));
    rec('X9', '(công khai)', 'login email là mảng', 400, await call(null, 'POST', '/auth/login', { email: ['a'], password: {} }));
    await sleep(800);
    const h = await call(null, 'GET', '/health');
    check('X0', '(server)', 'server còn sống sau toàn bộ request lỗi', h.status === 200 && s.exited === null, `health=${h.status}, tiến trình ${s.exited === null ? 'còn sống' : 'ĐÃ THOÁT'}`);
    check('X0', '(server)', 'không có unhandledRejection trong log', !/unhandledRejection/.test(s.log));
  } finally {
    s.kill();
  }
}

async function accountSuite() {
  const s = startServer(3112, 'account.db', { DEMO_MODE: 'false', ALLOW_DESTRUCTIVE_ADMIN: 'true' });
  try {
    if (!(await s.ready())) { console.log('SERVER (tài khoản) KHÔNG KHỞI ĐỘNG\n' + s.log); process.exitCode = 1; return; }
    const call = s.call;
    // Lấy email từ CSDL thử qua đăng nhập: chế độ thật không lộ tài khoản nào
    const cfg = await call(null, 'GET', '/auth/config');
    check('F1', '(công khai)', 'auth/config chế độ thật không lộ tài khoản/mật khẩu', cfg.data?.demoMode === false && cfg.data.demoAccounts.length === 0 && !cfg.data.demoPassword);

    const emails = JSON.parse(fs.readFileSync(path.join(TMP, 'emails.json'), 'utf8'));
    const NEW = 'MatKhauMoi#2026';
    const l1 = await call(null, 'POST', '/auth/login', { email: emails.president, password: PASS });
    check('F2', 'CN', 'đăng nhập mật khẩu mặc định → bị yêu cầu đổi', l1.status === 200 && l1.data?.mustChangePassword === true);
    const pending = l1.data?.token;
    { const r = await call(pending, 'GET', '/tasks'); check('F3', 'CN (chưa đổi MK)', 'mọi API nghiệp vụ bị chặn', r.status === 403 && r.data?.code === 'PASSWORD_CHANGE_REQUIRED', `${r.status} ${r.data?.code}`); }
    { const r = await call(pending, 'GET', '/auth/me'); check('F4', 'CN (chưa đổi MK)', '/auth/me vẫn dùng được', r.status === 200 && r.data?.mustChangePassword === true); }
    rec('F5', 'CN', 'đổi MK: sai mật khẩu hiện tại', 400, await call(pending, 'POST', '/auth/change-password', { currentPassword: 'sai', newPassword: NEW }));
    rec('F5', 'CN', 'đổi MK: mật khẩu mới quá ngắn', 400, await call(pending, 'POST', '/auth/change-password', { currentPassword: PASS, newPassword: '1234567' }));
    rec('F5', 'CN', 'đổi MK: dùng lại mật khẩu mặc định (đệm đủ dài không qua được)', 400, await call(pending, 'POST', '/auth/change-password', { currentPassword: PASS, newPassword: PASS }));
    const ch = await call(pending, 'POST', '/auth/change-password', { currentPassword: PASS, newPassword: NEW });
    rec('F6', 'CN', 'đổi MK hợp lệ', 200, ch);
    const CN = ch.data?.token;
    rec('F7', 'CN', 'token cũ sau khi đổi MK', 401, await call(pending, 'GET', '/tasks'));
    rec('F7', 'CN', 'token mới', 200, await call(CN, 'GET', '/tasks'));
    rec('F8', 'CN', 'đăng nhập bằng mật khẩu mặc định cũ', 401, await call(null, 'POST', '/auth/login', { email: emails.president, password: PASS }));
    { const r = await call(null, 'POST', '/auth/login', { email: emails.president, password: NEW }); check('F8', 'CN', 'đăng nhập bằng mật khẩu mới, không bị yêu cầu đổi', r.status === 200 && r.data?.mustChangePassword === false); }

    // Thành viên đổi MK rồi quên → Chủ nhiệm đặt lại
    const m1 = await call(null, 'POST', '/auth/login', { email: emails.member, password: PASS });
    const mch = await call(m1.data?.token, 'POST', '/auth/change-password', { currentPassword: PASS, newPassword: 'ThanhVien#2026' });
    const members = (await call(CN, 'GET', '/members')).data;
    const mem = members.find((m) => m.email === emails.member);
    rec('F9', 'CN', 'đặt lại mật khẩu thành viên', 200, await call(CN, 'POST', `/members/${mem.id}/reset-password`));
    rec('F9', 'TV', 'token của thành viên sau khi bị đặt lại', 401, await call(mch.data?.token, 'GET', '/tasks'));
    { const r = await call(null, 'POST', '/auth/login', { email: emails.member, password: PASS }); check('F9', 'TV', 'đăng nhập lại bằng mặc định → phải đổi', r.status === 200 && r.data?.mustChangePassword === true); }

    // Chặn dò mật khẩu
    let last = null;
    for (let i = 0; i < 6; i++) last = await call(null, 'POST', '/auth/login', { email: emails.other, password: 'sai-' + i });
    rec('F10', '(dò mật khẩu)', 'lần sai thứ 6 cùng email', 429, last);
    rec('F10', '(dò mật khẩu)', 'đúng mật khẩu trong lúc bị khóa', 429, await call(null, 'POST', '/auth/login', { email: emails.other, password: PASS }));

    // Reset demo khi đã bật cờ: phải tự sao lưu, và danh bạ không được rỗng sau reset
    const rs = await call(CN, 'POST', '/admin/reset');
    rec('F11', 'CN', 'POST /admin/reset khi đã bật cờ', 200, rs, `sao lưu: ${rs.data?.backup}`);
    check('F11', '(server)', 'có tệp sao lưu trước khi reset', Boolean(rs.data?.backup) && fs.existsSync(path.join(TMP, 'backups', rs.data.backup)));
    rec('F11', 'CN', 'token cũ sau reset (tài khoản đã tạo lại)', 401, await call(CN, 'GET', '/tasks'));
    const l2 = await call(null, 'POST', '/auth/login', { email: emails.president, password: PASS });
    const ch2 = await call(l2.data?.token, 'POST', '/auth/change-password', { currentPassword: PASS, newPassword: NEW });
    { const r = await call(ch2.data?.token, 'GET', '/members'); check('F12', 'CN', 'danh bạ sau reset KHÔNG rỗng (đã gắn nhiệm kỳ)', r.status === 200 && r.data?.length > 0, `${r.data?.length} thành viên`); }

    const h = await call(null, 'GET', '/health');
    check('X0', '(server tài khoản)', 'server còn sống', h.status === 200 && s.exited === null);
  } finally {
    s.kill();
  }
}

(async () => {
  // Lấy 3 email mẫu từ bản sao CSDL (chủ nhiệm, một thành viên, một người khác) cho bộ thử tài khoản
  const { PrismaClient } = require(path.join(PROJ, 'node_modules/@prisma/client'));
  const probe = path.join(TMP, 'probe.db');
  copyAndMigrate(probe);
  const p = new PrismaClient({ datasources: { db: { url: `file:${probe.replace(/\\/g, '/')}` } } });
  const ms = await p.member.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } });
  await p.$disconnect();
  const tv = ms.filter((m) => m.role === 'Thành viên');
  fs.writeFileSync(path.join(TMP, 'emails.json'), JSON.stringify({ president: ms.find((m) => m.role === 'Chủ nhiệm').email, member: tv[0].email, other: tv[1].email }));

  await mainSuite();
  await accountSuite();

  const w = (v, n) => String(v).padEnd(n).slice(0, n);
  console.log('\n' + w('ID', 4) + w('Vai trò', 28) + w('Thao tác', 58) + w('K.vọng', 8) + w('Thực tế', 8) + w('KQ', 9) + 'Ghi chú');
  for (const r of rows) console.log(w(r.id, 4) + w(r.who, 28) + w(r.what, 58) + w(r.expect, 8) + w(r.actual, 8) + w(r.ok, 9) + r.note);
  // TEST_REPORT=<tệp.json>: xuất toàn bộ kết quả để đưa vào báo cáo thử nghiệm
  if (process.env.TEST_REPORT) fs.writeFileSync(process.env.TEST_REPORT, JSON.stringify(rows, null, 1));
  const bad = rows.filter((r) => r.ok === 'LỆCH');
  const pend = rows.filter((r) => r.ok.startsWith('CHỜ'));
  console.log(`\nTổng ${rows.length} phép thử — đạt ${rows.filter((r) => r.ok === 'OK').length}, LỆCH ${bad.length}, chờ giai đoạn sau ${pend.length} (${[...new Set(pend.map((r) => r.id))].join(', ')})`);
  if (bad.length) process.exitCode = 1;
})()
  .catch((e) => { console.error('LỖI BỘ THỬ', e); process.exitCode = 1; })
  .finally(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {} setTimeout(() => process.exit(process.exitCode || 0), 500); });
