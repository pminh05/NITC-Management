import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import { loginHandler, meHandler, requireAuth } from './server/auth';
import { apiRouter } from './server/api';
import { parseBBHHandler } from './server/aiParser';
import { seedIfEmpty } from './server/seed';
import { subscribeMember } from './server/notifications';
import { calendarIcsHandler } from './server/calendar';
import { registerDocsRoutes } from './server/docs';
import { startScheduler } from './server/scheduler';
import { prisma } from './server/db';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nitc-command-center-dev-secret-change-in-production';

app.use(express.json({ limit: '25mb' })); // ảnh/PDF base64 có thể lớn hơn file gốc ~37%

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Auth (không cần token)
app.post('/api/auth/login', loginHandler);
app.get('/api/auth/me', requireAuth, meHandler);

// SSE stream thông báo realtime — EventSource không gửi được header, xác thực qua ?token=
app.get('/api/notifications/stream', async (req, res) => {
  const token = String(req.query.token || '');
  let memberId: string;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { member: true } });
    if (!user?.member) throw new Error('no member');
    memberId = user.member.id;
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`data: ${JSON.stringify({ hello: true })}\n\n`);

  const unsubscribe = subscribeMember(memberId, (data) => {
    res.write(`data: ${data}\n\n`);
  });
  // Heartbeat 25s giữ kết nối sống
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// Xuất lịch ICS (Google/Apple Calendar) — tải trực tiếp trên trình duyệt qua ?token=
app.get('/api/calendar.ics', requireAuth, calendarIcsHandler);

// AI BBH Parser: Ban lãnh đạo + Trưởng/Phó ban (họp riêng ban)
app.post('/api/gemini/parse-bbh', requireAuth, (req, res, next) => {
  const role = req.authMember?.role;
  if (!['Chủ nhiệm', 'Phó Chủ nhiệm', 'Trưởng ban', 'Phó ban'].includes(role || '')) {
    return res.status(403).json({ error: 'Chỉ Ban lãnh đạo hoặc Trưởng ban/Phó ban được đọc biên bản họp' });
  }
  return next();
}, parseBBHHandler);

// Reminder / Nag log placeholder (giữ tương thích cũ; log thật giờ qua /api/logs)
app.post('/api/nag/send-reminders', requireAuth, (req, res) => {
  const { type, recipientEmail, recipientName, subject, content, department, taskCount } = req.body || {};
  const log = {
    id: `log-${Date.now()}`,
    type: type || 'overdue_nag',
    recipientName: recipientName || 'Ban Điều Hành NITC',
    recipientEmail: recipientEmail || 'bdh-nitc@gmail.com',
    department,
    subject: subject || 'Thông báo từ NITC Command Center',
    content: content || '',
    sentAt: new Date().toISOString(),
    status: 'sent',
    taskCount: taskCount || 1,
  };
  res.json({ success: true, log });
});

// Toàn bộ API nghiệp vụ (cần đăng nhập)
app.use('/api', requireAuth, apiRouter);
registerDocsRoutes(apiRouter);

// Vite & Static Asset Handling
async function startServer() {
  // Seed dữ liệu mẫu khi CSDL trống (lần chạy đầu)
  const seeded = await seedIfEmpty();
  if (seeded) {
    console.log('✔ Database seeded với dữ liệu demo NITC (mật khẩu mặc định: nitc123)');
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NITC Command Center Server (v3 backend) running on http://localhost:${PORT}`);
  });

  // Cron: quét deadline 6h · digest 20h · báo cáo tuần Chủ Nhật 21h
  startScheduler();
}

startServer();
