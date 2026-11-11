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
  onOpenTask,
  channel,
  onChangeChannel,
}) => {
  const [open, setOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
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
    if (next) {
      onRefresh();
    }
  };

  const displayedNotifications =
    activeTab === 'unread' ? notifications.filter((n) => !n.readAt) : notifications;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={handleToggle}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 transition relative cursor-pointer shadow-xs"
        title="Thông báo của bạn"
      >
        <Bell className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
        <span className="hidden lg:inline">Thông báo</span>
        {unread > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold absolute -top-1.5 -right-1.5 flex items-center justify-center animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[92vw] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white">Thông báo</span>
              {unread > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold">
                  {unread} mới
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPrefsOpen((v) => !v)}
                className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Cài đặt nhận thông báo"
              >
                <Settings2 className="w-4 h-4" />
              </button>
              {unread > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-[#1E4FC4] dark:text-[#8FB2FF] hover:bg-[#2C69FF]/10 dark:hover:bg-[#2C69FF]/20 transition cursor-pointer"
                  title="Đánh dấu tất cả đã đọc"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Đã đọc hết</span>
                </button>
              )}
            </div>
          </div>

          {/* Tabs: Tất cả vs Chưa đọc */}
          <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-3 bg-slate-50 dark:bg-slate-950/40 text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`py-2 px-3 font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'all'
                  ? 'border-[#2C69FF] text-[#1E4FC4] dark:text-[#8FB2FF]'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Tất cả ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`py-2 px-3 font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'unread'
                  ? 'border-[#2C69FF] text-[#1E4FC4] dark:text-[#8FB2FF]'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>Chưa đọc</span>
              {unread > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-500 text-white font-bold">
                  {unread}
                </span>
              )}
            </button>
          </div>

          {/* Cài đặt kênh nhận */}
          {prefsOpen && (
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Kênh nhận thông báo</div>
              {Object.entries(CHANNEL_LABEL).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => onChangeChannel(key)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition cursor-pointer ${
                    channel === key
                      ? 'bg-[#2C69FF]/10 dark:bg-[#2C69FF]/15 text-[#1E4FC4] dark:text-[#8FB2FF] border border-[#2C69FF]/30 font-semibold'
                      : 'bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{label}</span>
                  {channel === key && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
              <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-1">
                Email hoạt động khi máy chủ bật cấu hình SMTP (EMAIL_ENABLED=true). Kênh "email tổng hợp" gửi 1 email duy nhất lúc 20h mỗi ngày.
              </p>
            </div>
          )}

          {/* Danh sách */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {displayedNotifications.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                {activeTab === 'unread'
                  ? '🎉 Bạn không có thông báo chưa đọc nào.'
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
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer flex gap-3 ${
                    !n.readAt ? 'bg-[#2C69FF]/[0.05] dark:bg-[#2C69FF]/[0.10]' : ''
                  }`}
                  title={n.taskId ? 'Bấm để mở chi tiết công việc' : ''}
                >
                  <span className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center text-sm ${meta.color}`}>
                    {meta.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-bold truncate ${!n.readAt ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                        {n.title}
                      </span>
                      {!n.readAt && <span className="w-2 h-2 rounded-full bg-[#2C69FF] shrink-0" />}
                    </span>
                    {n.body && (
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 whitespace-pre-line">
                        {n.body}
                      </span>
                    )}
                    <span className="flex items-center justify-between mt-1 text-[10px]">
                      <span className="text-slate-400 dark:text-slate-500">{timeAgoVN(n.createdAt)}</span>
                      {n.taskId && (
                        <span className="text-[#1E4FC4] dark:text-[#8FB2FF] hover:underline font-semibold flex items-center gap-0.5">
                          <span>Chi tiết việc</span>
                          <span>&rarr;</span>
                        </span>
                      )}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
