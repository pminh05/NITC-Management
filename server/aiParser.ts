import { Request, Response } from 'express';
import OpenAI from 'openai';

// AI BBH Parser (OpenAI — structured JSON output) + fallback heuristic theo quy tắc nghiệp vụ NITC

let aiClient: OpenAI | null = null;
function getAIClient(): OpenAI | null {
  if (!aiClient && process.env.OPENAI_API_KEY) {
    aiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return aiClient;
}

// Bỏ dấu tiếng Việt để so khớp tiêu đề mục (dùng trong heuristic parser)
function stripAccents(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Helper for heuristic fallback date calculation
function calculateFallbackDate(baseDateStr: string, relativeText: string): string {
  const base = new Date(baseDateStr || new Date().toISOString().split('T')[0]);
  const lower = relativeText.toLowerCase();

  if (lower.includes('ngày mai') || lower.includes('ngay mai')) {
    base.setDate(base.getDate() + 1);
  } else if (lower.includes('3 ngày') || lower.includes('3 ngay')) {
    base.setDate(base.getDate() + 3);
  } else if (lower.includes('thứ hai') || lower.includes('thu hai') || lower.includes('thứ 2')) {
    const currentDay = base.getDay(); // 0 is Sunday, 1 is Monday
    const daysUntilMonday = (8 - currentDay) % 7 || 7;
    base.setDate(base.getDate() + daysUntilMonday);
  } else if (lower.includes('thứ sáu') || lower.includes('thu sau') || lower.includes('thứ 6')) {
    const currentDay = base.getDay();
    const daysUntilFriday = (5 - currentDay + 7) % 7 || 7;
    base.setDate(base.getDate() + daysUntilFriday);
  } else if (lower.includes('chủ nhật') || lower.includes('chu nhat')) {
    const currentDay = base.getDay();
    const daysUntilSunday = (7 - currentDay) % 7 || 7;
    base.setDate(base.getDate() + daysUntilSunday);
  } else if (lower.includes('tuần sau') || lower.includes('tuan sau')) {
    base.setDate(base.getDate() + 7);
  } else {
    // try to match YYYY-MM-DD or DD/MM/YYYY
    const matchSlash = relativeText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (matchSlash) {
      return `${matchSlash[3]}-${matchSlash[2].padStart(2, '0')}-${matchSlash[1].padStart(2, '0')}`;
    }
    const matchDash = relativeText.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (matchDash) {
      return matchDash[0];
    }
    base.setDate(base.getDate() + 5); // default 5 days
  }

  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Fallback heuristic parser if Gemini API key is unavailable or fails
function fallbackParseBBH(bbhText: string, members: any[], meetingDateStr: string) {
  const lines = bbhText.split('\n').map((l) => l.trim()).filter(Boolean);

  let title = 'Họp Ban Điều hành NITC';
  let date = meetingDateStr || new Date().toISOString().split('T')[0];
  let chairperson = 'Phạm Phúc Minh';
  let secretary = '';
  const attendees: string[] = [];
  const absentees: string[] = [];
  const latecomers: string[] = [];
  const discussionLines: string[] = [];
  const actionLines: string[] = [];

  let currentSection = '';

  for (const line of lines) {
    const lower = line.toLowerCase();
    const isSignatureLine = lower.includes('lập biên bản') || lower.includes('lap bien ban');
    const looksLikeTitle = (lower.includes('bbh') || lower.includes('biên bản')) &&
      !isSignatureLine && !lower.includes(':') && line.length <= 80;
    if (looksLikeTitle) {
      const candidate = line.replace(/^[#\-\*\d\.\s]+/, '').trim();
      // Ưu tiên dòng có "BBH"; nếu tiêu đề hiện tại đã có "BBH" thì không hạ cấp bằng dòng thường
      if (candidate && !(candidate.length > 0 && /biên bản họp ban điều hành nitc/i.test(candidate) && title.toLowerCase().includes('bbh'))) {
        title = candidate.replace(/BBH/g, 'Họp');
      }
    }
    // Dòng chữ ký "Người lập biên bản" -> bắt đầu phần ký tên, ngưng thu thập nội dung
    if (isSignatureLine) {
      currentSection = 'signature';
      continue;
    }
    if (currentSection === 'signature') {
      // Dòng không trống đầu tiên sau chữ ký là tên người lập biên bản
      if (!secretary && !/^[\d\.\-\s]*$/.test(line)) {
        secretary = line.trim();
      }
      continue;
    }
    if (lower.includes('ngày') && lower.includes('thời gian')) {
      const dateMatch = line.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (dateMatch) {
        date = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
      }
    }
    if (lower.includes('chủ trì:') || lower.includes('chu tri:')) {
      chairperson = line.split(':')[1]?.trim() || chairperson;
    }
    if (lower.includes('thư ký:') || lower.includes('thu ky:')) {
      secretary = line.split(':')[1]?.trim() || secretary;
    }
    if (lower.includes('có mặt:') || lower.includes('co mat:')) {
      const names = line.split(':')[1]?.split(/[,;]/).map((n) => n.trim()).filter(Boolean) || [];
      attendees.push(...names);
    }
    if (lower.includes('vắng mặt:') || lower.includes('vang mat:') || lower.includes('vắng:')) {
      const names = line.split(':')[1]?.split(/[,;]/).map((n) => n.trim()).filter(Boolean) || [];
      absentees.push(...names);
    }
    // Template BBH thật NITC: mục "Muộn: 1 (Thanh Tú)"
    if (lower.includes('muộn:')) {
      const raw = line.split(':')[1] || '';
      const names = raw.match(/\(([^)]+)\)/)?.[1]?.split(/[,;]/).map((n) => n.trim()).filter(Boolean) || [];
      latecomers.push(...names);
    }
    // Mục "DEADLINES" (template thật) cũng là khu vực công việc
    if (lower.includes('deadlines')) {
      currentSection = 'action';
      continue;
    }
    // Mục "Kế hoạch sắp tới" (template thật) — các việc sắp tới cũng là đầu việc
    if (stripAccents(lower).includes('ke hoach sap toi')) {
      currentSection = 'action';
      continue;
    }

    if (lower.includes('3. nội dung thảo luận') || lower.includes('thảo luận:')) {
      currentSection = 'discussion';
      continue;
    }
    if (lower.includes('4. kế hoạch') || lower.includes('phân công công việc') || lower.includes('kế hoạch:')) {
      currentSection = 'action';
      continue;
    }

    if (currentSection === 'discussion') {
      discussionLines.push(line);
    } else if (currentSection === 'action') {
      actionLines.push(line);
    }
  }

  // Parse action lines into draft tasks (bỏ nhãn mục trống / dòng rác của template)
  const junkPatterns = [
    /^chung:?\s*$/i,
    /^tưng việc:?\s*$/i,
    /^all:?\s*$/i,
    /^ban (học thuật|truyền thông|sự kiện|đối ngoại):?\s*$/i,
  ];
  const cleanedActionLines = actionLines.filter((l) => {
    const stripped = l.replace(/^[#\-\*\d\.\s]+/, '').trim();
    if (!stripped) return false;
    if (junkPatterns.some((re) => re.test(stripped))) return false;
    return true;
  });
  const rawTasks = cleanedActionLines.length > 0 ? cleanedActionLines : lines.filter(l => /^\d+[\.\)]/.test(l));

  const extractedTasks = rawTasks.map((taskLine, idx) => {
    const cleanLine = taskLine.replace(/^\d+[\.\)]\s*/, '').trim();

    // Check deadline pattern: Deadline: ... or Hạn chót: ...
    let rawDeadline = 'Thứ Hai tới';
    let cleanTitle = cleanLine;
    const deadlineMatch = cleanLine.match(/(?:deadline|hạn chót|thời hạn|hạn)[:\s]+([^.]+)/i);
    if (deadlineMatch) {
      rawDeadline = deadlineMatch[1].trim();
      cleanTitle = cleanLine.replace(/(?:deadline|hạn chót|thời hạn|hạn)[:\s]+[^.]+/i, '').trim();
    }

    const calculatedDeadline = calculateFallbackDate(date, rawDeadline);

    // Check verification type
    const lowerClean = cleanTitle.toLowerCase();
    const isLink =
      lowerClean.includes('thiết kế') ||
      lowerClean.includes('banner') ||
      lowerClean.includes('poster') ||
      lowerClean.includes('form') ||
      lowerClean.includes('slide') ||
      lowerClean.includes('tài liệu') ||
      lowerClean.includes('đề thi') ||
      lowerClean.includes('link') ||
      lowerClean.includes('bộ ảnh') ||
      lowerClean.includes('frame') ||
      lowerClean.includes('sheet');
    const verificationType = isLink ? 'link_required' : 'report_required';

    // Check department / assignee
    let rawAssigneeText = 'Ban Điều Hành';
    let suggestedDepartment = 'Ban Chủ nhiệm';
    let suggestedAssigneeId = '';
    let suggestedAssigneeName = '';
    let hasAmbiguity = false;
    let ambiguityMatches: any[] = [];
    let isAbsentee = false;
    let warningMessages: string[] = [];

    // Department match
    if (lowerClean.includes('ban truyền thông') || lowerClean.includes('truyền thông')) {
      suggestedDepartment = 'Truyền thông';
      const head = members.find((m) => m.department === 'Truyền thông' && m.role === 'Trưởng ban');
      if (head) {
        suggestedAssigneeId = head.id;
        suggestedAssigneeName = head.name;
        rawAssigneeText = 'Ban Truyền thông (Gán Trưởng ban ' + head.name + ')';
      }
    } else if (lowerClean.includes('ban sự kiện') || lowerClean.includes('sự kiện')) {
      suggestedDepartment = 'Sự kiện';
      const head = members.find((m) => m.department === 'Sự kiện' && m.role === 'Trưởng ban');
      if (head) {
        suggestedAssigneeId = head.id;
        suggestedAssigneeName = head.name;
        rawAssigneeText = 'Ban Sự kiện (Gán Trưởng ban ' + head.name + ')';
      }
    } else if (lowerClean.includes('ban học thuật') || lowerClean.includes('học thuật')) {
      suggestedDepartment = 'Học thuật';
      const head = members.find((m) => m.department === 'Học thuật' && m.role === 'Trưởng ban');
      if (head) {
        suggestedAssigneeId = head.id;
        suggestedAssigneeName = head.name;
        rawAssigneeText = 'Ban Học thuật (Gán Trưởng ban ' + head.name + ')';
      }
    } else if (lowerClean.includes('ban đối ngoại') || lowerClean.includes('đối ngoại')) {
      suggestedDepartment = 'Đối ngoại';
      const head = members.find((m) => m.department === 'Đối ngoại' && m.role === 'Trưởng ban');
      if (head) {
        suggestedAssigneeId = head.id;
        suggestedAssigneeName = head.name;
        rawAssigneeText = 'Ban Đối ngoại (Gán Trưởng ban ' + head.name + ')';
      }
    }

    // Check specific person names
    for (const member of members) {
      if (cleanTitle.toLowerCase().includes(member.name.toLowerCase())) {
        suggestedAssigneeId = member.id;
        suggestedAssigneeName = member.name;
        suggestedDepartment = member.department;
        rawAssigneeText = member.name;
        break;
      }
    }

    // Check "Minh" ambiguity rule: If line has standalone "Minh"
    const words = cleanTitle.split(/\s+/);
    const hasStandaloneMinh = words.some((w) => w.toLowerCase() === 'minh' || w.toLowerCase() === 'minh,' || w.toLowerCase() === 'minh:');
    if (hasStandaloneMinh && !suggestedAssigneeId) {
      const minhMatches = members.filter((m) => m.name.toLowerCase().includes('minh'));
      if (minhMatches.length > 1) {
        hasAmbiguity = true;
        ambiguityMatches = minhMatches;
        rawAssigneeText = 'Minh (Phát hiện trùng tên nhiều thành viên)';
        suggestedAssigneeId = '';
        suggestedAssigneeName = '';
        warningMessages.push('⚠️ Quy tắc "Minh": Trùng tên với nhiều thành viên. Vui lòng chọn chính xác người phụ trách.');
      }
    }

    // Check Absentee Warning
    const personToCheck = suggestedAssigneeName || rawAssigneeText;
    for (const abs of absentees) {
      if (personToCheck && (abs.toLowerCase().includes(personToCheck.toLowerCase()) || personToCheck.toLowerCase().includes(abs.toLowerCase()))) {
        isAbsentee = true;
        warningMessages.push(`🚨 Cảnh báo vắng mặt: ${personToCheck} nằm trong danh sách VẮNG HỌP của biên bản này!`);
        break;
      }
    }

    return {
      tempId: `draft-${Date.now()}-${idx}`,
      title: cleanTitle,
      rawAssigneeText,
      suggestedAssigneeId,
      suggestedAssigneeName,
      suggestedDepartment,
      rawDeadlinetext: rawDeadline,
      suggestedDeadline: calculatedDeadline,
      verificationType,
      hasAmbiguity,
      ambiguityMatches,
      isAbsentee,
      warningMessages,
      approved: true,
      priority: 'high',
      reasoning: 'Heuristic parsing & NITC business rules matching',
    };
  });

  return {
    meeting: {
      title,
      date,
      chairperson,
      secretary,
      attendees,
      absentees,
      discussionSummary: discussionLines.join('\n') || 'Đã tổng hợp nội dung thảo luận các ban.',
      actionPlan: actionLines.join('\n') || rawTasks.join('\n'),
    },
    tasks: extractedTasks,
  };
}

/**
 * G6.5: Nhận link Google Docs/Sheets (chia sẻ "Anyone with the link can view")
 * -> tải trực tiếp nội dung văn bản/CSV qua link export của Google (không cần API/OAuth).
 */
export function extractGoogleDocId(url: string): { kind: 'doc' | 'sheet'; id: string } | null {
  const doc = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (doc) return { kind: 'doc', id: doc[1] };
  const sheet = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheet) return { kind: 'sheet', id: sheet[1] };
  return null;
}

export async function fetchGoogleDocText(url: string): Promise<string> {
  const parsed = extractGoogleDocId(url);
  if (!parsed) {
    throw new Error('LINK_INVALID');
  }
  const exportUrl =
    parsed.kind === 'doc'
      ? `https://docs.google.com/document/d/${parsed.id}/export?format=txt`
      : `https://docs.google.com/spreadsheets/d/${parsed.id}/gviz/tq?tqx=out:csv`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(exportUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (NITC Command Center)' },
    });
    const contentType = res.headers.get('content-type') || '';
    const body = await res.text();
    // Google trả HTML (trang đăng nhập/nội dung rỗng) khi tài liệu chưa công khai
    if (!res.ok || contentType.includes('text/html') || body.trim().startsWith('<!DOCTYPE html')) {
      throw new Error('NOT_PUBLIC');
    }
    return body;
  } catch (e: any) {
    if (e.message === 'NOT_PUBLIC' || e.message === 'LINK_INVALID') throw e;
    if (e.name === 'AbortError') throw new Error('TIMEOUT');
    throw new Error('FETCH_FAILED');
  } finally {
    clearTimeout(timer);
  }
}

export async function parseBBHHandler(req: Request, res: Response) {
  const { bbhText: rawText, images, pdf, docUrl, members, meetingDate } = req.body;

  // Chế độ LINK: tải nội dung Google Docs/Sheets công khai thành văn bản
  let bbhText: string | undefined = typeof rawText === 'string' ? rawText : undefined;
  if (typeof docUrl === 'string' && docUrl.trim()) {
    try {
      bbhText = await fetchGoogleDocText(docUrl.trim());
      console.log(`Loaded Google doc content: ${bbhText.length} chars from ${docUrl}`);
    } catch (e: any) {
      const messages: Record<string, string> = {
        LINK_INVALID: 'Đây không phải link Google Docs/Sheets hợp lệ. Dán link dạng https://docs.google.com/document/d/...',
        NOT_PUBLIC: 'Chưa đọc được tài liệu. Hãy mở tài liệu -> Chia sẻ -> chọn "Anyone with the link" (Anyone with the link can view) rồi thử lại.',
        TIMEOUT: 'Tải tài liệu quá lâu (hết 20 giây). Thử lại sau.',
        FETCH_FAILED: 'Không kết nối được Google Docs. Kiểm tra link/mạng rồi thử lại.',
      };
      return res.status(400).json({ error: messages[e.message] || 'Không đọc được tài liệu từ link đã dán.' });
    }
  }

  // Đầu vào: văn bản HOẶC ảnh (mảng data URL) HOẶC PDF (data URL)
  const imageList: string[] = Array.isArray(images)
    ? images.filter((x: any) => typeof x === 'string' && x.startsWith('data:image/'))
    : [];
  const pdfData: string | null = typeof pdf === 'string' && pdf.startsWith('data:application/pdf') ? pdf : null;
  const hasText = typeof bbhText === 'string' && bbhText.trim().length > 0;
  const hasFile = imageList.length > 0 || !!pdfData;

  if (!hasText && !hasFile) {
    return res.status(400).json({ error: 'Vui lòng dán nội dung hoặc đính kèm ảnh/PDF biên bản họp' });
  }

  const memberList = Array.isArray(members) ? members : [];
  const ai = getAIClient();

  if (!ai) {
    if (hasFile) {
      return res.status(400).json({
        error: 'Đọc biên bản từ ảnh/PDF cần OPENAI_API_KEY. Hãy cấu hình key trong .env rồi khởi động lại server (hoặc dùng tab Dán văn bản).',
      });
    }
    console.log('Using local heuristic parser (No OPENAI_API_KEY provided)');
    const fallbackResult = fallbackParseBBH(bbhText, memberList, meetingDate);
    return res.json(fallbackResult);
  }

  try {
    const memberContext = memberList
      .map((m: any) => `- ID: ${m.id} | Họ tên: ${m.name} | Ban: ${m.department} | Vai trò: ${m.role}`)
      .join('\n');

    const prompt = `Bạn là Trợ lý AI Điều hành cao cấp của NITC Command Center — hệ thống quản trị CLB Công nghệ thông tin ĐH Kinh tế Quốc dân.
Phân tích Biên bản họp (BBH) dưới đây theo đúng cấu trúc chuẩn NITC (4 mục I-IV) và quy tắc nghiệp vụ nghiêm ngặt.

DANH SÁCH THÀNH VIÊN HIỆN TẠI (ROSTER — gồm Chủ nhiệm, Phó Chủ nhiệm, Trưởng ban, Phó ban, Thành viên):
${memberContext}

NGÀY HỌP MẶC ĐỊNH (nếu biên bản không ghi rõ): ${meetingDate || new Date().toISOString().split('T')[0]}

NGUỒN BIÊN BẢN:
${
  hasFile
    ? (pdfData ? '- Một tệp PDF chứa biên bản họp (đính kèm trong tin nhắn). ' : '') +
      (imageList.length > 0 ? `- ${imageList.length} ảnh chụp biên bản họp (đính kèm, có thể nhiều trang, chụp lệch hoặc nhòe). ` : '') +
      'Hãy TỰ ĐỌC (OCR) toàn bộ nội dung biên bản từ tài liệu đính kèm — kể cả chữ in nhỏ và chữ viết tay nếu rõ ràng — rồi phân tích theo các quy tắc dưới đây.'
    : `VĂN BẢN BIÊN BẢN HỌP:
"""
${bbhText}
"""`
}

CẤU TRÚC BBH CHUẨN NITC:
- Mục I: THỜI GIAN, ĐỊA ĐIỂM, THÀNH PHẦN THAM GIA (Có mặt/Tổng — Vắng — Muộn)
- Mục II: MỤC TIÊU BUỔI HỌP
- Mục III: NỘI DUNG CHÍNH (Báo cáo từng ban — Thảo luận — Kế hoạch sắp tới)
- Mục IV: DEADLINES (các đầu việc kèm hạn chót)
- Cuối: Người lập biên bản (= thư ký)

QUY TẮC TRÍCH XUẤT BẮT BUỘC:
1. THÔNG TIN HỌP (meeting):
   - title: tiêu đề/loại biên bản (VD: "Họp BCN tuần 45" — không dùng viết tắt BBH, hoặc tự đặt ngắn gọn nếu không có)
   - date: ngày họp chuẩn YYYY-MM-DD (quy đổi từ "Thứ Hai 3/11/2026" theo tuần thực tế)
   - chairperson: người chủ trì (thường là Chủ nhiệm/Phó Chủ nhiệm — so khớp Roster)
   - secretary: "Người lập biên bản" cuối biên bản
   - attendees: tên có mặt (mục "Có mặt"/"Tổng")
   - absentees: mục "Vắng"
   - latecomers: mục "Muộn" (VD: "Muộn: 1 (Thanh Tú)" -> ["Thanh Tú"]) — rỗng nếu không ghi
   - objectives: nội dung mục II "MỤC TIÊU BUỔI HỌP" (tóm tắt 1-3 câu nếu dài)
   - discussionSummary: tóm tắt mục III (Báo cáo từng ban + Thảo luận + Kế hoạch sắp tới)
   - actionPlan: nội dung mục IV "DEADLINES" nguyên văn

2. CÔNG VIỆC (tasks) — lấy từ TOÀN BỘ biên bản, ưu tiên mục IV DEADLINES, kế đến "Kế hoạch sắp tới" và các việc phát sinh trong "Thảo luận" có mốc thời gian (ký hiệu "dl", "deadline", "trước ngày...", "tuần sau"...):
   - description: mô tả ngắn 1-2 câu làm rõ việc (bối cảnh/yêu cầu kèm theo trong biên bản); chuỗi rỗng nếu biên bản không ghi rõ.
   - LOGIC DEADLINE: quy đổi mọi thời gian tương đối ("tuần sau", "thứ 3 tới", "3 ngày nữa", "cuối tuần") thành YYYY-MM-DD dựa vào ngày họp. Nếu chỉ ghi "dl 17/9" -> ngày 17 tháng 9 theo năm của ngày họp. Không có mốc -> suggestedDeadline = ngày họp + 5 ngày.
   - PHÂN LOẠI BAN: "Ban Truyền thông làm..." -> suggestedDepartment = "Truyền thông" + suggestedAssigneeId/Name = Trưởng ban Truyền thông trong Roster. Tương tự 4 ban. "BCN/Ban chủ nhiệm/Chủ nhiệm" -> Ban Chủ nhiệm.
   - TÊN CÁ NHÂN: ghi tên cụ thể có trong Roster -> gán đúng người đó (đúng ban của họ).
   - QUY TẮC TRÙNG TÊN (vd nhiều người tên "Minh"): nếu không xác định được người cụ thể -> hasAmbiguity = true, liệt kê ambiguityMatches các ứng viên trùng tên, suggestedAssigneeId = "" — KHÔNG TỰ Ý GÁN.
   - CẢNH BÁO VẮNG MẶT: người được giao nằm trong mục "Vắng" -> isAbsentee = true + warningMessages.
   - LOẠI XÁC MINH: "link_required" cho sản phẩm cụ thể (thiết kế, poster, form, sheet, slide, đề thi, bài đăng fanpage, video); "report_required" cho việc hành động (gặp gỡ, liên hệ, mua đồ, xin giấy tờ, trực bàn).
   - priority: "high" nếu trong mục IV DEADLINES hoặc ảnh hưởng sự kiện lớn; "medium"/"normal" còn lại.

CẤU TRÚC JSON PHẢI TRẢ VỀ (đúng từng tên trường):
{"meeting": {"title": str, "date": "YYYY-MM-DD", "chairperson": str, "secretary": str, "attendees": [str], "absentees": [str], "latecomers": [str], "objectives": str, "discussionSummary": str, "actionPlan": str},
 "tasks": [{"title": str, "description": str, "rawAssigneeText": str, "suggestedAssigneeId": str, "suggestedAssigneeName": str, "suggestedDepartment": str, "rawDeadlinetext": str, "suggestedDeadline": "YYYY-MM-DD", "verificationType": "link_required" | "report_required", "hasAmbiguity": bool, "ambiguityMatches": [{"id": str, "name": str, "department": str, "role": str}], "isAbsentee": bool, "warningMessages": [str], "priority": "high" | "medium" | "normal", "reasoning": str}]}

Trả về JSON theo cấu trúc trên.`;

    const response = await ai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Bạn là trợ lý điều hành CLB NITC. Luôn trả về DUY NHẤT một object JSON hợp lệ đúng cấu trúc được yêu cầu, không thêm văn bản nào khác.',
        },
        {
          role: 'user',
          content: (() => {
            const parts: any[] = [];
            if (pdfData) {
              parts.push({ type: 'file', file: { filename: 'bbh.pdf', file_data: pdfData } });
            }
            for (const img of imageList) {
              parts.push({ type: 'image_url', image_url: { url: img } });
            }
            parts.push({ type: 'text', text: prompt });
            return parts;
          })(),
        },
      ],
    });

    const parsedJson = JSON.parse(response.choices[0]?.message?.content?.trim() || '{}');

    // Post-process tasks: đảm bảo ID + tính nhất quán
    // Chuẩn hóa tiêu đề: không dùng viết tắt BBH trên giao diện
    if (parsedJson.meeting?.title) {
      parsedJson.meeting.title = String(parsedJson.meeting.title).replace(/BBH/g, 'Họp');
    }
    if (parsedJson.tasks && Array.isArray(parsedJson.tasks)) {
      parsedJson.tasks = parsedJson.tasks.map((t: any, idx: number) => ({
        ...t,
        tempId: t.tempId || `draft-${Date.now()}-${idx}`,
        // OCR/vision có thể bỏ sót ban — mặc định về Ban Chủ nhiệm để người duyệt chỉnh
        suggestedDepartment: t.suggestedDepartment || 'Ban Chủ nhiệm',
        approved: true,
        priority: t.priority || 'high',
        warningMessages: t.warningMessages || [],
        ambiguityMatches: t.ambiguityMatches || [],
      }));
    }

    return res.json(parsedJson);
  } catch (error: any) {
    console.error('Gemini parsing error, falling back to heuristic parser:', error);
    const fallbackResult = fallbackParseBBH(bbhText, memberList, meetingDate);
    return res.json(fallbackResult);
  }
}
