import { confirmDialog, toast } from './ui/Feedback';
import React, { useState } from 'react';
import {
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  FileJson,
} from 'lucide-react';
import { Meeting, Member, NotificationLog, Task } from '../types';
import { formatDateVN } from '../utils/dateUtils';
import { todayVN } from '../../shared/time';

interface DataSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  meetings: Meeting[];
  members: Member[];
  logs: NotificationLog[];
  onImportAllData: (data: {
    tasks?: Task[];
    meetings?: Meeting[];
    members?: Member[];
    logs?: NotificationLog[];
  }) => void;
  onResetToDemo: () => void;
  /** Khôi phục từ JSON / reset dữ liệu mẫu ghi đè toàn bộ dữ liệu — chỉ Chủ nhiệm thấy hai mục này */
  canDestructive?: boolean;
}

export const DataSyncModal: React.FC<DataSyncModalProps> = ({
  isOpen,
  onClose,
  tasks,
  meetings,
  members,
  logs,
  onImportAllData,
  onResetToDemo,
  canDestructive = false,
}) => {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Export CSV for Google Sheets
  const handleExportCSV = () => {
    // Include UTF-8 BOM so Excel & Google Sheets correctly decode Vietnamese diacritics
    const bom = '\uFEFF';
    const headers = [
      'STT',
      'Mã Nhiệm Vụ',
      'Tên Công Việc',
      'Ban Phụ Trách',
      'Người Phụ Trách',
      'Hạn Chót',
      'Trạng Thái',
      'Loại Xác Minh',
      'Link Minh Chứng',
      'Báo Cáo Ngắn',
      'Ghi Chú Duyệt',
      'Biên Bản Họp Nguồn',
    ];

    const rows = tasks.map((t, idx) => [
      idx + 1,
      t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      t.department,
      `"${t.assigneeName.replace(/"/g, '""')}"`,
      t.deadline,
      t.status,
      t.verificationType === 'link_required' ? 'Cần Link' : 'Cần Báo Cáo',
      `"${(t.evidenceLink || '').replace(/"/g, '""')}"`,
      `"${(t.evidenceReport || '').replace(/"/g, '""')}"`,
      `"${(t.approvalNote || '').replace(/"/g, '""')}"`,
      `"${(t.sourceMeetingTitle || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = bom + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `NITC_Command_Center_Tasks_${todayVN()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccessMsg('Đã xuất file CSV (tương thích 100% Google Sheets & Excel)!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Export Full JSON Backup
  const handleExportJSON = () => {
    const backupData = {
      system: 'NITC Command Center',
      version: '2.6',
      exportedAt: new Date().toISOString(),
      tasks,
      meetings,
      members,
      logs,
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `nitc_command_center_backup_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccessMsg('Đã xuất bản sao lưu hệ thống định dạng JSON!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Import JSON Backup
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.tasks || parsed.meetings || parsed.members) {
          onImportAllData(parsed);
          setSuccessMsg('Khôi phục dữ liệu từ tệp tin thành công!');
          setTimeout(() => setSuccessMsg(null), 3000);
        } else {
          toast('Không khôi phục được', 'Tệp tin không đúng định dạng sao lưu NITC Command Center.', 'warn');
        }
      } catch (err) {
        toast('Không khôi phục được', 'Lỗi đọc tệp tin JSON.', 'warn');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#101828]/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-xs">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary-light text-primary border border-primary/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-fg tracking-tight">
                Lưu Trữ Dữ Liệu & Đồng Bộ Google Sheets
              </h2>
              <p className="text-muted">
                Quy tắc lưu trữ tập trung: Xuất file Google Sheet CSV, sao lưu JSON và khôi phục
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notification */}
        {successMsg && (
          <div className="bg-success-bg border-b border-success-bar/30 px-6 py-2.5 text-success flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body Options */}
        <div className="p-6 space-y-4 text-fg">
          
          {/* Card 1: Google Sheets / Excel CSV */}
          <div className="p-4 bg-surface-2 border border-border rounded-xl flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-bold text-fg text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-success" />
                <span>Xuất Danh Sách Công Việc Ra Google Sheets (CSV)</span>
              </div>
              <p className="text-muted">
                Chứa đầy đủ thông tin {tasks.length} nhiệm vụ, người phụ trách, hạn chót, link minh chứng và trạng thái duyệt. Hỗ trợ Unicode Tiếng Việt mở trực tiếp trên Excel/G-Sheets.
              </p>
            </div>

            <button
              onClick={handleExportCSV}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-sm transition shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Tải File CSV</span>
            </button>
          </div>

          {/* Card 2: JSON Backup */}
          <div className="p-4 bg-surface-2 border border-border rounded-xl flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-bold text-fg text-sm flex items-center gap-2">
                <FileJson className="w-4 h-4 text-info" />
                <span>Sao Lưu Toàn Bộ Hệ Thống (JSON)</span>
              </div>
              <p className="text-muted">
                Xuất toàn bộ {tasks.length} việc, {meetings.length} biên bản họp, {members.length} thành viên và lịch sử thông báo vào 1 tệp tin JSON an toàn.
              </p>
            </div>

            <button
              onClick={handleExportJSON}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-1.5 shadow-sm transition shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Tải Bản Sao Lưu</span>
            </button>
          </div>

          {canDestructive && (
          <>
          {/* Card 3: Import JSON */}
          <div className="p-4 bg-surface-2 border border-border rounded-xl flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-bold text-fg text-sm flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" />
                <span>Khôi Phục Dữ Liệu Từ File JSON</span>
              </div>
              <p className="text-muted">
                Nạp lại dữ liệu cuộc họp và danh sách công việc từ bản sao lưu trước đó.
              </p>
            </div>

            <label className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1.5 shadow-sm transition shrink-0 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Chọn File JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Card 4: Khôi phục dữ liệu mẫu */}
          <div className="p-4 bg-surface-2 border border-border rounded-xl flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-semibold text-fg-2 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-warning" />
                <span>Khôi Phục Dữ Liệu Mẫu Ban Đầu (Demo Reset)</span>
              </div>
              <p className="text-muted">
                Đưa hệ thống về bộ dữ liệu mẫu chuẩn để thử nghiệm (danh bạ mẫu, các ca thử quy tắc trùng tên, việc lưu chuyển, biên bản mẫu).
              </p>
            </div>

            <button
              onClick={async () => {
                if (
                  await confirmDialog({
                    title: 'Khôi phục dữ liệu mẫu?',
                    message: 'Toàn bộ dữ liệu hiện tại sẽ bị thay bằng bộ dữ liệu mẫu (server tự sao lưu trước khi xóa).',
                    confirmText: 'Khôi phục',
                    danger: true,
                  })
                ) {
                  onResetToDemo();
                  setSuccessMsg('Đã khôi phục về dữ liệu mẫu NITC chuẩn thành công!');
                  setTimeout(() => setSuccessMsg(null), 3000);
                }
              }}
              className="px-3.5 py-1.5 rounded-lg bg-surface-2 hover:bg-warning-bg text-fg-2 hover:text-warning border border-border font-semibold transition shrink-0"
            >
              Khôi phục dữ liệu mẫu
            </button>
          </div>
          </>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-surface flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface-2 hover:bg-[#F2F4F7] text-fg font-semibold"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
