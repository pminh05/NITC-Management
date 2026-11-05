// Test parse với đúng văn bản BBH user gửi (fallback heuristic, chưa có OpenAI key trong process)
import 'dotenv/config';

const text = [
  'BBH BCN',
  'THỜI GIAN, ĐỊA ĐIỂM, THÀNH PHẦN THAM GIA',
  'Thời gian:',
  'Địa điểm:',
  'Thành phần tham gia:',
  'ALL',
  'Vắng: 0',
  'Muộn: 0',
  'MỤC TIÊU BUỔI HỌP',
  'NỘI DUNG CHÍNH',
  'Báo cáo từng ban',
  'Ban Học thuật:',
  'Ban Truyền thông:',
  'Ban Sự kiện:',
  'Ban Đối ngoại:',
  'Thảo luận',
  'Kế hoạch sắp tới',
  'Tuyển Gen : Nhanh chóng chuẩn bị làm sớm',
  'Hợp tác với AIESEC',
  'Xin địa điểm tổ chức, giống như đợt hợp tác workshop vừa rồi',
  'Chủ yếu rắc rối về vấn đề mượn phòng, nên bắt đầu sớm',
  'Cho các em làm việc sớm để chọn được trường, phó ban',
  'Tầm đầu tháng 10 tổ chức',
  'ĐN liên hệ kì lại với bên đó rồi cập nhật tình hình để mọi người vote',
  'DEADLINES',
  'Chung',
  'Người lập biên bản',
  'ABC',
].join('\n');

const login = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'phamphucminhlehong@gmail.com', password: 'nitc123' }),
});
const { token } = await login.json();
if (!token) {
  console.error('LOGIN FAILED');
  process.exit(1);
}

const res = await fetch('http://localhost:3000/api/gemini/parse-bbh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ bbhText: text, members: [], meetingDate: '2026-11-05' }),
});
console.log('HTTP', res.status);
const d: any = await res.json();
console.log('meeting.title:', d.meeting?.title);
console.log('meeting.chairperson:', d.meeting?.chairperson);
console.log('tasks:', d.tasks?.length);
(d.tasks || []).forEach((t: any, i: number) =>
  console.log(' -', i + 1, (t.title || '').slice(0, 55), '| dept:', t.suggestedDepartment, '| deadline:', t.suggestedDeadline)
);
process.exit(0);
