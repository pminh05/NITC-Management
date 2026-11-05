/** Hôm nay theo chuẩn YYYY-MM-DD (so khớp trực tiếp với trường deadline) */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Việc quá hạn = deadline đã trễ HÔM NAY và chưa hoàn thành.
 * Dựa theo ngày (không phụ thuộc task.status) để luôn đúng — kể cả khi
 * status chưa được cron cập nhật.
 */
export function isTaskOverdue(task: { deadline: string; status: string }): boolean {
  return task.status !== 'completed' && task.deadline < todayISO();
}

export function formatDateVN(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function formatDateTimeVN(isoStr?: string): string {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return isoStr;
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${hours}:${mins}, ${d}/${m}/${y}`;
}

export function getDaysRemaining(deadlineStr: string): {
  days: number;
  isOverdue: boolean;
  isToday: boolean;
  label: string;
  badgeColor: string;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadline = new Date(deadlineStr);
  deadline.setHours(0, 0, 0, 0);

  const diffTime = deadline.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const daysLate = Math.abs(diffDays);
    return {
      days: diffDays,
      isOverdue: true,
      isToday: false,
      label: `Quá hạn ${daysLate} ngày`,
      badgeColor: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800',
    };
  } else if (diffDays === 0) {
    return {
      days: 0,
      isOverdue: false,
      isToday: true,
      label: 'Hạn chót hôm nay',
      badgeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800',
    };
  } else if (diffDays === 1) {
    return {
      days: 1,
      isOverdue: false,
      isToday: false,
      label: 'Hạn chót ngày mai',
      badgeColor: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-800',
    };
  } else {
    return {
      days: diffDays,
      isOverdue: false,
      isToday: false,
      label: `Còn ${diffDays} ngày`,
      badgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800',
    };
  }
}
