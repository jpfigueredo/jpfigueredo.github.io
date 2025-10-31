import React from 'react';

export const Toggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="ml-2 flex items-center gap-2 text-xs text-slate-300 bg-slate-800/70 border border-slate-700 rounded px-2 py-1">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    {label}
  </label>
);


