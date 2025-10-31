import React from 'react';
import type { Node } from '../types';
import { yearOf } from '../utils';

export const DetailPanel: React.FC<{
  node: Node;
  onClose: () => void;
  onCenter: () => void;
  onOpenSource: () => void;
  onCopyLink: () => void;
}> = ({ node, onClose, onCenter, onOpenSource, onCopyLink }) => {
  return (
    <div className="absolute right-3 bottom-3 z-10 max-w-sm p-4 rounded-lg bg-slate-900/95 backdrop-blur-sm border border-slate-700 text-slate-200 shadow-xl">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {(node as any).image && (
            <img
              src={(node as any).image}
              alt="autor"
              className="w-10 h-10 rounded-full object-cover border border-slate-700 flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-neon font-semibold text-sm break-words">{node.label}</div>
            <div className="text-xs text-slate-400 mt-0.5">{yearOf(node.date)}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-neon transition-colors flex-shrink-0"
          aria-label="Close details"
        >
          ✕
        </button>
      </div>

      {(node as any).summary && (
        <div className="mt-3 text-sm text-slate-300 leading-relaxed">{(node as any).summary}</div>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={onCenter}
          className="px-2 py-1 text-xs border border-slate-600 rounded hover:border-neon hover:text-neon transition-colors"
        >
          Center
        </button>
        <button
          onClick={onOpenSource}
          className="px-2 py-1 text-xs border border-slate-600 rounded hover:border-neon hover:text-neon transition-colors"
        >
          Open source
        </button>
        <button
          onClick={onCopyLink}
          className="px-2 py-1 text-xs border border-slate-600 rounded hover:border-neon hover:text-neon transition-colors"
        >
          Copy link
        </button>
      </div>

      {node.sources && node.sources.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <div className="text-xs text-slate-400 mb-2 font-medium">Fontes primárias</div>
          <ul className="space-y-1.5">
            {node.sources.slice(0, 6).map((src: string, i: number) => (
              <li key={i}>
                <a
                  className="text-neon hover:underline text-xs break-all block"
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                >
                  {src.length > 60 ? `${src.slice(0, 60)}...` : src}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {node.tags && node.tags.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <div className="flex flex-wrap gap-1.5">
            {node.tags.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs bg-slate-800/60 border border-slate-700 rounded text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

