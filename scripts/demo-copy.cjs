// Chạy giao diện + máy chủ trên BẢN SAO của prisma/dev.db ở cổng 3111 (chế độ demo, tắt bộ lập lịch và thư).
// Dùng để chụp ảnh giao diện cho báo cáo mà không đụng CSDL thật. Chạy: node scripts/demo-copy.cjs
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJ = path.resolve(__dirname, '..');
const dir = path.join(os.tmpdir(), 'nitc-demo-copy');
fs.mkdirSync(dir, { recursive: true });
const db = path.join(dir, 'demo.db');
fs.copyFileSync(path.join(PROJ, 'prisma', 'dev.db'), db);
const env = { ...process.env, DATABASE_URL: `file:${db.replace(/\\/g, '/')}` };
execSync(`"${process.execPath}" "${path.join(PROJ, 'node_modules/prisma/build/index.js')}" migrate deploy`, { cwd: PROJ, env, stdio: 'pipe' });

const child = spawn(process.execPath, [path.join(PROJ, 'node_modules/tsx/dist/cli.mjs'), 'server.ts'], {
  cwd: PROJ,
  env: { ...env, PORT: '3111', DEMO_MODE: 'true', SCHEDULER_ENABLED: 'false', EMAIL_ENABLED: 'false', ALLOW_DESTRUCTIVE_ADMIN: 'false' },
  stdio: 'inherit',
});
const stop = () => { try { process.platform === 'win32' ? execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' }) : child.kill(); } catch {} process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (c) => process.exit(c ?? 0));
