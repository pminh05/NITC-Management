import React, { useState } from 'react';
import { KeyRound, LogOut, ShieldAlert, X } from 'lucide-react';
import { api, setToken } from '../api/client';
import { Member } from '../types';

interface ChangePasswordModalProps {
  /** true = bắt buộc (đang dùng mật khẩu mặc định): toàn màn hình, không đóng được, chỉ có thể đổi hoặc đăng xuất */
  forced?: boolean;
  memberName?: string;
  onClose?: () => void;
  onLogout?: () => void;
  /** Gọi sau khi đổi thành công — token mới đã được lưu */
  onChanged: (member: Member) => void;
}

const MIN_LENGTH = 8;

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  forced = false,
  memberName,
  onClose,
  onLogout,
  onChanged,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!currentPassword) return setError('Vui lòng nhập mật khẩu hiện tại');
    if (newPassword.length < MIN_LENGTH) return setError(`Mật khẩu mới cần ít nhất ${MIN_LENGTH} ký tự`);
    if (newPassword !== confirmPassword) return setError('Hai lần nhập mật khẩu mới chưa khớp nhau');
    if (newPassword === currentPassword) return setError('Mật khẩu mới phải khác mật khẩu hiện tại');

    setSaving(true);
    try {
      const res = await api<{ token: string; member: Member }>('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      // Token cũ đã hết hiệu lực ngay khi đổi mật khẩu → dùng token mới
      setToken(res.token);
      onChanged(res.member);
    } catch (err: any) {
      setError(err?.message || 'Không đổi được mật khẩu, vui lòng thử lại');
      setSaving(false);
    }
  };

  const inputClass =
    'mt-1 w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2C69FF] focus:ring-1 focus:ring-[#2C69FF]';
  const labelClass = 'text-xs font-semibold text-slate-400 uppercase tracking-wide';

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 font-sans antialiased ${
        forced ? 'bg-[#10192F]' : 'bg-slate-950/70 backdrop-blur-sm'
      }`}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl text-white"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${forced ? 'bg-amber-500/15 text-amber-300' : 'bg-[#2C69FF]/15 text-[#8FB2FF]'}`}>
              {forced ? <ShieldAlert className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold">{forced ? 'Đổi mật khẩu mặc định' : 'Đổi mật khẩu'}</h2>
              {memberName && <p className="text-xs text-slate-400">{memberName}</p>}
            </div>
          </div>
          {!forced && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {forced && (
          <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 leading-relaxed">
            Tài khoản của bạn đang dùng mật khẩu mặc định mà ai trong CLB cũng biết. Hãy đặt mật khẩu riêng
            trước khi tiếp tục.
          </p>
        )}

        <div>
          <label className={labelClass}>Mật khẩu hiện tại</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Mật khẩu mới (ít nhất {MIN_LENGTH} ký tự)</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Nhập lại mật khẩu mới</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className={inputClass}
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-lg px-3 py-2">{error}</div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 bg-[#2C69FF] hover:bg-[#1F56D6] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition active:scale-[0.98] cursor-pointer"
        >
          {saving ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
        </button>

        {forced && onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Đăng xuất
          </button>
        )}

        <p className="text-[11px] text-slate-500 text-center leading-relaxed">
          Sau khi đổi, các phiên đăng nhập cũ trên thiết bị khác sẽ tự hết hiệu lực. Quên mật khẩu: nhờ Chủ nhiệm
          đặt lại trong Danh sách thành viên.
        </p>
      </form>
    </div>
  );
};
