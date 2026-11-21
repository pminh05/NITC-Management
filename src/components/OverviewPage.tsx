import React, { useMemo } from 'react';
import {
  AlarmClock,
  Inbox,
  Timer,
  CircleCheck,
  Link2,
  FileText,
  BellRing,
  CheckCheck,
  Plus,
  Sparkles,
  LucideIcon,
} from 'lucide-react';
import { Member, Task } from '../types';
import { Actor, canRemindTask, canReviewTask, isDeptManager, isLeadership } from '../../shared/permissions';
import { effectiveStatus } from '../../shared/taskState';
import { diffDays, todayVN, ymdVN } from '../../shared/time';
import { initialsOf } from './Header';
import { DEPARTMENTS } from './Sidebar';

interface OverviewPageProps {
  tasks: Task[];
  authMember: Member;
  actor: Actor;
  loading: boolean;
  onReview: (task: Task) => void;
  onRemind: (task: Task) => void;
  onOpenDetail: (task: Task) => void;
  /** Sang Bảng việc với bộ lọc ban / trạng thái */
  onGoBoard: (dept: string, status: string) => void;
  onOpenQuickAdd?: () => void;
  onOpenParser?: () => void;
}

// Màu avatar theo tên (chỉ để phân biệt người, không mang nghĩa trạng thái)
const AVATAR_TONES = [
  'bg-[#E0EAFF] text-[#3538CD]',
  'bg-[#FCE7F6] text-[#C11574]',
  'bg-[#D1FADF] text-[#027A48]',
  'bg-[#FEF0C7] text-[#B54708]',
  'bg-[#F4EBFF] text-[#6941C6]',
  'bg-[#CFF9FE] text-[#0E7090]',
];
function toneOf(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

/** Ngày nộp minh chứng (ngày VN); thiếu thì lấy ngày cập nhật */
function submittedDay(t: Task): string {
  return ymdVN(t.evidenceSubmittedAt || t.updatedAt);
}

function evidenceLabel(t: Task): { icon: LucideIcon; text: string } | null {
  const link = t.evidenceLink || '';
  const hasReport = Boolean(t.evidenceReport && t.evidenceReport.trim());
  if (link) {
    const kind = link.includes('docs.google') ? 'Link Docs' : link.includes('drive.google') ? 'Link Drive' : 'Link';
    return { icon: Link2, text: hasReport ? `${kind} + báo cáo` : kind };
  }
  if (hasReport) return { icon: FileText, text: 'Báo cáo' };
  return null;
}

function greetingNow(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  );
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 13) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function dateLabelNow(): string {
  const s = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const Card: React.FC<{ className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <section className={`min-w-0 rounded-2xl border border-border bg-surface ${className}`} {...rest}>
    {children}
  </section>
);

const CardHead: React.FC<{ id: string; title: string; count?: number; sub?: string; action?: React.ReactNode }> = ({
  id,
  title,
  count,
  sub,
  action,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
    <div className="min-w-0">
      <h2 id={id} className="flex items-center gap-2 font-display text-[16px] font-bold text-fg">
        {title}
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[12px] font-medium tabular-nums text-warning">{count}</span>
        )}
      </h2>
      {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
    </div>
    {action}
  </div>
);

const LinkButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="text-[14px] font-medium text-primary hover:underline cursor-pointer">
    {children}
  </button>
);

const Kpi: React.FC<{
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone: 'danger' | 'warning' | 'info' | 'success';
  alert?: boolean;
  footer: React.ReactNode;
}> = ({ label, value, icon: Icon, tone, alert, footer }) => {
  const iconTone = {
    danger: 'bg-danger-bg text-danger',
    warning: 'bg-warning-bg text-warning',
    info: 'bg-info-bg text-info',
    success: 'bg-success-bg text-success',
  }[tone];
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-medium text-muted">{label}</p>
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${iconTone}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className={`mt-1 font-display text-[28px] font-bold leading-none tabular-nums ${alert ? 'text-danger' : 'text-fg'}`}>
        {value}
      </p>
      <div className="mt-2 text-[12px] text-muted">{footer}</div>
    </div>
  );
};

export const OverviewPage: React.FC<OverviewPageProps> = ({
  tasks,
  authMember,
  actor,
  loading,
  onReview,
  onRemind,
  onOpenDetail,
  onGoBoard,
  onOpenQuickAdd,
  onOpenParser,
}) => {
  const today = todayVN();
  const canReviewAny = isLeadership(actor) || isDeptManager(actor);

  const d = useMemo(() => {
    const eff = tasks.map((t) => ({ t, s: effectiveStatus(t, today) }));
    const overdue = eff
      .filter((x) => x.s === 'overdue')
      .map((x) => x.t)
      .sort((a, b) => a.deadline.localeCompare(b.deadline));
    const inProgress = eff.filter((x) => x.s === 'in_progress').map((x) => x.t);
    const pending = tasks.filter((t) => t.status === 'pending_approval');
    const queue = pending
      .filter((t) => canReviewTask(actor, t))
      .sort((a, b) => submittedDay(a).localeCompare(submittedDay(b)));
    const upcoming = inProgress
      .filter((t) => {
        const n = diffDays(today, t.deadline.slice(0, 10));
        return n >= 0 && n <= 7;
      })
      .sort((a, b) => a.deadline.localeCompare(b.deadline));
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const dueToday = inProgress.filter((t) => t.deadline.slice(0, 10) === today).length;
    const depts = DEPARTMENTS.map(({ name }) => {
      const list = eff.filter((x) => x.t.department === name);
      const count = (s: string) => list.filter((x) => x.s === s).length;
      return {
        name,
        total: list.length,
        completed: count('completed'),
        pending: count('pending_approval'),
        inProgress: count('in_progress'),
        overdue: count('overdue'),
      };
    }).filter((x) => x.total > 0);
    return { overdue, inProgress, pending, queue, upcoming, completed, dueToday, depts };
  }, [tasks, today, actor.id, actor.role, actor.department]);

  const total = tasks.length;
  const rate = total > 0 ? Math.round((d.completed / total) * 100) : 0;
  const firstName = authMember.name.trim().split(/\s+/).pop() || authMember.name;
  const scope = isLeadership(actor)
    ? 'Toàn CLB'
    : isDeptManager(actor)
      ? `Ban ${authMember.department}`
      : 'Việc được giao cho bạn';
  const longestOverdue = d.overdue[0] ? diffDays(d.overdue[0].deadline.slice(0, 10), today) : 0;
  const longestWait = d.queue[0] ? Math.max(0, diffDays(submittedDay(d.queue[0]), today)) : 0;

  const header = (
    <section className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[24px] font-bold leading-tight tracking-[-0.4px] text-fg sm:text-[28px]">
          {greetingNow()}, {firstName}
        </h1>
        <p className="mt-1 text-[14px] text-muted">
          {dateLabelNow()} · {scope}
          {total > 0 && ` · ${total} việc`}
        </p>
      </div>
    </section>
  );

  // ===== Đang tải lần đầu =====
  if (loading && total === 0) {
    return (
      <div aria-busy="true" aria-label="Đang tải">
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface p-4">
              <div className="skeleton size-8" />
              <div className="skeleton mt-3 h-3 w-20" />
              <div className="skeleton mt-2 h-7 w-12" />
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <div className="skeleton h-4 w-32" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border px-5 py-3.5 last:border-0">
              <div className="skeleton size-9 rounded-full" />
              <div className="flex-1">
                <div className="skeleton h-3.5 w-2/3" />
                <div className="skeleton mt-2 h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ===== Chưa có việc nào =====
  if (total === 0) {
    return (
      <div>
        {header}
        <div className="flex flex-col items-center rounded-2xl border border-border bg-surface px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-success-bg text-success">
            <CheckCheck className="size-6" />
          </span>
          <h2 className="mt-4 font-display text-[18px] font-bold text-fg">Chưa có việc nào</h2>
          <p className="mt-1 max-w-[380px] text-[14px] text-muted">
            Thêm việc mới hoặc nhập biên bản họp để AI tạo danh sách việc.
          </p>
          {(onOpenQuickAdd || onOpenParser) && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {onOpenParser && (
                <button
                  type="button"
                  onClick={onOpenParser}
                  className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-border-strong bg-surface px-3.5 text-[14px] font-medium text-fg-2 hover:bg-surface-2 cursor-pointer"
                >
                  <Sparkles className="size-4" />
                  Nhập biên bản AI
                </button>
              )}
              {onOpenQuickAdd && (
                <button
                  type="button"
                  onClick={onOpenQuickAdd}
                  className="btn-primary inline-flex h-10 items-center gap-2 rounded-[10px] px-3.5 text-[14px] font-medium cursor-pointer"
                >
                  <Plus className="size-4" />
                  Thêm việc
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}

      {/* Bốn số chính */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Số liệu chính">
        <Kpi
          label="Quá hạn"
          value={d.overdue.length}
          icon={AlarmClock}
          tone="danger"
          alert={d.overdue.length > 0}
          footer={d.overdue.length > 0 ? `Lâu nhất ${longestOverdue} ngày` : 'Không có việc trễ'}
        />
        <Kpi
          label="Chờ duyệt"
          value={d.pending.length}
          icon={Inbox}
          tone="warning"
          footer={d.queue.length > 0 ? `Chờ lâu nhất ${longestWait} ngày` : canReviewAny ? 'Không có minh chứng chờ' : 'Minh chứng bạn đã nộp'}
        />
        <Kpi
          label="Đang làm"
          value={d.inProgress.length}
          icon={Timer}
          tone="info"
          footer={d.dueToday > 0 ? `${d.dueToday} việc đến hạn hôm nay` : 'Không có việc đến hạn hôm nay'}
        />
        <Kpi
          label="Hoàn thành"
          value={`${rate}%`}
          icon={CircleCheck}
          tone="success"
          footer={
            <div className="mt-0.5 flex items-center gap-2">
              <span className="h-1.5 flex-1 rounded-full bg-[#EAECF0]">
                <span className="block h-full rounded-full bg-success-bar" style={{ width: `${rate}%` }} />
              </span>
              <span className="tabular-nums">
                {d.completed}/{total}
              </span>
            </div>
          }
        />
      </section>

      <div className={`mt-6 grid grid-cols-1 gap-6 ${canReviewAny ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : 'xl:grid-cols-2'}`}>
        {/* Hàng đợi duyệt — chỉ người có quyền duyệt */}
        {canReviewAny && (
          <Card aria-labelledby="ov-duyet">
            <CardHead
              id="ov-duyet"
              title="Chờ duyệt"
              count={d.queue.length}
              sub={d.queue.length > 0 ? 'Xếp theo thời gian chờ, lâu nhất lên đầu' : undefined}
              action={d.queue.length > 0 ? <LinkButton onClick={() => onGoBoard('all', 'pending_approval')}>Xem tất cả</LinkButton> : undefined}
            />
            {d.queue.length === 0 ? (
              <p className="px-5 py-10 text-center text-[14px] text-muted">Không có minh chứng nào chờ bạn duyệt.</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.queue.slice(0, 6).map((t) => {
                  const wait = Math.max(0, diffDays(submittedDay(t), today));
                  const ev = evidenceLabel(t);
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2">
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${toneOf(t.assigneeName)}`}
                        aria-hidden="true"
                      >
                        {initialsOf(t.assigneeName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onOpenDetail(t)}
                          className="block max-w-full truncate text-left text-[14px] font-medium text-fg hover:text-primary cursor-pointer"
                          title={t.title}
                        >
                          {t.title}
                        </button>
                        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
                          <span className="truncate">
                            {t.assigneeName} · {t.department}
                          </span>
                          {ev && (
                            <span className="hidden shrink-0 items-center gap-1 md:inline-flex">
                              · <ev.icon className="size-3.5" />
                              {ev.text}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="hidden shrink-0 rounded-full bg-warning-bg px-2 py-0.5 text-[12px] font-medium text-warning sm:inline">
                        {wait === 0 ? 'Nộp hôm nay' : `Chờ ${wait} ngày`}
                      </span>
                      <button
                        type="button"
                        onClick={() => onReview(t)}
                        className="inline-flex h-8 shrink-0 items-center rounded-lg border border-border-strong bg-surface px-3 text-[13px] font-medium text-fg-2 transition hover:bg-surface-2 cursor-pointer"
                      >
                        Kiểm tra
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}

        <div className={`flex min-w-0 flex-col gap-6 ${canReviewAny ? '' : 'xl:col-span-2 xl:grid xl:grid-cols-2'}`}>
          {/* Đến hạn 7 ngày tới */}
          <Card aria-labelledby="ov-han">
            <CardHead id="ov-han" title="Đến hạn 7 ngày tới" />
            {d.upcoming.length === 0 ? (
              <p className="px-5 py-8 text-center text-[14px] text-muted">Không có việc nào đến hạn trong 7 ngày tới.</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.upcoming.slice(0, 5).map((t) => {
                  const left = diffDays(today, t.deadline.slice(0, 10));
                  const [, mm, dd] = t.deadline.slice(0, 10).split('-');
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => onOpenDetail(t)}
                        className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-2 cursor-pointer"
                      >
                        <span
                          className={`flex w-11 shrink-0 flex-col items-center rounded-lg py-1 ${
                            left === 0 ? 'bg-warning-bg text-warning' : 'bg-surface-2 text-fg-2'
                          }`}
                        >
                          <span className="text-[11px] font-medium leading-none">T{Number(mm)}</span>
                          <span className="font-display text-[16px] font-bold leading-tight">{dd}</span>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium text-fg">{t.title}</span>
                          <span className="block truncate text-[12px] text-muted">
                            {left === 0 ? 'Hôm nay' : `Còn ${left} ngày`} · {t.assigneeName}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Quá hạn lâu nhất */}
          <Card aria-labelledby="ov-tre">
            <CardHead
              id="ov-tre"
              title="Quá hạn lâu nhất"
              action={d.overdue.length > 0 ? <LinkButton onClick={() => onGoBoard('all', 'overdue')}>Xem {d.overdue.length} việc</LinkButton> : undefined}
            />
            {d.overdue.length === 0 ? (
              <p className="px-5 py-8 text-center text-[14px] text-muted">Không có việc quá hạn.</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.overdue.slice(0, 4).map((t) => {
                  const late = diffDays(t.deadline.slice(0, 10), today);
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                      <button type="button" onClick={() => onOpenDetail(t)} className="min-w-0 flex-1 text-left cursor-pointer">
                        <span className="block truncate text-[14px] font-medium text-fg hover:text-primary" title={t.title}>
                          {t.title}
                        </span>
                        <span className="block truncate text-[12px] text-muted">
                          <span className="font-medium text-danger">{late} ngày</span> · {t.assigneeName}
                        </span>
                      </button>
                      {canRemindTask(actor, t) && (
                        <button
                          type="button"
                          onClick={() => onRemind(t)}
                          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-fg-2 transition hover:bg-surface-2 cursor-pointer"
                        >
                          <BellRing className="size-4" />
                          Nhắc
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* Tiến độ theo ban */}
        {d.depts.length > 0 && (
          <Card className="xl:col-span-2" aria-labelledby="ov-ban">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <h2 id="ov-ban" className="font-display text-[16px] font-bold text-fg">
                Tiến độ theo ban
              </h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <i className="size-2 rounded-full bg-success-bar" />
                  Đã xong
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="size-2 rounded-full bg-warning-bar" />
                  Chờ duyệt
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="size-2 rounded-full bg-info-bar" />
                  Đang làm
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="size-2 rounded-full bg-danger-bar" />
                  Quá hạn
                </span>
              </div>
            </div>
            <ul className="grid grid-cols-1 gap-x-10 gap-y-1 px-3 py-3 md:grid-cols-2">
              {d.depts.map((x) => (
                <li key={x.name}>
                  <button
                    type="button"
                    onClick={() => onGoBoard(x.name, 'all')}
                    className="block w-full rounded-xl px-2 py-2.5 text-left hover:bg-surface-2 cursor-pointer"
                    aria-label={`${x.name}: ${x.completed}/${x.total} xong, ${x.overdue} quá hạn`}
                  >
                    <span className="flex items-baseline justify-between gap-2 text-[14px]">
                      <span className="truncate font-medium text-fg">{x.name}</span>
                      <span className="shrink-0 tabular-nums text-muted">
                        {x.completed}/{x.total} xong
                        {x.overdue > 0 && <span className="text-danger"> · {x.overdue} quá hạn</span>}
                      </span>
                    </span>
                    <span className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full bg-[#EAECF0]" aria-hidden="true">
                      {x.completed > 0 && <i className="bg-success-bar" style={{ flex: x.completed }} />}
                      {x.pending > 0 && <i className="bg-warning-bar" style={{ flex: x.pending }} />}
                      {x.inProgress > 0 && <i className="bg-info-bar" style={{ flex: x.inProgress }} />}
                      {x.overdue > 0 && <i className="bg-danger-bar" style={{ flex: x.overdue }} />}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
};
