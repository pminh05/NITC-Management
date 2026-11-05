# -*- coding: utf-8 -*-
# Patch: chuyển AI parser từ Gemini sang OpenAI (json_object mode) + thêm mô tả task
import io, sys

path = 'server/aiParser.ts'
s = io.open(path, encoding='utf-8').read()

# 1) Import + client init
old = """import { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

// AI BBH Parser (Gemini) — giữ nguyên logic prompt & quy tắc nghiệp vụ NITC từ MVP

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return aiClient;
}"""
new = """import { Request, Response } from 'express';
import OpenAI from 'openai';

// AI BBH Parser (OpenAI — structured JSON output) + fallback heuristic theo quy tắc nghiệp vụ NITC

let aiClient: OpenAI | null = null;
function getAIClient(): OpenAI | null {
  if (!aiClient && process.env.OPENAI_API_KEY) {
    aiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return aiClient;
}"""
if old not in s:
    print('FAIL: import block not found')
    sys.exit(1)
s = s.replace(old, new)

# 2) Thay block gọi Gemini bằng OpenAI (từ "const response = await ai.models.generateContent" đến trước "const parsedJson")
start = s.index("    const response = await ai.models.generateContent({")
end = s.index("    const parsedJson = JSON.parse(response.text?.trim() || '{}');")
new_call = """    const response = await ai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Bạn là trợ lý điều hành CLB NITC. Luôn trả về DUY NHẤT một object JSON hợp lệ đúng cấu trúc được yêu cầu, không thêm văn bản nào khác.',
        },
        { role: 'user', content: prompt },
      ],
    });

"""
s = s[:start] + new_call + s[end:]

# 3) parsedJson đọc từ choices
s = s.replace(
    "    const parsedJson = JSON.parse(response.text?.trim() || '{}');",
    "    const parsedJson = JSON.parse(response.choices[0]?.message?.content?.trim() || '{}');")

# 4) Prompt: thêm mô tả công việc + JSON shape chuẩn
s = s.replace(
    """2. CÔNG VIỆC (tasks) — lấy từ TOÀN BỘ biên bản, ưu tiên mục IV DEADLINES, kế đến "Kế hoạch sắp tới" và các việc phát sinh trong "Thảo luận" có mốc thời gian (ký hiệu "dl", "deadline", "trước ngày...", "tuần sau"...):""",
    """2. CÔNG VIỆC (tasks) — lấy từ TOÀN BỘ biên bản, ưu tiên mục IV DEADLINES, kế đến "Kế hoạch sắp tới" và các việc phát sinh trong "Thảo luận" có mốc thời gian (ký hiệu "dl", "deadline", "trước ngày...", "tuần sau"...):
   - description: mô tả ngắn 1-2 câu làm rõ việc (bối cảnh/yêu cầu kèm theo trong biên bản); chuỗi rỗng nếu biên bản không ghi rõ.""")

s = s.replace(
    "Trả về JSON đúng schema.`;",
    """CẤU TRÚC JSON PHẢI TRẢ VỀ (đúng từng tên trường):
{"meeting": {"title": str, "date": "YYYY-MM-DD", "chairperson": str, "secretary": str, "attendees": [str], "absentees": [str], "latecomers": [str], "objectives": str, "discussionSummary": str, "actionPlan": str},
 "tasks": [{"title": str, "description": str, "rawAssigneeText": str, "suggestedAssigneeId": str, "suggestedAssigneeName": str, "suggestedDepartment": str, "rawDeadlinetext": str, "suggestedDeadline": "YYYY-MM-DD", "verificationType": "link_required" | "report_required", "hasAmbiguity": bool, "ambiguityMatches": [{"id": str, "name": str, "department": str, "role": str}], "isAbsentee": bool, "warningMessages": [str], "priority": "high" | "medium" | "normal", "reasoning": str}]}

Trả về JSON theo cấu trúc trên.`;""")

io.open(path, 'w', encoding='utf-8', newline='\n').write(s)
print('aiParser switched to OpenAI')

# 5) server.ts: đổi import + .env.example
p = 'server.ts'
s = io.open(p, encoding='utf-8').read()
s = s.replace("import { parseBBHHandler } from './server/gemini';", "import { parseBBHHandler } from './server/aiParser';")
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('server.ts import updated')

p = '.env.example'
s = io.open(p, encoding='utf-8').read()
s = s.replace(
    '''# GEMINI_API_KEY: bắt buộc để dùng AI parse BBH bằng Gemini.
# Lấy key miễn phí tại https://aistudio.google.com/apikey
# (Nếu bỏ trống: hệ thống tự chuyển sang parser heuristic nội bộ)
GEMINI_API_KEY="MY_GEMINI_API_KEY"''',
    '''# OPENAI_API_KEY: dùng cho AI đọc biên bản họp (trích xuất công việc).
# Lấy key tại https://platform.openai.com/api-keys
# (Nếu bỏ trống: hệ thống tự chuyển sang parser heuristic nội bộ)
OPENAI_API_KEY="sk-..."

# OPENAI_MODEL: model OpenAI sử dụng (mặc định gpt-4o-mini — rẻ và đủ tốt)
# OPENAI_MODEL="gpt-4o-mini"''')
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('.env.example updated')
