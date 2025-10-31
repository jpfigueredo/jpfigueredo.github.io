import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const SearchBar = ({ value, mode, onChange, onModeChange }) => {
    return (_jsxs("div", { className: "flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-4", children: [_jsx("input", { value: value, onChange: (e) => onChange(e.target.value), placeholder: "Buscar (ex.: algoritmos, OOP, Turing)", className: "w-full sm:w-auto flex-1 px-4 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-neon/40" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => onModeChange('highlight'), className: `px-3 py-2 rounded-md border ${mode === 'highlight'
                            ? 'bg-neon text-black border-neon'
                            : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:border-neon/40'}`, children: "Highlight" }), _jsx("button", { onClick: () => onModeChange('filter'), className: `px-3 py-2 rounded-md border ${mode === 'filter'
                            ? 'bg-neon text-black border-neon'
                            : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:border-neon/40'}`, children: "Filter" })] })] }));
};
