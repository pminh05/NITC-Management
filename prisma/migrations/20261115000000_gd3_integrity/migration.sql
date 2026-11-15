-- GĐ3: ràng buộc toàn vẹn — email thành viên duy nhất, chỉ mục truy vấn, người nghiệm thu, nhiệm kỳ của việc/kỳ họp.
-- Không xóa hay sửa dữ liệu nghiệp vụ; chỉ thêm cột (NULL), chỉ mục, và gán nhiệm kỳ hiện hành cho bản ghi cũ.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT 'Ban Chủ nhiệm',
    "date" TEXT NOT NULL,
    "time" TEXT,
    "location" TEXT,
    "chairperson" TEXT NOT NULL,
    "secretary" TEXT NOT NULL,
    "attendees" TEXT NOT NULL,
    "absentees" TEXT NOT NULL,
    "latecomers" TEXT NOT NULL DEFAULT '[]',
    "objectives" TEXT NOT NULL DEFAULT '',
    "discussionSummary" TEXT NOT NULL,
    "actionPlan" TEXT NOT NULL,
    "rawContent" TEXT NOT NULL,
    "termId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Meeting_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Meeting" ("absentees", "actionPlan", "attendees", "chairperson", "createdAt", "date", "department", "discussionSummary", "id", "latecomers", "location", "objectives", "rawContent", "secretary", "time", "title") SELECT "absentees", "actionPlan", "attendees", "chairperson", "createdAt", "date", "department", "discussionSummary", "id", "latecomers", "location", "objectives", "rawContent", "secretary", "time", "title" FROM "Meeting";
DROP TABLE "Meeting";
ALTER TABLE "new_Meeting" RENAME TO "Meeting";
CREATE INDEX "Meeting_termId_idx" ON "Meeting"("termId");
CREATE INDEX "Meeting_department_idx" ON "Meeting"("department");
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT NOT NULL,
    "assigneeName" TEXT NOT NULL,
    "assigneeIds" TEXT NOT NULL DEFAULT '[]',
    "department" TEXT NOT NULL,
    "deadline" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "verificationType" TEXT NOT NULL,
    "evidenceLink" TEXT,
    "evidenceReport" TEXT,
    "evidenceSubmittedAt" TEXT,
    "approvalNote" TEXT,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "rejectedReason" TEXT,
    "updateRequestedAt" TEXT,
    "updateRequestNote" TEXT,
    "updateRequestById" TEXT,
    "updateFeedback" TEXT,
    "sourceMeetingId" TEXT,
    "priority" TEXT,
    "isSticky" BOOLEAN NOT NULL DEFAULT false,
    "stickyWeeksCount" INTEGER,
    "createdById" TEXT,
    "termId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_sourceMeetingId_fkey" FOREIGN KEY ("sourceMeetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("approvalNote", "assigneeId", "assigneeIds", "assigneeName", "createdAt", "createdById", "deadline", "department", "description", "evidenceLink", "evidenceReport", "evidenceSubmittedAt", "id", "isSticky", "priority", "rejectedReason", "sourceMeetingId", "status", "stickyWeeksCount", "title", "updateFeedback", "updateRequestById", "updateRequestNote", "updateRequestedAt", "updatedAt", "verificationType") SELECT "approvalNote", "assigneeId", "assigneeIds", "assigneeName", "createdAt", "createdById", "deadline", "department", "description", "evidenceLink", "evidenceReport", "evidenceSubmittedAt", "id", "isSticky", "priority", "rejectedReason", "sourceMeetingId", "status", "stickyWeeksCount", "title", "updateFeedback", "updateRequestById", "updateRequestNote", "updateRequestedAt", "updatedAt", "verificationType" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_department_idx" ON "Task"("department");
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX "Task_status_deadline_idx" ON "Task"("status", "deadline");
CREATE INDEX "Task_sourceMeetingId_idx" ON "Task"("sourceMeetingId");
CREATE INDEX "Task_termId_idx" ON "Task"("termId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Doc_termId_department_idx" ON "Doc"("termId", "department");

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- CreateIndex
CREATE INDEX "Member_termId_idx" ON "Member"("termId");

-- CreateIndex
CREATE INDEX "Member_department_idx" ON "Member"("department");

-- CreateIndex
CREATE INDEX "Notification_memberId_createdAt_idx" ON "Notification"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_sentAt_idx" ON "NotificationLog"("sentAt");


-- Gán nhiệm kỳ hiện hành cho công việc và kỳ họp đã có (trước đây chưa gắn nhiệm kỳ)
UPDATE "Task" SET "termId" = (SELECT "id" FROM "Term" WHERE "isActive" = 1 LIMIT 1) WHERE "termId" IS NULL;
UPDATE "Meeting" SET "termId" = (SELECT "id" FROM "Term" WHERE "isActive" = 1 LIMIT 1) WHERE "termId" IS NULL;
