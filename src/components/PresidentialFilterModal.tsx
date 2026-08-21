import React, { useState } from 'react';
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
  Sparkles,
  HelpCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Department, ExtractedDraftTask, Meeting, Member, Role, VerificationType } from '../types';
import { formatDateVN } from '../utils/dateUtils';

interface PresidentialFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingData: Partial<Meeting>;
  draftTasks: ExtractedDraftTask[];
  members: Member[];
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
  onPublishTasks,
}) => {
  const [tasks, setTasks] = useState<ExtractedDraftTask[]>(initialDraftTasks);
  const [meeting, setMeeting] = useState<Partial<Meeting>>(meetingData);

  // Sync when initial draft tasks change
  React.useEffect(() => {
    setTasks(initialDraftTasks);
  }, [initialDraftTasks]);

  React.useEffect(() => {
    setMeeting(meetingData);
  }, [meetingData]);

  if (!isOpen) return null;

  const handleUpdateTask = (tempId: string, updates: Partial<ExtractedDraftTask>) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.tempId !== tempId) return t;
        const updated = { ...t, ...updates };

        // If assignee changed, re-check absentee and clear ambiguity flag if manually resolved
        if (updates.suggestedAssigneeId) {
          const selectedMember = members.find((m) => m.id === updates.suggestedAssigneeId);
          if (selectedMember) {
            updated.suggestedAssigneeName = selectedMember.name;
            updated.suggestedDepartment = selectedMember.department;
            updated.hasAmbiguity = false;

            // check if selected member is in absentees
            const isAbs = (meeting.absentees || []).some((abs) =>
              abs.toLowerCase().includes(selectedMember.name.toLowerCase()) ||
              selectedMember.name.toLowerCase().includes(abs.toLowerCase())
            );
            updated.isAbsentee = isAbs;
            if (isAbs) {
              if (!updated.warningMessages.some(m => m.includes('VẮNG HỌP'))) {
                updated.warningMessages = [...updated.warningMessages, `🚨 Cảnh báo: ${selectedMember.name} VẮNG HỌP!`];
              }
            } else {
              updated.warningMessages = updated.warningMessages.filter(m => !m.includes('VẮNG HỌP') && !m.includes('Quy tắc "Minh"'));
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
      reasoning: 'Chủ tịch bổ sung thủ công',
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const handlePublish = () => {
    // Check if any task still has unresolved ambiguity or missing assignee
    const unresolvedTask = tasks.find((t) => !t.suggestedAssigneeId || t.hasAmbiguity);
    if (unresolvedTask) {
      alert(`⚠️ Chú ý: Công việc "${unresolvedTask.title}" chưa được gán người phụ trách cụ thể! Vui lòng chọn người trước khi ban hành.`);
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

  const departments: Department[] = ['Học thuật', 'Truyền thông', 'Sự kiện', 'Đối ngoại', 'Ban Chủ nhiệm'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Bộ Lọc Của Chủ Tịch (Presidential Filter)
                </h2>
                <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-indigo-500/30">
                  {tasks.length} Việc trích xuất
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Đối chiếu chuyên sâu: Giải quyết trùng tên "Minh", cảnh báo người Vắng họp & chuẩn hóa hạn chót
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Meeting Details Bar */}
        <div className="bg-slate-950 px-6 py-3 border-b border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 flex-wrap text-slate-300">
            <div>
              <span className="text-slate-400">Cuộc họp:</span>{' '}
              <strong className="text-white">{meeting.title}</strong>
            </div>
            <div>
              <span className="text-slate-400">Ngày họp:</span>{' '}
              <strong className="text-sky-400">{formatDateVN(meeting.date)}</strong>
            </div>
            <div>
              <span className="text-slate-400">Chủ trì:</span>{' '}
              <strong className="text-white">{meeting.chairperson}</strong>
            </div>
          </div>

          {meeting.absentees && meeting.absentees.length > 0 && (
            <div className="flex items-center gap-1.5 bg-red-500/10 text-red-300 px-2.5 py-1 rounded-lg border border-red-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>
                <strong>Vắng mặt:</strong> {meeting.absentees.join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Task Review List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-slate-200">
          
          {tasks.map((task, index) => {
            const isMinhAmbiguity = task.hasAmbiguity;
            const isAbsent = task.isAbsentee;

            return (
              <div
                key={task.tempId}
                className={`p-4 rounded-xl border transition relative ${
                  isMinhAmbiguity
                    ? 'bg-amber-950/20 border-amber-500/50 shadow-md shadow-amber-950/20'
                    : isAbsent
                    ? 'bg-red-950/20 border-red-500/50 shadow-md shadow-red-950/20'
                    : 'bg-slate-800/60 border-slate-700/70 hover:border-slate-600'
                }`}
              >
                {/* Index tag */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-6 h-6 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs">
                      {index + 1}
                    </span>

                    {/* Department tag */}
                    <select
                      value={task.suggestedDepartment}
                      onChange={(e) =>
                        handleUpdateTask(task.tempId, {
                          suggestedDepartment: e.target.value as Department,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-sky-400 focus:outline-none"
                    >
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          Ban {dept}
                        </option>
                      ))}
                    </select>

                    {/* Verification Type pill */}
                    <div className="flex items-center rounded-lg bg-slate-900 p-0.5 border border-slate-700 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateTask(task.tempId, {
                            verificationType: 'link_required',
                          })
                        }
                        className={`px-2 py-0.5 rounded flex items-center gap-1 font-medium transition ${
                          task.verificationType === 'link_required'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-white'
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
                        className={`px-2 py-0.5 rounded flex items-center gap-1 font-medium transition ${
                          task.verificationType === 'report_required'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <FileCheck className="w-3 h-3" />
                        <span>Cần Báo cáo 📝</span>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteTask(task.tempId)}
                    className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700/50 transition"
                    title="Xóa công việc này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Task Title Edit */}
                <div className="mb-3">
                  <input
                    type="text"
                    value={task.title}
                    onChange={(e) =>
                      handleUpdateTask(task.tempId, { title: e.target.value })
                    }
                    className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-700 rounded-lg text-sm text-white font-medium focus:outline-none focus:border-indigo-500"
                    placeholder="Tên đầu việc..."
                  />
                </div>

                {/* SPECIAL LOGIC WARNINGS */}
                {/* 1. Quy tắc "Minh" Ambiguity Warning */}
                {isMinhAmbiguity && (
                  <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span>⚠️ QUY TẮC "MINH": Phát hiện tên "Minh" trùng với nhiều thành viên!</span>
                    </div>
                    <p className="text-amber-200/90">
                      BBH ghi: <em>"{task.rawAssigneeText}"</em>. AI không được tự đoán. Chủ tịch vui lòng chọn chính xác người phụ trách:
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {task.ambiguityMatches.length > 0 ? (
                        task.ambiguityMatches.map((match) => (
                          <button
                            key={match.id}
                            type="button"
                            onClick={() =>
                              handleUpdateTask(task.tempId, {
                                suggestedAssigneeId: match.id,
                                suggestedAssigneeName: match.name,
                                suggestedDepartment: match.department,
                                hasAmbiguity: false,
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-200 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>{match.name}</span>
                            <span className="opacity-75">({match.department} - {match.role})</span>
                          </button>
                        ))
                      ) : (
                        members
                          .filter((m) => m.name.toLowerCase().includes('minh'))
                          .map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() =>
                                handleUpdateTask(task.tempId, {
                                  suggestedAssigneeId: m.id,
                                  suggestedAssigneeName: m.name,
                                  suggestedDepartment: m.department,
                                  hasAmbiguity: false,
                                })
                              }
                              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-200 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>{m.name}</span>
                              <span className="opacity-75">({m.department})</span>
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Absentee Warning */}
                {isAbsent && (
                  <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/40 rounded-xl text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-red-400 font-semibold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        🚨 CẢNH BÁO VẮNG MẶT: <strong>{task.suggestedAssigneeName}</strong> nằm trong danh sách VẮNG HỌP của BBH này!
                      </span>
                    </div>
                    <span className="text-[11px] text-red-300">Cân nhắc đổi người hoặc xác nhận giao</span>
                  </div>
                )}

                {/* Assignee & Deadline Selectors Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Assignee */}
                  <div>
                    <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Người phụ trách (Gán theo thành viên NITC):</span>
                    </label>
                    <select
                      value={task.suggestedAssigneeId || ''}
                      onChange={(e) =>
                        handleUpdateTask(task.tempId, {
                          suggestedAssigneeId: e.target.value,
                        })
                      }
                      className={`w-full px-3 py-2 bg-slate-900 border rounded-lg text-xs font-medium focus:outline-none ${
                        !task.suggestedAssigneeId
                          ? 'border-amber-500 text-amber-300 bg-amber-950/30'
                          : 'border-slate-700 text-white'
                      }`}
                    >
                      <option value="">-- Chưa chọn người phụ trách --</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.department} - {m.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Deadline */}
                  <div>
                    <label className="block text-slate-400 font-medium mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-sky-400" />
                        <span>Hạn chót (Deadline cụ thể):</span>
                      </span>
                      {task.rawDeadlinetext && (
                        <span className="text-[11px] text-slate-400 italic">
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
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

              </div>
            );
          })}

          {/* Add new task button */}
          <button
            type="button"
            onClick={handleAddNewTask}
            className="w-full py-3 rounded-xl border border-dashed border-slate-700 hover:border-indigo-500 hover:bg-slate-800/40 text-slate-400 hover:text-indigo-300 text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm công việc thủ công nếu AI trích xuất thiếu</span>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/95 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-10">
          <div className="text-xs text-slate-400">
            <span>Đã kiểm tra {tasks.length} công việc. </span>
            <span className="text-amber-400 font-medium">
              Tất cả việc chưa hoàn thành từ tuần trước sẽ tự động được giữ lại (Quy tắc Sticky Task).
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Quay lại
            </button>

            <button
              type="button"
              onClick={handlePublish}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-4.5 h-4.5 text-white" />
              <span>Phê Duyệt & Ban Hành Vào Hệ Thống</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
