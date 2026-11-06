# -*- coding: utf-8 -*-
# Patch G4: aiParser nhận ảnh/PDF (OpenAI vision + PDF input)
import io, sys

p = 'server/aiParser.ts'
s = io.open(p, encoding='utf-8').read()

# 1) Handler: nhận images[] + pdf data URL
OLD1 = '''export async function parseBBHHandler(req: Request, res: Response) {
  const { bbhText, members, meetingDate } = req.body;

  if (!bbhText || typeof bbhText !== 'string') {
    return res.status(400).json({ error: 'Nội dung Biên bản họp không được để trống' });
  }

  const memberList = Array.isArray(members) ? members : [];
  const ai = getAIClient();

  if (!ai) {
    console.log('Using local heuristic parser (No OPENAI_API_KEY provided)');
    const fallbackResult = fallbackParseBBH(bbhText, memberList, meetingDate);
    return res.json(fallbackResult);
  }'''

NEW1 = '''export async function parseBBHHandler(req: Request, res: Response) {
  const { bbhText, images, pdf, members, meetingDate } = req.body;

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
  }'''

if OLD1 not in s:
    print('NOT FOUND handler block')
    sys.exit(1)
s = s.replace(OLD1, NEW1)
print('ok handler')

# 2) user message content: văn bản hoặc đính kèm file/ảnh
OLD2 = "        { role: 'user', content: prompt },"
NEW2 = '''        {
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
        },'''
if OLD2 not in s:
    print('NOT FOUND user message')
    sys.exit(1)
s = s.replace(OLD2, NEW2)
print('ok user message')

# 3) Prompt: nguồn biên bản (ảnh/PDF -> OCR; văn bản -> nguyên văn)
OLD3 = 'VĂN BẢN BIÊN BẢN HỌC:'  # placeholder check
# Prompt thực tế chứa khối: VĂN BẢN BIÊN BẢN HỌP:\n"""\n${bbhText}\n"""\n — thay bằng khối điều kiện
OLD3 = '''VĂN BẢN BIÊN BẢN HỌP:
"""
${bbhText}
"""
'''
NEW3 = '''NGUỒN BIÊN BẢN:
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
'''
if OLD3 not in s:
    print('NOT FOUND prompt source block')
    sys.exit(1)
s = s.replace(OLD3, NEW3)
print('ok prompt source')

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ALL OK')
