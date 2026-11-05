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
  channel: string;
  onChangeChannel: (channel: string) => void;
}

const TYPE_META: Record<string, { icon: string; color: string }> = {
  task_assigned: { icon: '📌', color: 'bg-[#2C69FF]/15 text-[#8FB2FF] border-[#2C69FF]/30' },
  deadline_tomorrow: { icon: '⏰', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  deadline_today: { icon: '🔥', color: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  overdue: { icon: '🚨', color: 'bg-red-500/15 text-red-300 border-red-500/30' },
  evidence_submitted: { icon: '📥', color: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  evidence_approved: { icon: '✅', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  evidence_rejected: { icon: '↩️', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  sticky_carried: { icon: '📎', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  weekly_summary: { icon: '📊', color: 'bg-[#2C69FF]/15 text-[#8FB2FF] border-[#2C69FF]/30' },
  broadcast: { icon: '📢', color: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
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
  channel,
  onChangeChannel,
}) => {
  const [open, setOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi bấm ra ngoài
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPrefsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    setPrefsOpen(false);
    if (next) onRefresh();
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={handleToggle}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition relative cursor-pointer"
        title="Thông báo của bạn"
      >
        <Bell className="w-3.5 h-3.5 text-amber-400" />
        <span className="hidden lg:inline">Thông báo</span>
        {unread > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold absolute -top-1.5 -right-1.5 flex items-center justify-center animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[92vw] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Thông báo</span>
              {unread > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-bold border border-red-500/30">
                  {unread} chưa đọc
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPrefsOpen((v) => !v)}
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Cài đặt nhận thông báo"
              >
                <Settings2 className="w-4 h-4" />
              </button>
              <button
                onClick={onMarkAllRead}
                disabled={unread === 0}
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                title="Đánh dấu tất cả đã đọc"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cài đặt kênh nhận */}
          {prefsOpen && (
            <div className="px-4 py-3 bg-slate-800/60 border-b border-slate-800 space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Kênh nhận thông báo</div>
              {Object.entries(CHANNEL_LABEL).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => onChangeChannel(key)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition cursor-pointer ${
                    channel === key
                      ? 'bg-[#2C69FF]/15 text-[#8FB2FF] border border-[#2C69FF]/30 font-semibold'
                      : 'bg-slate-900/60 text-slate-300 border border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <span>{label}</span>
                  {channel === key && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
              <p className="text-[10px] text-slate-500 pt-1">
                Email hoạt động khi máy chủ bật cấu hình SMTP (EMAIL_ENABLED=true). Kênh "email tổng hợp" gửi 1 email duy nhất lúc 20h mỗi ngày.
              </p>
            </div>
          )}

          {/* Danh sách */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-800">
            {notifications.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-500 text-xs">
                Chưa có thông báo nào. Thông báo giao việc, hạn chót và kết quả duyệt sẽ hiện ở đây.
              </div>
            )}
            {notifications.map((n) => {
              const meta = TYPE_META[n.type] || TYPE_META.broadcast;
              return (
                <button
                  key={n.id}
                  onClick={() => onMarkRead(n.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-800/60 transition cursor-pointer flex gap-3 ${
                    !n.readAt ? 'bg-[#2C69FF]/[0.06]' : ''
                  }`}
                  title={n.readAt ? '' : 'Bấm để đánh dấu đã đọc'}
                >
                  <span className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center text-sm ${meta.color}`}>
                    {meta.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className={`text-xs font-bold truncate ${!n.readAt ? 'text-white' : 'text-slate-300'}`}>
                        {n.title}
                      </span>
                      {!n.readAt && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                    </span>
                    {n.body && (
                      <span className="block text-[11px] text-slate-400 mt-0.5 line-clamp-2 whitespace-pre-line">
                        {n.body}
                      </span>
                    )}
                    <span className="block text-[10px] text-slate-500 mt-1">{timeAgoVN(n.createdAt)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
