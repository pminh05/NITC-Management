import { jsPDF } from 'jspdf';
import { Meeting, Task } from '../types';
import { formatDateVN } from './dateUtils';

export function exportMeetingToPdf(meeting: Meeting, tasks: Task[] = []): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header - Quốc hiệu / Tên CLB
  doc.setFontSize(10);
  doc.text('CÂU LẠC BỘ CÔNG NGHỆ THÔNG TIN NITC', 20, y);
  doc.text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', pageWidth - 20, y, { align: 'right' });
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('BAN ĐIỀU HÀNH CLB', 20, y);
  doc.setFont('helvetica', 'normal');
  doc.text('Độc lập - Tự do - Hạnh phúc', pageWidth - 20, y, { align: 'right' });
  y += 4;

  doc.setDrawColor(180, 180, 180);
  doc.line(20, y, 70, y);
  doc.line(pageWidth - 70, y, pageWidth - 20, y);
  y += 12;

  // Tiêu đề BBH
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('BIÊN BẢN HỌP BAN ĐIỀU HÀNH', pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'italic');
  doc.text(meeting.title || 'Biên bản cuộc họp', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Thông tin chung
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`1. Thời gian: Ngày ${formatDateVN(meeting.date)}`, 20, y);
  y += 6;
  doc.text(`2. Chủ trì: ${meeting.chairperson || 'Lê Hồng Phúc Minh'}    |    Thư ký: ${meeting.secretary || 'Nguyễn Thị Ngọc Ánh'}`, 20, y);
  y += 6;
  doc.text(`3. Thành phần tham dự:`, 20, y);
  y += 5;
  doc.text(`- Có mặt: ${meeting.attendees?.join(', ') || 'Đầy đủ'}`, 25, y);
  y += 5;
  doc.text(`- Vắng mặt: ${meeting.absentees?.length ? meeting.absentees.join(', ') : 'Không có'}`, 25, y);
  y += 8;

  // Thảo luận
  doc.setFont('helvetica', 'bold');
  doc.text('4. Tóm tắt nội dung thảo luận:', 20, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  const splitDiscussion = doc.splitTextToSize(meeting.discussionSummary || 'Nội dung thảo luận các ban...', pageWidth - 40);
  doc.text(splitDiscussion, 25, y);
  y += splitDiscussion.length * 5 + 4;

  // Danh sách công việc
  doc.setFont('helvetica', 'bold');
  doc.text('5. Phân công nhiệm vụ & Hạn chót:', 20, y);
  y += 6;

  const meetingTasks = tasks.filter(t => t.sourceMeetingId === meeting.id || !t.sourceMeetingId);
  const tasksToRender = meetingTasks.length > 0 ? meetingTasks : [];

  if (tasksToRender.length === 0 && meeting.actionPlan) {
    const splitPlan = doc.splitTextToSize(meeting.actionPlan, pageWidth - 40);
    doc.setFont('helvetica', 'normal');
    doc.text(splitPlan, 25, y);
    y += splitPlan.length * 5 + 6;
  } else {
    doc.setFontSize(9);
    tasksToRender.forEach((task, idx) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`${idx + 1}. [${task.department}] ${task.title}`, 22, y);
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      const verText = task.verificationType === 'link_required' ? 'Yêu cầu nộp Link' : 'Yêu cầu nộp Báo cáo';
      const statusText = task.status === 'completed' ? 'Đã hoàn thành' : task.status === 'pending_approval' ? 'Chờ duyệt' : 'Đang làm';
      doc.text(`   Phụ trách: ${task.assigneeName}  |  Hạn chót: ${formatDateVN(task.deadline)}  |  Xác minh: ${verText}  |  Trạng thái: ${statusText}`, 22, y);
      y += 5.5;
    });
  }

  y += 10;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  // Chữ ký
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('THƯ KÝ CUỘC HỌP', 40, y, { align: 'center' });
  doc.text('CHỦ TỊCH CLB NITC', pageWidth - 40, y, { align: 'center' });
  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.text(meeting.secretary || 'Nguyễn Thị Ngọc Ánh', 40, y, { align: 'center' });
  doc.text(meeting.chairperson || 'Lê Hồng Phúc Minh', pageWidth - 40, y, { align: 'center' });

  // Save PDF
  const filename = `BBH-NITC-${meeting.date || 'meeting'}.pdf`;
  doc.save(filename);
}
