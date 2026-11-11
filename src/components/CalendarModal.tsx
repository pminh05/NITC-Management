import React, { useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight, CalendarDays, Download } from 'lucide-react';
import { Meeting, Task } from '../types';
import { getToken } from '../api/client';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  meetings: Meeting[];
}

const DAY_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const STATUS_STYLE: Record<string, { dot: string; label: string }> = {
  in_progress: { dot: 'bg-[#2C69FF]', label: 'Đang làm' },
  pending_approval: { dot: 'bg-amber-400', label: 'Chờ duyệt' },
  overdue: { dot: 'bg-red-500', label: 'Quá hạn' },
  completed: { dot: 'bg-emerald-500', label: 'Đã xong' },
};

export const CalendarModal: React.FC<CalendarModalProps> = ({ isOpen, onClose, tasks, meetings }) => {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Map ngày YYYY-MM-DD -> danh sách việc + họp
  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t.deadline)) continue;
      const arr = map.get(t.deadline) || [];
      arr.push(t);
      map.set(t.deadline, arr);
    }
    return map;
  }, [tasks]);

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of meetings) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date)) continue;
      const arr = map.get(m.date) || [];
      arr.push(m);
      map.set(m.date, arr);
    }
    return map;
  }, [meetings]);

  // Lưới ngày trong tháng hiển thị (bắt đầu từ Thứ 2)
  const grid = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const offset = (first.getDay() + 6) % 7; // Thứ 2 = 0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDay(null);
  };
  const nextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDay(null);
  };

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('vi-VN', {
    month: 'long',
    year: 'numeric',
  });

  const dayTasks = selectedDay ? tasksByDay.get(selectedDay) || [] : [];
  const dayMeetings = selectedDay ? meetingsByDay.get(selectedDay) || [] : [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-xs">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Lịch tổng — Deadline & Họp</h2>
              <p className="text-slate-400">Toàn bộ hạn chót và kỳ họp trong phạm vi của bạn</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: điều hướng tháng */}
        <div className="px-6 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button onClick={prevMonth} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-white capitalize min-w-[140px] text-center">{monthLabel}</span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
                setSelectedDay(todayStr);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-[#2C69FF]/15 text-[#8FB2FF] text-xs font-bold hover:bg-[#2C69FF]/30 transition cursor-pointer"
            >
              Hôm nay
            </button>
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/calendar.ics', {
                    headers: { Authorization: `Bearer ${getToken() || ''}` },
                  });
                  if (!res.ok) throw new Error();
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'nitc-lich-dieu-hanh.ics';
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  alert('Không tải được lịch. Kiểm tra kết nối máy chủ.');
                }
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Tải file .ics để đưa lịch vào Google/Apple Calendar"
            >
              <Download className="w-3.5 h-3.5" />
              Xuất .ics
            </button>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            {Object.entries(STATUS_STYLE).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${v.dot}`} /> {v.label}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-violet-400" /> Họp
            </span>
          </div>
        </div>

        {/* Body: lưới + chi tiết ngày */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          {/* Lưới tháng */}
          <div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_HEADERS.map((d) => (
                <div key={d} className="text-center text-[11px] font-bold text-slate-500 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((day, i) => {
                if (!day) return <div key={`e${i}`} className="min-h-[72px] rounded-lg bg-slate-950/40" />;
                const dayNum = Number(day.slice(8));
                const isToday = day === todayStr;
                const dayTasks = tasksByDay.get(day) || [];
                const dayMeetings = meetingsByDay.get(day) || [];
                const openTasks = dayTasks.filter((t) => t.status !== 'completed');
                const isSelected = selectedDay === day;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`min-h-[72px] p-1.5 rounded-lg border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-[#2C69FF] bg-[#2C69FF]/10'
                        : isToday
                        ? 'border-amber-500/60 bg-amber-500/5 hover:bg-slate-800/60'
                        : 'border-slate-800 bg-slate-950/40 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isToday ? 'text-amber-400' : 'text-slate-300'}`}>
                        {dayNum}
                      </span>
                      {openTasks.length > 0 && (
                        <span className={`text-[9px] px-1 rounded font-bold ${
                          dayTasks.some((t) => t.deadline < todayStr && t.status !== 'completed')
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-[#2C69FF]/20 text-[#8FB2FF]'
                        }`}>
                          {openTasks.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {dayMeetings.length > 0 && (
                        <div className="text-[9px] text-violet-300 truncate">🤝 {dayMeetings.length} họp</div>
                      )}
                      {dayTasks.slice(0, 2).map((t) => (
                        <div key={t.id} className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_STYLE[t.status]?.dot || 'bg-slate-500'}`} />
                          <span className={`text-[9px] truncate ${t.status === 'completed' ? 'text-slate-600 line-through' : 'text-slate-300'}`}>
                            {t.title}
                          </span>
                        </div>
                      ))}
                      {dayTasks.length > 2 && (
                        <div className="text-[9px] text-slate-500">+{dayTasks.length - 2} việc khác</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chi tiết ngày đang chọn */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3 self-start">
            <div className="text-sm font-bold text-white">
              {selectedDay
                ? new Date(selectedDay).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                : 'Chọn một ngày'}
            </div>

            {selectedDay && dayMeetings.length === 0 && dayTasks.length === 0 && (
              <div className="text-slate-500 text-[11px] py-4 text-center">
                Không có deadline hay kỳ họp nào trong ngày này.
              </div>
            )}

            {dayMeetings.map((m) => (
              <div key={m.id} className="p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/30">
                <div className="text-xs font-bold text-violet-300">🤝 {m.title}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {m.time ? `${m.time} — ` : ''}Chủ trì: {m.chairperson}
                </div>
              </div>
            ))}

            {dayTasks.map((t) => (
              <div
                key={t.id}
                className={`p-2.5 rounded-lg border ${
                  t.status === 'completed'
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : t.deadline < todayStr
                    ? 'bg-red-500/5 border-red-500/30'
                    : 'bg-slate-900 border border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${STATUS_STYLE[t.status]?.dot || 'bg-slate-500'}`} />
                  <span className={`text-xs font-semibold ${t.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}>
                    {t.title}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {t.assigneeName}
                  {(t.assigneeIds?.length || 0) > 1 ? ` +${t.assigneeIds.length - 1}` : ''} · Ban {t.department} · {STATUS_STYLE[t.status]?.label}
                </div>
                {t.status === 'in_progress' || t.status === 'overdue' ? (
                  <div className="text-[10px] text-[#8FB2FF] mt-1 font-semibold">→ Cần nộp minh chứng</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-slate-400">
          <span>Mẹo: bấm "Xuất .ics" ở thanh trên để đưa lịch vào Google/Apple Calendar.</span>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold cursor-pointer">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
