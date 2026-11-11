import React, { useState, useMemo, useEffect } from 'react';
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
  Sparkles,
} from 'lucide-react';
import { Department, ExtractedDraftTask, Meeting, Member } from '../types';
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
  // 1. Phân quyền và phòng ban được phép
  const isDeptHead = authMember?.role === 'Trưởng ban' || authMember?.role === 'Phó ban';
  const myDepartment = authMember?.department || 'Ban Chủ nhiệm';
  const allowedDepartments: Department[] = isDeptHead
    ? [myDepartment]
    : ['Học thuật', 'Truyền thông', 'Sự kiện', 'Đối ngoại', 'Ban Chủ nhiệm'];

  // 2. State hooks (Luôn ở top-level)
  const [tasks, setTasks] = useState<ExtractedDraftTask[]>([]);
  const [meeting, setMeeting] = useState<Partial<Meeting>>({});
  const [crossDeptRemoved, setCrossDeptRemoved] = useState(0);

  // Split-screen controls & tabs
  const [isSplitScreen, setIsSplitScreen] = useState(true);
  const [leftTab, setLeftTab] = useState<'raw' | 'summary'>('raw');
  const [mobileTab, setMobileTab] = useState<'bbh' | 'tasks'>('tasks');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'issues'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  // 3. Effect hooks
  useEffect(() => {
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

  useEffect(() => {
    setMeeting(meetingData || {});
  }, [meetingData]);

  // 4. Memoized values (Luôn gọi trước lệnh return)
  const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks.filter(Boolean) : []), [tasks]);

  const rawAttendees = useMemo(() => {
    return Array.isArray(meeting.attendees)
      ? meeting.attendees.map((x: any) => (typeof x === 'string' ? x : x?.name || JSON.stringify(x))).filter(Boolean)
      : [];
  }, [meeting.attendees]);

  const rawAbsentees = useMemo(() => {
    return Array.isArray(meeting.absentees)
      ? meeting.absentees.map((x: any) => (typeof x === 'string' ? x : x?.name || JSON.stringify(x))).filter(Boolean)
      : [];
  }, [meeting.absentees]);

  const rawLatecomers = useMemo(() => {
    return Array.isArray(meeting.latecomers)
      ? meeting.latecomers.map((x: any) => (typeof x === 'string' ? x : x?.name || JSON.stringify(x))).filter(Boolean)
      : [];
  }, [meeting.latecomers]);

  const safeObjectives = typeof meeting.objectives === 'string' ? meeting.objectives : '';
  const safeDiscussion = typeof meeting.discussionSummary === 'string' ? meeting.discussionSummary : '';
  const safeRawContent = typeof meeting.rawContent === 'string' ? meeting.rawContent : '';

  const issueCount = useMemo(() => {
    return safeTasks.filter(
      (t) => t.hasAmbiguity || t.isAbsentee || (t.suggestedDeadline && t.suggestedDeadline < todayISO()) || !t.suggestedAssigneeId
    ).length;
  }, [safeTasks]);

  const filteredTasks = useMemo(() => {
    return safeTasks.filter((t) => {
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
  }, [safeTasks, taskFilter, departmentFilter]);

  // 5. Early return (ĐẶT SAU TẤT CẢ CÁC HOOKS để tuân thủ Rules of Hooks)
  if (!isOpen) return null;

  // Handlers
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
            const isAbs = rawAbsentees.some(
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
    const defaultMember = members[1] || members[0] || { id: 'mem-1', name: 'Thành viên', department: 'Học thuật' };
    const newTask: ExtractedDraftTask = {
      tempId: `draft-manual-${Date.now()}`,
      title: 'Công việc bổ sung mới',
      rawAssigneeText: defaultMember.name,
      suggestedAssigneeId: defaultMember.id,
      suggestedAssigneeName: defaultMember.name,
      suggestedAssigneeIds: [defaultMember.id],
      suggestedDepartment: defaultMember.department as Department,
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
    if (safeRawContent) {
      navigator.clipboard.writeText(safeRawContent);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    }
  };

  const handleFixPastDeadline = (tempId: string) => {
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    handleUpdateTask(tempId, { suggestedDeadline: nextWeek });
  };

  const handlePublish = () => {
    const unresolvedTask = safeTasks.find((t) => !t.suggestedAssigneeId || t.hasAmbiguity);
    if (unresolvedTask) {
      alert(
        `⚠️ Chú ý: Công việc "${unresolvedTask.title}" chưa được gán người phụ trách cụ thể hoặc còn trùng tên! Vui lòng chọn người trước khi ban hành.`
      );
      return;
    }

    const finalMeeting: Meeting = {
      id: `meet-${Date.now()}`,
      title: typeof meeting.title === 'string' ? meeting.title : 'Biên bản họp Ban Điều Hành',
      date: typeof meeting.date === 'string' ? meeting.date : new Date().toISOString().split('T')[0],
      chairperson: typeof meeting.chairperson === 'string' ? meeting.chairperson : 'Lê Hồng Phúc Minh',
      secretary: typeof meeting.secretary === 'string' ? meeting.secretary : 'Nguyễn Thị Ngọc Ánh',
      attendees: rawAttendees,
      absentees: rawAbsentees,
      discussionSummary: safeDiscussion,
      actionPlan: typeof meeting.actionPlan === 'string' ? meeting.actionPlan : '',
      rawContent: safeRawContent,
      taskCount: safeTasks.length,
      completedTaskCount: 0,
      createdAt: new Date().toISOString(),
    };

    onPublishTasks(finalMeeting, safeTasks);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-hidden">
      <div className="bg-white border border-slate-300 rounded-2xl w-full max-w-[1560px] h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* 1. Modal Top Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-2xs">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Đối Soát & Chuẩn Hóa Nhiệm Vụ (Split-Screen Review)
                </h2>
                <div className="flex items-center gap-1.5">
                  <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-blue-300">
                    {safeTasks.length} nhiệm vụ
                  </span>
                  {issueCount > 0 ? (
                    <span className="bg-amber-100 text-amber-900 text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-300 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      {issueCount} cần lưu ý
                    </span>
                  ) : (
                    <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-300 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Sẵn sàng ban hành
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Giao diện đối soát song song: Đối chiếu văn bản gốc bên trái và điều chỉnh nhiệm vụ bên phải trước khi ban hành
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Split Screen Desktop Toggle */}
            <button
              type="button"
              onClick={() => setIsSplitScreen(!isSplitScreen)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-300 hover:bg-slate-100 text-slate-700 transition cursor-pointer shadow-2xs"
              title="Bật/Tắt chế độ xem song song biên bản họp"
            >
              <Columns className="w-4 h-4 text-blue-600" />
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
        <div className="bg-slate-100/90 px-5 py-2.5 border-b border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 flex-wrap text-slate-700">
            <div>
              <span className="text-slate-500 font-medium">Cuộc họp:</span>{' '}
              <strong className="text-slate-900 font-bold">{meeting.title || 'Biên bản họp Ban Điều Hành'}</strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Ngày họp:</span>{' '}
              <strong className="text-blue-700 font-bold">{formatDateVN(meeting.date)}</strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Chủ trì:</span>{' '}
              <strong className="text-slate-800 font-semibold">{meeting.chairperson || 'Lê Hồng Phúc Minh'}</strong>
            </div>
            {meeting.secretary && (
              <div>
                <span className="text-slate-500 font-medium">Thư ký:</span>{' '}
                <strong className="text-slate-800 font-semibold">{meeting.secretary}</strong>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {rawAbsentees.length > 0 && (
              <div className="flex items-center gap-1.5 bg-red-100 text-red-900 px-2.5 py-1 rounded-lg border border-red-300 font-medium shadow-2xs">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>
                  <strong>Vắng mặt:</strong> {rawAbsentees.join(', ')}
                </span>
              </div>
            )}

            {rawLatecomers.length > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-100 text-amber-950 px-2.5 py-1 rounded-lg border border-amber-300 font-medium shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  <strong>Đi muộn:</strong> {rawLatecomers.join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {crossDeptRemoved > 0 && (
          <div className="mx-5 mt-2.5 p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs shrink-0 flex items-center gap-2">
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
            <span>✅ Danh Sách Việc ({safeTasks.length})</span>
          </button>
        </div>

        {/* 4. Main Body: Split-Screen Content */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-100/70">
          
          {/* CỘT TRÁI: Bản gốc Biên bản họp (Đối soát) */}
          {(isSplitScreen || mobileTab === 'bbh') && (
            <div
              className={`border-r border-slate-300 flex flex-col bg-slate-50 overflow-hidden ${
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
                        ? 'bg-blue-600 text-white shadow-2xs'
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
                        ? 'bg-blue-600 text-white shadow-2xs'
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
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer border border-slate-300 text-xs flex items-center gap-1 shadow-2xs bg-white"
                  title="Sao chép văn bản biên bản họp"
                >
                  {copiedRaw ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[11px] text-emerald-600 font-semibold">Đã copy</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-[11px] font-medium hidden sm:inline">Sao chép</span>
                    </>
                  )}
                </button>
              </div>

              {/* Left Column Search Input */}
              {leftTab === 'raw' && (
                <div className="px-3.5 py-2 border-b border-slate-200 bg-white flex items-center gap-2 shrink-0">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm từ khóa trong biên bản để đối chiếu..."
                    className="w-full text-xs bg-transparent focus:outline-none text-slate-800 placeholder-slate-400 font-medium"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="text-[11px] text-slate-400 hover:text-slate-600 px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {/* Left Column Content Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {leftTab === 'raw' ? (
                  <div className="bg-white rounded-xl border border-slate-300 p-4 shadow-sm font-mono text-xs text-slate-900 whitespace-pre-wrap leading-relaxed select-text">
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
                        Chưa có toàn văn biên bản họp. Bạn có thể xem tab "Điểm danh & Tóm tắt".
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 text-xs">
                    {/* Objectives */}
                    {safeObjectives && (
                      <div className="bg-white rounded-xl border border-slate-300 p-3.5 space-y-1 shadow-2xs">
                        <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>Mục tiêu cuộc họp</span>
                        </h4>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{safeObjectives}</p>
                      </div>
                    )}

                    {/* Attendees & Absentees Card */}
                    <div className="bg-white rounded-xl border border-slate-300 p-3.5 space-y-3 shadow-2xs">
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
                                  className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md text-[11px] font-medium border border-slate-300"
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
                                  className="px-2 py-0.5 bg-red-100 text-red-800 rounded-md text-[11px] font-bold border border-red-300"
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
                      <div className="bg-white rounded-xl border border-slate-300 p-3.5 space-y-1 shadow-2xs">
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
            className={`flex flex-col bg-slate-100/60 overflow-hidden ${
              isSplitScreen ? 'lg:col-span-7' : 'lg:col-span-12'
            } ${mobileTab === 'tasks' ? 'col-span-1 flex' : 'hidden lg:flex'}`}
          >
            {/* Right Column Header Controls */}
            <div className="p-3.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">Bộ lọc xem:</span>
                <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setTaskFilter('all')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                      taskFilter === 'all'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tất cả ({safeTasks.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskFilter('issues')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                      taskFilter === 'issues'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Cần xử lý ({issueCount})</span>
                  </button>
                </div>
              </div>

              {/* Department Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
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
                <div className="py-12 text-center space-y-2 bg-white rounded-2xl border border-slate-300 p-8 shadow-xs">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800">Không có công việc nào cần xử lý</h4>
                  <p className="text-xs text-slate-500">
                    Tất cả các công việc đã được gán đầy đủ người phụ trách và không có cảnh báo.
                  </p>
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const originalIndex = safeTasks.findIndex((t) => t.tempId === task.tempId);
                  const isMinhAmbiguity = task.hasAmbiguity;
                  const isAbsent = task.isAbsentee;
                  const isPastDeadline = !!task.suggestedDeadline && task.suggestedDeadline < todayISO();

                  return (
                    <div
                      key={task.tempId}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 relative bg-white shadow-xs hover:shadow-sm ${
                        isMinhAmbiguity
                          ? 'border-2 border-amber-400 bg-amber-50/40'
                          : isAbsent
                          ? 'border-2 border-red-400 bg-red-50/40'
                          : 'border border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {/* Task Card Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs border border-slate-300 shadow-2xs">
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
                            className={`px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer shadow-2xs ${
                              task.suggestedDepartment === 'Học thuật'
                                ? 'bg-sky-50 border-sky-300 text-sky-800'
                                : task.suggestedDepartment === 'Truyền thông'
                                ? 'bg-pink-50 border-pink-300 text-pink-800'
                                : task.suggestedDepartment === 'Sự kiện'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : task.suggestedDepartment === 'Đối ngoại'
                                ? 'bg-purple-50 border-purple-300 text-purple-800'
                                : 'bg-amber-50 border-amber-300 text-amber-900'
                            }`}
                          >
                            {allowedDepartments.map((dept) => (
                              <option key={dept} value={dept}>
                                Ban {dept}
                              </option>
                            ))}
                          </select>

                          {/* Verification Type Toggle */}
                          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-300 text-xs">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateTask(task.tempId, {
                                  verificationType: 'link_required',
                                })
                              }
                              className={`px-2.5 py-1 rounded-md flex items-center gap-1 font-bold transition cursor-pointer ${
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
                              className={`px-2.5 py-1 rounded-md flex items-center gap-1 font-bold transition cursor-pointer ${
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
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition cursor-pointer"
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
                          className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-2xs"
                          placeholder="Tiêu đề nhiệm vụ..."
                        />
                        <textarea
                          value={task.description || ''}
                          onChange={(e) =>
                            handleUpdateTask(task.tempId, { description: e.target.value })
                          }
                          rows={2}
                          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 resize-none shadow-2xs leading-relaxed"
                          placeholder="Mô tả chi tiết công việc hoặc ghi chú yêu cầu (AI tự động điền nếu biên bản có ghi rõ)..."
                        />
                      </div>

                      {/* SPECIAL AI LOGIC WARNINGS */}
                      
                      {/* 1. Trùng tên thành viên Warning */}
                      {isMinhAmbiguity && (
                        <div className="mb-3.5 p-3.5 bg-amber-100/90 border border-amber-400 rounded-xl text-xs space-y-2.5 animate-in fade-in duration-150 shadow-2xs">
                          <div className="flex items-center gap-2 font-bold text-amber-950">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>⚠️ PHÁT HIỆN TRÙNG TÊN: Tên "{task.rawAssigneeText}" trùng với nhiều thành viên!</span>
                          </div>
                          <p className="text-amber-900 font-medium">
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
                                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-600 hover:text-white text-amber-950 border border-amber-400 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
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
                                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-600 hover:text-white text-amber-950 border border-amber-400 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
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
                        <div className="mb-3.5 p-3 bg-orange-100/90 border border-orange-400 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-orange-950 font-medium shadow-2xs">
                          <div className="flex items-center gap-2 font-bold">
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
                        <div className="mb-3.5 p-3 bg-red-100/90 border border-red-400 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-red-950 shadow-2xs">
                          <div className="flex items-center gap-2 font-bold">
                            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                            <span>
                              🚨 CẢNH BÁO VẮNG MẶT: <strong>{task.suggestedAssigneeName}</strong> nằm trong danh sách VẮNG HỌP của biên bản này!
                            </span>
                          </div>
                          <span className="text-[11px] text-red-800 font-bold self-start sm:self-auto">
                            Cân nhắc chọn lại người khác bên dưới
                          </span>
                        </div>
                      )}

                      {/* Assignee & Deadline Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs pt-1">
                        {/* Assignee Selector */}
                        <div>
                          <label className="block text-slate-800 font-bold mb-1.5 flex items-center gap-1.5">
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
                          <p className="text-[10px] text-slate-500 font-medium mt-1">
                            Người đầu tiên được chọn là người phụ trách chính nhận đôn đốc.
                          </p>
                        </div>

                        {/* Deadline Selector */}
                        <div>
                          <label className="block text-slate-800 font-bold mb-1.5 flex items-center justify-between">
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
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 shadow-2xs"
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
                className="w-full py-3.5 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-slate-700 hover:text-blue-700 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer bg-white"
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
            <span className="font-bold text-slate-800">Đã kiểm tra {safeTasks.length} công việc.</span>
            <span className="text-slate-400 hidden md:inline">|</span>
            <span className="text-amber-800 font-semibold hidden md:inline">
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
