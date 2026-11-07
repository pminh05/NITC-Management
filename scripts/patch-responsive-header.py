# -*- coding: utf-8 -*-
# Patch responsive Header (đúng thụt lề 14 spaces)
import io, sys

p = 'src/components/Header.tsx'
s = io.open(p, encoding='utf-8').read()

def sub(old, new):
    global s
    if old not in s:
        print('!! NOT FOUND: %r' % old[:80]); sys.exit(1)
    s = s.replace(old, new, 1)
    print('  ok')

# 1. Nút AI
sub(
    """                <button
                  onClick={onOpenBBHParser}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2C69FF]/100 hover:bg-[#1F56D6] text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                  title="Dán biên bản họp — AI tự trích xuất công việc"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Nhập biên bản (AI)</span>
                </button>""",
    """                <button
                  onClick={onOpenBBHParser}
                  className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-[#2C69FF] hover:bg-[#1F56D6] text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                  title="Dán biên bản họp — AI tự trích xuất công việc"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Nhập biên bản (AI)</span>
                </button>""")

# 2. Kho biên bản
sub(
    """              <button
                onClick={onOpenMeetingHistory}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
                title="Lưu trữ biên bản họp & Xuất PDF"
              >
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden lg:inline">Kho biên bản</span>
              </button>""",
    """              <button
                onClick={onOpenMeetingHistory}
                className="inline-flex items-center gap-1.5 px-2 py-1.5 md:px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer whitespace-nowrap shrink-0"
                title="Lưu trữ biên bản họp & Xuất PDF"
              >
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden md:inline">Kho biên bản</span>
              </button>""")

# 3. Lịch
sub(
    """              <button
                onClick={onOpenCalendar}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
                title="Lịch deadline & kỳ họp"
              >
                <Calendar className="w-3.5 h-3.5 text-violet-400" />
                <span className="hidden md:inline">Lịch</span>
              </button>""",
    """              <button
                onClick={onOpenCalendar}
                className="inline-flex items-center gap-1.5 px-2 py-1.5 md:px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer whitespace-nowrap shrink-0"
                title="Lịch deadline & kỳ họp"
              >
                <Calendar className="w-3.5 h-3.5 text-violet-400" />
                <span className="hidden md:inline">Lịch</span>
              </button>""")

# 4. Nhóm nút: cuộn ngang khi chật
sub(
    '            <div className="flex items-center gap-1.5 sm:gap-2">',
    '            <div className="flex items-center gap-1 sm:gap-2 flex-nowrap overflow-x-auto max-w-[58vw] md:max-w-none [scrollbar-width:none]">')

# 5. Chào người dùng ẩn trên mobile
sub(
    '              <div className="flex flex-col items-end text-xs hidden sm:flex">',
    '              <div className="flex flex-col items-end text-xs hidden md:flex">')

# 6. Dòng mô tả dài ẩn trên mobile
sub(
    '<span className="italic">Đăng nhập bằng tài khoản cá nhân — dữ liệu đồng bộ thời gian thực qua máy chủ</span>',
    '<span className="italic hidden md:inline">Đăng nhập bằng tài khoản cá nhân — dữ liệu đồng bộ thời gian thực qua máy chủ</span>')

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ALL OK')
