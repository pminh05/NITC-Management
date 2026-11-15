// API client — wrapper fetch gắn JWT, trả về JSON đã type, lỗi có message tiếng Việt

const TOKEN_KEY = 'nitc_token_v3';

/** Sự kiện toàn cục để App phản ứng khi phiên hết hiệu lực / bị buộc đổi mật khẩu giữa chừng. */
export const SESSION_EXPIRED_EVENT = 'nitc:session-expired';
export const PASSWORD_CHANGE_REQUIRED_EVENT = 'nitc:password-change-required';

export class ApiError extends Error {
  status: number;
  /** Mã lỗi máy đọc được từ server (VD: PASSWORD_CHANGE_REQUIRED, TOO_MANY_ATTEMPTS) */
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/** Chuyển phản hồi lỗi thành ApiError + phát sự kiện phiên khi cần. */
function toApiError(path: string, res: Response, data: any, hadToken: boolean): ApiError {
  const err = new ApiError(data?.error || `Lỗi máy chủ (${res.status})`, res.status, data?.code);
  if (typeof window !== 'undefined') {
    // 401 khi đang có token (không phải lúc đăng nhập) = phiên đã hết hiệu lực: token hết hạn,
    // mật khẩu đã đổi, hoặc tài khoản bị ngưng hoạt động
    if (res.status === 401 && hadToken && !path.startsWith('/auth/login')) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: err.message }));
    }
    if (res.status === 403 && err.code === 'PASSWORD_CHANGE_REQUIRED') {
      window.dispatchEvent(new CustomEvent(PASSWORD_CHANGE_REQUIRED_EVENT));
    }
  }
  return err;
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('Không kết nối được máy chủ. Kiểm tra server đang chạy?', 0);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw toApiError(path, res, data, Boolean(token));
  }
  return data as T;
}

/** Upload multipart (file Excel...) kèm các trường form lân cận */
export async function apiUpload<T>(
  path: string,
  file: File,
  fields: Record<string, string> = {}
): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  for (const [k, v] of Object.entries(fields)) {
    form.append(k, v);
  }
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method: 'POST', headers, body: form });
  } catch {
    throw new ApiError('Không kết nối được máy chủ.', 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(path, res, data, Boolean(token));
  }
  return data as T;
}
