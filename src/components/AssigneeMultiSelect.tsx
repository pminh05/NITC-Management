import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Users } from 'lucide-react';
import { Member } from '../types';

interface AssigneeMultiSelectProps {
  members: Member[]; // danh sách đã lọc theo ban
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Chọn nhiều người phụ trách: checkbox từng thành viên + nút "Chọn tất cả (cả ban)".
 * Người đầu tiên trong danh sách là phụ trách chính.
 */
export const AssigneeMultiSelect: React.FC<AssigneeMultiSelectProps> = ({
  members,
  selectedIds,
  onChange,
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

  const allSelected = members.length > 0 && members.every((m) => selectedIds.includes(m.id));
  const firstName = members.find((m) => m.id === selectedIds[0])?.name;

  const summary = (() => {
    if (selectedIds.length === 0) return '-- Chưa chọn người phụ trách --';
    if (allSelected) return `👥 Cả ban (${members.length} người)`;
    if (selectedIds.length === 1) return firstName || '1 người';
    return `${firstName} +${selectedIds.length - 1} người`;
  })();

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-1.5 px-3 py-2 bg-white border rounded-lg text-xs font-medium text-left transition shadow-2xs ${
          selectedIds.length === 0
            ? 'border-amber-400 text-amber-800 bg-amber-50/70 hover:bg-amber-50'
            : 'border-slate-300 text-slate-800 hover:border-slate-400'
        }`}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[240px] max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-150">
          {/* Chọn tất cả / Bỏ chọn */}
          <div className="sticky top-0 bg-slate-50/95 backdrop-blur px-2.5 py-2 flex items-center gap-1.5 border-b border-slate-200 z-10">
            <button
              type="button"
              onClick={() => onChange(members.map((m) => m.id))}
              disabled={members.length === 0}
              className={`flex-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                allSelected
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              <Users className="w-3 h-3" />
              Chọn tất cả ({members.length})
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={selectedIds.length === 0}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition cursor-pointer border border-slate-200"
            >
              Bỏ chọn
            </button>
          </div>

          {members.length === 0 && (
            <div className="px-3 py-4 text-xs text-slate-400 text-center">
              Ban này chưa có thành viên
            </div>
          )}
          <div className="py-1">
            {members.map((m) => {
              const checked = selectedIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition cursor-pointer ${
                    checked ? 'bg-blue-50/60 hover:bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                      checked
                        ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {checked && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                  <span className="text-xs text-slate-800 truncate flex-1 font-medium">
                    {m.name}
                    <span className="text-slate-400 font-normal ml-1">({m.role})</span>
                  </span>
                  {selectedIds[0] === m.id && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold shrink-0 border border-amber-200">
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
