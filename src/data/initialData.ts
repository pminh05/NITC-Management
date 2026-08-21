import { Member, Task, Meeting, NotificationLog } from '../types';

export const INITIAL_MEMBERS: Member[] = [
  {
    id: 'mem-1',
    name: 'Lê Hồng Phúc Minh',
    role: 'Chủ tịch',
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
    title: 'BBH Họp Ban Điều Hành Tuần 34 - Chuẩn bị TechFest NITC 2026',
    date: '2026-08-18',
    content: `CÂU LẠC BỘ CÔNG NGHỆ THÔNG TIN NITC
BAN ĐIỀU HÀNH CLB
Số: 34/BBH-NITC-2026

BIÊN BẢN HỌP BAN ĐIỀU HÀNH
(V/v: Triển khai sự kiện TechFest NITC 2026 & Đánh giá công việc tuần)

1. THỜI GIAN & ĐỊA ĐIỂM:
- Thời gian: 19h30, Thứ Ba ngày 18/08/2026
- Địa điểm: Phòng họp Zoom BĐH & Văn phòng CLB NITC
- Chủ trì: Lê Hồng Phúc Minh (Chủ tịch CLB)
- Thư ký: Nguyễn Thị Ngọc Ánh

2. THÀNH PHẦN THAM DỰ:
- Có mặt: Lê Hồng Phúc Minh (Chủ tịch), Trần Hoàng Nam (Trưởng ban Truyền thông), Đặng Thu Thảo (Trưởng ban Sự kiện), Phạm Minh Anh (Trưởng ban Đối ngoại), Vũ Đình Trọng (Ban Học thuật), Nguyễn Thị Ngọc Ánh.
- Vắng mặt: Nguyễn Đức Minh (Trưởng ban Học thuật - có phép), Hoàng Nhật Minh (Ban Sự kiện - không phép).

3. NỘI DUNG THẢO LUẬN:
- Chủ tịch đánh giá tiến độ chuẩn bị sự kiện TechFest 2026. Khâu truyền thông cần đẩy mạnh teaser và mở đơn đăng ký cho sinh viên toàn trường.
- Ban Đối ngoại báo cáo đã tiếp cận 3 nhà tài trợ công nghệ, cần hoàn thiện hồ sơ mời tài trợ chính thức và xin lịch gặp đại diện doanh nghiệp.
- Ban Sự kiện đã khảo sát hội trường B1, cần chốt hợp đồng âm thanh ánh sáng và kịch bản chi tiết.
- Về học thuật: Cần hoàn thiện đề thi vòng sơ loại Code Challenge và chuẩn bị server chấm bài tự động.

4. KẾ HOẠCH & PHÂN CÔNG CÔNG VIỆC:
1. Ban Truyền thông làm bộ ảnh Key Visual và Avatar Frame cho TechFest. Deadline: Thứ Sáu tuần này (21/08/2026).
2. Minh làm đề thi vòng 1 Code Challenge và barem chấm điểm chi tiết. Deadline: Thứ Hai tới (24/08/2026).
3. Đặng Thu Thảo hoàn thiện kịch bản chi tiết chương trình TechFest và gửi duyệt. Deadline: Chủ Nhật (23/08/2026).
4. Phạm Minh Anh gửi email mời tài trợ và báo cáo kết quả liên hệ 3 doanh nghiệp (VNG, FPT, MoMo). Deadline: 3 ngày sau họp (21/08/2026).
5. Vũ Đình Trọng setup hệ thống máy chủ chấm code test thử tải 500 thí sinh. Deadline: Tuần sau (25/08/2026).
6. Ban Sự kiện liên hệ gặp Ban Quản lý Giảng đường B1 để làm thủ tục mượn phòng. Deadline: Ngày mai (19/08/2026).`,
  },
  {
    id: 'sample-bbh-2',
    title: 'BBH Họp Giao Ban Đầu Tháng - Triển khai Khóa Huấn luyện Web Dev & Hackathon',
    date: '2026-08-10',
    content: `CÂU LẠC BỘ CÔNG NGHỆ THÔNG TIN NITC
BAN ĐIỀU HÀNH CLB
Số: 32/BBH-NITC-2026

BIÊN BẢN HỌP ĐẦU THÁNG BAN ĐIỀU HÀNH
(V/v: Kế hoạch Bootcamp Web Development & Quỹ CLB)

1. THỜI GIAN & ĐỊA ĐIỂM:
- Thời gian: 20h00, Thứ Hai ngày 10/08/2026
- Địa điểm: Phòng C3-302, Đại học Bách Khoa
- Chủ trì: Lê Hồng Phúc Minh (Chủ tịch)
- Thư ký: Nguyễn Thị Ngọc Ánh

2. THÀNH PHẦN THAM DỰ:
- Có mặt: Lê Hồng Phúc Minh, Nguyễn Đức Minh, Trần Hoàng Nam, Đặng Thu Thảo, Phạm Minh Anh, Trần Quang Minh.
- Vắng mặt: Lê Khánh Huyền (Sự kiện).

3. NỘI DUNG THẢO LUẬN:
- Rà soát các đầu việc còn tồn của tháng trước. Ban Học thuật triển khai giáo trình 6 buổi bootcamp React & Node.js.
- Ban Truyền thông thiết kế poster tuyển sinh bootcamp và đăng bài đợt 1.
- Ban Đối ngoại làm việc với Đoàn trường để xin chứng nhận tham gia cho sinh viên.

4. KẾ HOẠCH & PHÂN CÔNG CÔNG VIỆC:
1. Nguyễn Đức Minh hoàn thiện Slide và giáo trình Bootcamp 6 buổi. Deadline: 17/08/2026.
2. Trần Hoàng Nam thiết kế Banner và Form đăng ký Google Form cho học viên. Deadline: 15/08/2026.
3. Phạm Minh Anh gặp Thầy Cố vấn Đoàn trường xin phê duyệt kinh phí và chữ ký mộc. Deadline: 14/08/2026.
4. Ban Sự kiện mua văn phòng phẩm và thẻ ban tổ chức. Deadline: 16/08/2026.`,
  }
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
    approvalNote: 'Chủ tịch đã duyệt: Danh sách rất tốt, ưu tiên tiếp cận 3 đơn vị Top 1.',
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
    content: 'Chào Đức Minh, Công việc của bạn đã quá hạn từ ngày 17/08/2026. Vui lòng nộp link tài liệu hoặc báo cáo tiến độ gấp để Chủ tịch phê duyệt.',
    sentAt: '2026-08-20T08:00:00.000Z',
    status: 'sent',
    taskCount: 1,
  },
];
