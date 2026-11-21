import React, { useEffect, useState } from 'react';
import { BellRing, ChevronRight, Eye, EyeOff, Info, Loader2, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { api, setToken } from '../api/client';
import { Member } from '../types';

interface LoginPageProps {
  onLogin: (member: Member, mustChangePassword: boolean) => void;
  /** Thông báo hiển thị phía trên form (VD: phiên đăng nhập vừa hết hiệu lực) */
  notice?: string | null;
}

interface DemoAccount {
  label: string;
  email: string;
  icon: string;
}

interface AuthConfig {
  demoMode: boolean;
  demoAccounts: DemoAccount[];
  demoPassword?: string;
}

// Ba việc chính của hệ thống, hiện ở cột giới thiệu
const FEATURES = [
  { icon: Sparkles, title: 'AI đọc biên bản họp', text: 'Dán biên bản, AI tự tách thành việc cho từng ban' },
  { icon: ShieldCheck, title: 'Nộp và duyệt minh chứng', text: 'Thành viên nộp link hoặc báo cáo, ban điều hành duyệt ngay' },
  { icon: BellRing, title: 'Nhắc việc tự động', text: 'Nhắc việc quá hạn và gửi báo cáo tuần cho Ban Chủ nhiệm' },
];

const Logo: React.FC<{ size?: 'md' | 'lg' }> = ({ size = 'md' }) => (
  <span
    className={`flex shrink-0 items-center justify-center rounded-[10px] bg-primary font-display font-bold text-white ${
      size === 'lg' ? 'size-10 text-[18px]' : 'size-8 text-[15px]'
    }`}
  >
    N
  </span>
);

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, notice }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Tài khoản đăng nhập nhanh do server cấp — chỉ có khi server chạy ở chế độ demo (DEMO_MODE=true).
  // Mã nguồn giao diện không còn chứa sẵn email hay mật khẩu của ai.
  const [demo, setDemo] = useState<AuthConfig | null>(null);

  useEffect(() => {
    let alive = true;
    api<AuthConfig>('/auth/config')
      .then((cfg) => {
        if (alive && cfg?.demoMode && Array.isArray(cfg.demoAccounts)) setDemo(cfg);
      })
      .catch(() => {
        // Không lấy được cấu hình → coi như không ở chế độ demo
      });
    return () => {
      alive = false;
    };
  }, []);

  const doLogin = async (mail: string, pass: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ token: string; member: Member; mustChangePassword?: boolean }>('/auth/login', {
        method: 'POST',
        body: { email: mail, password: pass },
      });
      setToken(res.token);
      onLogin(res.member, Boolean(res.mustChangePassword));
    } catch (e: any) {
      setError(e?.message || 'Đăng nhập thất bại');
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email && !password) {
      setError('Chưa nhập email và mật khẩu.');
      return;
    }
    if (!email) {
      setError('Chưa nhập email.');
      return;
    }
    if (!password) {
      setError('Chưa nhập mật khẩu.');
      return;
    }
    doLogin(email, password);
  };

  const hasDemo = Boolean(demo && demo.demoAccounts.length > 0 && demo.demoPassword);
  const inputClass =
    'h-12 w-full rounded-[10px] border border-border-strong bg-surface px-3.5 text-[15px] text-fg outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-[var(--app-ring)]';

  return (
    <div className="relative grid min-h-screen grid-cols-1 overflow-clip bg-[#F3F8FF] font-sans text-fg antialiased lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* ===== Nền chung phủ cả màn: vệt sáng xanh + khối cầu kính góc dưới phải (nằm sau thẻ đăng nhập) ===== */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-[220px] -top-[260px] h-[620px] w-[760px] rounded-full bg-[var(--app-glow-1)] opacity-30 blur-[140px]" />
        <div className="absolute -left-[120px] -top-[160px] h-[360px] w-[460px] rounded-full bg-[var(--app-glow-2)] opacity-30 blur-[110px]" />
        <div className="absolute -bottom-[200px] right-[10%] h-[480px] w-[640px] rounded-full bg-[var(--app-glow-1)] opacity-25 blur-[140px]" />
        <div className="absolute -bottom-[16%] -right-[10%] w-[58vw] max-w-[620px] sm:w-[44vw] lg:w-[36%]">
          <div className="orb orb-float">
            <div className="orb-halo" />
            <div className="orb-core" />
            <div className="orb-caustic" />
            <div className="orb-swirl" />
            <div className="orb-swirl reverse" />
            <div className="orb-shine" />
            <div className="orb-rim" />
          </div>
        </div>
      </div>

      {/* ===== Cột giới thiệu (máy tính) ===== */}
      <section className="relative hidden lg:flex lg:flex-col" aria-label="Giới thiệu">

        <div className="relative z-10 flex items-center gap-2.5 px-12 pt-10 xl:px-16">
          <Logo />
          <span className="font-display text-[17px] font-bold tracking-[-0.3px] text-fg">NITC Command Center</span>
        </div>

        {/* Nội dung giới thiệu: căn giữa theo chiều dọc để lấp đầy cả cột */}
        <div className="relative z-10 flex flex-1 items-center px-12 py-10 xl:px-16">
          <div className="w-full max-w-[620px]">
            <h1 className="font-display text-[48px] font-bold leading-[1.06] tracking-[-1.6px] text-fg xl:text-[60px] xl:tracking-[-2px]">
              Điều hành CLB,
              <br />
              gọn trong một màn
            </h1>
            <p className="mt-6 max-w-[520px] text-[18px] leading-[1.55] text-muted [text-wrap:pretty]">
              Hệ thống quản trị tích hợp AI cho CLB Công nghệ thông tin — Trường Công nghệ, ĐH Kinh tế Quốc dân.
            </p>
            <ul className="mt-10 grid gap-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="glass-chip flex items-center gap-4 rounded-2xl px-4 py-3.5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-fg">{title}</span>
                    <span className="block text-[14px] text-muted">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="relative z-10 mt-auto px-12 pb-8 text-[13px] text-muted xl:px-16">NITC Command Center v3 · CLB CNTT NEU</p>
      </section>

      {/* ===== Cột đăng nhập ===== */}
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-3 py-8 sm:px-8 sm:py-10">
        <div className="relative w-full max-w-[460px] rounded-3xl bg-white/85 p-5 shadow-[0_30px_70px_-30px_rgba(0,60,140,0.45)] ring-1 ring-white/80 backdrop-blur-xl sm:p-9">
          <div className="flex items-center gap-2.5 lg:hidden">
            <Logo size="lg" />
            <span className="font-display text-[18px] font-bold tracking-[-0.3px] text-fg">NITC Command Center</span>
          </div>

          <h2 className="mt-8 font-display text-[28px] font-bold tracking-[-0.6px] text-fg lg:mt-0">Đăng nhập</h2>
          <p className="mt-1.5 text-[15px] text-muted">Dùng email đã được Ban Chủ nhiệm thêm vào hệ thống.</p>

          {notice && !error && (
            <div role="status" className="mt-6 flex gap-2.5 rounded-xl border border-warning-bar/30 bg-warning-bg px-3.5 py-3 text-[14px] text-warning">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="login-email" className="w-fit cursor-pointer text-[14px] font-medium text-fg-2">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email"
                className={inputClass}
                aria-invalid={Boolean(error && !email)}
                autoFocus
              />
            </div>

            <div className="relative flex flex-col gap-2">
              <label htmlFor="login-password" className="w-fit cursor-pointer text-[14px] font-medium text-fg-2">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className={`${inputClass} pr-12`}
                  aria-invalid={Boolean(error && !password)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-1 my-auto flex size-10 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg cursor-pointer"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                </button>
              </div>
              {/* Đứng sau ô trong DOM để thứ tự Tab là email → mật khẩu → mắt → link */}
              <button
                type="button"
                onClick={() => setShowForgot((v) => !v)}
                className="absolute right-0 top-0 text-[14px] text-fg hover:underline cursor-pointer"
                aria-expanded={showForgot}
                aria-controls="forgot-hint"
              >
                Quên mật khẩu?
              </button>
            </div>

            {showForgot && (
              <div id="forgot-hint" className="flex gap-2.5 rounded-xl border border-info-bar/25 bg-info-bg px-3.5 py-3 text-[14px] text-info">
                <Info className="mt-0.5 size-4 shrink-0" />
                <span>
                  Nhắn Chủ nhiệm CLB để được đặt lại mật khẩu về mặc định, rồi đăng nhập và đổi sang mật khẩu mới.
                </span>
              </div>
            )}

            {error && (
              <div role="alert" className="flex gap-2.5 rounded-xl border border-danger-bar/25 bg-danger-bg px-3.5 py-3 text-[14px] text-danger">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-[12px] text-[15px] font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </button>
          </form>

          {/* Đăng nhập nhanh — chỉ hiện khi server bật DEMO_MODE */}
          {hasDemo && demo && (
            <section className="mt-8" aria-labelledby="demo-title">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <h3 id="demo-title" className="text-[12px] font-medium text-muted">
                  Đăng nhập nhanh · chế độ demo
                </h3>
                <span className="h-px flex-1 bg-border" />
              </div>
              <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
                {demo.demoAccounts.map((acc) => (
                  <li key={acc.email}>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(acc.email);
                        setPassword(demo.demoPassword!);
                        doLogin(acc.email, demo.demoPassword!);
                      }}
                      disabled={loading}
                      className="group flex h-11 w-full items-center gap-3 px-3.5 text-left transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                    >
                      <span className="text-[16px]" aria-hidden="true">
                        {acc.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] text-fg-2 group-hover:text-fg">{acc.label}</span>
                      <ChevronRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-fg" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-8 text-center text-[13px] text-muted lg:hidden">NITC Command Center v3 · CLB CNTT NEU</p>
        </div>
      </main>
    </div>
  );
};
