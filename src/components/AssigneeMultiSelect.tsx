import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Users } from 'lucide-react';
import { Member } from '../types';

interface AssigneeMultiSelectProps {
  members: Member[]; // danh sách đã lọc theo ban
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  darkMode?: boolean;
}

/**
 * Chọn nhiều người phụ trách: checkbox từng thành viên + nút "Chọn tất cả (cả ban)".
 * Người đầu tiên trong danh sách là phụ trách chính.
 */
export const AssigneeMultiSelect: React.FC<AssigneeMultiSelectProps> = ({
  members,
  selectedIds,
  onChange,
  darkMode = false,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const safeMembers = Array.isArray(members) ? members : [];
  const safeSelectedIds = Array.isArray(selectedIds) ? selectedIds : [];

  const allSelected = safeMembers.length > 0 && safeMembers.every((m) => safeSelectedIds.includes(m.id));
  const firstName = safeMembers.find((m) => m.id === safeSelectedIds[0])?.name;

  const summary = (() => {
    if (safeSelectedIds.length === 0) return '-- Chưa chọn người phụ trách --';
    if (allSelected) return `👥 Cả ban (${safeMembers.length} người)`;
    if (safeSelectedIds.length === 1) return firstName || '1 người';
    return `${firstName} +${safeSelectedIds.length - 1} người`;
  })();

  const toggle = (id: string) => {
    if (safeSelectedIds.includes(id)) {
      onChange(safeSelectedIds.filter((x) => x !== id));
    } else {
      onChange([...safeSelectedIds, id]);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-1.5 px-3 py-2 border rounded-lg text-xs font-medium text-left transition shadow-2xs ${
          darkMode
            ? selectedIds.length === 0
              ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 hover:bg-amber-500/15'
              : 'bg-slate-950 border-slate-700 text-slate-100 hover:border-slate-600'
            : selectedIds.length === 0
            ? 'border-amber-400 text-amber-800 bg-amber-50/70 hover:bg-amber-50'
            : 'border-slate-300 text-slate-800 hover:border-slate-400 bg-white'
        }`}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {open && (
        <div
          className={`absolute z-30 mt-1 w-full min-w-[240px] max-h-64 overflow-y-auto rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
            darkMode
              ? 'bg-slate-900 border border-slate-700 text-slate-100 shadow-slate-950/80'
              : 'bg-white border border-slate-200 text-slate-900 shadow-xl'
          }`}
        >
          {/* Chọn tất cả / Bỏ chọn */}
          <div
            className={`sticky top-0 px-2.5 py-2 flex items-center gap-1.5 border-b z-10 backdrop-blur ${
              darkMode
                ? 'bg-slate-900/95 border-slate-800'
                : 'bg-slate-50/95 border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => onChange(safeMembers.map((m) => m.id))}
              disabled={safeMembers.length === 0}
              className={`flex-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                allSelected
                  ? 'bg-[#2C69FF] text-white shadow-xs'
                  : darkMode
                  ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/40'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              <Users className="w-3 h-3" />
              Chọn tất cả ({safeMembers.length})
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={safeSelectedIds.length === 0}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold disabled:opacity-40 transition cursor-pointer border ${
                darkMode
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white border-slate-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
              }`}
            >
              Bỏ chọn
            </button>
          </div>

          {safeMembers.length === 0 && (
            <div className="px-3 py-4 text-xs text-slate-400 text-center">
              Ban này chưa có thành viên
            </div>
          )}
          <div className="py-1">
            {safeMembers.map((m) => {
              const checked = safeSelectedIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition cursor-pointer ${
                    darkMode
                      ? checked
                        ? 'bg-blue-500/15 hover:bg-blue-500/25'
                        : 'hover:bg-slate-800/70'
                      : checked
                      ? 'bg-blue-50/60 hover:bg-blue-50'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                      checked
                        ? 'bg-[#2C69FF] border-[#2C69FF] text-white shadow-2xs'
                        : darkMode
                        ? 'border-slate-600 bg-slate-950'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {checked && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                  <span
                    className={`text-xs truncate flex-1 font-medium ${
                      darkMode ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    {m.name}
                    <span className="text-slate-400 font-normal ml-1">({m.role})</span>
                  </span>
                  {safeSelectedIds[0] === m.id && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold shrink-0 border ${
                        darkMode
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}
                    >
                      phụ trách chính
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
