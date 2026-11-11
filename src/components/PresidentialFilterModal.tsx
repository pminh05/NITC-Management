import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  Calendar,
  Link as LinkIcon,
  FileCheck,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  Clock,
  Search,
  Copy,
  Check,
  FileText,
  Users,
  Columns,
  Maximize2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Department, ExtractedDraftTask, Meeting, Member, Role } from '../types';
import { AssigneeMultiSelect } from './AssigneeMultiSelect';
import { todayISO, formatDateVN } from '../utils/dateUtils';

interface PresidentialFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingData: Partial<Meeting>;
  draftTasks: ExtractedDraftTask[];
  members: Member[];
  authMember: Member;
  onPublishTasks: (
    finalMeeting: Meeting,
    finalTasks: ExtractedDraftTask[]
  ) => void;
}

export const PresidentialFilterModal: React.FC<PresidentialFilterModalProps> = ({
  isOpen,
  onClose,
  meetingData,
  draftTasks: initialDraftTasks,
  members,
  authMember,
  onPublishTasks,
}) => {
  const isDeptHead = authMember?.role === 'Trưởng ban' || authMember?.role === 'Phó ban';
  const myDepartment = authMember?.department || 'Ban Chủ nhiệm';
  const allowedDepartments: Department[] = isDeptHead
    ? [myDepartment]
    : ['Học thuật', 'Truyền thông', 'Sự kiện', 'Đối ngoại', 'Ban Chủ nhiệm'];

  const safeInitialTasks = Array.isArray(initialDraftTasks) ? initialDraftTasks : [];
  const [tasks, setTasks] = useState<ExtractedDraftTask[]>(safeInitialTasks);
  const [meeting, setMeeting] = useState<Partial<Meeting>>(meetingData || {});
  const [crossDeptRemoved, setCrossDeptRemoved] = useState(0);

  // Split screen and tabs
  const [isSplitScreen, setIsSplitScreen] = useState(true);
  const [leftTab, setLeftTab] = useState<'raw' | 'summary'>('raw');
  const [mobileTab, setMobileTab] = useState<'bbh' | 'tasks'>('tasks');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'issues'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  // Safe helpers for string values
  const rawAttendees = Array.isArray(meeting.attendees)
    ? meeting.attendees.map((x: any) => (typeof x === 'string' ? x : x?.name || JSON.stringify(x))).filter(Boolean)
    : [];
  const rawAbsentees = Array.isArray(meeting.absentees)
    ? meeting.absentees.map((x: any) => (typeof x === 'string' ? x : x?.name || JSON.stringify(x))).filter(Boolean)
    : [];
  const rawLatecomers = Array.isArray(meeting.latecomers)
    ? meeting.latecomers.map((x: any) => (typeof x === 'string' ? x : x?.name || JSON.stringify(x))).filter(Boolean)
    : [];
  const safeObjectives = typeof meeting.objectives === 'string' ? meeting.objectives : '';
  const safeDiscussion = typeof meeting.discussionSummary === 'string' ? meeting.discussionSummary : '';
  const safeRawContent = typeof meeting.rawContent === 'string' ? meeting.rawContent : '';

  // Sync initial draft tasks
  React.useEffect(() => {
    const rawList = Array.isArray(initialDraftTasks) ? initialDraftTasks : [];
    if (isDeptHead) {
      const kept = rawList.filter(
        (t) => t && (t.suggestedDepartment === myDepartment || t.hasAmbiguity)
      );
      const removedCount = rawList.length - kept.length;
      setTasks(kept.map((t) => ({ ...t, suggestedDepartment: myDepartment })));
      setCrossDeptRemoved(removedCount);
    } else {
      setTasks(rawList);
    }
  }, [initialDraftTasks, isDeptHead, myDepartment]);

  React.useEffect(() => {
    setMeeting(meetingData || {});
  }, [meetingData]);

  if (!isOpen) return null;

  const handleUpdateTask = (tempId: string, updates: Partial<ExtractedDraftTask>) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.tempId !== tempId) return t;
        const updated = { ...t, ...updates };

        // Đổi ban: nếu người đang chọn không thuộc ban mới thì reset
        if (updates.suggestedDepartment && updates.suggestedDepartment !== t.suggestedDepartment) {
          const currentAssignee = members.find((m) => m.id === updated.suggestedAssigneeId);
          if (!currentAssignee || currentAssignee.department !== updates.suggestedDepartment) {
            updated.suggestedAssigneeId = '';
            updated.suggestedAssigneeName = '';
            updated.suggestedAssigneeIds = [];
          }
        }

        // Khi người phụ trách thay đổi
        if (updates.suggestedAssigneeId) {
          const selectedMember = members.find((m) => m.id === updates.suggestedAssigneeId);
          if (selectedMember) {
            updated.suggestedAssigneeName = selectedMember.name;
            updated.suggestedDepartment = selectedMember.department;
            updated.hasAmbiguity = false;

            // Kiểm tra vắng mặt an toàn
            const absenteesList = Array.isArray(meeting.absentees)
              ? meeting.absentees.map((a: any) => (typeof a === 'string' ? a : a?.name || String(a || ''))).filter(Boolean)
              : [];
            const isAbs = absenteesList.some(
              (abs) =>
                abs.toLowerCase().includes(selectedMember.name.toLowerCase()) ||
                selectedMember.name.toLowerCase().includes(abs.toLowerCase())
            );
            updated.isAbsentee = isAbs;
            const currentWarnings = Array.isArray(updated.warningMessages) ? updated.warningMessages : [];
            if (isAbs) {
              if (!currentWarnings.some((m) => m.includes('VẮNG HỌP'))) {
                updated.warningMessages = [
                  ...currentWarnings,
                  `🚨 Cảnh báo: ${selectedMember.name} VẮNG HỌP!`,
                ];
              }
            } else {
              updated.warningMessages = currentWarnings.filter(
                (m) => !m.includes('VẮNG HỌP') && !m.includes('Quy tắc "Minh"') && !m.includes('TRÙNG TÊN')
              );
            }
          }
        }

        return updated;
      })
    );
  };

  const handleDeleteTask = (tempId: string) => {
    setTasks((prev) => prev.filter((t) => t.tempId !== tempId));
  };

  const handleAddNewTask = () => {
    const defaultMember = members[1] || members[0];
    const newTask: ExtractedDraftTask = {
      tempId: `draft-manual-${Date.now()}`,
      title: 'Công việc bổ sung mới',
      rawAssigneeText: defaultMember.name,
      suggestedAssigneeId: defaultMember.id,
      suggestedAssigneeName: defaultMember.name,
      suggestedAssigneeIds: [defaultMember.id],
      suggestedDepartment: defaultMember.department,
      rawDeadlinetext: '7 ngày tới',
      suggestedDeadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      verificationType: 'link_required',
      hasAmbiguity: false,
      ambiguityMatches: [],
      isAbsentee: false,
      warningMessages: [],
      approved: true,
      priority: 'high',
      reasoning: 'Lãnh đạo bổ sung thủ công',
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const handleCopyRaw = () => {
    const text = meeting.rawContent || '';
    if (text) {
      navigator.clipboard.writeText(text);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    }
  };

  const handleFixPastDeadline = (tempId: string) => {
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    handleUpdateTask(tempId, { suggestedDeadline: nextWeek });
  };

  const handlePublish = () => {
    const unresolvedTask = tasks.find((t) => !t.suggestedAssigneeId || t.hasAmbiguity);
    if (unresolvedTask) {
      alert(
        `⚠️ Chú ý: Công việc "${unresolvedTask.title}" chưa được gán người phụ trách cụ thể hoặc còn vướng quy tắc trùng tên! Vui lòng chọn người trước khi ban hành.`
      );
      return;
    }

    const finalMeeting: Meeting = {
      id: `meet-${Date.now()}`,
      title: meeting.title || 'Biên bản họp Ban Điều Hành',
      date: meeting.date || new Date().toISOString().split('T')[0],
      chairperson: meeting.chairperson || 'Lê Hồng Phúc Minh',
      secretary: meeting.secretary || 'Nguyễn Thị Ngọc Ánh',
      attendees: meeting.attendees || [],
      absentees: meeting.absentees || [],
      discussionSummary: meeting.discussionSummary || '',
      actionPlan: meeting.actionPlan || '',
      rawContent: meeting.rawContent || '',
      taskCount: tasks.length,
      completedTaskCount: 0,
      createdAt: new Date().toISOString(),
    };

    onPublishTasks(finalMeeting, tasks);
  };

  // Metrics
  const validTasks = Array.isArray(tasks) ? tasks.filter(Boolean) : [];
  const issueCount = validTasks.filter(
    (t) => t.hasAmbiguity || t.isAbsentee || (t.suggestedDeadline && t.suggestedDeadline < todayISO())
  ).length;

  const filteredTasks = useMemo(() => {
    return validTasks.filter((t) => {
      if (taskFilter === 'issues') {
        const hasIssue =
          t.hasAmbiguity ||
          t.isAbsentee ||
          (t.suggestedDeadline && t.suggestedDeadline < todayISO()) ||
          !t.suggestedAssigneeId;
        if (!hasIssue) return false;
      }
      if (departmentFilter !== 'all' && t.suggestedDepartment !== departmentFilter) {
        return false;
      }
      return true;
    });
  }, [validTasks, taskFilter, departmentFilter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-hidden">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-[1560px] h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* 1. Modal Top Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 shadow-2xs">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Đối Soát & Chuẩn Hóa Nhiệm Vụ
                </h2>
                <div className="flex items-center gap-1.5">
                  <span className="bg-blue-50 text-blue-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-blue-200">
                    {tasks.length} nhiệm vụ
                  </span>
                  {issueCount > 0 ? (
                    <span className="bg-amber-50 text-amber-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-200 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      {issueCount} cần lưu ý
                    </span>
                  ) : (
                    <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Sẵn sàng ban hành
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Giao diện đối soát song song: Đối chiếu văn bản gốc, kiểm tra người phụ trách, cảnh báo người vắng họp & chuẩn hóa deadline trước khi ban hành
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Split Screen Desktop Toggle */}
            <button
              type="button"
              onClick={() => setIsSplitScreen(!isSplitScreen)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
              title="Bật/Tắt chế độ xem song song biên bản họp"
            >
              <Columns className="w-4 h-4 text-slate-500" />
              <span>{isSplitScreen ? 'Tắt chia đôi màn hình' : 'Bật chia đôi màn hình'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Meeting Details Strip */}
        <div className="bg-slate-50 px-5 py-2.5 border-b border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 flex-wrap text-slate-700">
            <div>
              <span className="text-slate-400 font-medium">Cuộc họp:</span>{' '}
              <strong className="text-slate-900 font-bold">{meeting.title}</strong>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Ngày họp:</span>{' '}
              <strong className="text-blue-600 font-semibold">{formatDateVN(meeting.date)}</strong>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Chủ trì:</span>{' '}
              <strong className="text-slate-800 font-semibold">{meeting.chairperson}</strong>
            </div>
            {meeting.secretary && (
              <div>
                <span className="text-slate-400 font-medium">Thư ký:</span>{' '}
                <strong className="text-slate-800 font-semibold">{meeting.secretary}</strong>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {rawAbsentees.length > 0 && (
              <div className="flex items-center gap-1.5 bg-red-50 text-red-700 px-2.5 py-1 rounded-lg border border-red-200">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>
                  <strong>Vắng mặt:</strong> {rawAbsentees.join(', ')}
                </span>
              </div>
            )}

            {rawLatecomers.length > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg border border-amber-200">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  <strong>Đi muộn:</strong> {rawLatecomers.join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {crossDeptRemoved > 0 && (
          <div className="mx-5 mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs shrink-0 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Đã ẩn <strong>{crossDeptRemoved}</strong> công việc thuộc ban khác khỏi kỳ họp riêng này. Những việc đó do Ban Điều hành xử lý ở kỳ họp toàn CLB.
            </span>
          </div>
        )}

        {/* 3. Mobile View Switcher (Tab BBH vs Tab Tasks) */}
        <div className="lg:hidden px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab('bbh')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              mobileTab === 'bbh'
                ? 'bg-white text-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>📄 Xem Bản Gốc BBH</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('tasks')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              mobileTab === 'tasks'
                ? 'bg-white text-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>✅ Danh Sách Việc ({tasks.length})</span>
          </button>
        </div>

        {/* 4. Main Body: Split-Screen Content */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* CỘT TRÁI: Bản gốc Biên bản họp (Đối soát) */}
          {(isSplitScreen || mobileTab === 'bbh') && (
            <div
              className={`border-r border-slate-200 flex flex-col bg-slate-50/60 overflow-hidden ${
                isSplitScreen ? 'lg:col-span-5' : 'hidden'
              } ${mobileTab === 'bbh' ? 'col-span-1 flex' : 'hidden lg:flex'}`}
            >
              {/* Left Column Header */}
              <div className="p-3.5 border-b border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLeftTab('raw')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      leftTab === 'raw'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Toàn văn BBH</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftTab('summary')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      leftTab === 'summary'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Điểm danh & Tóm tắt</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopyRaw}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer border border-slate-200 text-xs flex items-center gap-1"
                  title="Sao chép văn bản biên bản họp"
                >
                  {copiedRaw ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[11px] text-emerald-600 font-semibold">Đã copy</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium hidden sm:inline">Sao chép</span>
                    </>
                  )}
                </button>
              </div>

              {/* Left Column Search Input */}
              {leftTab === 'raw' && (
                <div className="px-3.5 py-2 border-b border-slate-200 bg-white/70 flex items-center gap-2 shrink-0">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm từ khóa trong biên bản để đối chiếu..."
                    className="w-full text-xs bg-transparent focus:outline-none text-slate-800 placeholder-slate-400"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="text-[11px] text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {/* Left Column Content Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {leftTab === 'raw' ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed select-text">
                    {safeRawContent ? (
                      searchTerm.trim() ? (
                        (() => {
                          try {
                            const escaped = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const regex = new RegExp(`(${escaped})`, 'gi');
                            return safeRawContent.split(regex).map((part, i) =>
                              part.toLowerCase() === searchTerm.trim().toLowerCase() ? (
                                <mark key={i} className="bg-yellow-200 text-slate-900 px-0.5 rounded font-bold">
                                  {part}
                                </mark>
                              ) : (
                                part
                              )
                            );
                          } catch {
                            return safeRawContent;
                          }
                        })()
                      ) : (
                        safeRawContent
                      )
                    ) : (
                      <div className="text-slate-400 italic py-8 text-center font-sans">
                        Chưa có toàn văn biên bản họp (nhập từ link hoặc ảnh OCR). Bạn có thể xem tab "Điểm danh & Tóm tắt".
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 text-xs">
                    {/* Objectives */}
                    {safeObjectives && (
                      <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-1 shadow-2xs">
                        <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>Mục tiêu cuộc họp</span>
                        </h4>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{safeObjectives}</p>
                      </div>
                    )}

                    {/* Attendees & Absentees Card */}
                    <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3 shadow-2xs">
                      <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>Danh sách điểm danh thành viên</span>
                      </h4>

                      <div className="space-y-2">
                        <div>
                          <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                            Có mặt tham gia ({rawAttendees.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {rawAttendees.length > 0 ? (
                              rawAttendees.map((name, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md text-[11px] font-medium border border-slate-200"
                                >
                                  {name}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">Không có dữ liệu</span>
                            )}
                          </div>
                        </div>

                        {rawAbsentees.length > 0 && (
                          <div className="pt-1">
                            <span className="text-[11px] font-semibold text-red-600 block mb-1">
                              Vắng mặt ({rawAbsentees.length}):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {rawAbsentees.map((name, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 bg-red-50 text-red-700 rounded-md text-[11px] font-bold border border-red-200"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Discussion & Action plan */}
                    {safeDiscussion && (
                      <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-1 shadow-2xs">
                        <h4 className="font-bold text-slate-900">Tóm tắt nội dung thảo luận</h4>
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {safeDiscussion}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CỘT PHẢI: Danh sách việc trích xuất & Chuẩn hóa */}
          <div
            className={`flex flex-col bg-slate-50/30 overflow-hidden ${
              isSplitScreen ? 'lg:col-span-7' : 'lg:col-span-12'
            } ${mobileTab === 'tasks' ? 'col-span-1 flex' : 'hidden lg:flex'}`}
          >
            {/* Right Column Header Controls */}
            <div className="p-3.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">Bộ lọc xem:</span>
                <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setTaskFilter('all')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                      taskFilter === 'all'
                        ? 'bg-white text-blue-600 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tất cả ({tasks.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskFilter('issues')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                      taskFilter === 'issues'
                        ? 'bg-white text-amber-600 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    <span>Cần xử lý ({issueCount})</span>
                  </button>
                </div>
              </div>

              {/* Department Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs"
                >
                  <option value="all">Tất cả các ban</option>
                  {allowedDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      Ban {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tasks Cards List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {filteredTasks.length === 0 ? (
                <div className="py-12 text-center space-y-2 bg-white rounded-2xl border border-slate-200 p-8 shadow-2xs">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800">Không có công việc nào cần xử lý</h4>
                  <p className="text-xs text-slate-500">
                    Tất cả các công việc đã được gán đầy đủ người phụ trách và không có cảnh báo.
                  </p>
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const originalIndex = tasks.findIndex((t) => t.tempId === task.tempId);
                  const isMinhAmbiguity = task.hasAmbiguity;
                  const isAbsent = task.isAbsentee;
                  const isPastDeadline = !!task.suggestedDeadline && task.suggestedDeadline < todayISO();

                  return (
                    <div
                      key={task.tempId}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 relative bg-white shadow-2xs hover:shadow-xs ${
                        isMinhAmbiguity
                          ? 'border-amber-300 ring-2 ring-amber-100 bg-amber-50/20'
                          : isAbsent
                          ? 'border-red-300 ring-2 ring-red-100 bg-red-50/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Task Card Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-200">
                            {originalIndex + 1}
                          </span>

                          {/* Department Selector */}
                          <select
                            value={task.suggestedDepartment}
                            onChange={(e) =>
                              handleUpdateTask(task.tempId, {
                                suggestedDepartment: e.target.value as Department,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-blue-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                          >
                            {allowedDepartments.map((dept) => (
                              <option key={dept} value={dept}>
                                Ban {dept}
                              </option>
                            ))}
                          </select>

                          {/* Verification Type Toggle */}
                          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateTask(task.tempId, {
                                  verificationType: 'link_required',
                                })
                              }
                              className={`px-2.5 py-1 rounded-md flex items-center gap-1 font-semibold transition cursor-pointer ${
                                task.verificationType === 'link_required'
                                  ? 'bg-blue-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <LinkIcon className="w-3 h-3" />
                              <span>Cần Link 🔗</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateTask(task.tempId, {
                                  verificationType: 'report_required',
                                })
                              }
                              className={`px-2.5 py-1 rounded-md flex items-center gap-1 font-semibold transition cursor-pointer ${
                                task.verificationType === 'report_required'
                                  ? 'bg-purple-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <FileCheck className="w-3 h-3" />
                              <span>Cần Báo cáo 📝</span>
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.tempId)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title="Xóa công việc này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Task Title & Description Input */}
                      <div className="mb-3 space-y-2">
                        <input
                          type="text"
                          value={task.title}
                          onChange={(e) =>
                            handleUpdateTask(task.tempId, { title: e.target.value })
                          }
                          className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-2xs"
                          placeholder="Tiêu đề nhiệm vụ..."
                        />
                        <textarea
                          value={task.description || ''}
                          onChange={(e) =>
                            handleUpdateTask(task.tempId, { description: e.target.value })
                          }
                          rows={2}
                          className="w-full px-3.5 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none shadow-2xs leading-relaxed"
                          placeholder="Mô tả chi tiết công việc hoặc ghi chú yêu cầu (AI tự động điền nếu biên bản có ghi rõ)..."
                        />
                      </div>

                      {/* SPECIAL AI LOGIC WARNINGS */}
                      
                      {/* 1. Trùng tên thành viên Warning */}
                      {isMinhAmbiguity && (
                        <div className="mb-3.5 p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs space-y-2.5 animate-in fade-in duration-150">
                          <div className="flex items-center gap-2 font-bold text-amber-900">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>⚠️ PHÁT HIỆN TRÙNG TÊN: Tên "{task.rawAssigneeText}" trùng với nhiều thành viên!</span>
                          </div>
                          <p className="text-amber-800">
                            Biên bản họp ghi: <em>"{task.rawAssigneeText}"</em>. AI không tự ý suy đoán. Vui lòng bấm chọn người phụ trách cụ thể bên dưới:
                          </p>
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {Array.isArray(task.ambiguityMatches) && task.ambiguityMatches.length > 0 ? (
                              task.ambiguityMatches.map((match: any) => (
                                <button
                                  key={match.id || match.name}
                                  type="button"
                                  onClick={() =>
                                    handleUpdateTask(task.tempId, {
                                      suggestedAssigneeId: match.id || '',
                                      suggestedAssigneeName: match.name || '',
                                      suggestedDepartment: match.department || task.suggestedDepartment,
                                      suggestedAssigneeIds: match.id ? [match.id] : [],
                                      hasAmbiguity: false,
                                    })
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-600 hover:text-white text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                                >
                                  <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                                  <span>{match.name || 'Thành viên'}</span>
                                  {match.department && (
                                    <span className="opacity-80 font-normal">
                                      ({match.department}{match.role ? ` - ${match.role}` : ''})
                                    </span>
                                  )}
                                </button>
                              ))
                            ) : (
                              (members || [])
                                .filter((m) => m && m.name && m.name.toLowerCase().includes('minh'))
                                .map((m) => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() =>
                                      handleUpdateTask(task.tempId, {
                                        suggestedAssigneeId: m.id,
                                        suggestedAssigneeName: m.name,
                                        suggestedDepartment: m.department,
                                        suggestedAssigneeIds: [m.id],
                                        hasAmbiguity: false,
                                      })
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-600 hover:text-white text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                                  >
                                    <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                                    <span>{m.name}</span>
                                    <span className="opacity-80 font-normal">({m.department})</span>
                                  </button>
                                ))
                            )}
                          </div>
                        </div>
                      )}

                      {/* 2. Cảnh báo hạn chót đã qua */}
                      {isPastDeadline && (
                        <div className="mb-3.5 p-3 bg-orange-50 border border-orange-300 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-orange-900 font-medium">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-orange-600 shrink-0" />
                            <span>
                              Hạn chót <strong>{task.suggestedDeadline}</strong> đã ở quá khứ (do AI hiểu nhầm năm).
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleFixPastDeadline(task.tempId)}
                            className="px-2.5 py-1 rounded-md bg-orange-600 text-white font-bold hover:bg-orange-700 transition cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                          >
                            + Đổi sang 7 ngày tới
                          </button>
                        </div>
                      )}

                      {/* 3. Cảnh báo vắng mặt */}
                      {isAbsent && (
                        <div className="mb-3.5 p-3 bg-red-50 border border-red-300 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-red-900">
                          <div className="flex items-center gap-2 font-bold">
                            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                            <span>
                              🚨 CẢNH BÁO VẮNG MẶT: <strong>{task.suggestedAssigneeName}</strong> nằm trong danh sách VẮNG HỌP của biên bản này!
                            </span>
                          </div>
                          <span className="text-[11px] text-red-700 font-semibold self-start sm:self-auto">
                            Cân nhắc chọn lại người khác bên dưới
                          </span>
                        </div>
                      )}

                      {/* Assignee & Deadline Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs pt-1">
                        {/* Assignee Selector */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                            <span>Người phụ trách (chọn nhiều người hoặc cả ban):</span>
                          </label>
                          <AssigneeMultiSelect
                            members={members.filter((m) => m.department === task.suggestedDepartment)}
                            selectedIds={
                              task.suggestedAssigneeIds ||
                              (task.suggestedAssigneeId ? [task.suggestedAssigneeId] : [])
                            }
                            onChange={(ids) =>
                              handleUpdateTask(task.tempId, {
                                suggestedAssigneeIds: ids,
                                suggestedAssigneeId: ids[0] || '',
                              })
                            }
                          />
                          <p className="text-[10px] text-slate-400 mt-1">
                            Người đầu tiên được chọn là người phụ trách chính nhận đôn đốc.
                          </p>
                        </div>

                        {/* Deadline Selector */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-blue-600" />
                              <span>Hạn chót cụ thể (Deadline):</span>
                            </span>
                            {task.rawDeadlinetext && (
                              <span className="text-[11px] text-slate-500 font-normal italic">
                                (Gốc: {task.rawDeadlinetext})
                              </span>
                            )}
                          </label>
                          <input
                            type="date"
                            value={task.suggestedDeadline}
                            onChange={(e) =>
                              handleUpdateTask(task.tempId, {
                                suggestedDeadline: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
                          />
                        </div>
                      </div>

                    </div>
                  );
                })
              )}

              {/* Add manual task button */}
              <button
                type="button"
                onClick={handleAddNewTask}
                className="w-full py-3.5 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 text-slate-600 hover:text-blue-700 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Thêm công việc thủ công nếu AI trích xuất thiếu</span>
              </button>
            </div>
          </div>

        </div>

        {/* 5. Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span className="font-bold text-slate-800">Đã kiểm tra {tasks.length} công việc.</span>
            <span className="text-slate-400 hidden md:inline">|</span>
            <span className="text-amber-700 font-medium hidden md:inline">
              Nhiệm vụ tuần trước chưa xong sẽ tự động được kế thừa (Quy tắc Sticky Task).
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer w-full sm:w-auto"
            >
              Quay lại
            </button>

            <button
              type="button"
              onClick={handlePublish}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer w-full sm:w-auto"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>Phê Duyệt & Ban Hành Nhiệm Vụ</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};