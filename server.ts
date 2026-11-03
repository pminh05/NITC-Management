import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { loginHandler, meHandler, requireAuth } from './server/auth';
import { apiRouter } from './server/api';
import { parseBBHHandler } from './server/gemini';
import { seedIfEmpty } from './server/seed';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Auth (không cần token)
app.post('/api/auth/login', loginHandler);
app.get('/api/auth/me', requireAuth, meHandler);

// AI BBH Parser (cần đăng nhập — chỉ Chủ tịch/BĐH mới dùng được từ UI)
app.post('/api/gemini/parse-bbh', requireAuth, parseBBHHandler);

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
}

startServer();
