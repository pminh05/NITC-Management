# -*- coding: utf-8 -*-
# Patch G4 frontend: MeetingParserModal 2 tab (Dán văn bản / Ảnh·PDF)
import io, sys

def sub(p, old, new):
    s = io.open(p, encoding='utf-8').read()
    if old not in s:
        print('!! NOT FOUND in %s: %r' % (p, old[:80])); sys.exit(1)
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s.replace(old, new, 1))
    print('ok', p)

p = 'src/components/MeetingParserModal.tsx'

# 1) State ảnh/PDF + tab + handlers
sub(p,
"""  const [bbhText, setBbhText] = useState(SAMPLE_BBH_TEMPLATES[0].content);
  const [meetingDate, setMeetingDate] = useState('2026-11-03');""",
"""  const [bbhText, setBbhText] = useState(SAMPLE_BBH_TEMPLATES[0].content);
  const [meetingDate, setMeetingDate] = useState('2026-11-03');
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<string | null>(null);""")

# 2) handleAnalyze: gửi theo chế độ
sub(p,
"""  const handleAnalyze = async () => {
    if (!bbhText.trim()) {
      setErrorMsg('Vui lòng dán nội dung Biên bản họp trước khi phân tích.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const data = await api<{ meeting: any; tasks: ExtractedDraftTask[] }>('/gemini/parse-bbh', {
        method: 'POST',
        body: {
          bbhText,
          members,
          meetingDate,
        },
      });""",
"""  const handleAnalyze = async () => {
    const hasFiles = imagePreviews.length > 0 || !!pdfData;
    if (inputMode === 'file' && !hasFiles) {
      setErrorMsg('Vui lòng chọn ảnh hoặc tệp PDF biên bản họp trước khi phân tích.');
      return;
    }
    if (inputMode === 'text' && !bbhText.trim()) {
      setErrorMsg('Vui lòng dán nội dung Biên bản họp trước khi phân tích.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const data = await api<{ meeting: any; tasks: ExtractedDraftTask[] }>('/gemini/parse-bbh', {
        method: 'POST',
        body:
          inputMode === 'file'
            ? { images: imagePreviews, pdf: pdfData, members, meetingDate }
            : { bbhText, members, meetingDate },
      });""")

# 3) Tab switch UI — chèn trước khối "Main textarea", bao 2 tab
sub(p,
"""          {/* Main textarea for BBH */}""",
"""          {/* Input mode tabs */}
          <div className="flex items-center gap-1.5 mb-3">
            <button
              type="button"
              onClick={() => setInputMode('text')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                inputMode === 'text' ? 'bg-[#2C69FF] text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              📋 Dán văn bản
            </button>
            <button
              type="button"
              onClick={() => setInputMode('file')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                inputMode === 'file' ? 'bg-[#2C69FF] text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              📷 Ảnh / PDF biên bản
            </button>
            <span className="text-[10px] text-slate-500 ml-1">
              Ảnh/PDF: AI tự đọc (OCR) — hỗ trợ chụp nhiều trang, cả chữ viết tay
            </span>
          </div>

          {inputMode === 'file' && (
            <div className="mb-3 space-y-2">
              <label className="flex flex-col items-center justify-center gap-1.5 py-6 rounded-xl border-2 border-dashed border-slate-600 hover:border-[#2C69FF] hover:bg-slate-800/40 cursor-pointer transition text-center">
                <span className="text-2xl">📷</span>
                <span className="text-xs text-slate-300 font-semibold">
                  Bấm để chọn ảnh chụp biên bản (chọn được nhiều ảnh) hoặc tệp PDF
                </span>
                <span className="text-[10px] text-slate-500">JPG · PNG · WEBP · PDF — tối đa ~7MB</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    setErrorMsg(null);
                    const imgs: string[] = [];
                    let pdfFile: File | null = null;
                    for (const f of files) {
                      if (f.type === 'application/pdf') { pdfFile = f; break; }
                    }
                    const imgFiles = files.filter((f) => f.type.startsWith('image/'));
                    let pending = imgFiles.length + (pdfFile ? 1 : 0);
                    if (pending === 0) {
                      setErrorMsg('Chỉ nhận ảnh (JPG/PNG/WEBP) hoặc tệp PDF.');
                      return;
                    }
                    const done = () => {
                      pending -= 1;
                      if (pending === 0) {
                        setImagePreviews(imgs.slice(0, 4));
                        if (pdfFile) { setPdfName(pdfFile.name); }
                      }
                    };
                    imgFiles.slice(0, 4).forEach((f) => {
                      const reader = new FileReader();
                      reader.onload = () => { imgs.push(String(reader.result)); done(); };
                      reader.onerror = () => done();
                      reader.readAsDataURL(f);
                    });
                    if (pdfFile) {
                      const reader = new FileReader();
                      reader.onload = () => { setPdfData(String(reader.result)); done(); };
                      reader.onerror = () => done();
                      reader.readAsDataURL(pdfFile);
                    }
                  }}
                />
              </label>

              {/* Xem trước */}
              {(imagePreviews.length > 0 || pdfName) && (
                <div className="flex items-center gap-2 flex-wrap">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative">
                      <img src={src} alt={`Trang ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-slate-700" />
                      <span className="absolute top-1 left-1 text-[9px] bg-slate-900/80 text-slate-300 px-1 rounded">
                        {i + 1}
                      </span>
                    </div>
                  ))}
                  {pdfName && (
                    <div className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200">
                      📄 {pdfName}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { setImagePreviews([]); setPdfData(null); setPdfName(null); }}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-red-600/40 text-slate-400 hover:text-red-300 text-[11px] font-semibold transition cursor-pointer"
                  >
                    ✕ Xóa tệp
                  </button>
                </div>
              )}
            </div>
          )}

          {inputMode === 'text' && (
          {/* Main textarea for BBH */}""")

print('modal tabs added')
