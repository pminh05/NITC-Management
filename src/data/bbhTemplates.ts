import { Member } from '../types';
import { addDays, todayVN } from '../../shared/time';

/**
 * Mẫu biên bản họp để thử "AI đọc biên bản".
 * Dựng từ DANH SÁCH THÀNH VIÊN HIỆN TẠI và NGÀY HÔM NAY, nên không bao giờ dính tên người đã rời CLB
 * hay mốc thời gian đã qua (mẫu cũ ghi cứng tên và ngày tháng 11/2026).
 */
export interface BbhTemplate {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  content: string;
}

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const DEPTS = ['Học thuật', 'Truyền thông', 'Sự kiện', 'Đối ngoại'] as const;

function vnDate(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

function weekday(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function buildBbhTemplates(members: Member[], today: string = todayVN()): BbhTemplate[] {
  const active = members.filter((m) => !m.status || m.status === 'active');
  if (active.length === 0) return [];

  const byRole = (role: string) => active.filter((m) => m.role === role);
  const chair = byRole('Chủ nhiệm')[0] || active[0];
  const vice = byRole('Phó Chủ nhiệm')[0];

  // Mỗi ban: trưởng ban (nếu có) + tối đa 2 người khác
  const team = DEPTS.map((dept) => {
    const inDept = active.filter((m) => m.department === dept);
    const head = inDept.find((m) => m.role === 'Trưởng ban') || inDept[0];
    const others = inDept.filter((m) => m !== head).slice(0, 2);
    return { dept, head, people: [head, ...others].filter(Boolean) as Member[] };
  }).filter((t) => t.people.length > 0);

  const secretary =
    active.find((m) => m.department === 'Ban Chủ nhiệm' && m !== chair) || vice || team[0]?.head || chair;
  const absent = team.length > 1 ? team[team.length - 1].people[team[team.length - 1].people.length - 1] : undefined;
  const attendees = [chair, vice, ...team.flatMap((t) => t.people)]
    .filter((m, i, arr): m is Member => Boolean(m) && arr.indexOf(m) === i && m !== absent)
    .map((m) => m.name);

  const [y, mo] = today.split('-').map(Number);
  const nextMonth = mo === 12 ? 1 : mo + 1;
  const names = (ps: Member[]) => ps.map((p) => p.name).join(', ');
  const deadline = (days: number) => vnDate(addDays(today, days));

  const TASKS: Record<(typeof DEPTS)[number], { work: string; days: number }> = {
    'Học thuật': { work: `Soạn đề cương và tài liệu buổi học đầu tháng ${nextMonth}`, days: 5 },
    'Truyền thông': { work: `Thiết kế bộ ấn phẩm truyền thông cho sự kiện tháng ${nextMonth}`, days: 7 },
    'Sự kiện': { work: `Lên kế hoạch và dự trù ngân sách sự kiện tháng ${nextMonth}`, days: 4 },
    'Đối ngoại': { work: `Liên hệ khách mời và đối tác cho sự kiện tháng ${nextMonth}`, days: 10 },
  };

  const plan = `BBH BCN

I. THỜI GIAN, ĐỊA ĐIỂM, THÀNH PHẦN THAM GIA
1. Thời gian: 20h00, ${weekday(today)}, ngày ${vnDate(today)}
2. Địa điểm: Google Meet
3. Thành phần tham gia:
- Có mặt: ${attendees.join(', ')}
- Vắng: ${absent ? `${absent.name} (${absent.department} - có phép)` : '0'}

II. MỤC TIÊU BUỔI HỌP
Chốt kế hoạch hoạt động tháng ${nextMonth}/${mo === 12 ? y + 1 : y} và phân công đầu việc cho từng ban.

III. NỘI DUNG CHÍNH
${team.map((t) => `- Ban ${t.dept}: ${t.head ? `${t.head.name} báo cáo tiến độ, ` : ''}thống nhất đầu việc tháng ${nextMonth}.`).join('\n')}

IV. DEADLINES
${team
  .map((t, i) => `${i + 1}. ${TASKS[t.dept].work} — Ban ${t.dept} (${names(t.people)}). Deadline: ${deadline(TASKS[t.dept].days)}.`)
  .join('\n')}

Người lập biên bản
${secretary.name}`;

  const reviewDate = today;
  const firstTwo = team.slice(0, 2);
  const review = `BBH BCN

I. THỜI GIAN, ĐỊA ĐIỂM, THÀNH PHẦN THAM GIA
1. Thời gian: 21h00, ${weekday(reviewDate)}, ngày ${vnDate(reviewDate)}
2. Địa điểm: Phòng họp CLB
3. Thành phần tham gia:
- Có mặt: ${[chair, vice, ...team.map((t) => t.head)].filter((m, i, a): m is Member => Boolean(m) && a.indexOf(m) === i).map((m) => m.name).join(', ')}
- Vắng: 0

II. NỘI DUNG CHÍNH
Sơ kết tiến độ trong tuần, đôn đốc các đầu việc quá hạn và duyệt các minh chứng đang chờ.

III. DEADLINES
${firstTwo
  .map((t, i) => `${i + 1}. Hoàn thiện và nộp minh chứng các việc còn tồn của Ban ${t.dept} — ${t.head?.name || names(t.people)}. Deadline: ${deadline(3 + i * 2)}.`)
  .join('\n')}

Người lập biên bản
${secretary.name}`;

  return [
    { id: 'tpl-plan', title: `Họp BCN — Kế hoạch tháng ${nextMonth}`, date: today, content: plan },
    { id: 'tpl-review', title: 'Họp BCN — Sơ kết tiến độ tuần', date: reviewDate, content: review },
  ];
}
