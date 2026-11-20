import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Link as LinkIcon,
  X,
  FileText,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Info,
  Users,
  Clock,
  ShieldCheck,
  Check,
  Upload,
} from 'lucide-react';
import { ExtractedDraftTask, Meeting, Member } from '../types';
import { SAMPLE_BBH_TEMPLATES } from '../data/initialData';
import { api } from '../api/client';


/** Giới hạn tệp PDF gửi lên (máy chủ nhận tối đa 25 MB cho API đọc biên bản; base64 làm dữ liệu lớn thêm ~1/3). */
const MAX_PDF_BYTES = 15 * 1024 * 1024;

/** Thu nhỏ ảnh về cạnh dài tối đa 2000 px, nén JPEG; lỗi thì dùng ảnh gốc. Trả data URL. */
function shrinkImage(file: File): Promise<string | null> {
  const readRaw = () =>
    new Promise<string | null>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => resolve(null);
      r.readAsDataURL(file);
    });
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) return readRaw().then(resolve);
      ctx.fillStyle = '#ffffff'; // nền trắng cho ảnh PNG trong suốt
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      readRaw().then(resolve);
    };
    img.src = url;
  });
}

interface MeetingParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onExtractionSuccess: (
    meetingData: Partial<Meeting>,
    extractedTasks: ExtractedDraftTask[],
    rawText: string
  ) => void;
}

const AI_STEPS = [
  {
    step: 1,
    title: 'Đọc & Tiền xử lý văn bản / OCR',
    desc: 'Chuẩn hóa định dạng, nhận diện cấu trúc mục Thảo luận & Kế hoạch',
    icon: FileText,
  },
  {
    step: 2,
    title: 'Quét danh sách thành viên & Điểm danh',
    desc: 'Nhận diện người tham dự, phát hiện thành viên vắng mặt hoặc đi muộn',
    icon: Users,
  },
  {
    step: 3,
    title: 'Bóc tách nhiệm vụ & Chuẩn hóa Deadline',
    desc: 'Quy đổi mốc thời gian, xác định người phụ trách & yêu cầu minh chứng',
    icon: Clock,
  },
];

export const MeetingParserModal: React.FC<MeetingParserModalProps> = ({
  isOpen,
  onClose,
  members,
  onExtractionSuccess,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState(SAMPLE_BBH_TEMPLATES[0].id);
  const [bbhText, setBbhText] = useState(SAMPLE_BBH_TEMPLATES[0].content);
  const [meetingDate, setMeetingDate] = useState('2026-11-03');
  const [inputMode, setInputMode] = useState<'text' | 'file' | 'link'>('text');
  const [docUrl, setDocUrl] = useState('');
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Stepper state when AI is processing
  const [currentStep, setCurrentStep] = useState(1);
  const [progressPercent, setProgressPercent] = useState(15);

  useEffect(() => {
    let timer1: any;
    let timer2: any;

    if (isLoading) {
      setCurrentStep(1);
      setProgressPercent(25);

      timer1 = setTimeout(() => {
        setCurrentStep(2);
        setProgressPercent(60);
      }, 1000);

      timer2 = setTimeout(() => {
        setCurrentStep(3);
        setProgressPercent(88);
      }, 2300);
    } else {
      setCurrentStep(1);
      setProgressPercent(15);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isLoading]);

  if (!isOpen) return null;

  const handleSelectSample = (sampleId: string) => {
    const sample = SAMPLE_BBH_TEMPLATES.find((s) => s.id === sampleId);
    if (sample) {
      setSelectedTemplateId(sampleId);
      setBbhText(sample.content);
      setMeetingDate(sample.date);
    }
  };

  const handleAnalyze = async () => {
    const hasFiles = imagePreviews.length > 0 || !!pdfData;
    if (inputMode === 'file' && !hasFiles) {
      setErrorMsg('Vui lòng chọn ảnh hoặc tệp PDF biên bản họp trước khi phân tích.');
      return;
    }
    if (inputMode === 'link' && !docUrl.trim()) {
      setErrorMsg('Vui lòng dán link Google Docs biên bản họp.');
      return;
    }
    if (inputMode === 'text' && !bbhText.trim()) {
      setErrorMsg('Vui lòng dán nội dung Biên bản họp trước khi phân tích.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const data = await api<{ meeting: any; tasks: ExtractedDraftTask[] }>('/ai/parse-bbh', {
        method: 'POST',
        body:
          inputMode === 'file'
            ? { images: imagePreviews, pdf: pdfData, members, meetingDate }
            : inputMode === 'link'
            ? { docUrl: docUrl.trim(), members, meetingDate }
            : { bbhText, members, meetingDate },
      });

      // Quick visual finish on step 3
      setCurrentStep(3);
      setProgressPercent(100);

      await new Promise((resolve) => setTimeout(resolve, 400));

      // Helper sanitize text string
      const toSafeString = (v: any, fallback = ''): string => {
        if (v == null) return fallback;
        if (typeof v === 'string') return v;
        if (Array.isArray(v)) return v.map((item) => toSafeString(item)).join('\n');
        if (typeof v === 'object') return JSON.stringify(v, null, 2);
        return String(v);
      };

      // Helper sanitize string array
      const toSafeStringArray = (v: any): string[] => {
        if (!v) return [];
        if (typeof v === 'string') return [v];
        if (!Array.isArray(v)) return [toSafeString(v)];
        return v
          .map((item: any) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') return item.name || item.title || JSON.stringify(item);
            return String(item || '');
          })
          .filter(Boolean);
      };

      const meetingData: Partial<Meeting> = {
        title: toSafeString(data?.meeting?.title, 'Biên bản họp Ban Điều Hành'),
        date: toSafeString(data?.meeting?.date, meetingDate),
        chairperson: toSafeString(data?.meeting?.chairperson, 'Lê Hồng Phúc Minh'),
        secretary: toSafeString(data?.meeting?.secretary, 'Nguyễn Thị Ngọc Ánh'),
        attendees: toSafeStringArray(data?.meeting?.attendees),
        absentees: toSafeStringArray(data?.meeting?.absentees),
        latecomers: toSafeStringArray(data?.meeting?.latecomers),
        objectives: toSafeString(data?.meeting?.objectives, ''),
        discussionSummary: toSafeString(data?.meeting?.discussionSummary, ''),
        actionPlan: toSafeString(data?.meeting?.actionPlan, ''),
        rawContent: bbhText,
      };

      const rawTasks = Array.isArray(data?.tasks)
        ? data.tasks
        : data?.tasks && typeof data.tasks === 'object'
        ? Object.values(data.tasks)
        : [];

      const extractedTasks: ExtractedDraftTask[] = rawTasks.map((t: any, idx: number) => ({
        tempId: t.tempId || `draft-${Date.now()}-${idx}`,
        title: toSafeString(t.title, `Nhiệm vụ #${idx + 1}`),
        description: toSafeString(t.description, ''),
        rawAssigneeText: toSafeString(t.rawAssigneeText, 'Ban Điều Hành'),
        suggestedAssigneeId: toSafeString(t.suggestedAssigneeId, ''),
        suggestedAssigneeName: toSafeString(t.suggestedAssigneeName, ''),
        suggestedAssigneeIds: Array.isArray(t.suggestedAssigneeIds)
          ? t.suggestedAssigneeIds.filter((x: any) => typeof x === 'string')
          : t.suggestedAssigneeId
          ? [t.suggestedAssigneeId]
          : [],
        suggestedDepartment: t.suggestedDepartment || 'Ban Chủ nhiệm',
        rawDeadlinetext: toSafeString(t.rawDeadlinetext, ''),
        suggestedDeadline: toSafeString(t.suggestedDeadline, meetingDate),
        verificationType: t.verificationType === 'report_required' ? 'report_required' : 'link_required',
        hasAmbiguity: Boolean(t.hasAmbiguity),
        ambiguityMatches: Array.isArray(t.ambiguityMatches) ? t.ambiguityMatches : [],
        isAbsentee: Boolean(t.isAbsentee),
        absenteeName: toSafeString(t.absenteeName, ''),
        warningMessages: toSafeStringArray(t.warningMessages),
        approved: true,
        priority: t.priority === 'normal' || t.priority === 'medium' ? t.priority : 'high',
        reasoning: toSafeString(t.reasoning, ''),
      }));

      onExtractionSuccess(meetingData, extractedTasks, bbhText);
    } catch (err: any) {
      console.error('Error analyzing BBH:', err);
      setErrorMsg(err.message || 'Không thể trích xuất biên bản họp. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative text-slate-100 text-xs">
        
        {/* Loading Stepper Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-slate-100 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
              
              {/* Top animation & title */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#2C69FF]/15 text-[#8FB2FF] border border-[#2C69FF]/30">
                  <Sparkles className="w-6 h-6 animate-pulse text-[#8FB2FF]" />
                </div>
                <h3 className="text-base font-bold text-white">
                  NITC AI Engine đang xử lý biên bản...
                </h3>
                <p className="text-xs text-slate-400">
                  Quét ngữ nghĩa, đối chiếu danh bạ & kiểm tra các quy tắc lãnh đạo
                </p>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <span>Tiến trình trích xuất</span>
                  <span className="text-[#8FB2FF]">{progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-[#2C69FF] via-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* 4 Steps List */}
              <div className="space-y-3 pt-1">
                {AI_STEPS.map((stepItem) => {
                  const isDone = currentStep > stepItem.step || progressPercent === 100;
                  const isActive = currentStep === stepItem.step && progressPercent < 100;
                  const StepIcon = stepItem.icon;

                  return (
                    <div
                      key={stepItem.step}
                      className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all duration-200 ${
                        isActive
                          ? 'bg-[#2C69FF]/15 border-[#2C69FF]/50 shadow-xs'
                          : isDone
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400 opacity-60'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition-colors ${
                          isActive
                            ? 'bg-[#2C69FF] text-white shadow-xs'
                            : isDone
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {isDone ? (
                          <Check className="w-4 h-4 stroke-[3]" />
                        ) : isActive ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          stepItem.step
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <StepIcon className={`w-3.5 h-3.5 ${isActive ? 'text-[#8FB2FF]' : isDone ? 'text-emerald-400' : 'text-slate-400'}`} />
                          <h4
                            className={`text-xs font-bold leading-tight ${
                              isActive
                                ? 'text-[#8FB2FF]'
                                : isDone
                                ? 'text-slate-200'
                                : 'text-slate-400'
                            }`}
                          >
                            {stepItem.title}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug line-clamp-1">
                          {stepItem.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-center text-[11px] text-slate-400">
                ⚡ Công nghệ AI OpenAI & Quy tắc phân công độc quyền NITC
              </div>
            </div>
          </div>
        )}

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#2C69FF]/15 text-[#8FB2FF] border border-[#2C69FF]/30">
              <Sparkles className="w-5 h-5 text-[#8FB2FF]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Nhập Biên bản họp — AI Tự Trích Xuất Việc
                </h2>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#2C69FF]/15 text-[#8FB2FF] border border-[#2C69FF]/30">
                  NITC AI Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tự động quét mục Thảo luận & Kế hoạch, quy đổi ngày tháng và phát hiện gán việc
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-900 text-slate-200">
          
          {/* Quick template selector bar */}
          <div className="bg-slate-950/50 rounded-xl p-3.5 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-bold text-slate-200">
                Chọn mẫu biên bản họp thực tế của NITC:
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_BBH_TEMPLATES.map((sample, idx) => {
                const isSelected = selectedTemplateId === sample.id;
                return (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => handleSelectSample(sample.id)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition cursor-pointer border ${
                      isSelected
                        ? 'bg-[#2C69FF] text-white border-[#2C69FF] shadow-2xs'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    Mẫu {idx + 1}: {sample.title.split('-')[0].trim()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Meeting Date selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#8FB2FF]" />
                Ngày diễn ra cuộc họp (Dùng làm mốc tính Deadline)
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-medium text-slate-100 [color-scheme:dark] focus:outline-none focus:border-[#2C69FF] focus:ring-1 focus:ring-[#2C69FF] transition"
              />
            </div>
          </div>

          {/* Input mode tabs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Phương thức nạp biên bản họp:</span>
            </div>

            <div className="inline-flex p-1 rounded-xl bg-slate-800 border border-slate-800 gap-1">
              <button
                type="button"
                onClick={() => setInputMode('text')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  inputMode === 'text'
                    ? 'bg-[#2C69FF] text-white shadow-2xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
                }`}
              >
                <span>📋 Dán văn bản</span>
              </button>
              <button
                type="button"
                onClick={() => setInputMode('link')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  inputMode === 'link'
                    ? 'bg-[#2C69FF] text-white shadow-2xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
                }`}
              >
                <span>🔗 Link Google Docs</span>
              </button>
              <button
                type="button"
                onClick={() => setInputMode('file')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  inputMode === 'file'
                    ? 'bg-[#2C69FF] text-white shadow-2xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
                }`}
              >
                <span>📷 Ảnh / PDF (OCR)</span>
              </button>
            </div>
          </div>

          {/* File Upload Mode */}
          {inputMode === 'file' && (
            <div className="space-y-3">
              <label className="flex flex-col items-center justify-center gap-2 py-8 rounded-2xl border-2 border-dashed border-slate-700 hover:border-[#2C69FF] hover:bg-blue-500/5 cursor-pointer transition text-center bg-slate-950/40">
                <div className="w-12 h-12 rounded-full bg-[#2C69FF]/15 border border-[#2C69FF]/30 text-[#8FB2FF] flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-200">
                    Bấm để tải ảnh biên bản họp (chọn nhiều ảnh) hoặc tệp PDF
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">JPG · PNG · WEBP (tự thu nhỏ trước khi gửi, tối đa 4 ảnh) · PDF tối đa 15 MB — hỗ trợ chữ in và chữ viết tay rõ</p>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files: File[] = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    setErrorMsg(null);
                    const pdfFile = files.find((f) => f.type === 'application/pdf') || null;
                    const imgFiles = files.filter((f) => f.type.startsWith('image/')).slice(0, 4);
                    if (!pdfFile && imgFiles.length === 0) {
                      setErrorMsg('Chỉ nhận ảnh (JPG/PNG/WEBP) hoặc tệp PDF.');
                      return;
                    }
                    if (pdfFile && pdfFile.size > MAX_PDF_BYTES) {
                      setErrorMsg(`Tệp PDF quá lớn (${(pdfFile.size / 1048576).toFixed(1)} MB). Giới hạn 15 MB — hãy tách bớt trang hoặc chụp ảnh từng trang.`);
                      return;
                    }
                    // Ảnh được thu nhỏ ở trình duyệt trước khi gửi: ảnh điện thoại thường 3–8 MB,
                    // thu về cạnh dài tối đa 2000 px là đủ để AI đọc chữ và giữ yêu cầu gửi lên gọn nhẹ.
                    Promise.all(imgFiles.map(shrinkImage)).then((imgs) => {
                      setImagePreviews(imgs.filter(Boolean) as string[]);
                    });
                    if (pdfFile) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        setPdfData(String(reader.result));
                        setPdfName(pdfFile.name);
                      };
                      reader.readAsDataURL(pdfFile);
                    }
                  }}
                />
              </label>

              {/* Previews */}
              {(imagePreviews.length > 0 || pdfName) && (
                <div className="flex items-center gap-2.5 flex-wrap p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={src}
                        alt={`Trang ${i + 1}`}
                        className="w-20 h-20 object-cover rounded-lg border border-slate-700 shadow-2xs"
                      />
                      <span className="absolute top-1 left-1 text-[10px] font-bold bg-slate-950/80 text-white px-1.5 py-0.5 rounded">
                        Trang {i + 1}
                      </span>
                    </div>
                  ))}
                  {pdfName && (
                    <div className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 font-medium shadow-2xs flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-red-400" />
                      <span>{pdfName}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreviews([]);
                      setPdfData(null);
                      setPdfName(null);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 text-xs font-semibold transition cursor-pointer border border-red-500/30"
                  >
                    ✕ Xóa tệp đã chọn
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Google Docs Link Mode */}
          {inputMode === 'link' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-200">
                Đường dẫn liên kết Google Docs / Sheets:
              </label>
              <div className="relative">
                <LinkIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="url"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="https://docs.google.com/document/d/..."
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#2C69FF] focus:ring-1 focus:ring-[#2C69FF]"
                />
              </div>
              <div className="text-xs text-slate-200 bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Hệ thống tự động đồng bộ nội dung từ tài liệu đám mây — không cần sao chép thủ công.</span>
                </p>
                <p className="flex items-center gap-1.5 text-amber-300">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Đảm bảo tài liệu được cấp quyền <strong className="text-white font-semibold">"Bất kỳ ai có đường liên kết đều xem được"</strong>.</span>
                </p>
              </div>
            </div>
          )}

          {/* Text Input Mode */}
          {inputMode === 'text' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200">
                  Nội dung toàn văn biên bản cuộc họp:
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {bbhText.split('\n').length} dòng | {bbhText.length} ký tự
                </span>
              </div>
              <textarea
                rows={11}
                value={bbhText}
                onChange={(e) => setBbhText(e.target.value)}
                placeholder="Dán nội dung biên bản họp theo định dạng chuẩn của NITC vào đây..."
                className="w-full p-4 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-200 placeholder-slate-500 focus:bg-slate-950 focus:outline-none focus:border-[#2C69FF] focus:ring-1 focus:ring-[#2C69FF] transition resize-y leading-relaxed"
              />
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 transition w-full sm:w-auto cursor-pointer"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={handleAnalyze}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#2C69FF] to-indigo-600 hover:from-[#1F56D6] hover:to-indigo-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-[#2C69FF]/20 flex items-center justify-center gap-2 disabled:opacity-50 transition active:scale-95 w-full sm:w-auto cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>AI đang quét & trích xuất...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Phân tích & Mở Màn hình Đối soát</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};