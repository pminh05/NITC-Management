import { z } from 'zod';

// ===== Luật kiểm tra dữ liệu đầu vào cho toàn bộ API (zod) =====
// Mỗi route gọi validate(schema, req.body) trước khi chạm CSDL: sai kiểu/thiếu trường/giá trị ngoài
// danh mục bị trả 400 ngay ở biên, không bao giờ lọt xuống Prisma. Trường lạ bị loại bỏ.

z.config(z.locales.vi());

// ----- Danh mục giá trị hợp lệ (CSDL lưu TEXT nên ràng buộc nằm ở đây) -----
export const ROLES = ['Chủ nhiệm', 'Phó Chủ nhiệm', 'Trưởng ban', 'Phó ban', 'Thành viên', 'Cố vấn'] as const;
export const DEPARTMENTS = ['Ban Chủ nhiệm', 'Học thuật', 'Truyền thông', 'Sự kiện', 'Đối ngoại'] as const;
export const MEMBER_STATUSES = ['active', 'inactive', 'alumni'] as const;
export const VERIFICATION_TYPES = ['link_required', 'report_required'] as const;
export const PRIORITIES = ['high', 'medium', 'normal'] as const;
export const DOC_TYPES = ['drive', 'sheet', 'doc', 'slide', 'pdf', 'image', 'form', 'other'] as const;

// ----- Khối dựng chung -----
const text = (label: string, max: number) =>
  z
    .string(`Thiếu ${label}`)
    .trim()
    .min(1, `Thiếu ${label}`)
    .max(max, `${label} quá dài (tối đa ${max} ký tự)`);

/** Chuỗi tùy chọn: chấp nhận thiếu / null / rỗng. */
const optText = (max: number) => z.string().max(max, `Nội dung quá dài (tối đa ${max} ký tự)`).nullish();

const id = z.string('Thiếu mã định danh').min(1, 'Thiếu mã định danh').max(100);

const ymd = z
  .string('Thiếu ngày')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo dạng YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Ngày không tồn tại trên lịch');

const email = z
  .string('Thiếu email')
  .trim()
  .toLowerCase()
  .max(200)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email không hợp lệ');

const httpUrl = (label: string) =>
  z
    .string(`Thiếu ${label}`)
    .trim()
    .max(2000, `${label} quá dài`)
    .regex(/^https?:\/\/\S+$/i, `${label} phải bắt đầu bằng http:// hoặc https://`);

/** URL tùy chọn: rỗng/null coi như không gửi. */
const optHttpUrl = (label: string) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v ?? undefined), httpUrl(label).optional());

const role = z.enum(ROLES, { error: `Vai trò phải là một trong: ${ROLES.join(', ')}` });
const department = z.enum(DEPARTMENTS, { error: `Ban phải là một trong: ${DEPARTMENTS.join(', ')}` });
const verificationType = z.enum(VERIFICATION_TYPES, { error: 'Loại minh chứng không hợp lệ' });
const priority = z.enum(PRIORITIES, { error: 'Độ ưu tiên không hợp lệ' });

/** Mảng id: bỏ phần tử không phải chuỗi, khử trùng lặp. */
const idList = z
  .array(z.unknown())
  .max(200, 'Quá nhiều người phụ trách')
  .nullish()
  .transform((a) => Array.from(new Set((a ?? []).filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 100))));

/** Mảng tên (có mặt/vắng/muộn): AI có thể trả object {name} — quy hết về chuỗi. */
const nameList = z
  .array(z.unknown())
  .max(500)
  .nullish()
  .transform((a) =>
    (a ?? [])
      .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' && typeof (x as any).name === 'string' ? (x as any).name : ''))
      .map((s: string) => s.trim().slice(0, 200))
      .filter(Boolean)
  );

// ----- Auth -----
export const loginSchema = z.object({
  email: z.string('Vui lòng nhập email').trim().toLowerCase().min(1, 'Vui lòng nhập email').max(200),
  password: z.string('Vui lòng nhập mật khẩu').min(1, 'Vui lòng nhập mật khẩu').max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string('Vui lòng nhập mật khẩu hiện tại').min(1, 'Vui lòng nhập mật khẩu hiện tại').max(200),
  newPassword: z
    .string('Vui lòng nhập mật khẩu mới')
    .min(8, 'Mật khẩu mới cần ít nhất 8 ký tự')
    .max(100, 'Mật khẩu mới tối đa 100 ký tự'),
});

// ----- Thành viên -----
export const memberCreateSchema = z.object({
  id: id.optional(),
  name: text('họ tên', 120),
  role,
  department,
  email,
  phone: optText(30),
  studentId: optText(30),
  className: optText(30),
});

export const memberUpdateSchema = z.object({
  name: text('họ tên', 120).optional(),
  role: role.optional(),
  department: department.optional(),
  email: email.optional(),
  phone: optText(30),
  studentId: optText(30),
  className: optText(30),
  birthday: optText(20),
  status: z.enum(MEMBER_STATUSES, { error: 'Trạng thái phải là active, inactive hoặc alumni' }).optional(),
});

// ----- Công việc -----
export const taskCreateSchema = z.object({
  title: text('tiêu đề nhiệm vụ', 300),
  description: optText(5000),
  assigneeId: z.string('Thiếu người phụ trách').min(1, 'Thiếu người phụ trách').max(100),
  assigneeIds: idList,
  department,
  deadline: ymd,
  verificationType: verificationType.default('link_required'),
  priority: priority.default('medium'),
  sourceMeetingId: id.nullish(),
  // Lưu ý: KHÔNG nhận `status` — việc mới luôn bắt đầu ở "đang làm" (tránh tạo thẳng việc "đã hoàn thành" để lấy điểm KPI)
});

export const taskActionSchema = z.discriminatedUnion(
  'action',
  [
    z.object({
      action: z.literal('submit_evidence'),
      link: optHttpUrl('Link minh chứng'),
      report: optText(5000),
    }),
    z.object({ action: z.literal('approve'), note: optText(2000) }),
    z.object({ action: z.literal('reject'), reason: text('lý do trả lại', 2000) }),
    z.object({ action: z.literal('request_update'), note: optText(2000) }),
    z.object({
      action: z.literal('respond_update'),
      feedback: text('nội dung phản hồi (feedback)', 2000),
      decision: z.enum(['approve', 'reject']).optional(),
    }),
    z.object({
      action: z.literal('update'),
      title: text('tiêu đề nhiệm vụ', 300).optional(),
      description: optText(5000),
      assigneeId: id.optional(),
      assigneeIds: idList, // đổi toàn bộ danh sách người phụ trách (bỏ trống = giữ nguyên)
      department: department.optional(),
      deadline: ymd.optional(),
      priority: priority.optional(),
      verificationType: verificationType.optional(),
      isSticky: z.boolean().optional(),
    }),
  ],
  { error: 'Action không hợp lệ (submit_evidence | approve | reject | request_update | respond_update | update)' }
);

export const remindSchema = z.object({ note: optText(500) });

// ----- Kỳ họp: ban hành biên bản + bộ nhiệm vụ -----
export const publishSchema = z.object({
  meeting: z.object(
    {
      id: id.optional(),
      title: text('tiêu đề kỳ họp', 300),
      date: ymd,
      department: department.optional(),
      time: optText(50),
      location: optText(300),
      chairperson: optText(200),
      secretary: optText(200),
      attendees: nameList,
      absentees: nameList,
      latecomers: nameList,
      objectives: optText(20000),
      discussionSummary: optText(100000),
      actionPlan: optText(100000),
      rawContent: optText(500000),
    },
    { error: 'Thiếu thông tin kỳ họp' }
  ),
  tasks: z
    .array(
      z.object({
        title: text('tiêu đề nhiệm vụ', 300),
        description: optText(5000),
        suggestedDepartment: department,
        suggestedAssigneeId: optText(100),
        suggestedAssigneeIds: idList,
        suggestedDeadline: ymd,
        verificationType: verificationType.default('link_required'),
        priority: priority.default('medium'),
      }),
      { error: 'Không có nhiệm vụ nào để ban hành' }
    )
    .min(1, 'Không có nhiệm vụ nào để ban hành')
    .max(200, 'Tối đa 200 nhiệm vụ mỗi kỳ họp'),
});

// ----- Nhật ký nhắc việc -----
export const logCreateSchema = z.object({
  type: optText(50),
  recipientName: optText(200),
  recipientEmail: text('người nhận', 200),
  department: optText(50),
  subject: text('tiêu đề', 300),
  content: optText(20000),
  taskCount: z.number().int().min(0).max(100000).nullish(),
});

// ----- Kho tài liệu -----
export const docCreateSchema = z.object({
  name: text('tên tài liệu', 300),
  url: httpUrl('Đường dẫn'),
  docType: z.string().max(20).nullish(),
  department: department.optional(),
  termId: id.nullish(),
  label: optText(100),
});

export const docUpdateSchema = z.object({
  name: text('tên tài liệu', 300).optional(),
  url: httpUrl('Đường dẫn').optional(),
  docType: z.string().max(20).nullish(),
  department: department.optional(),
  label: optText(100),
});

// ----- AI đọc biên bản -----
export const parseBbhSchema = z.object({
  bbhText: optText(500000),
  docUrl: optText(2000),
  images: z.array(z.string().max(20_000_000)).max(12, 'Tối đa 12 ảnh mỗi lần').nullish(),
  pdf: z.string().max(30_000_000).nullish(),
  // Chỉ giữ 4 trường cần cho prompt — không chuyển SĐT/email/ngày sinh của thành viên sang dịch vụ AI
  members: z
    .array(z.object({ id: z.string().max(100), name: z.string().max(200), department: z.string().max(50), role: z.string().max(50) }))
    .max(1000)
    .nullish(),
  meetingDate: z.preprocess((v) => (v === '' ? undefined : v ?? undefined), ymd.optional()),
});

// ----- Import toàn bộ dữ liệu (quản trị) -----
const isoish = z.string().max(40).nullish();
export const adminImportSchema = z.object({
  members: z
    .array(
      z.object({
        id,
        name: text('họ tên', 120),
        role,
        department,
        email,
        phone: optText(30),
        studentId: optText(30),
        className: optText(30),
        birthday: optText(20),
      }),
      { error: 'Dữ liệu import cần có members, tasks, meetings' }
    )
    .min(1, 'Danh sách thành viên trống')
    .max(2000),
  meetings: z
    .array(
      z.object({
        id,
        title: text('tiêu đề kỳ họp', 300),
        date: ymd,
        department: department.optional(),
        chairperson: optText(200),
        secretary: optText(200),
        attendees: nameList,
        absentees: nameList,
        latecomers: nameList,
        objectives: optText(20000),
        discussionSummary: optText(100000),
        actionPlan: optText(100000),
        rawContent: optText(500000),
        createdAt: isoish,
      }),
      { error: 'Dữ liệu import cần có members, tasks, meetings' }
    )
    .max(5000),
  tasks: z
    .array(
      z.object({
        id,
        title: text('tiêu đề nhiệm vụ', 300),
        description: optText(5000),
        assigneeId: id,
        assigneeName: text('tên người phụ trách', 200),
        assigneeIds: idList,
        department,
        deadline: ymd,
        status: z.enum(['in_progress', 'pending_approval', 'completed', 'overdue'], { error: 'Trạng thái nhiệm vụ không hợp lệ' }),
        verificationType,
        evidenceLink: optText(2000),
        evidenceReport: optText(5000),
        evidenceSubmittedAt: isoish,
        approvalNote: optText(2000),
        rejectedReason: optText(2000),
        sourceMeetingId: id.nullish(),
        priority: priority.nullish(),
        isSticky: z.boolean().nullish(),
        stickyWeeksCount: z.number().int().nullish(),
        createdAt: isoish,
        updatedAt: isoish,
      }),
      { error: 'Dữ liệu import cần có members, tasks, meetings' }
    )
    .max(20000),
  logs: z
    .array(
      z.object({
        id: id.optional(),
        type: optText(50),
        recipientName: optText(200),
        recipientEmail: optText(200),
        department: optText(50),
        subject: optText(300),
        content: optText(20000),
        sentAt: isoish,
        status: optText(20),
        taskCount: z.number().int().nullish(),
      })
    )
    .max(20000)
    .nullish(),
});

// ----- Nhiệm kỳ, cấu hình, kênh thông báo -----
export const termCreateSchema = z.object({
  name: z
    .string('Thiếu tên nhiệm kỳ')
    .trim()
    .regex(/^\d{4}-\d{4}$/, 'Tên nhiệm kỳ phải theo định dạng YYYY-YYYY (VD: 2026-2027)')
    .refine((s) => Number(s.slice(5)) === Number(s.slice(0, 4)) + 1, 'Năm sau phải hơn năm trước đúng 1 (VD: 2026-2027)'),
});

const kpiPoint = z.number('Điểm KPI phải là số').int('Điểm KPI phải là số nguyên').min(-100).max(100);

/** Cập nhật một phần: trường nào gửi lên mới được kiểm tra và lưu */
export const settingsUpdateSchema = z.object({
  clubName: text('tên CLB', 200).optional(),
  groupEmail: email.optional(),
  kpiOnTime: kpiPoint.optional(),
  kpiLate: kpiPoint.optional(),
  kpiPending: kpiPoint.optional(),
  kpiOverdue: kpiPoint.optional(),
  reportDayOfWeek: z.number().int().min(0, 'Ngày gửi báo cáo phải từ 0 (Chủ nhật) đến 6').max(6, 'Ngày gửi báo cáo phải từ 0 (Chủ nhật) đến 6').optional(),
  reportHour: z.number().int().min(0, 'Giờ gửi báo cáo phải từ 0 đến 23').max(23, 'Giờ gửi báo cáo phải từ 0 đến 23').optional(),
});

export const notificationPrefSchema = z.object({
  channel: z.enum(['in_app', 'in_app_email', 'digest'], { error: 'Kênh nhận thông báo không hợp lệ (in_app | in_app_email | digest)' }),
});
