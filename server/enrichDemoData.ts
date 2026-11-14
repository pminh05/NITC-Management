import { prisma } from './db';

async function enrich() {
  console.log('Enriching data...');
  
  // 1. Get key members
  const members = await prisma.member.findMany();
  const getMemId = (nameSub: string) => members.find(m => m.name.toLowerCase().includes(nameSub.toLowerCase()))?.id;
  
  const minhId = getMemId('Phạm Phúc Minh');
  const thuongId = getMemId('Trần Thị Hoài Thương');
  const tuId = getMemId('Đoàn Anh Tú');
  const duongId = getMemId('Trần Xuân Dương');
  const thuId = getMemId('Lê Ngọc Anh Thư');
  const hoangId = getMemId('Nguyễn Việt Hoàng');
  const trangId = getMemId('Trần Thị Huyền Trang');
  const hieuId = getMemId('Nguyễn Minh Hiếu');
  const myId = getMemId('Chu Hà My');
  const hoaId = getMemId('Bùi Thị Thanh Hoa');
  const tuDngId = getMemId('Hoàng Thanh Tú');
  const quynhId = getMemId('Nguyễn Thị Như Quỳnh');
  const linhId = getMemId('Đặng Khánh Linh');

  console.log('Found members:', { minhId, tuId, thuId, trangId, myId });

  // 2. Normalize all existing tasks
  const tasks = await prisma.task.findMany();
  for (const t of tasks) {
    let ids: string[] = [t.assigneeId];
    if (t.assigneeIds) {
      try {
        const p = JSON.parse(t.assigneeIds);
        if (Array.isArray(p)) {
          const clean = p.map((x: any) => typeof x === 'object' && x && x.id ? String(x.id) : String(x)).filter(Boolean);
          ids = Array.from(new Set([...ids, ...clean]));
        }
      } catch {}
    }
    await prisma.task.update({
      where: { id: t.id },
      data: { assigneeIds: JSON.stringify(ids) }
    });
  }

  // 3. Enrich specific multi-assignee tasks
  // Task: Key Visual NCD
  const kvTask = tasks.find(t => t.title.includes('key visual NCD') || t.title.includes('Key Visual'));
  if (kvTask && myId && trangId && hieuId) {
    await prisma.task.update({
      where: { id: kvTask.id },
      data: {
        assigneeId: myId,
        assigneeName: 'Chu Hà My',
        assigneeIds: JSON.stringify([myId, trangId, hieuId]),
        department: 'Truyền thông',
        status: 'in_progress',
        deadline: '2026-11-18',
        verificationType: 'link_required'
      }
    });
    console.log('Updated KV task');
  }

  // Task: Tổ chức buổi học mở màn khóa CF (Pending approval)
  const cfTask = tasks.find(t => t.title.includes('buổi học mở màn'));
  if (cfTask && thuId && hoangId) {
    await prisma.task.update({
      where: { id: cfTask.id },
      data: {
        assigneeId: thuId,
        assigneeName: 'Lê Ngọc Anh Thư',
        assigneeIds: JSON.stringify([thuId, hoangId]),
        department: 'Học thuật',
        status: 'pending_approval',
        deadline: '2026-11-18',
        verificationType: 'link_required',
        evidenceLink: 'https://drive.google.com/drive/folders/1ABC_CF_Course_Demo',
        evidenceReport: 'Đã hoàn thành buổi dạy mở màn với 45 bạn tham gia, tài liệu slide và bài tập lab đã nộp đủ trên Drive.',
        evidenceSubmittedAt: new Date(Date.now() - 3600000 * 4).toISOString()
      }
    });
    console.log('Updated CF task');
  }

  // Task: Viết caption giới thiệu talkshow tháng 12 (Pending approval)
  const capTask = tasks.find(t => t.title.includes('Viết caption giới thiệu'));
  if (capTask && quynhId) {
    await prisma.task.update({
      where: { id: capTask.id },
      data: {
        status: 'pending_approval',
        evidenceLink: 'https://docs.google.com/document/d/1DemoCaptionTalkshowDec/edit',
        evidenceReport: 'Đã hoàn thành 3 phiên bản bài viết caption kèm bộ hashtag chiến dịch và link đăng ký.',
        evidenceSubmittedAt: new Date(Date.now() - 3600000 * 2).toISOString()
      }
    });
    console.log('Updated Caption task');
  }

  // Task: Chuẩn bị phòng học CF cho buổi 2 (Pending approval)
  const roomTask = tasks.find(t => t.title.includes('Chuẩn bị phòng học'));
  if (roomTask) {
    await prisma.task.update({
      where: { id: roomTask.id },
      data: {
        status: 'pending_approval',
        verificationType: 'report_required',
        evidenceReport: 'Đã hoàn tất thủ tục mượn giảng đường B201, kiểm tra hệ thống wifi trường, máy chiếu và micro hoạt động ổn định.',
        evidenceSubmittedAt: new Date(Date.now() - 3600000 * 6).toISOString()
      }
    });
    console.log('Updated Room task');
  }

  // Task: Dọn dẹp và trang trí kho đồ Sự kiện (Multi-assignee)
  const khoTask = tasks.find(t => t.title.includes('Dọn dẹp và trang trí kho đồ'));
  if (khoTask && tuId && duongId) {
    await prisma.task.update({
      where: { id: khoTask.id },
      data: {
        assigneeId: tuId,
        assigneeName: 'Đoàn Anh Tú',
        assigneeIds: JSON.stringify([tuId, duongId, linhId].filter(Boolean)),
        department: 'Sự kiện',
        status: 'in_progress',
        deadline: '2026-11-20'
      }
    });
    console.log('Updated Kho task');
  }

  // Task: Họp ekip chốt chương trình talkshow (Multi-assignee)
  const ekipTask = tasks.find(t => t.title.includes('Họp ekip'));
  if (ekipTask && tuId && duongId) {
    await prisma.task.update({
      where: { id: ekipTask.id },
      data: {
        assigneeId: tuId,
        assigneeName: 'Đoàn Anh Tú',
        assigneeIds: JSON.stringify([tuId, duongId]),
        department: 'Sự kiện',
        status: 'in_progress',
        deadline: '2026-11-21'
      }
    });
    console.log('Updated Ekip task');
  }

  // Task: Brainstorm ý tưởng nội dung tháng 12 (Multi-assignee)
  const bsTask = tasks.find(t => t.title.includes('Brainstorm ý tưởng'));
  if (bsTask && trangId && myId && hieuId) {
    await prisma.task.update({
      where: { id: bsTask.id },
      data: {
        assigneeId: trangId,
        assigneeName: 'Trần Thị Huyền Trang',
        assigneeIds: JSON.stringify([trangId, myId, hieuId]),
        department: 'Truyền thông',
        status: 'in_progress',
        deadline: '2026-11-23'
      }
    });
    console.log('Updated Brainstorm task');
  }

  // Overdue tasks: ensure 4 overdue tasks for demo
  const bdTask = tasks.find(t => t.title.includes('backdrop NCD'));
  if (bdTask && myId) {
    await prisma.task.update({
      where: { id: bdTask.id },
      data: {
        assigneeId: myId,
        assigneeName: 'Chu Hà My',
        assigneeIds: JSON.stringify([myId]),
        status: 'overdue',
        deadline: '2026-11-10'
      }
    });
  }

  const giftTask = tasks.find(t => t.title.includes('Chốt ngân sách quà'));
  if (giftTask && tuId) {
    await prisma.task.update({
      where: { id: giftTask.id },
      data: {
        assigneeId: tuId,
        assigneeName: 'Đoàn Anh Tú',
        assigneeIds: JSON.stringify([tuId]),
        status: 'overdue',
        deadline: '2026-11-09'
      }
    });
  }

  const formTask = tasks.find(t => t.title.includes('form đăng ký tuyển'));
  if (formTask) {
    await prisma.task.update({
      where: { id: formTask.id },
      data: {
        status: 'overdue',
        deadline: '2026-11-11'
      }
    });
  }

  console.log('Data enrichment completed successfully!');
}

enrich()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

