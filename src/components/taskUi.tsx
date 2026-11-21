import React from 'react';
import { Clock } from 'lucide-react';
import { Department, TaskStatus } from '../types';
import { getDaysRemaining, formatDateVN } from '../utils/dateUtils';
import { DEPARTMENTS } from './Sidebar';
import { initialsOf } from './Header';

/**
 * Mảnh giao diện dùng chung cho thẻ việc ở Lưới, Kanban và Bảng — một nguồn để ba chế độ xem
 * cùng một kiểu nhãn, cùng một kiểu nút (giao diện sáng, token ở src/index.css).
 */

export const STATUS_META: Record<string, { label: string; chip: string; dot: string }> = {
  draft: { label: 'Bản nháp', chip: 'bg-surface-2 text-fg-2', dot: 'bg-muted' },
  in_progress: { label: 'Đang làm', chip: 'bg-info-bg text-info', dot: 'bg-info-bar' },
  pending_approval: { label: 'Chờ duyệt', chip: 'bg-warning-bg text-warning', dot: 'bg-warning-bar' },
  overdue: { label: 'Quá hạn', chip: 'bg-danger-bg text-danger', dot: 'bg-danger-bar' },
  completed: { label: 'Đã xong', chip: 'bg-success-bg text-success', dot: 'bg-success-bar' },
};

export const StatusChip: React.FC<{ status: TaskStatus | string }> = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.draft;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium ${m.chip}`}>
      <i className={`size-1.5 rounded-full ${m.dot}`} aria-hidden="true" />
      {m.label}
    </span>
  );
};

/** Nhãn ban: trung tính, có icon — màu dành cho trạng thái, không dành cho ban */
export const DeptLabel: React.FC<{ department: Department | string }> = ({ department }) => {
  const Icon = DEPARTMENTS.find((d) => d.name === department)?.icon;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-muted">
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
      <span className="truncate">{department}</span>
    </span>
  );
};

/** Hạn chót + còn bao lâu; chỉ đỏ khi đã trễ, hổ phách khi hôm nay / ngày mai */
export const DueText: React.FC<{ deadline: string; status: string; showDate?: boolean }> = ({
  deadline,
  status,
  showDate = true,
}) => {
  const info = getDaysRemaining(deadline);
  const done = status === 'completed' || status === 'pending_approval';
  const tone = done
    ? 'text-muted'
    : info.isOverdue
      ? 'text-danger font-medium'
      : info.days <= 1
        ? 'text-warning font-medium'
        : 'text-muted';
  const rel = info.isOverdue
    ? `Trễ ${Math.abs(info.days)} ngày`
    : info.isToday
      ? 'Hôm nay'
      : info.days === 1
        ? 'Ngày mai'
        : `Còn ${info.days} ngày`;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] text-muted">
      <Clock className="size-3.5 shrink-0" aria-hidden="true" />
      {showDate && <span className="tabular-nums">{formatDateVN(deadline)}</span>}
      {!done && (
        <>
          {showDate && <span aria-hidden="true">·</span>}
          <span className={tone}>{rel}</span>
        </>
      )}
    </span>
  );
};

/** Người phụ trách: avatar chữ cái + tên đầu + "+N" */
export const AssigneeLine: React.FC<{ names: string[] }> = ({ names }) => {
  if (names.length === 0) return <span className="text-[12px] text-muted">Chưa giao</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#E0EAFF] text-[10px] font-semibold text-[#3538CD]" aria-hidden="true">
        {initialsOf(names[0])}
      </span>
      <span className="min-w-0 truncate text-[13px] text-fg-2" title={names[0]}>
        {names[0]}
      </span>
      {names.length > 1 && (
        <span
          className="shrink-0 cursor-help rounded-full bg-surface-2 px-1.5 text-[11px] font-medium text-fg-2 ring-1 ring-border"
          title={`Còn lại ${names.length - 1} người phụ trách:\n• ${names.slice(1).join('\n• ')}`}
        >
          +{names.length - 1}
        </span>
      )}
    </span>
  );
};

// Nút nhỏ trên thẻ: một nút chính (Nộp), một nút nhẹ (Kiểm tra), nút viền (Nhắc nộp), nút icon (duyệt nhanh, xoá)
export const btnSm = 'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition cursor-pointer';
export const btnPrimarySm = `${btnSm} btn-primary`;
export const btnSoftSm = `${btnSm} bg-primary-light text-primary hover:bg-primary/15`;
export const btnOutlineSm = `${btnSm} border border-border-strong bg-surface text-fg-2 hover:bg-surface-2 hover:text-fg`;
/** Nhắc nộp: nền vàng nhạt, chữ hổ phách — nổi hơn nút viền nhưng không đỏ rực */
export const btnRemindSm = `${btnSm} border border-warning-bar/40 bg-warning-bg text-warning hover:bg-[#FEF0C7] hover:border-warning-bar/60`;
export const iconBtnSm =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 cursor-pointer';
