import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

// ===== Phản hồi giao diện dùng chung: thông báo góc màn hình + hộp xác nhận =====
// Thay cho alert()/confirm() của trình duyệt (chặn cả trang, lệch giao diện).
// Gọi được từ bất kỳ đâu, không cần truyền props:
//   toast('Đã lưu', 'Mô tả ngắn')              — thông báo tự ẩn
//   toast('Lỗi', e.message, 'warn')
//   if (!(await confirmDialog({ title: 'Xóa?', danger: true }))) return;

export type ToastType = 'success' | 'info' | 'warn';

interface ToastItem {
  id: number;
  title: string;
  desc?: string;
  type: ToastType;
  leaving: boolean;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Thao tác phá hủy (xóa, đặt lại…) → nút xác nhận màu đỏ */
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

type Api = {
  toast: (title: string, desc?: string, type?: ToastType) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

let api: Api | null = null;

export function toast(title: string, desc?: string, type: ToastType = 'success'): void {
  if (api) api.toast(title, desc, type);
  else console.warn('[toast]', title, desc);
}

export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const o = typeof opts === 'string' ? { title: opts } : opts;
  // Dự phòng khi provider chưa gắn (không xảy ra trong ứng dụng bình thường)
  if (!api) return Promise.resolve(window.confirm(o.message ? `${o.title}\n\n${o.message}` : o.title));
  return api.confirm(o);
}

const TOAST_MS = 4000;
const LEAVE_MS = 160;

const TONE: Record<ToastType, { box: string; icon: React.ReactNode }> = {
  success: {
    box: 'bg-white border-emerald-300 text-slate-900',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
  },
  info: {
    box: 'bg-blue-50 border-blue-300 text-blue-950',
    icon: <Info className="w-5 h-5 text-blue-600" />,
  },
  warn: {
    box: 'bg-amber-50 border-amber-300 text-amber-950',
    icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
  },
};

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const nextId = useRef(1);
  const confirmBtn = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), LEAVE_MS);
  }, []);

  const pushToast = useCallback(
    (title: string, desc?: string, type: ToastType = 'success') => {
      const id = nextId.current++;
      // Giữ tối đa 3 thông báo; mỗi thông báo có đồng hồ riêng (không tắt nhầm thông báo mới hơn)
      setToasts((list) => [...list.slice(-2), { id, title, desc, type, leaving: false }]);
      window.setTimeout(() => dismiss(id), type === 'warn' ? TOAST_MS + 2000 : TOAST_MS);
    },
    [dismiss]
  );

  // Giữ hộp xác nhận đang mở trong ref để trả kết quả ngay khi bấm (không gọi resolve bên trong hàm cập nhật state)
  const confirmRef = useRef<ConfirmState | null>(null);
  const askConfirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        confirmRef.current?.resolve(false); // hộp cũ còn mở → coi như hủy
        const next = { ...opts, resolve };
        confirmRef.current = next;
        setConfirmState(next);
      }),
    []
  );

  useEffect(() => {
    api = { toast: pushToast, confirm: askConfirm };
    return () => {
      api = null;
    };
  }, [pushToast, askConfirm]);

  const closeConfirm = useCallback((ok: boolean) => {
    const current = confirmRef.current;
    confirmRef.current = null;
    setConfirmState(null);
    current?.resolve(ok);
  }, []);

  // Hộp xác nhận: Enter = đồng ý, Esc = hủy; tự focus nút xác nhận
  useEffect(() => {
    if (!confirmState) return;
    confirmBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfirm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmState, closeConfirm]);

  return (
    <>
      {children}

      {/* Thông báo góc màn hình (đặt trên thanh điều hướng di động) */}
      <div className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-[70] flex flex-col items-end gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto w-[min(22rem,calc(100vw-2rem))] p-3.5 rounded-xl shadow-xl border flex items-start gap-3 ${TONE[t.type].box} ${
              t.leaving ? 'nitc-toast-leave' : 'animate-in fade-in slide-in-from-bottom-3 duration-200'
            }`}
          >
            <div className="shrink-0 mt-0.5">{TONE[t.type].icon}</div>
            <div className="flex-1 min-w-0">
              <h5 className="font-bold text-sm">{t.title}</h5>
              {t.desc && <p className="text-xs text-slate-600 mt-0.5 break-words">{t.desc}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-black/5 transition cursor-pointer"
              title="Đóng"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Hộp xác nhận */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px] animate-in fade-in duration-150"
          onClick={() => closeConfirm(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl shrink-0 ${confirmState.danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                {confirmState.danger ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-sm">{confirmState.title}</h3>
                {confirmState.message && (
                  <p className="text-xs text-slate-600 mt-1 whitespace-pre-line leading-relaxed">{confirmState.message}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                {confirmState.cancelText || 'Hủy'}
              </button>
              <button
                ref={confirmBtn}
                type="button"
                onClick={() => closeConfirm(true)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold text-white transition cursor-pointer ${
                  confirmState.danger ? 'bg-red-600 hover:bg-red-500' : 'bg-[#2C69FF] hover:bg-[#1F56D6]'
                }`}
              >
                {confirmState.confirmText || 'Đồng ý'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
