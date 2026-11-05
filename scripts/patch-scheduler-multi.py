# -*- coding: utf-8 -*-
# Patch scheduler: deadline/overdue notify TẤT CẢ người phụ trách (dedupeKey có memberId)
import io, sys

p = 'server/scheduler.ts'
s = io.open(p, encoding='utf-8').read()

old = """    if (diff === 1) {
      await notify({
        memberId: task.assigneeId,
        type: 'deadline_tomorrow',
        title: '⏰ Ngày mai đến hạn',
        body: `"${task.title}" có hạn chót ngày ${task.deadline}. Vui lòng hoàn thành và nộp minh chứng.`,
        taskId: task.id,
        dedupeKey: `deadline_tomorrow:${task.id}:${today}`,
      });
      cTomorrow++;
    } else if (diff === 0) {
      await notify({
        memberId: task.assigneeId,
        type: 'deadline_today',
        title: '🔥 Hạn chót hôm nay',
        body: `"${task.title}" đến hạn hôm nay. Nộp minh chứng trước khi hết ngày!`,
        taskId: task.id,
        dedupeKey: `deadline_today:${task.id}:${today}`,
      });
      cToday++;
    } else if (diff < 0) {
      const daysOverdue = Math.abs(diff);
      // Nhắc lại mỗi 2 ngày (daysOverdue lẻ -> bỏ qua để tránh spam)
      if (daysOverdue % 2 === 1) continue;
      const head = await departmentHead(task.department);
      const recipients = new Set<string>([task.assigneeId]);
      if (head) recipients.add(head.id);"""

new = """    // Đa phụ trách: tất cả người trong assigneeIds đều nhận nhắc hẹn
    let assigneeIds: string[] = [task.assigneeId];
    try {
      const parsed = JSON.parse(task.assigneeIds);
      if (Array.isArray(parsed) && parsed.length > 0) assigneeIds = parsed;
    } catch {}

    if (diff === 1) {
      for (const memberId of assigneeIds) {
        await notify({
          memberId,
          type: 'deadline_tomorrow',
          title: '⏰ Ngày mai đến hạn',
          body: `"${task.title}" có hạn chót ngày ${task.deadline}. Vui lòng hoàn thành và nộp minh chứng.`,
          taskId: task.id,
          dedupeKey: `deadline_tomorrow:${task.id}:${memberId}:${today}`,
        });
      }
      cTomorrow++;
    } else if (diff === 0) {
      for (const memberId of assigneeIds) {
        await notify({
          memberId,
          type: 'deadline_today',
          title: '🔥 Hạn chót hôm nay',
          body: `"${task.title}" đến hạn hôm nay. Nộp minh chứng trước khi hết ngày!`,
          taskId: task.id,
          dedupeKey: `deadline_today:${task.id}:${memberId}:${today}`,
        });
      }
      cToday++;
    } else if (diff < 0) {
      const daysOverdue = Math.abs(diff);
      // Nhắc lại mỗi 2 ngày (daysOverdue lẻ -> bỏ qua để tránh spam)
      if (daysOverdue % 2 === 1) continue;
      const head = await departmentHead(task.department);
      const recipients = new Set<string>([...assigneeIds]);
      if (head) recipients.add(head.id);"""

if old not in s:
    print('NOT FOUND scheduler block')
    sys.exit(1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s.replace(old, new))
print('ok scheduler multi-assignee')
