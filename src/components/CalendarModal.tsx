import React, { useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight, CalendarDays, User } from 'lucide-react';
import { Meeting, Task } from '../types';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  meetings: Meeting[];
  onOpenDetail?: (task: Task) => void;
}

const DAY_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
  'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
  'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

const STATUS_STYLE: Record<string, { dot: string; label: string }> = {
  in_progress: { dot: 'bg-primary', label: 'Đang làm' },
  pending_approval: { dot: 'bg-amber-400', label: 'Chờ duyệt' },
  overdue: { dot: 'bg-red-500', label: 'Quá hạn' },
  completed: { dot: 'bg-emerald-500', label: 'Đã xong' },
};

const DEPARTMENT_STYLE: Record<string, string> = {
  'Học thuật': 'bg-info-bg text-info border-info-bar/30',
  'Truyền thông': 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  'Sự kiện': 'bg-success-bg text-success border-success-bar/30',
  'Đối ngoại': 'bg-primary-light text-primary border-primary/30',
  'Ban Chủ nhiệm': 'bg-warning-bg text-warning border-warning-bar/30',
};

const STATUS_BADGE: Record<string, { label: string; style: string }> = {
  in_progress: { label: 'Đang làm', style: 'bg-info-bg text-primary border-info-bar/30' },
  pending_approval: { label: 'Chờ duyệt', style: 'bg-warning-bg text-warning border-warning-bar/30' },
  overdue: { label: 'Quá hạn 🚨', style: 'bg-danger-bg text-danger border-danger-bar/30 font-bold' },
  completed: { label: 'Đã xong', style: 'bg-success-bg text-success border-success-bar/30' },
  draft: { label: 'Bản nháp', style: 'bg-[#F2F4F7] text-fg-2 border-border-strong' },
};

export const CalendarModal: React.FC<CalendarModalProps> = ({
  isOpen,
  onClose,
  tasks,
  meetings,
  onOpenDetail,
}) => {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Tạo danh sách năm có thể chọn (từ 2024 đến 2032)
  const yearsList = useMemo(() => {
    const list: number[] = [];
    for (let y = 2024; y <= 2032; y++) {
      list.push(y);
    }
    return list;
  }, []);

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

  // Lưới cố định 42 ô (6 hàng x 7 cột) - không bao giờ nhảy kích thước khi đổi tháng
  const grid = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const offset = (first.getDay() + 6) % 7; // Thứ 2 = 0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    // Cố định đủ 42 ô để lịch luôn có đúng 6 hàng, tránh hoàn toàn hiện tượng resize
    while (cells.length < 42) cells.push(null);
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

  const dayTasks = selectedDay ? tasksByDay.get(selectedDay) || [] : [];
  const dayMeetings = selectedDay ? meetingsByDay.get(selectedDay) || [] : [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-[#101828]/50 backdrop-blur-sm overflow-hidden">
      {/* Modal Container: Kích thước lớn, cố định chiều cao để không bị resize */}
      <div className="bg-surface border border-border rounded-2xl w-[98vw] sm:w-[96vw] max-w-7xl h-[94vh] sm:h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-xs">

        {/* 1. Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-b border-border flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-xl bg-primary-light text-primary border border-primary/30">
              <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-fg tracking-tight">Lịch tổng — Deadline & Họp</h2>
              <p className="text-muted text-[10px] sm:text-[11px]">Toàn bộ hạn chót và kỳ họp trong phạm vi của bạn</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Toolbar: Bộ chọn Tháng/Năm trực tiếp + Điều hướng nhanh + Chú thích */}
        <div className="px-3 sm:px-6 py-2 sm:py-2.5 border-b border-border flex flex-wrap items-center justify-between gap-2 sm:gap-3 bg-surface-2 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg bg-surface-2 hover:bg-[#F2F4F7] text-fg-2 transition cursor-pointer"
              title="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Dropdown chọn Tháng */}
            <select
              value={viewMonth}
              onChange={(e) => {
                setViewMonth(Number(e.target.value));
                setSelectedDay(null);
              }}
              className="bg-surface-2 hover:bg-[#F2F4F7] text-fg font-bold text-xs rounded-lg px-2 sm:px-2.5 py-1.5 border border-border focus:outline-none focus:border-primary cursor-pointer"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx} className="bg-surface text-fg">
                  {name}
                </option>
              ))}
            </select>

            {/* Dropdown chọn Năm */}
            <select
              value={viewYear}
              onChange={(e) => {
                setViewYear(Number(e.target.value));
                setSelectedDay(null);
              }}
              className="bg-surface-2 hover:bg-[#F2F4F7] text-fg font-bold text-xs rounded-lg px-2 sm:px-2.5 py-1.5 border border-border focus:outline-none focus:border-primary cursor-pointer"
            >
              {yearsList.map((y) => (
                <option key={y} value={y} className="bg-surface text-fg">
                  Năm {y}
                </option>
              ))}
            </select>

            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg bg-surface-2 hover:bg-[#F2F4F7] text-fg-2 transition cursor-pointer"
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Nút về hôm nay */}
            <button
              onClick={() => {
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
                setSelectedDay(todayStr);
              }}
              className="ml-0.5 sm:ml-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-primary-light text-primary text-xs font-bold hover:bg-primary-light transition cursor-pointer"
            >
              Hôm nay
            </button>
          </div>

          {/* Chú thích màu sắc */}
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted">
            {Object.entries(STATUS_STYLE).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${v.dot}`} /> {v.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-400" /> Họp
            </span>
          </div>
        </div>

        {/* 3. Body: Lưới lịch cố định (6 hàng x 7 cột) + Cột chi tiết ngày */}
        <div className="flex-1 overflow-y-auto lg:overflow-hidden p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 min-h-0">

          {/* Lưới lịch tháng */}
          <div className="flex flex-col h-full min-h-0 bg-surface-2 rounded-xl p-2 sm:p-3 border border-border">
            {/* Tiêu đề thứ trong tuần */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5 shrink-0">
              {DAY_HEADERS.map((d) => (
                <div key={d} className="text-center text-[10px] sm:text-[11px] font-bold text-muted py-0.5 sm:py-1 uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>

            {/* Lưới 42 ô (6 hàng x 7 cột cố định chiều cao) */}
            <div className="grid grid-cols-7 grid-rows-6 gap-1 sm:gap-1.5 flex-1 min-h-0">
              {grid.map((day, i) => {
                if (!day) {
                  return (
                    <div
                      key={`empty-${i}`}
                      className="rounded-lg bg-surface-2 border border-border opacity-30"
                    />
                  );
                }

                const dayNum = Number(day.slice(8));
                const isToday = day === todayStr;
                const cellTasks = tasksByDay.get(day) || [];
                const cellMeetings = meetingsByDay.get(day) || [];
                const openTasks = cellTasks.filter((t) => t.status !== 'completed');
                const isSelected = selectedDay === day;

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`p-1 sm:p-1.5 rounded-lg border flex flex-col justify-between transition cursor-pointer overflow-hidden ${
                      isSelected
                        ? 'border-primary bg-primary-light ring-1 ring-primary'
                        : isToday
                        ? 'border-warning-bar/30 bg-warning-bg hover:bg-surface-2'
                        : 'border-border bg-surface-2 hover:bg-surface-2'
                    }`}
                  >
                    {/* Hàng ngày & số lượng việc */}
                    <div className="flex items-center justify-between shrink-0 mb-0.5 sm:mb-1">
                      <span className={`text-[11px] sm:text-xs font-bold ${isToday ? 'text-warning' : isSelected ? 'text-fg' : 'text-fg-2'}`}>
                        {dayNum}
                      </span>
                      {openTasks.length > 0 && (
                        <span
                          className={`text-[8px] sm:text-[9px] px-1 py-0.2 rounded font-bold ${
                            cellTasks.some((t) => t.deadline < todayStr && t.status !== 'completed')
                              ? 'bg-danger-bg text-danger border border-danger-bar/30'
                              : 'bg-primary-light text-primary border border-primary/30'
                          }`}
                        >
                          {openTasks.length}
                        </span>
                      )}
                    </div>

                    {/* Danh sách mini: Trên desktop hiện chữ + nút bấm, trên mobile hiện chấm màu tránh vỡ ô */}
                    <div className="space-y-0.5 overflow-hidden flex-1 flex flex-col justify-start">
                      {/* Desktop View (sm:block) */}
                      <div className="hidden sm:block space-y-0.5">
                        {cellMeetings.length > 0 && (
                          <div className="text-[9px] text-primary bg-primary-light px-1 py-0.5 rounded border border-primary/30 truncate font-semibold">
                            🤝 {cellMeetings.length} họp
                          </div>
                        )}
                        {cellTasks.slice(0, 2).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDetail?.(t);
                            }}
                            className="w-full flex items-center gap-1 px-1 py-0.5 rounded bg-surface-2 hover:bg-primary-light hover:border-primary/30 border border-transparent transition text-left cursor-pointer group"
                            title={`Bấm để mở chi tiết: ${t.title}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_STYLE[t.status]?.dot || 'bg-slate-500'}`} />
                            <span
                              className={`text-[9px] truncate ${
                                t.status === 'completed'
                                  ? 'text-muted line-through'
                                  : 'text-fg group-hover:text-fg font-medium'
                              }`}
                            >
                              {t.title}
                            </span>
                          </button>
                        ))}
                        {cellTasks.length > 2 && (
                          <div className="text-[9px] text-muted font-medium px-0.5">
                            +{cellTasks.length - 2} việc khác
                          </div>
                        )}
                      </div>

                      {/* Mobile View (sm:hidden): Chấm tròn màu trực quan, chống tràn text */}
                      <div className="sm:hidden flex items-center justify-center gap-1 mt-0.5 flex-wrap">
                        {cellMeetings.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />}
                        {cellTasks.slice(0, 3).map((t) => (
                          <span key={t.id} className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_STYLE[t.status]?.dot || 'bg-slate-500'}`} />
                        ))}
                        {cellTasks.length > 3 && <span className="text-[8px] text-muted leading-none font-bold">+</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chi tiết ngày đang chọn (Bên phải): Hiển thị task đẹp như card ở bên ngoài */}
          <div className="bg-surface border border-border rounded-xl flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
            {/* Header cột chi tiết */}
            <div className="p-3.5 border-b border-border bg-surface-2 shrink-0">
              <div className="text-xs font-bold text-fg">
                {selectedDay
                  ? new Date(selectedDay).toLocaleDateString('vi-VN', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'Chọn một ngày trên lịch'}
              </div>
              <div className="text-[11px] text-muted mt-0.5">
                {selectedDay
                  ? `${dayTasks.length} công việc · ${dayMeetings.length} cuộc họp`
                  : 'Bấm vào một ô ngày để xem tất cả nhiệm vụ và kỳ họp'}
              </div>
            </div>

            {/* Danh sách nhiệm vụ & họp trong ngày */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {selectedDay && dayMeetings.length === 0 && dayTasks.length === 0 && (
                <div className="text-muted text-xs py-8 text-center flex flex-col items-center justify-center gap-2">
                  <span>📅</span>
                  <span>Không có deadline hay kỳ họp nào trong ngày này.</span>
                </div>
              )}

              {/* Các cuộc họp */}
              {dayMeetings.map((m) => (
                <div key={m.id} className="p-3 rounded-xl bg-primary-light border border-primary/30 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <span>🤝</span>
                    <span>{m.title}</span>
                  </div>
                  <div className="text-[11px] text-muted flex items-center justify-between pt-1">
                    <span>Chủ trì: {m.chairperson}</span>
                    {m.time && <span className="font-mono text-primary">{m.time}</span>}
                  </div>
                </div>
              ))}

              {/* Các nhiệm vụ - Định dạng như TaskCard ở bên ngoài, có thể bấm xem chi tiết */}
              {dayTasks.map((t) => {
                const isOverdue = t.deadline < todayStr && t.status !== 'completed';
                const stInfo = STATUS_BADGE[t.status] || { label: t.status, style: 'bg-surface-2 text-fg-2 border-border' };
                const deptStyle = DEPARTMENT_STYLE[t.department] || 'bg-surface-2 text-fg-2 border-border';

                return (
                  <div
                    key={t.id}
                    onClick={() => onOpenDetail?.(t)}
                    className={`p-3 rounded-xl border transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md hover:border-primary group ${
                      t.status === 'completed'
                        ? 'bg-surface-2 border-border opacity-80'
                        : isOverdue
                        ? 'bg-surface border-l-4 border-l-red-500 border-border'
                        : t.status === 'pending_approval'
                        ? 'bg-surface border-l-4 border-l-amber-500 border-border'
                        : 'bg-surface border-border hover:bg-surface-2'
                    }`}
                  >
                    {/* Dải badge: Ban & Trạng thái */}
                    <div className="flex items-center justify-between gap-1.5 mb-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${deptStyle}`}>
                        {t.department}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${stInfo.style}`}>
                        {stInfo.label}
                      </span>
                    </div>

                    {/* Tiêu đề nhiệm vụ */}
                    <div
                      className={`text-xs font-semibold leading-snug group-hover:text-info transition ${
                        t.status === 'completed' ? 'text-muted line-through' : 'text-fg'
                      }`}
                    >
                      {t.title}
                    </div>

                    {/* Người phụ trách & Liên kết xem chi tiết */}
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border text-[11px] text-muted">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="w-3.5 h-3.5 text-muted shrink-0" />
                        <span className="truncate">
                          {t.assigneeName}
                          {(t.assigneeIds?.length || 0) > 1 ? ` +${t.assigneeIds.length - 1}` : ''}
                        </span>
                      </div>
                      <span className="text-[11px] text-info font-semibold group-hover:underline shrink-0">
                        Chi tiết &rarr;
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. Footer */}
        <div className="px-6 py-3 border-t border-border bg-surface flex items-center justify-between text-muted shrink-0">
          <span className="text-xs">💡 Bấm vào ô ngày để xem danh sách hoặc bấm trực tiếp vào thẻ công việc để mở chi tiết.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface-2 hover:bg-[#F2F4F7] text-fg font-semibold cursor-pointer transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
