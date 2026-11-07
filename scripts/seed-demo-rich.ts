// G6.5: (1) Thu gọn còn đúng 3 tài khoản test (Chủ nhiệm / Trưởng ban / Thành viên)
//       (2) Thêm dữ liệu demo phong phú: kỳ họp + công việc đủ mọi trạng thái/mốc thời gian
import 'dotenv/config';
import { prisma } from '../server/db';

const KEEP_EMAILS = [
  'phamphucminhlehong@gmail.com', // Chủ nhiệm
  'anhtud143@gmail.com', // Trưởng ban Sự kiện (Đoàn Anh Tú)
  'chuhamy1107@gmail.com', // Thành viên Truyền thông (Chu Hà My)
];

function d(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().split('T')[0];
}
function iso(offsetDays: number, hour = 10): Date {
  const x = new Date();
  x.setDate(x.getDate() + offsetDays);
  x.setHours(hour, 0, 0, 0);
  return x;
}

async function main() {
  const members = await prisma.member.findMany();
  const byName = (n: string) => members.find((m) => m.name === n);
  const CN = byName('Phạm Phúc Minh');
  const SK = byName('Đoàn Anh Tú'); // TB Sự kiện
  const SKPB = byName('Trần Xuân Dương'); // PB Sự kiện
  const HT = byName('Lê Ngọc Anh Thư'); // TB Học thuật
  const HTPB = byName('Nguyễn Việt Hoàng'); // PB Học thuật
  const TT = byName('Trần Thị Huyền Trang'); // TB Truyền thông
  const TTTV = byName('Chu Hà My'); // TV Truyền thông
  const DN = byName('Hoàng Thanh Tú'); // TB Đối ngoại

  // ===== 1. Thu gọn tài khoản đăng nhập còn đúng 3 =====
  const users = await prisma.user.findMany({ include: { member: true } });
  let removed = 0;
  for (const u of users) {
    if (!KEEP_EMAILS.includes(u.email)) {
      await prisma.user.delete({ where: { id: u.id } });
      removed++;
    }
  }
  console.log(`Đã gỡ ${removed} tài khoản đăng nhập thừa — chỉ còn 3 (Chủ nhiệm/Trưởng ban/Thành viên)`);

  // ===== 2. Thêm kỳ họp trải theo tháng =====
  const meetingDefs = [
    { title: 'Họp BCN tuần 42 — Sơ kết tháng 10', date: d(-25), chairperson: 'Phạm Phúc Minh', secretary: 'Đoàn Anh Tú', attendees: ['Phạm Phúc Minh', 'Trần Thị Hoài Thương', 'Lê Ngọc Anh Thư', 'Đoàn Anh Tú'], absentees: ['Hoàng Thanh Tú'], latecomers: [] },
    { title: 'Họp BCN tuần 43', date: d(-18), chairperson: 'Phạm Phúc Minh', secretary: 'Đoàn Anh Tú', attendees: ['Phạm Phúc Minh', 'Vũ Quang Thái', 'Trần Thị Huyền Trang', 'Đoàn Anh Tú'], absentees: [], latecomers: ['Chu Hà My'] },
    { title: 'Họp riêng Ban Sự kiện — Lên kế hoạch talkshow', date: d(-10), chairperson: 'Đoàn Anh Tú', secretary: 'Trần Xuân Dương', attendees: ['Đoàn Anh Tú', 'Trần Xuân Dương', 'Ngô Minh Quân'], absentees: [], latecomers: [], dept: 'Sự kiện' },
    { title: 'Họp BCN tuần 45 — Triển khai tháng 11', date: d(-4), chairperson: 'Phạm Phúc Minh', secretary: 'Nguyễn Thị Ngọc Ánh', attendees: ['Phạm Phúc Minh', 'Trần Thị Hoài Thương', 'Lê Ngọc Anh Thư', 'Trần Thị Huyền Trang'], absentees: ['Vũ Quang Thái'], latecomers: [], dept: 'Ban Chủ nhiệm' },
    { title: 'Họp riêng Ban Đối ngoại — Chốt tài trợ talkshow', date: d(-2), chairperson: 'Hoàng Thanh Tú', secretary: 'Trịnh Thị Ngọc Hoa', attendees: ['Hoàng Thanh Tú', 'Bùi Thị Thanh Hoa', 'Trần Ngọc Linh'], absentees: [], latecomers: [], dept: 'Đối ngoại' },
    { title: 'Họp BCN tuần 46 — Đầu tháng 12', date: d(8), chairperson: 'Phạm Phúc Minh', secretary: 'Đoàn Anh Tú', attendees: ['Phạm Phúc Minh', 'Trần Thị Hoài Thương'], absentees: [], latecomers: [] },
  ];
  const createdMeetings: Array<{ id: string; title: string }> = [];
  for (const m of meetingDefs) {
    const exists = await prisma.meeting.findFirst({ where: { title: m.title } });
    if (exists) {
      createdMeetings.push({ id: exists.id, title: exists.title });
      continue;
    }
    const created = await prisma.meeting.create({
      data: {
        title: m.title,
        department: (m as any).dept || 'Ban Chủ nhiệm',
        date: m.date,
        time: '20h30',
        location: 'Google Meeting',
        chairperson: m.chairperson,
        secretary: m.secretary,
        attendees: JSON.stringify(m.attendees),
        absentees: JSON.stringify(m.absentees),
        latecomers: JSON.stringify(m.latecomers),
        objectives: 'Rà soát tiến độ các ban và phân công công việc tuần tới.',
        discussionSummary: 'Các ban báo cáo tiến độ; Ban Điều hành thống nhất kế hoạch và hạn chót.',
        actionPlan: 'Xem phần DEADLINES trong biên bản gốc.',
        rawContent: '(Nội dung biên bản gốc)',
      },
    });
    createdMeetings.push({ id: created.id, title: created.title });
  }
  console.log(`Kỳ họp: ${createdMeetings.length} (đã có sẵn + mới thêm)`);

  // ===== 3. Thêm công việc đủ mọi trạng thái =====
  // Tìm meeting id để gắn nguồn
  const findM = (kw: string) => createdMeetings.find((m) => m.title.includes(kw))?.id;

  const taskDefs: Array<any> = [
    // --- Đã hoàn thành ĐÚNG HẠN (+3) ---
    { title: 'Thiết kế banner hội thảo tháng 10', dept: 'Truyền thông', assignee: TTTV, deadline: d(-20), submitted: d(-22), status: 'completed', evidence: 'https://drive.google.com/file/banner-hoi-thao', note: 'Banner đẹp, đúng bộ màu CLB!', meeting: 'tuần 42' },
    { title: 'Liên hệ khách mời talkshow tháng 12', dept: 'Đối ngoại', assignee: DN, deadline: d(-15), submitted: d(-16), status: 'completed', evidence: '', report: 'Đã xác nhận 2 khách mời từ FPT IS tham gia talkshow tháng 12.', note: 'Nhanh và chuyên nghiệp!', meeting: 'tuần 43' },
    { title: 'Lập kế hoạch chi tiết khóa CF đợt 11', dept: 'Học thuật', assignee: HT, deadline: d(-12), submitted: d(-13), status: 'completed', evidence: 'https://docs.google.com/document/d/kehoach-cf', note: 'Kế hoạch chi tiết từng buổi.', meeting: 'tuần 43' },
    // --- Hoàn thành TRỄ HẠN (+1) ---
    { title: 'Tổng hợp danh sách học viên khóa CF', dept: 'Học thuật', assignee: HTPB, deadline: d(-10), submitted: d(-7), status: 'completed', evidence: 'https://docs.google.com/spreadsheets/d/hocvien-cf', note: 'Trễ 3 ngày nhưng danh sách đầy đủ.', meeting: 'tuần 43' },
    // --- Chờ duyệt, nộp đúng hạn (+1) ---
    { title: 'Thiết kế standee quảng bá khóa CF', dept: 'Truyền thông', assignee: TTTV, deadline: d(2), submitted: iso(-1, 14), status: 'pending_approval', evidence: 'https://drive.google.com/file/standee-cf', meeting: 'tuần 45' },
    // --- Quá hạn chưa làm (−2) ---
    { title: 'Chốt ngân sách hội thảo tháng 12', dept: 'Sự kiện', assignee: SK, deadline: d(-8), submitted: null, status: 'in_progress', meeting: 'tuần 42' },
    { title: 'Xin giấy phép sử dụng phòng 302 cho khóa CF', dept: 'Học thuật', assignee: HTPB, deadline: d(-3), submitted: null, status: 'in_progress', meeting: 'tuần 45' },
    // --- Sắp đến hạn (đang làm, 0 điểm) ---
    { title: 'Chuẩn bị slide talkshow "AI trong đời sống sinh viên"', dept: 'Sự kiện', assignee: SKPB, deadline: d(4), submitted: null, status: 'in_progress', meeting: 'riêng SK' },
    { title: 'Đăng bài giới thiệu talkshow trên fanpage', dept: 'Truyền thông', assignee: TTTV, deadline: d(6), submitted: null, status: 'in_progress', meeting: 'tuần 45' },
    { title: 'Gửi hồ sơ tài trợ cho FPT IS', dept: 'Đối ngoại', assignee: DN, deadline: d(7), submitted: null, status: 'in_progress', meeting: 'riêng ĐN' },
    { title: 'Soạn đề bài thử thúc khóa CF', dept: 'Học thuật', assignee: HT, deadline: d(9), submitted: null, status: 'in_progress', meeting: 'tuần 45' },
    // --- Việc NHÓM (2-3 người) ---
    { title: 'Tổ chức buổi học mở màn khóa CF', dept: 'Học thuật', assignee: HT, group: [HT, HTPB], deadline: d(11), status: 'in_progress', meeting: 'tuần 45' },
    { title: 'Họp ekip chốt chương trình talkshow', dept: 'Sự kiện', assignee: SK, group: [SK, SKPB], deadline: d(14), status: 'in_progress', meeting: 'riêng SK' },
    // --- Việc cả ban ---
    { title: 'Brainstorm ý tưởng nội dung tháng 12 (cả ban góp ý)', dept: 'Truyền thông', assignee: TT, group: [TT, TTTV], deadline: d(16), status: 'in_progress', meeting: 'tuần 45' },
  ];

  let added = 0;
  for (const t of taskDefs) {
    const exists = await prisma.task.findFirst({ where: { title: t.title } });
    if (exists) continue;
    const assignee = t.assignee;
    if (!assignee) continue;
    const group: string[] = t.group || [assignee.id];
    await prisma.task.create({
      data: {
        title: t.title,
        description: `Phân công từ biên bản họp — ${t.dept === 'Học thuật' ? 'liên quan khóa CF/talkshow' : 'công việc định kỳ của ban'}.`,
        assigneeId: assignee.id,
        assigneeName: assignee.name,
        assigneeIds: JSON.stringify(group),
        department: t.dept,
        deadline: t.deadline,
        status: t.status,
        verificationType: t.evidence ? 'link_required' : 'report_required',
        evidenceLink: t.status === 'completed' || t.status === 'pending_approval' ? t.evidence || null : null,
        evidenceReport: t.status === 'completed' || t.status === 'pending_approval' ? (t.report || null) : null,
        evidenceSubmittedAt: t.submitted ? new Date(t.submitted).toISOString() : null,
        approvalNote: t.status === 'completed' ? t.note || null : null,
        sourceMeetingId: findM(t.meeting) || findM('tuần 45') || null,
        priority: t.status === 'in_progress' && t.deadline < d(0) ? 'high' : 'medium',
      },
    });
    added++;
  }
  console.log(`Đã thêm ${added} công việc mới (đủ mọi trạng thái, trải Oct -> Dec)`);

  const final = {
    meetings: await prisma.meeting.count(),
    tasks: await prisma.task.count(),
    users: await prisma.user.count(),
  };
  console.log('Hiện trạng DB:', final);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
