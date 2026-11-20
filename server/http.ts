import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { Prisma } from '@prisma/client';
import { ZodType } from 'zod';

// ===== Hạ tầng HTTP: bắt lỗi async, lỗi có mã trạng thái, kiểm tra đầu vào =====
// Express 4 không tự bắt Promise bị reject trong handler async → lỗi thành unhandledRejection
// và làm sập tiến trình. Mọi handler vì thế phải đi qua wrap()/asyncRouter().

/** Lỗi nghiệp vụ có mã HTTP — throw ở bất kỳ đâu trong handler, errorHandler sẽ trả JSON. */
export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Bọc handler (sync hoặc async): mọi lỗi/reject được chuyển cho errorHandler thay vì làm sập server. */
export function wrap(fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler {
  return (req, res, next) => {
    try {
      Promise.resolve(fn(req, res, next)).catch(next);
    } catch (e) {
      next(e);
    }
  };
}

/** Router mà mọi handler đăng ký qua get/post/put/delete/patch đều tự được bọc wrap(). */
export function asyncRouter(): Router {
  const router = Router();
  for (const method of ['get', 'post', 'put', 'delete', 'patch'] as const) {
    const original = (router[method] as (...args: unknown[]) => Router).bind(router);
    (router as unknown as Record<string, unknown>)[method] = (path: unknown, ...handlers: unknown[]) =>
      original(
        path,
        // Handler 4 tham số là error middleware — giữ nguyên
        ...handlers.map((h) => (typeof h === 'function' && h.length < 4 ? wrap(h as RequestHandler) : h))
      );
  }
  return router;
}

/**
 * Kiểm tra dữ liệu đầu vào theo schema zod. Sai → HttpError 400 kèm vị trí trường lỗi.
 * Trả về dữ liệu đã chuẩn hóa (đã bỏ trường lạ, đã ép kiểu/giá trị mặc định).
 */
export function validate<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const where = issue.path.length
    ? issue.path.map((p) => (typeof p === 'number' ? `[${p + 1}]` : String(p))).join('.').replace(/\.\[/g, '[')
    : '';
  throw new HttpError(400, where ? `Dữ liệu không hợp lệ (${where}): ${issue.message}` : `Dữ liệu không hợp lệ: ${issue.message}`, 'VALIDATION');
}

/** 404 cho đường dẫn /api không tồn tại (thay vì rơi xuống trang SPA). */
export function apiNotFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Không tìm thấy API này' });
}

/** Error middleware cuối chuỗi — chuyển mọi lỗi thành JSON, không bao giờ để lộ stack trace. */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
    return;
  }

  // body-parser
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Dữ liệu gửi lên không phải JSON hợp lệ' });
    return;
  }
  if (err?.type === 'entity.too.large') {
    const limitMb = req.originalUrl.startsWith('/api/ai/parse-bbh') ? 25 : 2;
    res.status(413).json({ error: `Dữ liệu gửi lên quá lớn (tối đa ${limitMb}MB)` });
    return;
  }
  // multer (upload file)
  if (err?.name === 'MulterError') {
    res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Tệp tải lên quá lớn (tối đa 10MB)' : 'Tệp tải lên không hợp lệ' });
    return;
  }

  // Prisma: ràng buộc CSDL
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray((err.meta as any)?.target) ? (err.meta as any).target.join(', ') : '';
      res.status(409).json({ error: `Dữ liệu bị trùng${target ? ` (${target})` : ''} — giá trị này đã tồn tại trong hệ thống` });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Không tìm thấy bản ghi cần thao tác' });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({ error: 'Không thể thực hiện vì dữ liệu này đang được tham chiếu ở nơi khác' });
      return;
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error(`[${req.method} ${req.originalUrl}] Prisma validation:`, err.message.split('\n').slice(-3).join(' '));
    res.status(400).json({ error: 'Dữ liệu gửi lên sai kiểu hoặc thiếu trường bắt buộc' });
    return;
  }

  console.error(`[${req.method} ${req.originalUrl}] Lỗi không lường trước:`, err);
  res.status(500).json({ error: 'Lỗi máy chủ nội bộ. Thao tác chưa được thực hiện — vui lòng thử lại.' });
}

/** Chặn tiến trình sập vì Promise bị reject ngoài vòng đời request (cron, SSE, email...). */
export function installProcessGuards(): void {
  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection] Lỗi async chưa được bắt (server vẫn tiếp tục chạy):', reason);
  });
}
