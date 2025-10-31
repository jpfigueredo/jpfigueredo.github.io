import React from 'react';

export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, children, ...props }) => (
  <button
    {...props}
    className={`px-3 py-1 text-xs bg-slate-800/70 border border-slate-700 rounded text-slate-200 hover:text-neon ${className ?? ''}`}
  >
    {children}
  </button>
);


