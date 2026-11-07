import React, { useEffect, useState } from 'react';
import { X, Settings, Check } from 'lucide-react';
import { api } from '../api/client';

interface AppSettings {
  clubName: string;
  groupEmail: string;
  kpiOnTime: number;
  kpiLate: number;
  kpiPending: number;
  kpiOverdue: number;
  reportDayOfWeek: number;
  reportHour: number;
}

const DAY_NAMES = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (s: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [s, setS] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api<AppSettings>('/settings')
        .then(setS)
        .catch((e) => setError(e.message));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const numField = (label: string, key: 'kpiOnTime' | 'kpiLate' | 'kpiPending' | 'kpiOverdue', hint: string) => (
    <div>
      <label className="block text-slate-300 font-semibold mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={s?.[key] ?? 0}
          onChange={(e) => setS((prev) => (prev ? { ...prev, [key]: Number(e.target.value) } : prev))}
          className="w-20 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#2C69FF]"
        />
        <span className="text-[11px] text-slate-500">{hint}</span>
      </div>
    </div>
  );

  const handleSave = async () => {
    if (!s) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api<AppSettings>('/settings', { method: 'PUT', body: s });
      setS(updated);
      setSavedAt(new Date().toLocaleTimeString('vi-VN'));
      onSaved(updated);
    } catch (e: any) {
      setError(e?.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-xs">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-500/20 text-slate-300 border border-slate-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Cấu hình hệ thống</h2>
              <p className="text-slate-400">Thang điểm KPI · lịch báo cáo tuần · thông tin CLB</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {!s && <div className="py-8 text-center text-slate-500">Đang tải cấu hình...</div>}

          {s && (
            <>
              <div className="space-y-3">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Thông tin CLB</div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tên CLB (hiện ở chân trang, email):</label>
                  <input
                    type="text"
                    value={s.clubName}
                    onChange={(e) => setS({ ...s, clubName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#2C69FF]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email nhóm Ban Điều hành:</label>
                  <input
                    type="email"
                    value={s.groupEmail}
                    onChange={(e) => setS({ ...s, groupEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#2C69FF]"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Thang điểm KPI (áp dụng ngay cho Bảng xếp hạng)
                </div>
                {numField('Hoàn thành đúng hạn', 'kpiOnTime', 'điểm/việc')}
                {numField('Hoàn thành trễ hạn', 'kpiLate', 'điểm/việc')}
                {numField('Nộp minh chứng chờ duyệt', 'kpiPending', 'điểm/việc')}
                {numField('Quá hạn chưa hoàn thành', 'kpiOverdue', 'điểm/việc (được phép số âm)')}
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Báo cáo tuần tự động</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Gửi vào thứ:</label>
                    <select
                      value={s.reportDayOfWeek}
                      onChange={(e) => setS({ ...s, reportDayOfWeek: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-[#2C69FF]"
                    >
                      {DAY_NAMES.map((d, i) => (
                        <option key={i} value={i}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Giờ gửi (0–23):</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={s.reportHour}
                      onChange={(e) => setS({ ...s, reportHour: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-[#2C69FF]"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Lịch áp dụng ngay sau khi lưu (không cần khởi động lại). Nội dung báo cáo gửi cho Ban Điều hành + email nhóm.
                </p>
              </div>

              {error && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300">{error}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <span className="text-[11px] text-emerald-400 flex items-center gap-1">
            {savedAt && (
              <>
                <Check className="w-3.5 h-3.5" /> Đã lưu lúc {savedAt}
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white font-semibold cursor-pointer">
              Đóng
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !s}
              className="px-4 py-1.5 rounded-lg bg-[#2C69FF] hover:bg-[#1F56D6] text-white font-bold disabled:opacity-50 transition active:scale-95 cursor-pointer"
            >
              {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
