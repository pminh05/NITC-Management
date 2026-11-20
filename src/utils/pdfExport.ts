import { jsPDF } from 'jspdf';
import { Meeting, Task } from '../types';
import { formatDateVN } from './dateUtils';

// Phông chuẩn của jsPDF (Helvetica) không có chữ tiếng Việt có dấu, nên phải nhúng phông Unicode.
// Noto Serif (giấy phép SIL OFL 1.1, xem public/fonts/OFL-NotoSerif.txt) được tải từ /fonts khi xuất lần đầu rồi giữ lại.
const FONT = 'NotoSerif';
const FONT_FILES: Record<'normal' | 'bold' | 'italic', string> = {
  normal: 'NotoSerif-Regular.ttf',
  bold: 'NotoSerif-Bold.ttf',
  italic: 'NotoSerif-Italic.ttf',
};
let fontCache: Promise<Record<string, string>> | null = null;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function loadFonts(): Promise<Record<string, string>> {
  if (!fontCache) {
    fontCache = Promise.all(
      Object.entries(FONT_FILES).map(async ([style, file]) => {
        const res = await fetch(`/fonts/${file}`);
        if (!res.ok) throw new Error(`Không tải được phông ${file}`);
        return [style, toBase64(await res.arrayBuffer())] as const;
      })
    ).then((pairs) => Object.fromEntries(pairs));
    fontCache.catch(() => {
      fontCache = null; // lần sau thử tải lại
    });
  }
  return fontCache;
}

export async function exportMeetingToPdf(meeting: Meeting, tasks: Task[] = []): Promise<void> {
  const fonts = await loadFonts();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  for (const [style, file] of Object.entries(FONT_FILES)) {
    doc.addFileToVFS(file, fonts[style]);
    doc.addFont(file, FONT, style);
  }
  doc.setFont(FONT, 'normal');

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header - Quốc hiệu / Tên CLB
  doc.setFontSize(10);
  doc.text('CÂU LẠC BỘ CÔNG NGHỆ THÔNG TIN NITC', 20, y);
  doc.text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', pageWidth - 20, y, { align: 'right' });
  y += 5;

  doc.setFont(FONT, 'bold');
  doc.text('BAN ĐIỀU HÀNH CLB', 20, y);
  doc.setFont(FONT, 'normal');
  doc.text('Độc lập - Tự do - Hạnh phúc', pageWidth - 20, y, { align: 'right' });
  y += 4;

  doc.setDrawColor(180, 180, 180);
  doc.line(20, y, 70, y);
  doc.line(pageWidth - 70, y, pageWidth - 20, y);
  y += 12;

  // Tiêu đề BBH
  doc.setFont(FONT, 'bold');
  doc.setFontSize(14);
  doc.text('BIÊN BẢN HỌP BAN ĐIỀU HÀNH', pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(11);
  doc.setFont(FONT, 'italic');
  doc.text(meeting.title || 'Biên bản cuộc họp', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Thông tin chung
  doc.setFont(FONT, 'normal');
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
  doc.setFont(FONT, 'bold');
  doc.text('4. Tóm tắt nội dung thảo luận:', 20, y);
  y += 5;
  doc.setFont(FONT, 'normal');
  const splitDiscussion = doc.splitTextToSize(meeting.discussionSummary || 'Nội dung thảo luận các ban...', pageWidth - 40);
  doc.text(splitDiscussion, 25, y);
  y += splitDiscussion.length * 5 + 4;

  // Danh sách công việc
  doc.setFont(FONT, 'bold');
  doc.text('5. Phân công nhiệm vụ & Hạn chót:', 20, y);
  y += 6;

  const meetingTasks = tasks.filter(t => t.sourceMeetingId === meeting.id || !t.sourceMeetingId);
  const tasksToRender = meetingTasks.length > 0 ? meetingTasks : [];

  if (tasksToRender.length === 0 && meeting.actionPlan) {
    const splitPlan = doc.splitTextToSize(meeting.actionPlan, pageWidth - 40);
    doc.setFont(FONT, 'normal');
    doc.text(splitPlan, 25, y);
    y += splitPlan.length * 5 + 6;
  } else {
    doc.setFontSize(9);
    tasksToRender.forEach((task, idx) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFont(FONT, 'bold');
      doc.text(`${idx + 1}. [${task.department}] ${task.title}`, 22, y);
      y += 4.5;
      doc.setFont(FONT, 'normal');
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
  doc.setFont(FONT, 'bold');
  doc.text('THƯ KÝ CUỘC HỌP', 40, y, { align: 'center' });
  doc.text('CHỦ NHIỆM CLB NITC', pageWidth - 40, y, { align: 'center' });
  y += 20;
  doc.setFont(FONT, 'normal');
  doc.text(meeting.secretary || 'Nguyễn Thị Ngọc Ánh', 40, y, { align: 'center' });
  doc.text(meeting.chairperson || 'Lê Hồng Phúc Minh', pageWidth - 40, y, { align: 'center' });

  // Save PDF
  const filename = `BBH-NITC-${meeting.date || 'meeting'}.pdf`;
  doc.save(filename);
}
