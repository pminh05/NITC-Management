// NGÀY GIỜ VIỆT NAM — nguồn duy nhất cho mọi phép tính "hôm nay", "còn mấy ngày", "quá hạn".
// Hạn chót lưu dạng 'YYYY-MM-DD' và được hiểu theo giờ Việt Nam (UTC+7, không đổi giờ mùa),
// bất kể server chạy ở múi giờ nào (máy chủ thuê thường chạy UTC → trước đây lệch 7 tiếng mỗi ngày).
// Tệp chỉ chứa hàm thuần để server và giao diện dùng chung.

export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Ngày (YYYY-MM-DD) theo giờ Việt Nam của một thời điểm; '' nếu thời điểm không hợp lệ. */
export function ymdVN(at: Date | string | number = new Date()): string {
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return '';
  return new Date(t + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Hôm nay theo giờ Việt Nam */
export function todayVN(): string {
  return ymdVN(new Date());
}

function ymdToUtcMs(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00Z`);
}

/** Cộng/trừ số ngày vào một ngày YYYY-MM-DD */
export function addDays(ymd: string, days: number): string {
  return new Date(ymdToUtcMs(ymd) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Số ngày từ `from` đến `to` (dương: `to` ở tương lai). NaN nếu sai định dạng. */
export function diffDays(from: string, to: string): number {
  return Math.round((ymdToUtcMs(to) - ymdToUtcMs(from)) / DAY_MS);
}

/** Số ngày còn lại tới hạn chót tính từ hôm nay (âm = đã trễ) */
export function daysUntil(deadline: string): number {
  return diffDays(todayVN(), deadline.slice(0, 10));
}
