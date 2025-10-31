import React from 'react';

export type SearchMode = 'highlight' | 'filter';

export const SearchBar: React.FC<{
  value: string;
  mode: SearchMode;
  onChange: (v: string) => void;
  onModeChange: (m: SearchMode) => void;
}> = ({ value, mode, onChange, onModeChange }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-4">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar (ex.: algoritmos, OOP, Turing)"
        className="w-full sm:w-auto flex-1 px-4 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-neon/40"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => onModeChange('highlight')}
          className={`px-3 py-2 rounded-md border ${
            mode === 'highlight'
              ? 'bg-neon text-black border-neon'
              : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:border-neon/40'
          }`}
        >
          Highlight
        </button>
        <button
          onClick={() => onModeChange('filter')}
          className={`px-3 py-2 rounded-md border ${
            mode === 'filter'
              ? 'bg-neon text-black border-neon'
              : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:border-neon/40'
          }`}
        >
          Filter
        </button>
      </div>
    </div>
  );
};


