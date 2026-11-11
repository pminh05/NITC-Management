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
      const data = await api<{ meeting: any; tasks: ExtractedDraftTask[] }>('/gemini/parse-bbh', {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative">
        
        {/* Loading Stepper Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-30 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-slate-800 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-6">
              
              {/* Top animation & title */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200">
                  <Sparkles className="w-6 h-6 animate-pulse text-blue-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  NITC AI Engine đang xử lý biên bản...
                </h3>
                <p className="text-xs text-slate-500">
                  Quét ngữ nghĩa, đối chiếu danh bạ & kiểm tra các quy tắc lãnh đạo
                </p>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Tiến trình trích xuất</span>
                  <span className="text-blue-600">{progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-full transition-all duration-500 ease-out"
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
                          ? 'bg-blue-50/70 border-blue-200 shadow-2xs'
                          : isDone
                          ? 'bg-emerald-50/50 border-emerald-200/80 text-slate-700'
                          : 'bg-slate-50/50 border-slate-100 text-slate-400 opacity-60'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition-colors ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-xs'
                            : isDone
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-500'
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
                          <StepIcon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : isDone ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <h4
                            className={`text-xs font-bold leading-tight ${
                              isActive
                                ? 'text-blue-900'
                                : isDone
                                ? 'text-slate-900'
                                : 'text-slate-500'
                            }`}
                          >
                            {stepItem.title}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-1">
                          {stepItem.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-center text-[11px] text-slate-400">
                ⚡ Công nghệ Google Gemini & Quy tắc phân công độc quyền NITC
              </div>
            </div>
          </div>
        )}

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Nhập Biên bản họp — AI Tự Trích Xuất Việc
                </h2>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  NITC AI Engine
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Tự động quét mục Thảo luận & Kế hoạch, quy đổi ngày tháng và phát hiện gán việc
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-white text-slate-800">
          
          {/* Quick template selector bar */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-xs font-bold text-slate-700">
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
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
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
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Ngày diễn ra cuộc họp (Dùng làm mốc tính Deadline)
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
              />
            </div>

            <div className="flex items-center">
              <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 text-xs text-blue-900 w-full flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Quy tắc ngày tháng:</strong> AI tự động chuyển đổi các từ tương đối như <em>"Thứ Hai tới"</em>, <em>"Tuần sau"</em>, <em>"3 ngày sau họp"</em> thành ngày cụ thể dựa trên mốc ngày họp này.
                </div>
              </div>
            </div>
          </div>

          {/* Input mode tabs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Phương thức nạp biên bản họp:</span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Hỗ trợ văn bản thuần, Google Docs và ảnh OCR
              </span>
            </div>

            <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/80 gap-1">
              <button
                type="button"
                onClick={() => setInputMode('text')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  inputMode === 'text'
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📋 Dán văn bản</span>
              </button>
              <button
                type="button"
                onClick={() => setInputMode('link')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  inputMode === 'link'
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🔗 Link Google Docs</span>
              </button>
              <button
                type="button"
                onClick={() => setInputMode('file')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  inputMode === 'file'
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📷 Ảnh / PDF (OCR)</span>
              </button>
            </div>
          </div>

          {/* File Upload Mode */}
          {inputMode === 'file' && (
            <div className="space-y-3">
              <label className="flex flex-col items-center justify-center gap-2 py-8 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 cursor-pointer transition text-center bg-slate-50/50">
                <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800">
                    Bấm để tải ảnh biên bản họp (chọn nhiều ảnh) hoặc tệp PDF
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">JPG · PNG · WEBP · PDF — tối đa ~7MB (Hỗ trợ chữ viết tay & in)</p>
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
                    const imgs: string[] = [];
                    let pdfFile: File | null = null;
                    for (const f of files) {
                      if (f.type === 'application/pdf') {
                        pdfFile = f;
                        break;
                      }
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
                        if (pdfFile) {
                          setPdfName(pdfFile.name);
                        }
                      }
                    };
                    imgFiles.slice(0, 4).forEach((f) => {
                      const reader = new FileReader();
                      reader.onload = () => {
                        imgs.push(String(reader.result));
                        done();
                      };
                      reader.onerror = () => done();
                      reader.readAsDataURL(f);
                    });
                    if (pdfFile) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        setPdfData(String(reader.result));
                        done();
                      };
                      reader.onerror = () => done();
                      reader.readAsDataURL(pdfFile);
                    }
                  }}
                />
              </label>

              {/* Previews */}
              {(imagePreviews.length > 0 || pdfName) && (
                <div className="flex items-center gap-2.5 flex-wrap p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={src}
                        alt={`Trang ${i + 1}`}
                        className="w-20 h-20 object-cover rounded-lg border border-slate-300 shadow-2xs"
                      />
                      <span className="absolute top-1 left-1 text-[10px] font-bold bg-slate-900/80 text-white px-1.5 py-0.5 rounded">
                        Trang {i + 1}
                      </span>
                    </div>
                  ))}
                  {pdfName && (
                    <div className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 font-medium shadow-2xs flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-red-500" />
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
                    className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold transition cursor-pointer border border-red-200"
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
              <label className="block text-xs font-bold text-slate-700">
                Đường dẫn liên kết Google Docs / Sheets:
              </label>
              <div className="relative">
                <LinkIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="url"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="https://docs.google.com/document/d/..."
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-2xs"
                />
              </div>
              <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Hệ thống tự động đồng bộ nội dung từ tài liệu đám mây — không cần sao chép thủ công.</span>
                </p>
                <p className="flex items-center gap-1.5 text-amber-800">
                  <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Đảm bảo tài liệu được cấp quyền <strong className="text-slate-900 font-semibold">"Bất kỳ ai có đường liên kết đều xem được"</strong>.</span>
                </p>
              </div>
            </div>
          )}

          {/* Text Input Mode */}
          {inputMode === 'text' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Nội dung toàn văn biên bản cuộc họp:
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  {bbhText.split('\n').length} dòng | {bbhText.length} ký tự
                </span>
              </div>
              <textarea
                rows={11}
                value={bbhText}
                onChange={(e) => setBbhText(e.target.value)}
                placeholder="Dán nội dung biên bản họp theo định dạng chuẩn của NITC vào đây..."
                className="w-full p-4 bg-slate-50/40 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition resize-y leading-relaxed shadow-2xs"
              />
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition w-full sm:w-auto cursor-pointer"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={handleAnalyze}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50 transition active:scale-95 w-full sm:w-auto cursor-pointer"
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