import { Member, Task, Meeting, NotificationLog } from '../types';

export const INITIAL_MEMBERS: Member[] = [
  {
    id: 'mem-1',
    name: 'Lê Hồng Phúc Minh',
    role: 'Chủ nhiệm',
    department: 'Ban Chủ nhiệm',
    email: 'phamphucminhlehong@gmail.com',
    phone: '0901234567',
  },
  {
    id: 'mem-2',
    name: 'Nguyễn Đức Minh',
    role: 'Trưởng ban',
    department: 'Học thuật',
    email: 'ducminh.nitc@gmail.com',
    phone: '0912345678',
  },
  {
    id: 'mem-3',
    name: 'Trần Hoàng Nam',
    role: 'Trưởng ban',
    department: 'Truyền thông',
    email: 'hoangnam.nitc@gmail.com',
    phone: '0923456789',
  },
  {
    id: 'mem-4',
    name: 'Đặng Thu Thảo',
    role: 'Trưởng ban',
    department: 'Sự kiện',
    email: 'thuthao.nitc@gmail.com',
    phone: '0934567890',
  },
  {
    id: 'mem-5',
    name: 'Phạm Minh Anh',
    role: 'Trưởng ban',
    department: 'Đối ngoại',
    email: 'minhanh.nitc@gmail.com',
    phone: '0945678901',
  },
  {
    id: 'mem-6',
    name: 'Trần Quang Minh',
    role: 'Thành viên',
    department: 'Truyền thông',
    email: 'quangminh.nitc@gmail.com',
    phone: '0956789012',
  },
  {
    id: 'mem-7',
    name: 'Hoàng Nhật Minh',
    role: 'Thành viên',
    department: 'Sự kiện',
    email: 'nhatminh.nitc@gmail.com',
    phone: '0967890123',
  },
  {
    id: 'mem-8',
    name: 'Nguyễn Thị Ngọc Ánh',
    role: 'Thành viên',
    department: 'Đối ngoại',
    email: 'ngocanh.nitc@gmail.com',
    phone: '0978901234',
  },
  {
    id: 'mem-9',
    name: 'Vũ Đình Trọng',
    role: 'Thành viên',
    department: 'Học thuật',
    email: 'dinhtrong.nitc@gmail.com',
    phone: '0989012345',
  },
  {
    id: 'mem-10',
    name: 'Lê Khánh Huyền',
    role: 'Thành viên',
    department: 'Sự kiện',
    email: 'khanhhuyen.nitc@gmail.com',
    phone: '0990123456',
  },
];

export const SAMPLE_BBH_TEMPLATES = [
  {
    id: 'sample-bbh-1',
    title: 'BBH BCN — Chuẩn bị Ngày Câu lạc bộ (NCD) & Tuyển Gen 8',
    date: '2026-11-03',
    content: `BBH BCN

I. THỜI GIAN, ĐỊA ĐIỂM, THÀNH PHẦN THAM GIA
1. Thời gian: 20h00, Thứ Ba, ngày 03/11/2026
2. Địa điểm: Google Meeting
3. Thành phần tham gia:
- Có mặt: Phạm Phúc Minh, Trần Thị Hoài Thương, Vũ Quang Thái, Lê Ngọc Anh Thư, Trần Thị Huyền Trang, Đoàn Anh Tú, Hoàng Thanh Tú, Chu Hà My, Phạm Duy Anh
- Vắng: Nguyễn Việt Hoàng (Học thuật - có phép)
- Muộn: 1 (Hoàng Thanh Tú)

II. MỤC TIÊU BUỔI HỌP
Chốt kế hoạch Ngày Câu lạc bộ (NCD 20/11) và khởi động quy trình tuyển Gen 8: concept, key visual, form đăng ký.

III. NỘI DUNG CHÍNH
1. Báo cáo từng ban
- Ban Học thuật: Coding challenge đã có 120 lượt tham gia; ICPC đang khảo sát nguyện vọng bằng form; NITC project: điền form + add group.
- Ban Truyền thông: còn thiếu ảnh thầy cố vấn cho bài tốt nghiệp; đăng 2 bài tri ân (Chủ nhiệm và Phó Chủ nhiệm chung 1 bài); core tuyển gen: Chu Hà My, Phạm Duy Anh.
- Ban Sự kiện: chờ chốt ngân sách quà NCD, dự trù 400k chưa tính tuyển gen.
- Ban Đối ngoại: core tuyển gen (Trịnh Thị Ngọc Hoa, Hoàng Thanh Tú); không kịp mời tài trợ cho NCD năm nay.
2. Thảo luận
- NCD: sinh viên qua gian CLB lấy điểm đoàn, điều kiện nhận dấu là follow + like page.
- Quà NCD đặt trước tối đa 2 ngày, phải dán hình CLB; chốt ngân sách và dự trù.
- Xin quà của khoa; làm sheet phân công trực bàn và trang trí gian hàng.
- Làm form thông tin tuyển gen (họ tên, msv, lớp, gmail, ban mong muốn) — Đối ngoại phụ trách form.
3. Kế hoạch sắp tới
- Họp chốt ngày tổ chức tuyển Gen 8 sau khi có concept và key visual.

IV. DEADLINES
1. Chung: Báo cáo kế hoạch NCD gửi Thầy cố vấn trước 10/11/2026.
2. Thiết kế key visual NCD và bộ ấn phẩm fanpage — Ban Truyền thông (Chu Hà My). Deadline: 14/11/2026.
3. Làm form đăng ký tuyển Gen 8 — Trịnh Thị Ngọc Hoa (Đối ngoại). Deadline: 12/11/2026.
4. Chốt ngân sách quà NCD và đặt quà — Đoàn Anh Tú. Deadline: 15/11/2026.
5. Lên sheet phân công trực bàn gian hàng NCD — Ban Sự kiện. Deadline: 17/11/2026.

Người lập biên bản
Đoàn Anh Tú`,
  },
  {
    id: 'sample-bbh-2',
    title: 'BBH BCN — Sơ kết tháng 11 & Đôn đốc tiến độ',
    date: '2026-11-10',
    content: `BBH BCN

I. THỜI GIAN, ĐỊA ĐIỂM, THÀNH PHẦN THAM GIA
1. Thời gian: 21h00, Thứ Ba, ngày 10/11/2026
2. Địa điểm: Phòng tự học A2, NEU
3. Thành phần tham gia:
- Có mặt: Phạm Phúc Minh, Trần Thị Hoài Thương, Lê Ngọc Anh Thư, Trần Thị Huyền Trang, Đoàn Anh Tú, Nguyễn Minh Hiếu
- Vắng: Hoàng Thanh Tú (Đối ngoại), Phạm Quang Minh (Học thuật)
- Muộn: 0

II. MỤC TIÊU BUỔI HỌP
Sơ kết tiến độ tuyển Gen 8 và NCD; phân công các đầu việc tuần tiếp theo.

III. NỘI DUNG CHÍNH
1. Báo cáo từng ban
- Ban Học thuật: Coding challenge cần barem chấm điểm chi tiết.
- Ban Truyền thông: key visual NCD đã xong, cần cắt bộ ảnh recap.
- Ban Sự kiện: trực bàn NCD chạy tốt, cần tổng kết số lượng điểm đoàn.
- Ban Đối ngoại: form tuyển gen đã mở, cần tổng hợp ứng viên mỗi tuần.
2. Thảo luận
- Tuyển gen 8: cần chốt core trước thứ Sáu để gọi ứng viên phỏng vấn.
- Cần nhắc lại việc sheet trực bàn còn thiếu ca tối.
3. Kế hoạch sắp tới
- Đêm sự kiện WiE tháng 12: bắt đầu lên concept.

IV. DEADLINES
1. Minh hoàn thiện barem chấm điểm Coding Challenge. Deadline: Thứ Hai tới.
2. Nguyễn Minh Hiếu cắt bộ ảnh recap NCD đăng fanpage. Deadline: 14/11/2026.
3. Tổng kết số điểm đoàn NCD — Đoàn Anh Tú. Deadline: 13/11/2026.
4. Tổng hợp danh sách ứng viên tuyển Gen 8 tuần 1 — Ban Đối ngoại. Deadline: 16/11/2026.

Người lập biên bản
Nguyễn Minh Hiếu`,
  },
];

export const INITIAL_MEETINGS: Meeting[] = [
  {
    id: 'meet-1',
    title: 'BBH Họp Ban Điều Hành Tuần 33 - Sơ kết hoạt động đầu tháng 8',
    date: '2026-08-11',
    chairperson: 'Lê Hồng Phúc Minh',
    secretary: 'Nguyễn Thị Ngọc Ánh',
    attendees: [
      'Lê Hồng Phúc Minh',
      'Nguyễn Đức Minh',
      'Trần Hoàng Nam',
      'Đặng Thu Thảo',
      'Phạm Minh Anh',
    ],
    absentees: ['Vũ Đình Trọng', 'Hoàng Nhật Minh'],
    discussionSummary:
      'Đánh giá hiệu quả truyền thông bài đăng tuyển thành viên và phân bổ nguồn lực chuẩn bị sự kiện lớn quý 3.',
    actionPlan:
      '1. Ban Truyền thông tổng hợp số liệu tương tác fanpage.\n2. Ban Học thuật biên soạn đề kiểm tra đầu vào.\n3. Ban Đối ngoại tìm kiếm nhà tài trợ nước uống.',
    rawContent: SAMPLE_BBH_TEMPLATES[1].content,
    taskCount: 4,
    completedTaskCount: 2,
    createdAt: '2026-08-11T21:00:00.000Z',
  },
];

// Initial Tasks demonstrating the Sticky Task rule, Pending Approval, Overdue, and Completed states
export const INITIAL_TASKS: Task[] = [
  {
    id: 'task-sticky-1',
    title: 'Biên soạn giáo trình chi tiết 6 buổi Bootcamp Web Dev 2026',
    description: 'Bao gồm slide, bài tập thực hành GitHub và tài liệu tham khảo cho học viên',
    assigneeId: 'mem-2',
    assigneeName: 'Nguyễn Đức Minh',
    department: 'Học thuật',
    deadline: '2026-08-17',
    status: 'overdue',
    verificationType: 'link_required',
    sourceMeetingId: 'meet-1',
    sourceMeetingTitle: 'BBH Họp Ban Điều Hành Tuần 33',
    isSticky: true, // Nhiệm vụ lưu chuyển từ tuần trước chưa xong
    stickyWeeksCount: 1,
    priority: 'high',
    createdAt: '2026-08-11T21:00:00.000Z',
    updatedAt: '2026-08-18T10:00:00.000Z',
  },
  {
    id: 'task-sticky-2',
    title: 'Gặp Thầy Cố vấn Đoàn trường xin phê duyệt kinh phí và chữ ký mộc',
    description: 'Trình kế hoạch chi tiêu TechFest và xin con dấu xác nhận của Đoàn trường',
    assigneeId: 'mem-5',
    assigneeName: 'Phạm Minh Anh',
    department: 'Đối ngoại',
    deadline: '2026-08-14',
    status: 'overdue',
    verificationType: 'report_required',
    sourceMeetingId: 'meet-1',
    sourceMeetingTitle: 'BBH Họp Ban Điều Hành Tuần 33',
    isSticky: true, // Nhiệm vụ lưu chuyển
    stickyWeeksCount: 1,
    priority: 'high',
    createdAt: '2026-08-11T21:00:00.000Z',
    updatedAt: '2026-08-18T10:00:00.000Z',
  },
  {
    id: 'task-pending-1',
    title: 'Thiết kế Bộ nhận diện Key Visual và Banner tuyển sinh Bootcamp',
    description: 'Thiết kế trên Canva/Figma đúng bộ màu chủ đạo NITC',
    assigneeId: 'mem-3',
    assigneeName: 'Trần Hoàng Nam',
    department: 'Truyền thông',
    deadline: '2026-08-19',
    status: 'pending_approval',
    verificationType: 'link_required',
    evidenceLink: 'https://www.figma.com/file/nitc-keyvisual-techfest-2026',
    evidenceSubmittedAt: '2026-08-19T14:30:00.000Z',
    sourceMeetingId: 'meet-1',
    sourceMeetingTitle: 'BBH Họp Ban Điều Hành Tuần 33',
    priority: 'high',
    createdAt: '2026-08-11T21:00:00.000Z',
    updatedAt: '2026-08-19T14:30:00.000Z',
  },
  {
    id: 'task-pending-2',
    title: 'Liên hệ BQL Giảng đường B1 để khảo sát âm thanh ánh sáng',
    description: 'Kiểm tra mic không dây, máy chiếu và hệ thống loa cho ngày hội',
    assigneeId: 'mem-4',
    assigneeName: 'Đặng Thu Thảo',
    department: 'Sự kiện',
    deadline: '2026-08-20',
    status: 'pending_approval',
    verificationType: 'report_required',
    evidenceReport: 'Đã gặp anh Tuấn quản lý hội trường B1 sáng nay. Âm thanh tốt, máy chiếu sắc nét, đã nhận chìa khóa test trước 1 ngày.',
    evidenceSubmittedAt: '2026-08-20T10:15:00.000Z',
    sourceMeetingId: 'meet-1',
    sourceMeetingTitle: 'BBH Họp Ban Điều Hành Tuần 33',
    priority: 'medium',
    createdAt: '2026-08-11T21:00:00.000Z',
    updatedAt: '2026-08-20T10:15:00.000Z',
  },
  {
    id: 'task-in-progress-1',
    title: 'Tạo Google Form đăng ký và kết nối tự động với Google Sheets',
    description: 'Thu thập thông tin sinh viên tham gia TechFest 2026',
    assigneeId: 'mem-3',
    assigneeName: 'Trần Hoàng Nam',
    department: 'Truyền thông',
    deadline: '2026-08-22',
    status: 'in_progress',
    verificationType: 'link_required',
    sourceMeetingId: 'meet-1',
    sourceMeetingTitle: 'BBH Họp Ban Điều Hành Tuần 33',
    priority: 'medium',
    createdAt: '2026-08-11T21:00:00.000Z',
    updatedAt: '2026-08-11T21:00:00.000Z',
  },
  {
    id: 'task-completed-1',
    title: 'Lập danh sách 15 doanh nghiệp IT tiềm năng tài trợ TechFest',
    description: 'Bao gồm người liên hệ, email, số điện thoại và mức tài trợ đề xuất',
    assigneeId: 'mem-5',
    assigneeName: 'Phạm Minh Anh',
    department: 'Đối ngoại',
    deadline: '2026-08-15',
    status: 'completed',
    verificationType: 'link_required',
    evidenceLink: 'https://docs.google.com/spreadsheets/d/1nitc_sponsors_list_2026',
    evidenceSubmittedAt: '2026-08-15T09:00:00.000Z',
    approvalNote: 'Chủ nhiệm đã duyệt: Danh sách rất tốt, ưu tiên tiếp cận 3 đơn vị Top 1.',
    sourceMeetingId: 'meet-1',
    sourceMeetingTitle: 'BBH Họp Ban Điều Hành Tuần 33',
    priority: 'high',
    createdAt: '2026-08-11T21:00:00.000Z',
    updatedAt: '2026-08-15T16:00:00.000Z',
  },
];

export const INITIAL_LOGS: NotificationLog[] = [
  {
    id: 'log-1',
    type: 'weekly_summary',
    recipientName: 'Toàn thể Ban Điều Hành NITC',
    recipientEmail: 'bdh-nitc-club@googlegroups.com',
    subject: '[NITC BÁO CÁO TUẦN 33] Tổng kết tiến độ công việc & Việc tồn đọng',
    content: 'Kính gửi BĐH NITC,\nHệ thống tổng kết: 6 việc đã giao, 1 hoàn thành, 2 chờ duyệt, 2 quá hạn. Đề nghị các Trưởng ban kiểm tra và đôn đốc thành viên nộp minh chứng.',
    sentAt: '2026-08-16T20:00:00.000Z',
    status: 'sent',
    taskCount: 6,
  },
  {
    id: 'log-2',
    type: 'overdue_nag',
    recipientName: 'Nguyễn Đức Minh (Trưởng ban Học thuật)',
    recipientEmail: 'ducminh.nitc@gmail.com',
    department: 'Học thuật',
    subject: '🚨 [NITC NHẮC VIỆC QUÁ HẠN] Công việc "Biên soạn giáo trình 6 buổi" đã trễ 3 ngày!',
    content: 'Chào Đức Minh, Công việc của bạn đã quá hạn từ ngày 17/08/2026. Vui lòng nộp link tài liệu hoặc báo cáo tiến độ gấp để Chủ nhiệm phê duyệt.',
    sentAt: '2026-08-20T08:00:00.000Z',
    status: 'sent',
    taskCount: 1,
  },
];
