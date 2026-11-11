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
        className={`w-full flex items-center justify-between gap-1 px-3 py-2 bg-slate-900 border rounded-lg text-xs font-medium text-left transition ${
          selectedIds.length === 0
            ? 'border-amber-500 text-amber-300 bg-amber-950/30'
            : 'border-slate-700 text-white'
        }`}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full min-w-[240px] max-h-64 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg shadow-2xl">
          {/* Chọn tất cả / Bỏ chọn */}
          <div className="sticky top-0 bg-slate-800/95 backdrop-blur px-2 py-1.5 flex items-center gap-1 border-b border-slate-700">
            <button
              type="button"
              onClick={() => onChange(members.map((m) => m.id))}
              disabled={members.length === 0}
              className={`flex-1 px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                allSelected
                  ? 'bg-[#2C69FF] text-white'
                  : 'bg-[#2C69FF]/15 text-[#8FB2FF] hover:bg-[#2C69FF]/30'
              }`}
            >
              <Users className="w-3 h-3" />
              Chọn tất cả (cả ban)
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={selectedIds.length === 0}
              className="px-2 py-1 rounded text-[11px] bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 transition cursor-pointer"
            >
              Bỏ chọn
            </button>
          </div>

          {members.length === 0 && (
            <div className="px-3 py-3 text-[11px] text-slate-500 text-center">
              Ban này chưa có thành viên
            </div>
          )}
          {members.map((m) => {
            const checked = selectedIds.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 text-left transition cursor-pointer"
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    checked ? 'bg-[#2C69FF] border-[#2C69FF]' : 'border-slate-600'
                  }`}
                >
                  {checked && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="text-xs text-slate-200 truncate flex-1">
                  {m.name}
                  <span className="text-slate-500 ml-1">({m.role})</span>
                </span>
                {selectedIds[0] === m.id && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold shrink-0">
                    chính
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
