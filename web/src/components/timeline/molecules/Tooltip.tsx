import React from 'react';
import type { Node } from '../types';

export const Tooltip: React.FC<{
  node: Node;
  x: number;
  y: number;
}> = ({ node, x, y }) => {
  return (
    <div
      className="pointer-events-none absolute z-10 p-3 rounded-md text-xs bg-slate-900/95 backdrop-blur-sm border border-slate-700 text-slate-200 shadow-lg max-w-xs"
      style={{ left: x, top: y }}
    >
      <div className="font-semibold text-neon mb-1">{node.label}</div>
      {(node as any).summary && (
        <div className="text-slate-300 text-xs leading-relaxed line-clamp-2">
          {(node as any).summary}
        </div>
      )}
      {node.tags && node.tags.length > 0 && (
        <div className="mt-2 text-slate-400 text-xs">
          Tags: {node.tags.slice(0, 6).join(', ')}
        </div>
      )}
    </div>
  );
};

