# -*- coding: utf-8 -*-
# Patch: TaskCard — nút 'Yêu cầu cập nhật' thay 'Cập nhật' + feedback hiển thị
import io, sys

p = 'src/components/TaskCard.tsx'
s = io.open(p, encoding='utf-8').read()

def sub(old, new):
    global s
    if old not in s:
        print('!! NOT FOUND: %r' % old[:70]); sys.exit(1)
    s = s.replace(old, new, 1)
    print('  ok')

# 1) Props: onUpdateRequest
sub(
    """  onDeleteTask: (taskId: string) => void;
  onQuickApprove?: (taskId: string) => void;
}""",
    """  onDeleteTask: (taskId: string) => void;
  onQuickApprove?: (taskId: string) => void;
  onUpdateRequest: (task: Task) => void;
}""")
sub(
    """  onDeleteTask,
  onQuickApprove,
}) => {""",
    """  onDeleteTask,
  onQuickApprove,
  onUpdateRequest,
}) => {""")

# 2) Nút Cập nhật -> Yêu cầu cập nhật (luồng mới) + badge chờ phản hồi
sub(
    """        <div className="flex items-center gap-1.5">
          {/* Trưởng ban / Assignee Submit Action */}
          {canSubmit && task.status !== 'completed' && (
            <button
              onClick={() => onOpenSubmitModal(task)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer ${
                task.status === 'pending_approval'
                  ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300'
                  : 'bg-[#2C69FF]/100 hover:bg-[#1F56D6] text-white shadow-sm'
              }`}
            >
              <Send className="w-3 h-3" />
              <span>{task.status === 'pending_approval' ? 'Cập nhật' : 'Nộp bài'}</span>
            </button>
          )}""",
    """        <div className="flex items-center gap-1.5">
          {/* Nộp bài (chưa nộp minh chứng) */}
          {canSubmit && task.status !== 'completed' && task.status !== 'pending_approval' && (
            <button
              onClick={() => onOpenSubmitModal(task)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer bg-[#2C69FF]/100 hover:bg-[#1F56D6] text-white shadow-sm"
            >
              <Send className="w-3 h-3" />
              <span>Nộp bài</span>
            </button>
          )}

          {/* Đang chờ duyệt: Yêu cầu cập nhật (Ban lãnh đạo/TB phản hồi bằng feedback) */}
          {canSubmit && task.status === 'pending_approval' && (
            task.updateRequestedAt && !task.updateFeedback ? (
              <span className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-300 text-[10px] font-bold border border-purple-300 dark:border-purple-500/30 flex items-center gap-1">
                ⏳ Chờ phản hồi yêu cầu
              </span>
            ) : (
              <button
                onClick={() => onUpdateRequest(task)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30"
                title="Gửi yêu cầu cập nhật minh chứng — Ban lãnh đạo/Trưởng ban sẽ phản hồi"
              >
                <Send className="w-3 h-3" />
                <span>Yêu cầu cập nhật</span>
              </button>
            )
          )}""")

# 3) Hiển thị feedback phản hồi
sub(
    """          {/* Chủ nhiệm Review / Approve Action */}""",
    """          {/* Phản hồi yêu cầu cập nhật từ Ban điều hành */}
          {task.updateFeedback && (
            <div className="mt-2 p-2 rounded-lg bg-amber-500/5 border border-amber-300 dark:border-amber-500/30 text-[10px]">
              <div className="text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1 mb-0.5">
                <FileText className="w-3 h-3" /> Phản hồi của Ban điều hành:
              </div>
              <div className="text-slate-700 dark:text-slate-300">{task.updateFeedback}</div>
            </div>
          )}

          {/* Chủ nhiệm Review / Approve Action */}""")

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ALL OK')
