import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck, Settings2 } from 'lucide-react';
import { AppNotification } from '../types';
import { api } from '../api/client';

interface NotificationBellProps {
  notifications: AppNotification[];
  unread: number;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onOpenTask: (taskId: string) => void;
  channel: string;
  onChangeChannel: (channel: string) => void;
}

// Ô icon theo loại thông báo: nền nhạt, chữ đậm cùng sắc (giao diện sáng)
const TYPE_META: Record<string, { icon: string; color: string }> = {
  task_assigned: { icon: '📌', color: 'bg-primary-light border-primary/20' },
  deadline_tomorrow: { icon: '⏰', color: 'bg-warning-bg border-warning-bar/25' },
  deadline_today: { icon: '🔥', color: 'bg-warning-bg border-warning-bar/25' },
  overdue: { icon: '🚨', color: 'bg-danger-bg border-danger-bar/25' },
  evidence_submitted: { icon: '📥', color: 'bg-info-bg border-info-bar/25' },
  evidence_approved: { icon: '✅', color: 'bg-success-bg border-success-bar/25' },
  evidence_rejected: { icon: '↩️', color: 'bg-warning-bg border-warning-bar/25' },
  sticky_carried: { icon: '📎', color: 'bg-surface-2 border-border' },
  weekly_summary: { icon: '📊', color: 'bg-primary-light border-primary/20' },
  broadcast: { icon: '📢', color: 'bg-surface-2 border-border' },
};

function timeAgoVN(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

const CHANNEL_LABEL: Record<string, string> = {
  in_app: 'Chỉ trong ứng dụng',
  in_app_email: 'Ứng dụng + email ngay',
  digest: 'Ứng dụng + email tổng hợp 20h',
};

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  unread,
  onRefresh,
  onMarkAllRead,
  onMarkRead,
  onOpenTask,
  channel,
  onChangeChannel,
}) => {
  const [open, setOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPrefsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setPrefsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    setPrefsOpen(false);
    if (next) {
      onRefresh();
    }
  };

  const displayedNotifications =
    activeTab === 'unread' ? notifications.filter((n) => !n.readAt) : notifications;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="relative inline-flex size-10 items-center justify-center rounded-lg text-fg-2 transition hover:bg-black/5 cursor-pointer"
        title="Thông báo của bạn"
        aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
        aria-expanded={open}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger-bar px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <div
        data-open={open}
        className="menu-pop absolute right-0 z-50 mt-2 w-96 max-w-[92vw] overflow-hidden rounded-xl border border-border bg-surface shadow-[0_16px_40px_-12px_rgba(16,24,40,0.22)]"
      >
        {/* Đầu bảng */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold text-fg">Thông báo</span>
            {unread > 0 && (
              <span className="rounded-full bg-danger-bg px-1.5 py-0.5 text-[11px] font-semibold text-danger">
                {unread} mới
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPrefsOpen((v) => !v)}
              className="rounded-md p-1.5 text-muted transition hover:bg-surface-2 hover:text-fg cursor-pointer"
              title="Cài đặt nhận thông báo"
              aria-label="Cài đặt nhận thông báo"
            >
              <Settings2 className="size-4" />
            </button>
            {unread > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-primary transition hover:bg-primary-light cursor-pointer"
                title="Đánh dấu tất cả đã đọc"
              >
                <CheckCheck className="size-3.5" />
                <span>Đã đọc hết</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab: Tất cả / Chưa đọc */}
        <div className="flex items-center gap-1 border-b border-border px-3 text-[13px]">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`border-b-2 px-2 py-2 font-medium transition cursor-pointer ${
              activeTab === 'all' ? 'border-primary text-fg' : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            Tất cả ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unread')}
            className={`flex items-center gap-1.5 border-b-2 px-2 py-2 font-medium transition cursor-pointer ${
              activeTab === 'unread' ? 'border-primary text-fg' : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            <span>Chưa đọc</span>
            {unread > 0 && (
              <span className="rounded-full bg-danger-bg px-1.5 text-[11px] font-semibold text-danger">{unread}</span>
            )}
          </button>
        </div>

        {/* Kênh nhận */}
        {prefsOpen && (
          <div className="space-y-1.5 border-b border-border bg-surface-2 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Kênh nhận thông báo</div>
            {Object.entries(CHANNEL_LABEL).map(([key, label]) => (
              <button
                type="button"
                key={key}
                onClick={() => onChangeChannel(key)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-[13px] transition cursor-pointer ${
                  channel === key
                    ? 'border-primary/30 bg-primary-light font-medium text-primary'
                    : 'border-border bg-surface text-fg-2 hover:bg-surface-2'
                }`}
              >
                <span>{label}</span>
                {channel === key && <Check className="size-3.5" />}
              </button>
            ))}
            <p className="pt-1 text-[11px] text-muted">
              Email hoạt động khi máy chủ bật cấu hình SMTP (EMAIL_ENABLED=true). Kênh "email tổng hợp" gửi 1 email duy nhất lúc 20h mỗi ngày.
            </p>
          </div>
        )}

        {/* Danh sách */}
        <div className="max-h-96 divide-y divide-border overflow-y-auto">
          {displayedNotifications.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-muted">
              {activeTab === 'unread'
                ? 'Bạn không có thông báo chưa đọc nào.'
                : 'Chưa có thông báo nào. Thông báo giao việc, hạn chót và kết quả duyệt sẽ hiện ở đây.'}
            </div>
          )}
          {displayedNotifications.map((n) => {
            const meta = TYPE_META[n.type] || TYPE_META.broadcast;
            return (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.readAt) onMarkRead(n.id);
                  if (n.taskId) {
                    onOpenTask(n.taskId);
                    setOpen(false);
                  }
                }}
                className={`flex w-full cursor-pointer gap-3 px-4 py-3 text-left transition hover:bg-surface-2 ${
                  !n.readAt ? 'bg-primary-light/50' : ''
                }`}
                title={n.taskId ? 'Bấm để mở chi tiết công việc' : ''}
              >
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg border text-sm ${meta.color}`}>
                  {meta.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-[13px] ${!n.readAt ? 'font-semibold text-fg' : 'font-medium text-fg-2'}`}>
                      {n.title}
                    </span>
                    {!n.readAt && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                  </span>
                  {n.body && (
                    <span className="mt-0.5 block line-clamp-2 whitespace-pre-line text-[12px] text-muted">{n.body}</span>
                  )}
                  <span className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-muted">{timeAgoVN(n.createdAt)}</span>
                    {n.taskId && <span className="font-medium text-primary hover:underline">Chi tiết việc →</span>}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
