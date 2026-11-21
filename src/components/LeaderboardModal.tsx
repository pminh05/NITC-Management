import React, { useEffect, useState } from 'react';
import { X, Trophy, Users, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { Member } from '../types';

interface MemberKpiRow {
  memberId: string;
  name: string;
  role: string;
  department: string;
  total: number;
  completed: number;
  onTime: number;
  late: number;
  pending: number;
  overdue: number;
  inProgress: number;
  points: number;
  completionRate: number;
}

interface DeptKpiRow {
  department: string;
  total: number;
  completed: number;
  overdue: number;
  points: number;
  completionRate: number;
  memberCount: number;
}

interface KpiData {
  rules: Record<string, number>;
  members: MemberKpiRow[];
  departments: DeptKpiRow[];
}

const DEPT_EMOJI: Record<string, string> = {
  'Học thuật': '💻',
  'Truyền thông': '📢',
  'Sự kiện': '📅',
  'Đối ngoại': '🤝',
  'Ban Chủ nhiệm': '👑',
};

const MEDALS = ['🥇', '🥈', '🥉'];

export const LeaderboardModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  authMember: Member;
}> = ({ isOpen, onClose, authMember }) => {
  const [data, setData] = useState<KpiData | null>(null);
  const [tab, setTab] = useState<'members' | 'departments'>('members');
  const [loading, setLoading] = useState(false);
  const [deptFilter, setDeptFilter] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    try {
      const d = await api<KpiData>('/kpi');
      setData(d);
    } catch {
      // im lặng — retry khi mở lại
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen]);

  if (!isOpen) return null;

  const pointsColor = (p: number) =>
    p > 0 ? 'text-success' : p < 0 ? 'text-danger' : 'text-muted';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#101828]/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-xs">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-warning-bg text-warning border border-warning-bar/30">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-fg tracking-tight">Bảng xếp hạng & Điểm đóng góp</h2>
              <p className="text-muted">
                Điểm tự tính từ công việc: đúng hạn +{data?.rules.completedOnTime ?? 3} · trễ hạn
                +{data?.rules.completedLate ?? 1} · chờ duyệt +{data?.rules.submittedPending ?? 1} · quá hạn
                {data?.rules.overdueUnfinished ?? -2}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTab('members')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tab === 'members' ? 'bg-primary text-white' : 'bg-surface-2 text-fg-2 hover:bg-[#F2F4F7]'
              }`}
            >
              🧑‍💻 Cá nhân
            </button>
            <button
              onClick={() => setTab('departments')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tab === 'departments' ? 'bg-primary text-white' : 'bg-surface-2 text-fg-2 hover:bg-[#F2F4F7]'
              }`}
            >
              🏢 Theo ban
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-surface-2 border border-border text-fg-2 text-xs font-semibold focus:outline-none focus:border-primary cursor-pointer"
              title="Lọc bảng xếp hạng theo ban"
            >
              <option value="all">🌐 Tất cả ban</option>
              {Object.keys(DEPT_EMOJI).map((d) => (
                <option key={d} value={d}>
                  {DEPT_EMOJI[d]} Ban {d}
                </option>
              ))}
            </select>
            <button
              onClick={load}
              disabled={loading}
              className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-[#F2F4F7] text-fg-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading && !data && (
            <div className="py-12 text-center text-muted">Đang tính điểm...</div>
          )}

          {tab === 'members' && data && (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface border-b border-border text-muted font-bold">
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">Thành viên</th>
                    <th className="p-3">Ban</th>
                    <th className="p-3 text-center">Việc</th>
                    <th className="p-3 text-center">Hoàn thành</th>
                    <th className="p-3 text-center">Đúng hạn</th>
                    <th className="p-3 text-center">Trễ</th>
                    <th className="p-3 text-center">Quá hạn</th>
                    <th className="p-3 text-center">Điểm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.members.filter((m) => deptFilter === 'all' || m.department === deptFilter).map((m, i) => {
                    const isMe = m.memberId === authMember.id;
                    return (
                      <tr key={m.memberId} className={`transition ${isMe ? 'bg-primary-light' : 'hover:bg-surface-2'}`}>
                        <td className="p-3 text-center font-bold text-fg-2">
                          {MEDALS[i] || i + 1}
                        </td>
                        <td className="p-3 font-semibold text-fg">
                          {m.name}
                          {isMe && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary-light text-primary font-bold">
                              tôi
                            </span>
                          )}
                          <span className="block text-[10px] text-muted font-normal">{m.role}</span>
                        </td>
                        <td className="p-3 text-fg-2 whitespace-nowrap">
                          {DEPT_EMOJI[m.department] || ''} {m.department}
                        </td>
                        <td className="p-3 text-center text-fg-2">{m.total}</td>
                        <td className="p-3 text-center">
                          <span className="text-success font-bold">{m.completed}</span>
                          <span className="text-muted">/{m.total}</span>
                          <div className="h-1 w-14 bg-surface-2 rounded-full mx-auto mt-1 overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${m.completionRate}%` }} />
                          </div>
                        </td>
                        <td className="p-3 text-center text-info">{m.onTime}</td>
                        <td className="p-3 text-center text-warning">{m.late}</td>
                        <td className="p-3 text-center">
                          <span className={m.overdue > 0 ? 'text-danger font-bold' : 'text-muted'}>{m.overdue}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-sm font-bold ${pointsColor(m.points)}`}>{m.points > 0 ? `+${m.points}` : m.points}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {data.members.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted">
                        Chưa có dữ liệu công việc nào để tính điểm.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'departments' && data && (
            <div className="space-y-3">
              {data.departments.filter((d) => deptFilter === 'all' || d.department === deptFilter).map((d, i) => {
                const rate = d.completionRate;
                const barColor = rate >= 75 ? 'bg-emerald-500' : rate >= 40 ? 'bg-amber-500' : 'bg-red-500';
                return (
                  <div key={d.department} className="bg-surface-2 border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{DEPT_EMOJI[d.department] || '🏢'}</span>
                        <div>
                          <span className="text-sm font-bold text-fg">Ban {d.department}</span>
                          <span className="text-[11px] text-muted ml-2">{d.memberCount} thành viên</span>
                        </div>
                        {MEDALS[i] && <span className="text-base">{MEDALS[i]}</span>}
                      </div>
                      <div className="text-right">
                        <span className={`text-base font-bold ${pointsColor(d.points)}`}>{d.points > 0 ? `+${d.points}` : d.points}</span>
                        <span className="text-[10px] text-muted ml-1">điểm</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-surface rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${rate}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted">
                      <span>
                        {d.completed}/{d.total} việc hoàn thành (<strong className="text-fg-2">{rate}%</strong>)
                      </span>
                      <span className={d.overdue > 0 ? 'text-danger font-semibold' : ''}>
                        {d.overdue > 0 ? `⚠ ${d.overdue} việc quá hạn` : '✓ Không có việc quá hạn'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-surface flex items-center justify-between text-muted">
          <span className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            {tab === 'members'
              ? `${(data?.members || []).filter((m) => deptFilter === 'all' || m.department === deptFilter).length} thành viên${deptFilter !== 'all' ? ` — Ban ${deptFilter}` : ' trong phạm vi của bạn'}`
              : `${(data?.departments || []).filter((d) => deptFilter === 'all' || d.department === deptFilter).length} ban`}
          </span>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-surface-2 hover:bg-[#F2F4F7] text-fg font-semibold cursor-pointer">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
