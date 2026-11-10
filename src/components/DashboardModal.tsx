import React, { useEffect, useState } from 'react';
import { X, RefreshCw, TrendingUp } from 'lucide-react';
import { api } from '../api/client';
import { Meeting, Member, Task } from '../types';

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  meetings: Meeting[];
  authMember: Member;
}

interface KpiResponse {
  members: Array<{
    memberId: string;
    name: string;
    department: string;
    total: number;
    completed: number;
    overdue: number;
    points: number;
  }>;
  departments: Array<{
    department: string;
    total: number;
    completed: number;
    overdue: number;
    points: number;
    completionRate: number;
    memberCount: number;
  }>;
}

const DEPT_EMOJI: Record<string, string> = {
  'Học thuật': '💻',
  'Truyền thông': '📢',
  'Sự kiện': '📅',
  'Đối ngoại': '🤝',
  'Ban Chủ nhiệm': '👑',
};

const STATUS_COLORS = {
  in_progress: { label: 'Đang làm', color: '#2C69FF' },
  pending_approval: { label: 'Chờ duyệt', color: '#f59e0b' },
  overdue: { label: 'Quá hạn', color: '#ef4444' },
  completed: { label: 'Đã xong', color: '#10b981' },
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Donut SVG: phân bố trạng thái công việc */
const DonutChart: React.FC<{ slices: Array<{ label: string; value: number; color: string }> }> = ({ slices }) => {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const R = 54;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="w-36 h-36 -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="18" />
        {total > 0 &&
          slices.map((s) => {
            const len = (s.value / total) * C;
            const el = (
              <circle
                key={s.label}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="18"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        {total === 0 && <circle cx="70" cy="70" r={R} fill="none" stroke="#94a3b8" strokeWidth="18" strokeDasharray="4 8" />}
      </svg>
      <div className="space-y-1.5 text-xs">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-slate-600 dark:text-slate-300">{s.label}</span>
            <span className="font-bold text-slate-900 dark:text-white ml-auto">{s.value}</span>
            <span className="text-slate-500 dark:text-slate-400 text-[10px] w-9 text-right">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const DashboardModal: React.FC<DashboardModalProps> = ({ isOpen, onClose, tasks, meetings, authMember }) => {
  const [kpi, setKpi] = useState<KpiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setKpi(await api<KpiResponse>('/kpi'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen]);

  if (!isOpen) return null;

  const isLeadership = authMember.role === 'Chủ nhiệm' || authMember.role === 'Phó Chủ nhiệm';

  // Thống kê trạng thái
  const counts = {
    in_progress: tasks.filter((t) => t.status === 'in_progress' && t.deadline >= todayISO()).length,
    pending_approval: tasks.filter((t) => t.status === 'pending_approval').length,
    overdue: tasks.filter((t) => t.status !== 'completed' && t.status !== 'pending_approval' && t.deadline < todayISO()).length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  };
  const slices = [
    { label: STATUS_COLORS.in_progress.label, value: counts.in_progress, color: STATUS_COLORS.in_progress.color },
    { label: STATUS_COLORS.pending_approval.label, value: counts.pending_approval, color: STATUS_COLORS.pending_approval.color },
    { label: STATUS_COLORS.overdue.label, value: counts.overdue, color: STATUS_COLORS.overdue.color },
    { label: STATUS_COLORS.completed.label, value: counts.completed, color: STATUS_COLORS.completed.color },
  ];
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((counts.completed / totalTasks) * 100) : 0;

  // Deadline 7 ngày tới (chưa hoàn thành)
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const upcoming = tasks
    .filter((t) => t.status !== 'completed' && t.deadline >= todayISO() && t.deadline <= in7)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  // Top 5 thành viên theo điểm
  const top5 = (kpi?.members || []).slice(0, 5);

  const statCards = [
    { label: 'Tổng công việc', value: totalTasks, sub: `${meetings.length} kỳ họp đã lưu`, color: 'text-[#2C69FF]' },
    { label: 'Hoàn thành', value: `${completionRate}%`, sub: `${counts.completed}/${totalTasks} việc`, color: 'text-emerald-500' },
    { label: 'Quá hạn', value: counts.overdue, sub: 'Cần đôn đốc ngay', color: 'text-red-500' },
    { label: 'Đang chờ duyệt', value: counts.pending_approval, sub: 'Minh chứng đợi nghiệm thu', color: 'text-amber-500' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-xs">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#2C69FF]/15 text-[#1E4FC4] dark:text-[#8FB2FF] border border-[#2C69FF]/30">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Dashboard phân tích</h2>
              <p className="text-slate-500 dark:text-slate-400">
                Toàn cảnh điều hành — {isLeadership ? 'phạm vi toàn CLB' : `phạm vi Ban ${authMember.department}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50 transition cursor-pointer" title="Làm mới">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50 dark:bg-transparent">

          {/* 4 stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {statCards.map((c) => (
              <div key={c.label} className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm">
                <div className="text-slate-500 dark:text-slate-400">{c.label}</div>
                <div className={`text-2xl font-bold mt-0.5 ${c.color}`}>{c.value}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Donut + deadline 7 ngày */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Phân bố trạng thái công việc
              </div>
              <DonutChart slices={slices} />
            </div>

            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Deadline 7 ngày tới ({upcoming.length} việc)
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {upcoming.length === 0 && (
                  <div className="py-6 text-center text-slate-400 dark:text-slate-500">Không có deadline nào trong 7 ngày tới.</div>
                )}
                {upcoming.map((t) => {
                  const days = Math.round((new Date(t.deadline).getTime() - new Date(todayISO()).getTime()) / 86400000);
                  const dateLabel = `${t.deadline.slice(8, 10)}/${t.deadline.slice(5, 7)}`;
                  const rel = days === 0 ? 'Hôm nay' : days === 1 ? 'Ngày mai' : `Còn ${days} ngày`;
                  return (
                    <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        days === 0 ? 'bg-orange-500/20 text-orange-600 dark:text-orange-300' : 'bg-[#2C69FF]/15 text-[#1E4FC4] dark:text-[#8FB2FF]'
                      }`}>
                        {dateLabel}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 truncate flex-1 font-medium" title={`${t.title} — ${rel} (${t.deadline})`}>{t.title}</span>
                      <span className="text-[10px] text-slate-400 shrink-0" title={`Hạn chót: ${t.deadline}`}>{rel}</span>
                      <span className="text-[10px] text-slate-500 shrink-0 font-medium">{t.assigneeName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bar theo ban + Top 5 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Tiến độ theo ban
              </div>
              <div className="space-y-3">
                {(kpi?.departments || []).map((d) => (
                  <div key={d.department}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">
                        {DEPT_EMOJI[d.department] || '🏢'} Ban {d.department}
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal ml-1.5">{d.memberCount} TV</span>
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {d.completed}/{d.total} · <span className="text-slate-800 dark:text-slate-300 font-bold">{d.points > 0 ? `+${d.points}` : d.points}đ</span>
                        {d.overdue > 0 && <span className="text-red-500 dark:text-red-400 font-bold ml-1">{d.overdue} trễ</span>}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${d.completionRate >= 75 ? 'bg-emerald-500' : d.completionRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${d.completionRate}%` }}
                      />
                    </div>
                  </div>
                ))}
                {(kpi?.departments || []).length === 0 && (
                  <div className="py-6 text-center text-slate-400 dark:text-slate-500">Chưa có dữ liệu.</div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Top 5 thành viên theo điểm đóng góp
              </div>
              <div className="space-y-1.5">
                {top5.map((m, i) => (
                  <div key={m.memberId} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <span className="w-6 text-center font-bold text-slate-400">
                      {['🥇', '🥈', '🥉'][i] || i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-800 dark:text-slate-200 font-semibold truncate">{m.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {DEPT_EMOJI[m.department] || ''} {m.department} · {m.completed}/{m.total} việc
                      </div>
                    </div>
                    <span className={`font-bold ${m.points > 0 ? 'text-emerald-600 dark:text-emerald-400' : m.points < 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-400'}`}>
                      {m.points > 0 ? `+${m.points}` : m.points}đ
                    </span>
                  </div>
                ))}
                {top5.length === 0 && <div className="py-6 text-center text-slate-400 dark:text-slate-500">Chưa có dữ liệu KPI.</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span>Số liệu tính trực tiếp từ dữ liệu điều hành hiện tại của {isLeadership ? 'toàn CLB' : `Ban ${authMember.department}`}.</span>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-semibold cursor-pointer transition">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
