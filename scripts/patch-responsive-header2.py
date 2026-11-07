# -*- coding: utf-8 -*-
# Patch còn lại (tolerant)
import io

p = 'src/components/Header.tsx'
s = io.open(p, encoding='utf-8').read()

def rep(old, new):
    global s
    if old in s:
        s = s.replace(old, new, 1)
        print('  ok:', old[:50].replace('\n', ' '))
    else:
        print('  (skip)', old[:50].replace('\n', ' '))

# 3. Lịch (chấp nhận có/không dòng trống trước)
rep(
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

# 4. Nhóm nút cuộn ngang
rep(
    '            <div className="flex items-center gap-1.5 sm:gap-2">',
    '            <div className="flex items-center gap-1 sm:gap-2 flex-nowrap overflow-x-auto max-w-[58vw] md:max-w-none [scrollbar-width:none]">')

# 5. Chào người dùng
rep(
    '              <div className="flex flex-col items-end text-xs hidden sm:flex">',
    '              <div className="flex flex-col items-end text-xs hidden md:flex">')

# 6. Dòng mô tả
rep(
    '<span className="italic">Đăng nhập bằng tài khoản cá nhân — dữ liệu đồng bộ thời gian thực qua máy chủ</span>',
    '<span className="italic hidden md:inline">Đăng nhập bằng tài khoản cá nhân — dữ liệu đồng bộ thời gian thực qua máy chủ</span>')

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('DONE')
