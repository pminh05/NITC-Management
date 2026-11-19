import React, { useRef, useState } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  Edit2,
  KeyRound,
  X,
  Shield,
  Search,
  Upload,
  RefreshCw,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { Department, ImportSummary, Member, Role, Term } from '../types';
import { Actor, canDeleteMember, canEditMember, canManageTerms } from '../../shared/permissions';
import { confirmDialog } from './ui/Feedback';

interface RosterManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  terms: Term[];
  selectedTermId: string; // 'active' | 'all' | term id
  importing: boolean;
  onSelectTerm: (termId: string) => void;
  onImportExcel: (file: File, termName: string) => Promise<ImportSummary | void>;
  onAddMember: (member: Omit<Member, 'id'>) => void;
  onUpdateMember: (id: string, updates: Partial<Member>) => void;
  onDeleteMember: (id: string) => void;
  onActivateTerm: (termId: string) => void;
  /** Xóa nhiệm kỳ trống (chưa có thành viên) */
  onDeleteTerm?: (termId: string) => void;
  /** Tạo nhiệm kỳ trống (không import) — chỉ người quản lý nhiệm kỳ */
  onCreateTerm?: (name: string) => Promise<boolean>;
  /** Người đang thao tác — quyết định nút nào được hiện (cùng quy tắc với server) */
  viewer: Actor;
  /** Đặt lại mật khẩu về mặc định — chỉ truyền vào khi người dùng là Chủ nhiệm */
  onResetPassword?: (member: Member) => void;
}

export const RosterManagerModal: React.FC<RosterManagerModalProps> = ({
  isOpen,
  onClose,
  members,
  terms,
  selectedTermId,
  importing,
  onSelectTerm,
  onImportExcel,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onActivateTerm,
  onDeleteTerm,
  onCreateTerm,
  onResetPassword,
  viewer,
}) => {
  const mayManageTerms = canManageTerms(viewer);
  const mayDelete = canDeleteMember(viewer);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importTermName, setImportTermName] = useState(() => suggestNextTerm());
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('Thành viên');
  const [department, setDepartment] = useState<Department>('Học thuật');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [studentId, setStudentId] = useState('');
  const [className, setClassName] = useState('');

  if (!isOpen) return null;

  function suggestNextTerm(): string {
    const y = new Date().getFullYear();
    return `${y}-${y + 1}`;
  }

  const handleStartEdit = (member: Member) => {
    setEditingId(member.id);
    setName(member.name);
    setRole(member.role);
    setDepartment(member.department);
    setEmail(member.email);
    setPhone(member.phone || '');
    setStudentId(member.studentId || '');
    setClassName(member.className || '');
    setIsAdding(false);
  };

  const handleCancelForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setName('');
    setEmail('');
    setPhone('');
    setStudentId('');
    setClassName('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      role,
      department,
      email: email.trim(),
      phone: phone.trim(),
      studentId: studentId.trim() || undefined,
      className: className.trim() || undefined,
    };

    if (editingId) {
      onUpdateMember(editingId, payload);
    } else {
      onAddMember({
        ...payload,
        email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '')}@nitc.vn`,
      } as Omit<Member, 'id'>);
    }

    handleCancelForm();
  };

  // Tên nhiệm kỳ: YYYY-YYYY, năm sau = năm trước + 1
  const termNameValid = (() => {
    const m = /^(\d{4})-(\d{4})$/.exec(importTermName.trim());
    return !!m && Number(m[2]) === Number(m[1]) + 1;
  })();
  const termExists = terms.some((t) => t.name === importTermName.trim());
  const [creatingTerm, setCreatingTerm] = useState(false);
  const handleCreateTermClick = async () => {
    if (!onCreateTerm || !termNameValid || termExists) return;
    setCreatingTerm(true);
    await onCreateTerm(importTermName.trim());
    setCreatingTerm(false);
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportResult(null);

    // Xác nhận trước khi ghi: nhiệm kỳ nào, có đổi nhiệm kỳ hiện hành không, tên file có khớp không
    const termName = importTermName.trim();
    const activeName = activeTerm?.name;
    const fileTerm = /(\d{4})\s*[-–]\s*(\d{4})/.exec(file.name);
    const fileTermName = fileTerm ? `${fileTerm[1]}-${fileTerm[2]}` : null;
    const effect = !activeName || termName > activeName
      ? `Nhiệm kỳ ${termName} sẽ trở thành nhiệm kỳ HIỆN HÀNH (thay cho ${activeName || 'hiện tại'}). Thành viên trùng email được cập nhật và chuyển sang ${termName}; người mới được tạo tài khoản đăng nhập.`
      : termName === activeName
      ? `Cập nhật danh bạ nhiệm kỳ hiện hành ${termName}: thành viên trùng email được cập nhật, người mới được tạo tài khoản.`
      : `${termName} cũ hơn nhiệm kỳ hiện hành ${activeName} → chỉ nhập LƯU TRỮ: nhiệm kỳ hiện hành giữ nguyên, người đã có trong hệ thống không bị sửa, người mới lưu ở trạng thái "Cựu thành viên" và không có tài khoản đăng nhập.`;
    const mismatch = fileTermName && fileTermName !== termName
      ? `\n\n⚠ Tên file có nhiệm kỳ ${fileTermName} nhưng ô "Nhiệm kỳ mới" đang là ${termName}. Nếu nhầm, bấm Hủy và sửa ô nhiệm kỳ.`
      : '';
    const ok = await confirmDialog({
      title: `Import "${file.name}" vào nhiệm kỳ ${termName}?`,
      message: effect + mismatch,
      confirmText: 'Import',
      danger: Boolean(mismatch),
    });
    if (!ok) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    try {
      const summary = await onImportExcel(file, importTermName.trim());
      if (summary) setImportResult(summary);
    } catch (err: any) {
      setImportError(err?.message || 'Import thất bại');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const departments: Department[] = ['Học thuật', 'Truyền thông', 'Sự kiện', 'Đối ngoại', 'Ban Chủ nhiệm'];
  const roles: Role[] = ['Chủ nhiệm', 'Phó Chủ nhiệm', 'Trưởng ban', 'Phó ban', 'Thành viên', 'Cố vấn'];

  // Từ khóa khớp tên, MSV, lớp, email, SĐT, ban, vai trò (không phân biệt dấu hoa/thường)
  const q = searchQuery.trim().toLowerCase();
  const matchesSearch = (m: Member) =>
    !q ||
    [m.name, m.studentId, m.className, m.email, m.phone, m.department, m.role].some((v) =>
      (v || '').toLowerCase().includes(q)
    );
  const filteredMembers = members.filter(
    (m) =>
      matchesSearch(m) &&
      (filterDept === 'all' || m.department === filterDept) &&
      (filterRole === 'all' || m.role === filterRole) &&
      (filterStatus === 'all' || m.status === filterStatus)
  );
  // Số lượng hiện trong từng lựa chọn: tính theo các bộ lọc còn lại để biết chọn vào sẽ ra bao nhiêu người
  const countBy = (key: 'department' | 'role' | 'status', value: string) =>
    members.filter(
      (m) =>
        matchesSearch(m) &&
        (key === 'department' || filterDept === 'all' || m.department === filterDept) &&
        (key === 'role' || filterRole === 'all' || m.role === filterRole) &&
        (key === 'status' || filterStatus === 'all' || m.status === filterStatus) &&
        (value === 'all' || m[key] === value)
    ).length;
  const hasFilter = Boolean(q) || filterDept !== 'all' || filterRole !== 'all' || filterStatus !== 'all';
  const clearFilters = () => {
    setSearchQuery('');
    setFilterDept('all');
    setFilterRole('all');
    setFilterStatus('all');
  };
  const STATUS_LABEL: Record<string, string> = { active: 'Đang hoạt động', inactive: 'Ngưng hoạt động', alumni: 'Cựu thành viên' };
  const selectClass =
    'px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-semibold [color-scheme:dark] focus:outline-none focus:border-emerald-500 cursor-pointer';

  const activeTerm = terms.find((t) => t.isActive);
  /** Nhiệm kỳ khác (không phải hiện hành) đang được chọn để xem */
  const selectedOtherTerm = terms.find((t) => t.id === selectedTermId && !t.isActive);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-xs">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Danh sách thành viên CLB (Roster)
              </h2>
              <p className="text-slate-400">
                Quản lý thành viên theo từng nhiệm kỳ — import trực tiếp từ file Excel danh bạ của CLB
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Term selector + Import Excel + Thêm mới */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Nhiệm kỳ */}
            <div className="flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedTermId}
                onChange={(e) => onSelectTerm(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                title="Xem roster theo nhiệm kỳ"
              >
                <option value="active">
                  ⭐ Nhiệm kỳ hiện hành{activeTerm ? `: ${activeTerm.name}` : ''}
                </option>
                <option value="all">Tất cả nhiệm kỳ</option>
                {terms
                  .filter((t) => !t.isActive)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      📦 {t.name} ({t.memberCount} TV)
                    </option>
                  ))}
              </select>
              {mayManageTerms && selectedOtherTerm && selectedOtherTerm.memberCount > 0 && (
                <button
                  onClick={() => onActivateTerm(selectedOtherTerm.id)}
                  className="px-2 py-1 rounded bg-amber-600/30 border border-amber-600/50 text-amber-300 font-semibold hover:bg-amber-600/50 transition cursor-pointer"
                  title="Đặt nhiệm kỳ này làm nhiệm kỳ hiện hành"
                >
                  Đặt hiện hành
                </button>
              )}
              {/* Nhiệm kỳ trống: không cho đặt hiện hành (danh bạ sẽ rỗng) — chỉ cho xóa */}
              {mayManageTerms && onDeleteTerm && selectedOtherTerm && selectedOtherTerm.memberCount === 0 && (
                <button
                  onClick={async () => {
                    const ok = await confirmDialog({
                      title: `Xóa nhiệm kỳ ${selectedOtherTerm.name}?`,
                      message: 'Nhiệm kỳ này chưa có thành viên nào. Xóa xong có thể tạo lại bất cứ lúc nào.',
                      confirmText: 'Xóa nhiệm kỳ',
                      danger: true,
                    });
                    if (ok) onDeleteTerm(selectedOtherTerm.id);
                  }}
                  className="px-2 py-1 rounded bg-red-600/20 border border-red-600/40 text-red-300 font-semibold hover:bg-red-600/40 transition cursor-pointer"
                  title="Nhiệm kỳ trống — xóa đi"
                >
                  Xóa nhiệm kỳ trống
                </button>
              )}
            </div>

            {/* Import Excel — đổi nhiệm kỳ hiện hành nên chỉ Chủ nhiệm */}
            {mayManageTerms && (
            <div className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg">
              <label htmlFor="new-term-name" className="text-slate-300 font-semibold whitespace-nowrap">
                Nhiệm kỳ mới:
              </label>
              <input
                id="new-term-name"
                type="text"
                value={importTermName}
                onChange={(e) => setImportTermName(e.target.value)}
                placeholder="2026-2027"
                className={`w-24 px-2 py-1 bg-slate-950 border rounded text-white placeholder-slate-500 focus:outline-none font-mono text-[11px] ${
                  termNameValid || !importTermName ? 'border-slate-700 focus:border-sky-500' : 'border-red-500/70'
                }`}
                title="Định dạng YYYY-YYYY, VD: 2026-2027"
              />
              {onCreateTerm && (
                <button
                  type="button"
                  onClick={handleCreateTermClick}
                  disabled={!termNameValid || termExists || creatingTerm}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition active:scale-95 cursor-pointer whitespace-nowrap flex items-center gap-1"
                  title={
                    !termNameValid
                      ? 'Nhập tên nhiệm kỳ dạng YYYY-YYYY'
                      : termExists
                      ? 'Nhiệm kỳ này đã có'
                      : 'Tạo nhiệm kỳ trống (chưa có thành viên, chưa đặt làm hiện hành)'
                  }
                >
                  <Plus className="w-3.5 h-3.5" />
                  {creatingTerm ? 'Đang tạo…' : 'Tạo nhiệm kỳ'}
                </button>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing || !termNameValid}
                className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition active:scale-95 cursor-pointer whitespace-nowrap flex items-center gap-1"
                title="Import file Excel danh bạ vào nhiệm kỳ này và đặt làm nhiệm kỳ hiện hành"
              >
                <Upload className="w-3.5 h-3.5" />
                {importing ? 'Đang import...' : 'Import Excel'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFilePicked}
                className="hidden"
              />
            </div>
            )}
          </div>

          {!isAdding && !editingId && (
            <button
              onClick={() => {
                setIsAdding(true);
                handleCancelForm();
                setIsAdding(true);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Thêm thành viên mới</span>
            </button>
          )}
        </div>

        {/* Import result / error banner */}
        {importResult && (
          <div className="mx-4 mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-200 space-y-1">
            <div className="font-bold text-emerald-300">
              ✅ Import nhiệm kỳ {importResult.term}
              {importResult.mode === 'archive' ? ' (lưu trữ)' : ''} thành công: +{importResult.created} thành viên mới,
              cập nhật {importResult.updated}, bỏ qua {importResult.skipped}
            </div>
            <div className="text-[11px] text-emerald-300/80">
              {Object.entries(importResult.departments)
                .map(([dept, n]) => `${dept}: ${n}`)
                .join(' · ')}
              {importResult.mode === 'archive'
                ? ' — lưu ở trạng thái Cựu thành viên, không tạo tài khoản đăng nhập; nhiệm kỳ hiện hành giữ nguyên'
                : ' — thành viên mới có tài khoản đăng nhập (mật khẩu mặc định nitc123)'}
            </div>
            {importResult.skippedRows.length > 0 && (
              <div className="text-[11px] text-amber-300">
                ⚠ {importResult.skippedRows.slice(0, 3).join(' | ')}
                {importResult.skippedRows.length > 3 ? ` … (+${importResult.skippedRows.length - 3})` : ''}
              </div>
            )}
          </div>
        )}
        {importError && (
          <div className="mx-4 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {importError}
          </div>
        )}

        {/* Add/Edit Form Banner */}
        {(isAdding || editingId) && (
          <form onSubmit={handleSave} className="p-4 bg-slate-800/80 border-b border-slate-700 space-y-3">
            <div className="flex items-center justify-between font-bold text-white text-sm">
              <span>{editingId ? 'Chỉnh Sửa Thông Tin Thành Viên' : 'Thêm thành viên mới (vào nhiệm kỳ hiện hành)'}</span>
              <button
                type="button"
                onClick={handleCancelForm}
                className="text-slate-400 hover:text-white"
              >
                Hủy
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Họ và tên:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Lê Ngọc Anh Thư"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Vai trò:</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                >
                  {roles.filter((r) => canEditMember(viewer, null, r)).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Phân ban:</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as Department)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>Ban {d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email:</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@nitc.vn"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">SĐT:</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09xx..."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">MSV:</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="112xxxxx"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Lớp:</label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="VD: IT67A"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                Lưu Thành Viên
              </button>
            </div>
          </form>
        )}

        {/* Member Table */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Tìm kiếm + bộ lọc */}
          <div className="mb-3 flex flex-col lg:flex-row lg:items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo tên, MSV, lớp, email, SĐT…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className={selectClass} title="Lọc theo ban">
                <option value="all">Tất cả ban ({countBy('department', 'all')})</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d === 'Ban Chủ nhiệm' ? 'Chủ nhiệm' : d} ({countBy('department', d)})
                  </option>
                ))}
              </select>
              <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className={selectClass} title="Lọc theo vai trò">
                <option value="all">Tất cả vai trò ({countBy('role', 'all')})</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r} ({countBy('role', r)})
                  </option>
                ))}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass} title="Lọc theo trạng thái">
                <option value="all">Mọi trạng thái ({countBy('status', 'all')})</option>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label} ({countBy('status', value)})
                  </option>
                ))}
              </select>
              {hasFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-emerald-300 hover:text-white hover:bg-slate-800 flex items-center gap-1 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Xóa lọc
                </button>
              )}
            </div>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold">
                  <th className="p-3 w-10 text-center">STT</th>
                  <th className="p-3">Họ và tên</th>
                  <th className="p-3">MSV</th>
                  <th className="p-3">Lớp</th>
                  <th className="p-3">Vai trò</th>
                  <th className="p-3">Ban</th>
                  <th className="p-3">Liên hệ</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredMembers.map((m, idx) => {
                  const isLeader = m.role === 'Chủ nhiệm' || m.role === 'Phó Chủ nhiệm';
                  return (
                    <tr key={m.id} className="hover:bg-slate-800/50 transition">
                      <td className="p-3 text-center font-mono text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="p-3 font-semibold text-white">
                        <div>{m.name}</div>
                        <div className="text-[10px] font-mono text-slate-500" title="Mã định danh trong hệ thống">
                          #{m.id.slice(-6)}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-slate-300 whitespace-nowrap" title="Mã sinh viên — dùng để phân biệt khi trùng tên">
                        {m.studentId || '—'}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {m.className ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium">
                            {m.className}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`inline-block whitespace-nowrap px-2 py-0.5 rounded text-[11px] font-bold ${
                          isLeader
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : m.role === 'Trưởng ban'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : m.role === 'Phó ban'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 font-medium whitespace-nowrap">
                        {m.department === 'Ban Chủ nhiệm' ? '👑 Chủ nhiệm' : m.department}
                      </td>
                      <td className="p-3 font-mono text-slate-400 whitespace-nowrap">
                        <div className="truncate max-w-[180px]" title={m.email}>{m.email}</div>
                        {m.phone && <div className="text-[10px] text-slate-500">{m.phone}</div>}
                      </td>
                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        {canEditMember(viewer, m) && (
                        <button
                          onClick={() => handleStartEdit(m)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          title="Sửa thông tin"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        )}
                        {onResetPassword && (
                          <button
                            onClick={() => onResetPassword(m)}
                            className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 transition"
                            title="Đặt lại mật khẩu về mặc định (khi thành viên quên mật khẩu)"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {mayDelete && m.role !== 'Chủ nhiệm' && (
                          <button
                            onClick={() => onDeleteMember(m.id)}
                            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                            title="Xóa thành viên"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      {hasFilter
                        ? 'Không có thành viên nào khớp bộ lọc.'
                        : 'Không có thành viên nào trong phạm vi này. Import file Excel danh bạ hoặc thêm thủ công.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-slate-400">
          <span className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            Đang xem <strong className="text-slate-300">{filteredMembers.length}</strong>
            {hasFilter ? ` / ${members.length}` : ''} thành viên
            {selectedTermId === 'active' && activeTerm ? ` — nhiệm kỳ ${activeTerm.name}` : ''}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
