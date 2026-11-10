# -*- coding: utf-8 -*-
# Patch: EvidenceReviewModal — nhãn "Kiểm tra / Yêu cầu cập nhật kèm note" + hiện ghi chú yêu cầu của thành viên
import io, sys

p = 'src/components/EvidenceReviewModal.tsx'
s = io.open(p, encoding='utf-8').read()

def sub(old, new):
    global s
    if old not in s:
        print('!! NOT FOUND: %r' % old[:80]); sys.exit(1)
    s = s.replace(old, new, 1)
    print('  ok')

# 1. Tiêu đề + phụ đề
sub(
    """              <h3 className="font-bold text-white text-base">
                Duyệt Bằng Chứng Hoàn Thành
              </h3>
              <p className="text-xs text-slate-400">
                Quyền hạn Chủ nhiệm &bull; Xác minh tính trách nhiệm
              </p>""",
    """              <h3 className="font-bold text-white text-base">
                Kiểm tra minh chứng
              </h3>
              <p className="text-xs text-slate-400">
                Duyệt hoàn thành hoặc yêu cầu cập nhật kèm ghi chú
              </p>""")

# 2. Hiện ghi chú yêu cầu cập nhật của thành viên (nếu có)
sub(
    """          {/* Evidence Content Card */}""",
    """          {/* Ghi chú yêu cầu cập nhật từ thành viên */}
          {task.updateRequestedAt && !task.updateFeedback && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-1">
              <div className="text-purple-300 font-bold text-xs">📥 Yêu cầu cập nhật từ thành viên</div>
              <div className="text-slate-300">{task.updateRequestNote || '(Không ghi chú kèm theo)'}</div>
              <div className="text-[10px] text-slate-500">Gửi {formatDateTimeVN(task.updateRequestedAt)}</div>
            </div>
          )}

          {/* Evidence Content Card */}""")

# 3. Nhãn lời phê trung tính (Phó CN cũng duyệt được)
sub(
    '<span>Lời phê của Chủ nhiệm (Ghi chú duyệt hoàn thành):</span>',
    '<span>Lời phê khi duyệt (tùy chọn):</span>')

# 4. Nút "Yêu cầu làm lại" -> "Yêu cầu cập nhật"
sub(
    """                Yêu cầu làm lại ↩️
              </button>""",
    """                Yêu cầu cập nhật 🔄
              </button>""")

# 5. Nhãn lý do -> nội dung cần cập nhật
sub(
    """                <span>Lý do yêu cầu làm lại:</span>""",
    """                <span>Nội dung cần cập nhật (cho thành viên biết cần sửa gì):</span>""")

# 6. Nút gửi
sub(
    """                Gửi Yêu Cầu Nộp Lại
              </button>""",
    """                Gửi Yêu Cầu Cập Nhật
              </button>""")

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ALL OK')
