import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Gemini SDK with telemetry header
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

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
  
  let title = 'Biên bản họp Ban Điều Hành NITC';
  let date = meetingDateStr || new Date().toISOString().split('T')[0];
  let chairperson = 'Lê Hồng Phúc Minh';
  let secretary = 'Nguyễn Thị Ngọc Ánh';
  const attendees: string[] = [];
  const absentees: string[] = [];
  const discussionLines: string[] = [];
  const actionLines: string[] = [];

  let currentSection = '';

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('biên bản') || lower.includes('bbh')) {
      title = line.replace(/^[#\-\*\d\.\s]+/, '').trim();
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

  // Parse action lines into draft tasks
  const rawTasks = actionLines.length > 0 ? actionLines : lines.filter(l => /^\d+[\.\)]/.test(l));
  
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

// AI BBH Parser Endpoint using Gemini
app.post('/api/gemini/parse-bbh', async (req, res) => {
  const { bbhText, members, meetingDate } = req.body;

  if (!bbhText || typeof bbhText !== 'string') {
    return res.status(400).json({ error: 'Nội dung Biên bản họp không được để trống' });
  }

  const memberList = Array.isArray(members) ? members : [];
  const ai = getAIClient();

  if (!ai) {
    console.log('Using local intelligent parser (No Gemini API Key provided)');
    const fallbackResult = fallbackParseBBH(bbhText, memberList, meetingDate);
    return res.json(fallbackResult);
  }

  try {
    const memberContext = memberList
      .map((m: any) => `- ID: ${m.id} | Họ tên: ${m.name} | Ban: ${m.department} | Vai trò: ${m.role}`)
      .join('\n');

    const prompt = `Bạn là Trợ lý AI Điều hành cao cấp dành riêng cho Chủ tịch CLB NITC (NITC Command Center).
Hãy phân tích văn bản Biên bản họp (BBH) sau đây theo các quy tắc nghiệp vụ nghiêm ngặt của NITC:

DANH SÁCH THÀNH VIÊN CLB NITC HIỆN TẠI (ROSTER):
${memberContext}

NGÀY HỌP MẶC ĐỊNH (nếu trong BBH không ghi rõ khác): ${meetingDate || new Date().toISOString().split('T')[0]}

VĂN BẢN BIÊN BẢN HỌP CẦN TRÍCH XUẤT:
"""
${bbhText}
"""

QUY TẮC BẮT BUỘC KHI TRÍCH XUẤT:
1. TRÍCH XUẤT THÔNG TIN HỌP:
   - Tiêu đề biên bản họp (title)
   - Ngày họp chính xác (date: YYYY-MM-DD)
   - Người chủ trì (chairperson)
   - Thư ký (secretary)
   - Danh sách người có mặt (attendees: string[])
   - Danh sách người vắng mặt (absentees: string[])
   - Tóm tắt phần Thảo luận (discussionSummary)
   - Kế hoạch tổng thể (actionPlan)

2. TRÍCH XUẤT CÔNG VIỆC (ACTION ITEMS / TASKS):
   - Trích xuất toàn bộ công việc từ mục "Thảo luận" và "Kế hoạch & Phân công".
   - LOGIC NGÀY THÁNG (DEADLINE):
     Dựa vào Ngày họp của BBH để quy đổi mọi từ chỉ thời gian tương đối ("Tuần sau", "Thứ Hai tới", "Thứ Sáu tuần này", "3 ngày sau họp", "Ngày mai", "Chủ Nhật") thành ngày cụ thể định dạng YYYY-MM-DD (ISO).
   - PHÂN LOẠI BAN VÀ TRƯỞNG BAN:
     Nếu BBH ghi "Ban Truyền thông làm..." -> Tự động gán suggestedDepartment là "Truyền thông", và suggestedAssigneeId/Name là Trưởng ban Truyền thông trong Roster.
     Tương tự cho Ban Sự kiện, Ban Học thuật, Ban Đối ngoại.
   - QUY TẮC "MINH" (TRÙNG TÊN / AMBIGUITY):
     Nếu BBH chỉ ghi "Minh" hoặc tên trùng với nhiều người trong Roster (VD: có Lê Hồng Phúc Minh, Nguyễn Đức Minh, Trần Quang Minh, Hoàng Nhật Minh...), AI KHÔNG ĐƯỢC TỰ Ý GÁN!
     Phải đặt: hasAmbiguity = true, liệt kê danh sách ambiguityMatches chứa các thành viên trùng tên, và để suggestedAssigneeId = "".
   - CẢNH BÁO VẮNG MẶT (ABSENTEE WARNING):
     Nếu người được phân công việc nằm trong danh sách VẮNG MẶT của BBH, phải đặt isAbsentee = true và thêm thông báo cảnh báo đỏ rõ ràng.
   - LOẠI XÁC MINH (VERIFICATION TYPE):
     + "link_required" nếu công việc cần sản phẩm cụ thể: Thiết kế Canva/Figma, Banner, Form đăng ký, Bộ ảnh, Slide, Đề thi, Google Sheet/Doc, Bài viết Fanpage.
     + "report_required" nếu công việc mang tính hành động thực địa: Gặp thầy cố vấn, Khảo sát hội trường, Mua đồ, Liên hệ đối tác/diễn giả, Họp ban con.

Hãy trả về kết quả dưới dạng JSON theo đúng schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            meeting: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                date: { type: Type.STRING, description: 'YYYY-MM-DD' },
                chairperson: { type: Type.STRING },
                secretary: { type: Type.STRING },
                attendees: { type: Type.ARRAY, items: { type: Type.STRING } },
                absentees: { type: Type.ARRAY, items: { type: Type.STRING } },
                discussionSummary: { type: Type.STRING },
                actionPlan: { type: Type.STRING },
              },
              required: ['title', 'date', 'chairperson', 'attendees', 'absentees'],
            },
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  tempId: { type: Type.STRING },
                  title: { type: Type.STRING },
                  rawAssigneeText: { type: Type.STRING },
                  suggestedAssigneeId: { type: Type.STRING },
                  suggestedAssigneeName: { type: Type.STRING },
                  suggestedDepartment: { type: Type.STRING },
                  rawDeadlinetext: { type: Type.STRING },
                  suggestedDeadline: { type: Type.STRING, description: 'YYYY-MM-DD' },
                  verificationType: { type: Type.STRING, description: 'link_required or report_required' },
                  hasAmbiguity: { type: Type.BOOLEAN },
                  ambiguityMatches: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        name: { type: Type.STRING },
                        department: { type: Type.STRING },
                        role: { type: Type.STRING },
                      },
                      required: ['id', 'name', 'department', 'role'],
                    },
                  },
                  isAbsentee: { type: Type.BOOLEAN },
                  warningMessages: { type: Type.ARRAY, items: { type: Type.STRING } },
                  priority: { type: Type.STRING, description: 'high, medium, or normal' },
                  reasoning: { type: Type.STRING },
                },
                required: [
                  'title',
                  'rawAssigneeText',
                  'suggestedDepartment',
                  'suggestedDeadline',
                  'verificationType',
                  'hasAmbiguity',
                  'isAbsentee',
                ],
              },
            },
          },
          required: ['meeting', 'tasks'],
        },
      },
    });

    const parsedJson = JSON.parse(response.text?.trim() || '{}');
    
    // Post-process tasks to ensure IDs and integrity
    if (parsedJson.tasks && Array.isArray(parsedJson.tasks)) {
      parsedJson.tasks = parsedJson.tasks.map((t: any, idx: number) => ({
        ...t,
        tempId: t.tempId || `draft-${Date.now()}-${idx}`,
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
});

// Reminder / Nag Trigger API
app.post('/api/nag/send-reminders', (req, res) => {
  const { type, recipientEmail, recipientName, subject, content, department, taskCount } = req.body;
  
  const log = {
    id: `log-${Date.now()}`,
    type: type || 'overdue_nag',
    recipientName: recipientName || 'Ban Điều Hành NITC',
    recipientEmail: recipientEmail || 'bdh-nitc@gmail.com',
    department,
    subject: subject || 'Thông báo từ NITC Command Center',
    content: content || '',
    sentAt: new Date().toISOString(),
    status: 'sent',
    taskCount: taskCount || 1,
  };

  res.json({ success: true, log });
});

// Vite & Static Asset Handling
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NITC Command Center Server running on http://localhost:${PORT}`);
  });
}

startServer();
