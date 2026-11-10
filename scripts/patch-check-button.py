# -*- coding: utf-8 -*-
# Patch: gộp nút pending_approval thành 1 nút "Kiểm tra" duy nhất
# - Người có quyền duyệt (Chủ nhiệm/Trưởng ban bộ phận): mở modal Kiểm tra (Duyệt / Yêu cầu cập nhật kèm note)
# - Thành viên: giữ "Yêu cầu cập nhật" (gửi yêu cầu kèm ghi chú)
import io, sys

p = 'src/components/TaskCard.tsx'
s = io.open(p, encoding='utf-8').read()

def sub(old, new):
    global s
    if old not in s:
        print('!! NOT FOUND: %r' % old[:80]); sys.exit(1)
    s = s.replace(old, new, 1)
    print('  ok')

# 1) Thêm canReview + onOpenReview cho thành viên thường (mở modal ở chế độ yêu cầu)
sub(
    """          {/* Đang chờ duyệt: Yêu cầu cập nhật (Ban lãnh đạo/TB phản hồi bằng feedback) */}
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
          )}

          {/* Phản hồi yêu cầu cập nhật từ Ban điều hành */}
          {task.updateFeedback && (
            <div className="mt-2 p-2 rounded-lg bg-amber-500/5 border border-amber-300 dark:border-amber-500/30 text-[10px]">
              <div className="text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1 mb-0.5">
                <FileText className="w-3 h-3" /> Phản hồi của Ban điều hành:
              </div>
              <div className="text-slate-700 dark:text-slate-300">{task.updateFeedback}</div>
            </div>
          )}

          {/* Chủ nhiệm Review / Approve Action */}
          {isPresident && task.status === 'pending_approval' && (
            <button
              onClick={() => onOpenReviewModal(task)}
              className="px-3 py-1.5 rounded-lg bg-[#2C69FF]/100 hover:bg-[#1F56D6] text-white text-xs font-bold flex items-center gap-1 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Duyệt minh chứng</span>
            </button>
          )}""",
    """          {/* Đang chờ duyệt: nút 'Kiểm tra' duy nhất — duyệt hoặc yêu cầu cập nhật */}
          {task.status === 'pending_approval' && (canReview || canSubmit) && (
            <button
              onClick={() => onOpenReviewModal(task)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
              title="Kiểm tra minh chứng: duyệt hoặc yêu cầu cập nhật"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Kiểm tra</span>
            </button>
          )}

          {/* Phản hồi yêu cầu cập nhật từ Ban điều hành */}
          {task.updateFeedback && (
            <div className="mt-2 p-2 rounded-lg bg-amber-500/5 border border-amber-300 dark:border-amber-500/30 text-[10px]">
              <div className="text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1 mb-0.5">
                <FileText className="w-3 h-3" /> Phản hồi của Ban điều hành:
              </div>
              <div className="text-slate-700 dark:text-slate-300">{task.updateFeedback}</div>
            </div>
          )}""")

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ALL OK')
