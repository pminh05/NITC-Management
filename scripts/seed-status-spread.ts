// Thêm công việc đã xong (xanh) + chờ duyệt (vàng) trải khắp tháng 11
// để lịch tổng hiển thị đủ cả 4 thẻ trạng thái
import 'dotenv/config';
import { prisma } from '../server/db';

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
  const byName = (n: string) => prisma.member.findFirst({ where: { name: n } });
  const HAMY = await byName('Chu Hà My');
  const QUYNH = await byName('Nguyễn Thị Như Quỳnh');
  const LINH = await byName('Đặng Khánh Linh');
  const DUONG = await byName('Trần Xuân Dương');
  const ANHTU = await byName('Đoàn Anh Tú');
  const NVA = await byName('Nguyễn Việt Hoàng');

  const taskDefs = [
    // --- ĐÃ XONG (chấm xanh lá) trải các ngày trong tháng ---
    { title: 'Thiết kế lại avatar mới cho fanpage', dept: 'Truyền thông', m: HAMY, deadline: d(3), submitted: d(4), status: 'completed', evidence: 'https://drive.google.com/file/avatar-fanpage', note: 'Avatar mới đúng concept, đã thay trên fanpage.' },
    { title: 'Chuẩn bị bộ đề thi thử cho khóa CF', dept: 'Học thuật', m: NVA, deadline: d(5), submitted: d(5), status: 'completed', evidence: 'https://drive.google.com/file/dethi-cf', note: 'Đề thi thử 60 phút, có barem.' },
    { title: 'Liên hệ in ấn standee quảng cáo', dept: 'Sự kiện', m: DUONG, deadline: d(8), submitted: d(7), status: 'completed', evidence: '', report: 'Đã chốt xưởng in, standee nhận trước 3 ngày sự kiện.', note: 'Chốt giá tốt hơn dự toán.' },
    { title: 'Tổng hợp khảo sát ekip talkshow', dept: 'Sự kiện', m: ANHTU, deadline: d(13), submitted: d(12), status: 'completed', evidence: 'https://docs.google.com/spreadsheets/d/khao-sat-ekip', note: 'Bảng khảo sát đầy đủ 12 thành viên ekip.' },
    { title: 'Chỉnh sửa logo đợt tuyển Gen 8', dept: 'Truyền thông', m: HAMY, deadline: d(17), submitted: d(18), status: 'completed', evidence: 'https://drive.google.com/file/logo-gen8', note: 'Logo Gen 8 Concept "Quỹ đạo" rất ổn!' },
    { title: 'Cập nhật danh bạ đối tác quý 4', dept: 'Đối ngoại', m: ANHTU, deadline: d(20), submitted: d(19), status: 'completed', evidence: 'https://docs.google.com/spreadsheets/d/doitac-q4', note: 'Thêm 4 đối tác mới, tổng 22 contacts.' },
    // --- CHỜ DUYỆT (chấm vàng) ---
    { title: 'Viết caption giới thiệu talkshow tháng 12', dept: 'Truyền thông', m: QUYNH, deadline: d(1), submitted: iso(0, 9), status: 'pending_approval', evidence: 'https://docs.google.com/document/d/caption-talkshow' },
    { title: 'Dọn dẹp và sắp xếp kho đồ CLB', dept: 'Sự kiện', m: DUONG, deadline: d(4), submitted: iso(0, 15), status: 'pending_approval', evidence: '', report: 'Kho đồ đã dọn xong, phân loại 3 thùng theo mức sử dụng.' },
    { title: 'Chuẩn bị phòng học CF cho buổi 2', dept: 'Học thuật', m: LINH, deadline: d(7), submitted: iso(-1, 16), status: 'pending_approval', evidence: '', report: 'Đã đặt phòng C3-302 và kiểm tra máy chiếu hoạt động tốt.' },
    { title: 'Chụp ảnh sản phẩm quà tài trợ', dept: 'Đối ngoại', m: ANHTU, deadline: d(12), submitted: iso(0, 11), status: 'pending_approval', evidence: 'https://drive.google.com/file/quataitro' },
  ];

  let added = 0;
  for (const t of taskDefs) {
    const exists = await prisma.task.findFirst({ where: { title: t.title } });
    if (exists) continue;
    if (!t.m) continue;
    const completed = t.status === 'completed';
    await prisma.task.create({
      data: {
        title: t.title,
        description: 'Công việc định kỳ của ban — phân công từ biên bản họp.',
        assigneeId: t.m.id,
        assigneeName: t.m.name,
        assigneeIds: JSON.stringify([t.m.id]),
        department: t.dept,
        deadline: t.deadline,
        status: t.status,
        verificationType: t.evidence ? 'link_required' : 'report_required',
        evidenceLink: t.evidence || null,
        evidenceReport: t.report || null,
        evidenceSubmittedAt: t.submitted ? new Date(t.submitted).toISOString() : null,
        approvalNote: completed ? t.note || null : null,
        priority: 'medium',
      },
    });
    added++;
  }
  console.log(`Đã thêm ${added} công việc (6 đã xong + 4 chờ duyệt trải khắp tháng 11)`);
  const counts = {
    completed: await prisma.task.count({ where: { status: 'completed' } }),
    pending: await prisma.task.count({ where: { status: 'pending_approval' } }),
    total: await prisma.task.count(),
  };
  console.log('Hiện trạng:', counts);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
