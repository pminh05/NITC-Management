import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Search,
  Plus,
  Pin,
  ExternalLink,
  Trash2,
  Edit2,
  FileSpreadsheet,
  FileText,
  File,
  Image as ImageIcon,
  FolderOpen,
} from 'lucide-react';
import { api } from '../api/client';
import { Doc, Member, Term } from '../types';

const DEPT_EMOJI: Record<string, string> = {
  'Học thuật': '💻',
  'Truyền thông': '📢',
  'Sự kiện': '📅',
  'Đối ngoại': '🤝',
  'Ban Chủ nhiệm': '🌐', // = TÀI LIỆU CHUNG
};

const TYPE_META: Record<string, { icon: React.ReactNode; label: string }> = {
  drive: { icon: <FolderOpen className="w-4 h-4" />, label: 'Thư mục Drive' },
  sheet: { icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" />, label: 'Google Sheet' },
  doc: { icon: <FileText className="w-4 h-4 text-sky-400" />, label: 'Google Docs' },
  slide: { icon: <FileText className="w-4 h-4 text-amber-400" />, label: 'Slide' },
  pdf: { icon: <File className="w-4 h-4 text-red-400" />, label: 'PDF' },
  image: { icon: <ImageIcon className="w-4 h-4 text-purple-400" />, label: 'Ảnh' },
  form: { icon: <FileText className="w-4 h-4 text-indigo-400" />, label: 'Form' },
  other: { icon: <File className="w-4 h-4 text-slate-400" />, label: 'Khác' },
};

const DEPARTMENTS = ['Học thuật', 'Truyền thông', 'Sự kiện', 'Đối ngoại'];

interface DocRow extends Doc {
  createdByName?: string;
}

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  terms: Term[];
  authMember: Member;
  onTermsRefresh?: () => void;
}

export const DocsModal: React.FC<DocsModalProps> = ({ isOpen, onClose, terms, authMember }) => {
  const isLeadership = authMember.role === 'Chủ nhiệm' || authMember.role === 'Phó Chủ nhiệm';
  const isDeptHead = authMember.role === 'Trưởng ban' || authMember.role === 'Phó ban';
  const canWrite = isLeadership || isDeptHead;

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [termFilter, setTermFilter] = useState<string>('active');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [fName, setFName] = useState('');
  const [fUrl, setFUrl] = useState('');
  const [fType, setFType] = useState('drive');
  const [fDept, setFDept] = useState(isLeadership ? 'Ban Chủ nhiệm' : authMember.department);
  const [fLabel, setFLabel] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const query = termFilter === 'all' ? '?all=1' : termFilter === 'active' ? '' : `?termId=${termFilter}`;
      const d = await api<DocRow[]>(`/docs${query}`);
      setDocs(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, termFilter]);

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFName('');
    setFUrl('');
    setFType('drive');
    setFDept(isLeadership ? 'Ban Chủ nhiệm' : authMember.department);
    setFLabel('');
  };

  const handleStartEdit = (d: DocRow) => {
    setEditingId(d.id);
    setIsAdding(false);
    setFName(d.name);
    setFUrl(d.url);
    setFType(d.docType);
    setFDept(d.department);
    setFLabel(d.label || '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fName.trim() || !fUrl.trim()) return;
    const body = { name: fName.trim(), url: fUrl.trim(), docType: fType, department: fDept, label: fLabel.trim() || undefined };
    try {
      if (editingId) {
        await api(`/docs/${editingId}`, { method: 'PUT', body });
      } else {
        await api('/docs', { method: 'POST', body });
      }
      resetForm();
      load();
    } catch (err: any) {
      alert(err?.message || 'Lưu thất bại');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa tài liệu này khỏi kho?')) return;
    try {
      await api(`/docs/${id}`, { method: 'DELETE' });
      load();
    } catch (err: any) {
      alert(err?.message || 'Xóa thất bại');
    }
  };

  const handlePin = async (id: string) => {
    try {
      await api(`/docs/${id}/pin`, { method: 'POST' });
      load();
    } catch (err: any) {
      alert(err?.message || 'Chỉ Ban lãnh đạo được ghim');
    }
  };

  const visibleDocs = useMemo(
    () =>
      docs.filter((d) => {
        if (deptFilter !== 'all' && d.department !== deptFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            d.name.toLowerCase().includes(q) ||
            (d.label || '').toLowerCase().includes(q) ||
            d.department.toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [docs, deptFilter, searchQuery]
  );

  const pinnedDocs = visibleDocs.filter((d) => d.pinned);
  const normalDocs = visibleDocs.filter((d) => !d.pinned);
  const activeTerm = terms.find((t) => t.isActive);

  if (!isOpen) return null;

  const deptLabel = (dept: string) =>
    dept === 'Ban Chủ nhiệm' ? '🌐 Tài liệu chung' : `${DEPT_EMOJI[dept] || ''} Ban ${dept}`;

  const renderRow = (d: DocRow) => {
    const canEditThis = isLeadership || (isDeptHead && d.department === authMember.department);
    const meta = TYPE_META[d.docType] || TYPE_META.other;
    return (
      <div key={d.id} className="p-3 hover:bg-slate-800/50 transition flex items-center gap-3 border-b border-slate-800 last:border-0">
        <span className="shrink-0">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <a
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-white hover:text-[#8FB2FF] flex items-center gap-1.5 truncate"
            title={d.url}
          >
            {d.pinned && <Pin className="w-3 h-3 text-amber-400 shrink-0 rotate-45" />}
            {d.name}
            <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
          </a>
          <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
            <span className={`px-1.5 py-0.5 rounded font-semibold ${
              d.department === 'Ban Chủ nhiệm'
                ? 'bg-[#2C69FF]/15 text-[#8FB2FF]'
                : 'bg-slate-800 text-slate-300'
            }`}>
              {deptLabel(d.department)}
            </span>
            {d.label && <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300">{d.label}</span>}
            <span>{meta.label}</span>
            {d.createdByName && <span>· {d.createdByName}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 rounded bg-[#2C69FF]/15 text-[#8FB2FF] hover:bg-[#2C69FF]/30 text-[10px] font-bold transition cursor-pointer"
          >
            Mở
          </a>
          {canEditThis && (
            <>
              <button onClick={() => handleStartEdit(d)} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer" title="Sửa">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(d.id)} className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer" title="Xóa">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {isLeadership && (
            <button
              onClick={() => handlePin(d.id)}
              className={`p-1 rounded transition cursor-pointer ${d.pinned ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400'}`}
              title={d.pinned ? 'Bỏ ghim' : 'Ghim lên đầu (Ban lãnh đạo)'}
            >
              <Pin className="w-3.5 h-3.5 rotate-45" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-xs">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Kho tài liệu CLB</h2>
              <p className="text-slate-400">
                Phản chiếu Drive của CLB — tài liệu chung + riêng từng ban theo nhiệm kỳ
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={termFilter}
              onChange={(e) => setTermFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500 cursor-pointer"
              title="Xem theo nhiệm kỳ"
            >
              <option value="active">⭐ Nhiệm kỳ hiện hành{activeTerm ? `: ${activeTerm.name}` : ''}</option>
              <option value="all">Tất cả nhiệm kỳ</option>
              {terms
                .filter((t) => !t.isActive)
                .map((t) => (
                  <option key={t.id} value={t.id}>📦 {t.name}</option>
                ))}
            </select>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500 cursor-pointer"
              title="Lọc theo nơi lưu trữ"
            >
              <option value="all">Tất cả nơi lưu</option>
              <option value="Ban Chủ nhiệm">🌐 Tài liệu chung</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{DEPT_EMOJI[d]} Riêng ban {d}</option>
              ))}
            </select>

            <div className="relative flex-1 min-w-[140px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo tên, nhãn, ban..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {canWrite && !isAdding && !editingId && (
              <button
                onClick={() => { setIsAdding(true); setEditingId(null); }}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm tài liệu
              </button>
            )}
          </div>
        </div>

        {/* Form thêm/sửa */}
        {(isAdding || editingId) && (
          <form onSubmit={handleSave} className="p-4 bg-slate-800/80 border-b border-slate-700 space-y-3">
            <div className="flex items-center justify-between font-bold text-white text-sm">
              <span>{editingId ? 'Sửa tài liệu' : 'Thêm tài liệu mới'}</span>
              <button type="button" onClick={resetForm} className="text-slate-400 hover:text-white">Hủy</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">Đường dẫn (link Drive/Docs/Sheet...):</label>
                <input
                  type="url"
                  value={fUrl}
                  onChange={(e) => setFUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-[11px] focus:outline-none focus:border-sky-500"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tên tài liệu:</label>
                <input
                  type="text"
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  placeholder="VD: Key visual tuyển Gen 8"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Loại:</label>
                <select
                  value={fType}
                  onChange={(e) => setFType(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                >
                  {Object.entries(TYPE_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nơi lưu trữ:</label>
                <select
                  value={fDept}
                  onChange={(e) => setFDept(e.target.value)}
                  disabled={isDeptHead && !isLeadership}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500 disabled:opacity-60"
                >
                  {isLeadership && <option value="Ban Chủ nhiệm">🌐 Tài liệu chung (toàn CLB)</option>}
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{DEPT_EMOJI[d]} Riêng ban {d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nhãn (không bắt buộc):</label>
                <input
                  type="text"
                  value={fLabel}
                  onChange={(e) => setFLabel(e.target.value)}
                  placeholder="VD: Key element, Hồ sơ tài trợ..."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer">
                {editingId ? 'Lưu thay đổi' : 'Thêm vào kho'}
              </button>
            </div>
          </form>
        )}

        {/* Danh sách */}
        <div className="flex-1 overflow-y-auto p-4">
          {pinnedDocs.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Pin className="w-3 h-3 rotate-45" /> Được ghim
              </div>
              <div className="border border-slate-800 rounded-xl overflow-hidden mb-4">
                {pinnedDocs.map(renderRow)}
              </div>
            </>
          )}
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            {normalDocs.map(renderRow)}
            {normalDocs.length === 0 && pinnedDocs.length === 0 && (
              <div className="p-10 text-center text-slate-500">
                Kho trống trong phạm vi này. Thêm link Drive/Docs của CLB để mọi người cùng truy cập!
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-slate-400">
          <span>
            {visibleDocs.length} tài liệu
            {termFilter === 'active' && activeTerm ? ` — nhiệm kỳ ${activeTerm.name}` : ''}
            {deptFilter !== 'all' ? ` · ${deptLabel(deptFilter)}` : ''}
          </span>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold cursor-pointer">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
