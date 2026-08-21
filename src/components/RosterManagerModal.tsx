import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  Edit2,
  X,
  Mail,
  Phone,
  Shield,
  Check,
  Search,
} from 'lucide-react';
import { Department, Member, Role } from '../types';

interface RosterManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onAddMember: (member: Omit<Member, 'id'>) => void;
  onUpdateMember: (id: string, updates: Partial<Member>) => void;
  onDeleteMember: (id: string) => void;
}

export const RosterManagerModal: React.FC<RosterManagerModalProps> = ({
  isOpen,
  onClose,
  members,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('Thành viên');
  const [department, setDepartment] = useState<Department>('Học thuật');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  if (!isOpen) return null;

  const handleStartEdit = (member: Member) => {
    setEditingId(member.id);
    setName(member.name);
    setRole(member.role);
    setDepartment(member.department);
    setEmail(member.email);
    setPhone(member.phone || '');
    setIsAdding(false);
  };

  const handleCancelForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setName('');
    setEmail('');
    setPhone('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      onUpdateMember(editingId, {
        name: name.trim(),
        role,
        department,
        email: email.trim(),
        phone: phone.trim(),
      });
    } else {
      onAddMember({
        name: name.trim(),
        role,
        department,
        email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '')}@nitc.vn`,
        phone: phone.trim(),
      });
    }

    handleCancelForm();
  };

  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const departments: Department[] = ['Học thuật', 'Truyền thông', 'Sự kiện', 'Đối ngoại', 'Ban Chủ nhiệm'];
  const roles: Role[] = ['Chủ tịch', 'Trưởng ban', 'Phó ban', 'Thành viên'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-xs">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Danh Bạ Ban & Danh Sách Thành Viên CLB (Roster)
              </h2>
              <p className="text-slate-400">
                Quản lý phân ban, phân quyền và nguồn nhân lực gán việc trong NITC
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

        {/* Toolbar */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, ban, vai trò..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          {!isAdding && !editingId && (
            <button
              onClick={() => {
                setIsAdding(true);
                setName('');
                setEmail('');
                setPhone('');
              }}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Thêm Thành Viên Mới</span>
            </button>
          )}
        </div>

        {/* Add/Edit Form Banner */}
        {(isAdding || editingId) && (
          <form onSubmit={handleSave} className="p-4 bg-slate-800/80 border-b border-slate-700 space-y-3">
            <div className="flex items-center justify-between font-bold text-white text-sm">
              <span>{editingId ? 'Chỉnh Sửa Thông Tin Thành Viên' : 'Thêm Thành Viên Mới'}</span>
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
                  placeholder="VD: Lê Hồng Phúc Minh"
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
                  {roles.map((r) => (
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
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold">
                  <th className="p-3">Họ và tên</th>
                  <th className="p-3">Vai trò</th>
                  <th className="p-3">Ban phụ trách</th>
                  <th className="p-3">Email liên hệ</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredMembers.map((m) => {
                  const isMinh = m.name.toLowerCase().includes('minh');
                  return (
                    <tr key={m.id} className="hover:bg-slate-800/50 transition">
                      <td className="p-3 font-semibold text-white flex items-center gap-2">
                        <span>{m.name}</span>
                        {isMinh && (
                          <span
                            className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            title="Tên này có thể trùng với thành viên khác khi AI xử lý BBH"
                          >
                            Tên "Minh"
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          m.role === 'Chủ tịch'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : m.role === 'Trưởng ban'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 font-medium">
                        Ban {m.department}
                      </td>
                      <td className="p-3 font-mono text-slate-400">
                        {m.email}
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <button
                          onClick={() => handleStartEdit(m)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          title="Sửa thông tin"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {m.role !== 'Chủ tịch' && (
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
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-slate-400">
          <span>Tổng cộng {members.length} thành viên trong danh bạ CLB NITC.</span>
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
