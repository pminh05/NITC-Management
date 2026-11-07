import React, { useState } from 'react';
import { api, setToken } from '../api/client';
import { Member, Role } from '../types';

interface LoginPageProps {
  onLogin: (member: Member) => void;
}

// Bộ tài khoản test (mật khẩu chung: nitc123) — đúng 3 vai trò chính
const DEMO_ACCOUNTS: { label: string; email: string; icon: string }[] = [
  { label: 'Chủ nhiệm — Phạm Phúc Minh', email: 'phamphucminhlehong@gmail.com', icon: '👑' },
  { label: 'Trưởng ban Sự kiện — Đoàn Anh Tú', email: 'anhtud143@gmail.com', icon: '📅' },
  { label: 'Thành viên Truyền thông — Chu Hà My', email: 'chuhamy1107@gmail.com', icon: '📢' },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const doLogin = async (mail: string, pass: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ token: string; member: Member }>('/auth/login', {
        method: 'POST',
        body: { email: mail, password: pass },
      });
      setToken(res.token);
      onLogin(res.member);
    } catch (e: any) {
      setError(e?.message || 'Đăng nhập thất bại');
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vui lòng nhập email và mật khẩu');
      return;
    }
    doLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-[#10192F] text-white flex items-center justify-center p-4 font-sans antialiased">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-[#2C69FF]/100 rounded-xl flex items-center justify-center font-bold text-2xl mx-auto shadow-lg">
            N
          </div>
          <h1 className="text-2xl font-bold mt-4 uppercase tracking-tight">NITC Command Center</h1>
          <p className="text-slate-400 text-sm mt-1">
            CLB Công nghệ thông tin — Trường Công nghệ, ĐH Kinh tế Quốc dân
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-800/70 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl"
        >
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ten.nitc@gmail.com"
              className="mt-1 w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2C69FF] focus:ring-1 focus:ring-[#2C69FF]"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Mật khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2C69FF] focus:ring-1 focus:ring-[#2C69FF]"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#2C69FF]/100 hover:bg-[#1F56D6] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition active:scale-[0.98] cursor-pointer"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        {/* Demo accounts */}
        <div className="mt-6">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold text-center mb-2">
            Đăng nhập nhanh (tài khoản demo — mật khẩu nitc123)
          </div>
          <div className="space-y-1.5">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                onClick={() => {
                  setEmail(acc.email);
                  setPassword('nitc123');
                  doLogin(acc.email, 'nitc123');
                }}
                disabled={loading}
                className="w-full flex items-center gap-3 px-3.5 py-2 bg-slate-800/50 hover:bg-slate-700/70 border border-slate-700/70 rounded-lg text-left transition cursor-pointer group"
              >
                <span className="text-base">{acc.icon}</span>
                <span className="text-xs text-slate-300 group-hover:text-white flex-1 truncate">
                  {acc.label}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">đăng nhập →</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-6">
          NITC Command Center v3 &bull; Hệ thống quản trị tích hợp AI cho tổ chức sinh viên
        </p>
      </div>
    </div>
  );
};
