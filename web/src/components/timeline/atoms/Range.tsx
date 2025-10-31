import React from 'react';

export const Range: React.FC<{
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  children?: React.ReactNode;
}> = ({ label, min, max, step = 1, value, onChange, children }) => (
  <label className="ml-2 flex items-center gap-2 text-xs text-slate-300 bg-slate-800/70 border border-slate-700 rounded px-2 py-1">
    {label}
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    {children}
  </label>
);


