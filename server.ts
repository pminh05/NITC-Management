import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { config } from './server/config';
import {
  authConfigHandler,
  authenticateToken,
  changePasswordHandler,
  loginHandler,
  meHandler,
  requireAuth,
  requireAuthAllowPending,
} from './server/auth';
import { apiRouter } from './server/api';
import { canPublishMeeting, requireCan } from './server/permissions';
import { parseBBHHandler } from './server/aiParser';
import { seedIfEmpty } from './server/seed';
import { subscribeMember } from './server/notifications';
import { calendarIcsHandler } from './server/calendar';
import { registerDocsRoutes } from './server/docs';
import { startScheduler } from './server/scheduler';
import { HttpError, apiNotFound, errorHandler, installProcessGuards, wrap } from './server/http';

// Promise bị reject ngoài vòng đời request (cron, SSE, email) chỉ ghi log, không làm sập server
installProcessGuards();

const app = express();
const PORT = config.port;

app.disable('x-powered-by');
app.use(express.json({ limit: '25mb' })); // ảnh/PDF base64 có thể lớn hơn file gốc ~37%

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Auth
app.get('/api/auth/config', wrap(authConfigHandler)); // công khai: trang đăng nhập hỏi có ở chế độ demo không
app.post('/api/auth/login', wrap(loginHandler));
// Hai route dưới cho qua tài khoản đang chờ đổi mật khẩu mặc định
app.get('/api/auth/me', requireAuthAllowPending, wrap(meHandler));
app.post('/api/auth/change-password', requireAuthAllowPending, wrap(changePasswordHandler));

// SSE stream thông báo realtime — EventSource không gửi được header, xác thực qua ?token=
app.get(
  '/api/notifications/stream',
  wrap(async (req, res) => {
    const auth = await authenticateToken(String(req.query.token || ''));
    if (auth.mustChangePassword) {
      throw new HttpError(403, 'Bạn cần đổi mật khẩu mặc định trước khi sử dụng hệ thống', 'PASSWORD_CHANGE_REQUIRED');
    }
    const memberId = auth.member.id;

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
  })
);

// Xuất lịch ICS (Google/Apple Calendar)
app.get('/api/calendar.ics', requireAuth, wrap(calendarIcsHandler));

// AI BBH Parser: Ban lãnh đạo + Trưởng/Phó ban (họp riêng ban)
app.post(
  '/api/ai/parse-bbh',
  requireAuth,
  requireCan(canPublishMeeting, 'Chỉ Ban lãnh đạo hoặc Trưởng ban/Phó ban được đọc biên bản họp'),
  wrap(parseBBHHandler)
);

// Toàn bộ API nghiệp vụ (cần đăng nhập)
app.use('/api', requireAuth, apiRouter);
registerDocsRoutes(apiRouter);

// Đường dẫn /api không tồn tại → 404 JSON; mọi lỗi của API → JSON qua errorHandler (không sập tiến trình)
app.use('/api', apiNotFound);
app.use(errorHandler);

// Vite & Static Asset Handling
async function startServer() {
  // Seed dữ liệu mẫu khi CSDL trống (lần chạy đầu)
  const seeded = await seedIfEmpty();
  if (seeded) {
    console.log(`✔ Database seeded với dữ liệu demo NITC (mật khẩu mặc định: ${config.defaultPassword})`);
  }

  if (!config.isProd) {
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
    if (config.demoMode) {
      console.log('⚠ DEMO_MODE=true: hiện nút đăng nhập nhanh và không buộc đổi mật khẩu mặc định — tắt khi dùng thật.');
    }
  });

  // Cron: quét deadline 6h · digest 20h · báo cáo tuần Chủ Nhật 21h
  startScheduler();
}

startServer().catch((e) => {
  console.error('✘ Không khởi động được server:', e);
  process.exit(1);
});
