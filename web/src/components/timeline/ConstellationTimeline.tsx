import React, { useEffect, useRef, useState } from 'react';
import type { SearchMode } from './SearchBar';
import dataset from '../../data/sw-timeline/seed.json';

type Node = typeof dataset.nodes[number];

type Edge = typeof dataset.edges[number];

function yearOf(date: string): number {
  const y = parseInt(date.slice(0, 4), 10);
  return Number.isFinite(y) ? y : 0;
}

export const ConstellationTimeline: React.FC<{ height?: number; query?: string; mode?: SearchMode }>= ({ height = 600, query = '', mode = 'highlight' }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // pan/zoom state
  const transformRef = useRef<{ offsetX: number; offsetY: number; scale: number }>({ offsetX: 0, offsetY: 0, scale: 1 });
  const isPanningRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const velocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const momentumRaf = useRef<number | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; nodeIndex: number | null }>({ x: 0, y: 0, nodeIndex: null });
  const [tick, setTick] = useState(0); // force redraws
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const layoutRef = useRef<{ x: number; y: number; index: number }[]>([]);

  // initialize from hash
  useEffect(() => {
    const key = 'sw-node=';
    const parse = () => {
      const hash = window.location.hash;
      const p = hash.indexOf(key);
      if (p === -1) return null;
      const id = decodeURIComponent(hash.slice(p + key.length));
      const idx = dataset.nodes.findIndex(n => n.id === id);
      return idx >= 0 ? idx : null;
    };
    const idx = parse();
    if (idx !== null) setSelectedIndex(idx);
    const onHash = () => {
      const i = parse();
      if (i !== null) setSelectedIndex(i);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setDeepLink = (index: number | null) => {
    if (index === null) return;
    const base = window.location.href.split('#')[0];
    const id = dataset.nodes[index].id;
    history.replaceState(null, '', `${base}#sw-node=${encodeURIComponent(id)}`);
  };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth * dpr;
    const heightPx = height * dpr;
    canvas.width = width;
    canvas.height = heightPx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // time range
    const years = dataset.nodes.map(n => yearOf(n.date)).filter(Boolean);
    const minY = Math.min(...years);
    const maxY = Math.max(...years);

    const yScale = (y: number) => {
      const t = (y - minY) / (maxY - minY || 1);
      return 40 + t * (height - 80);
    };

    const xBuckets: Record<string, number> = { person: 0.2, work: 0.5, paradigm: 0.8, event: 0.65, technology: 0.35 };
    const xScale = (type: string) => Math.floor((xBuckets[type] ?? 0.5) * (canvas.clientWidth - 80)) + 40;

    const q = query.trim().toLowerCase();
    const matches = (label: string) =>
      q.length === 0 || label.toLowerCase().includes(q);

    const { offsetX, offsetY, scale } = transformRef.current;
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw edges
    ctx.strokeStyle = 'rgba(0,240,255,0.15)';
    ctx.lineWidth = 1.2;
    dataset.edges.forEach((e: Edge) => {
      const a = dataset.nodes.find(n => n.id === e.from);
      const b = dataset.nodes.find(n => n.id === e.to);
      if (!a || !b) return;
      if (mode === 'filter') {
        const aText = `${a.label} ${a.tags?.join(' ') ?? ''}`;
        const bText = `${b.label} ${b.tags?.join(' ') ?? ''}`;
        if (!(matches(aText) || matches(bText))) return;
      }
      const ax = xScale(a.type);
      const ay = yScale(yearOf(a.date));
      const bx = xScale(b.type);
      const by = yScale(yearOf(b.date));
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      if (mode === 'highlight' && q) {
        const h = 1 + 2; // thickness boost
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.35;
        ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 1;
      } else {
        ctx.stroke();
      }
    });

    // Draw nodes
    layoutRef.current = [];
    dataset.nodes.forEach((n: Node, i: number) => {
      const x = xScale(n.type);
      const y = yScale(yearOf(n.date));
      layoutRef.current.push({ x, y, index: i });
      const text = `${n.label} ${(n.tags ?? []).join(' ')}`;
      const isMatch = matches(text);
      if (mode === 'filter' && q && !isMatch) return;

      // base point
      ctx.fillStyle = isMatch && q ? '#00f0ff' : '#fff';
      ctx.beginPath();
      ctx.arc(x, y, isMatch && q ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();

      // selection ring
      if (selectedIndex === i) {
        ctx.strokeStyle = 'rgba(0,240,255,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1.2;
      }

      ctx.fillStyle = isMatch && q ? 'rgba(0,240,255,0.95)' : 'rgba(226,232,240,0.9)';
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.fillText(`${n.label} (${yearOf(n.date)})`, x + 8, y - 8);
    });

    ctx.restore();
  }, [height, query, mode, tick, selectedIndex]);

  // interactions: pan, zoom, hover tooltip
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const redraw = () => setTick(t => t + 1);

    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const t = transformRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = clamp(t.scale * factor, 0.25, 3.0);
      const worldX = (mx - t.offsetX) / t.scale;
      const worldY = (my - t.offsetY) / t.scale;
      const newOffsetX = mx - worldX * newScale;
      const newOffsetY = my - worldY * newScale;
      transformRef.current = { offsetX: newOffsetX, offsetY: newOffsetY, scale: newScale };
      redraw();
    };

    const onMouseDown = (e: MouseEvent) => {
      isPanningRef.current = true;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (isPanningRef.current) {
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
        const t = transformRef.current;
        transformRef.current = { offsetX: t.offsetX + dx, offsetY: t.offsetY + dy, scale: t.scale };
        velocityRef.current = { vx: dx, vy: dy };
        setHover(h => ({ ...h, nodeIndex: null }));
        redraw();
        return;
      }

      // hover hit test in world space
      const t = transformRef.current;
      const wx = (mx - t.offsetX) / t.scale;
      const wy = (my - t.offsetY) / t.scale;

      // reconstruct layout
      const years = dataset.nodes.map(n => yearOf(n.date)).filter(Boolean);
      const minY = Math.min(...years);
      const maxY = Math.max(...years);
      const yScale = (y: number) => {
        const tt = (y - minY) / (maxY - minY || 1);
        return 40 + tt * (height - 80);
      };
      const xBuckets: Record<string, number> = { person: 0.2, work: 0.5, paradigm: 0.8, event: 0.65, technology: 0.35 };
      const xScale = (type: string) => Math.floor((xBuckets[type] ?? 0.5) * (canvas.clientWidth - 80)) + 40;
      const q = query.trim().toLowerCase();
      const inFilter = (n: Node) => {
        if (!q) return true;
        const text = `${n.label} ${(n.tags ?? []).join(' ')}`.toLowerCase();
        return text.includes(q);
      };

      let found: number | null = null;
      for (let i = 0; i < dataset.nodes.length; i++) {
        const n = dataset.nodes[i];
        if (mode === 'filter' && q && !inFilter(n)) continue;
        const x = xScale(n.type);
        const y = yScale(yearOf(n.date));
        const dx = wx - x;
        const dy = wy - y;
        if (dx * dx + dy * dy <= 9 * 9) { // radius 9 world units
          found = i;
          break;
        }
      }

      if (found !== null) setHover({ x: mx + 12, y: my + 12, nodeIndex: found });
      else if (hover.nodeIndex !== null) setHover(h => ({ ...h, nodeIndex: null }));
    };

    const onMouseUp = () => {
      isPanningRef.current = false;
      if (containerRef.current) containerRef.current.style.cursor = 'default';
      // momentum with decay
      const decay = 0.92;
      const minSpeed = 0.2;
      const step = () => {
        const { vx, vy } = velocityRef.current;
        const speed = Math.hypot(vx, vy);
        if (speed < minSpeed) {
          if (momentumRaf.current) cancelAnimationFrame(momentumRaf.current);
          momentumRaf.current = null;
          return;
        }
        const t = transformRef.current;
        transformRef.current = { offsetX: t.offsetX + vx, offsetY: t.offsetY + vy, scale: t.scale };
        velocityRef.current = { vx: vx * decay, vy: vy * decay };
        redraw();
        momentumRaf.current = requestAnimationFrame(step);
      };
      if (!momentumRaf.current) momentumRaf.current = requestAnimationFrame(step);
    };

    const onMouseLeave = () => {
      isPanningRef.current = false;
      if (containerRef.current) containerRef.current.style.cursor = 'default';
      if (hover.nodeIndex !== null) setHover(h => ({ ...h, nodeIndex: null }));
    };

    const onClick = (e: MouseEvent) => {
      const canvas = ref.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const t = transformRef.current;
      const wx = (mx - t.offsetX) / t.scale;
      const wy = (my - t.offsetY) / t.scale;
      // pick nearest within radius using layout
      let picked: number | null = null;
      let best = Infinity;
      for (const p of layoutRef.current) {
        const dx = wx - p.x;
        const dy = wy - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 12 * 12 && d2 < best) {
          best = d2;
          picked = p.index;
        }
      }
      if (picked !== null && (e.ctrlKey || e.metaKey)) {
        const node = dataset.nodes[picked];
        const firstSrc = node.sources && node.sources[0];
        if (firstSrc) window.open(firstSrc, '_blank');
        return;
      }
      setSelectedIndex(picked);
      if (picked !== null) setDeepLink(picked);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return;
      const t = transformRef.current;
      const step = 40;
      if (e.key === 'ArrowLeft') { transformRef.current = { ...t, offsetX: t.offsetX + step }; setSelectedIndex(null); setTick(v => v + 1); }
      else if (e.key === 'ArrowRight') { transformRef.current = { ...t, offsetX: t.offsetX - step }; setSelectedIndex(null); setTick(v => v + 1); }
      else if (e.key === 'ArrowUp') { transformRef.current = { ...t, offsetY: t.offsetY + step }; setSelectedIndex(null); setTick(v => v + 1); }
      else if (e.key === 'ArrowDown') { transformRef.current = { ...t, offsetY: t.offsetY - step }; setSelectedIndex(null); setTick(v => v + 1); }
      else if (e.key === '+') { const evt = new WheelEvent('wheel', { deltaY: -1 }); ref.current?.dispatchEvent(evt); }
      else if (e.key === '-') { const evt = new WheelEvent('wheel', { deltaY: 1 }); ref.current?.dispatchEvent(evt); }
      else if (e.key === 'Escape') { setSelectedIndex(null); }
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('click', onClick);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      canvas.removeEventListener('wheel', onWheel as EventListener);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('keydown', onKeyDown);
      if (momentumRaf.current) {
        cancelAnimationFrame(momentumRaf.current);
        momentumRaf.current = null;
      }
    };
  }, [height, query, mode, hover.nodeIndex]);

  return (
    <div
      ref={containerRef}
      className="w-full relative outline-none focus:ring-2 focus:ring-neon/60 focus:rounded-md"
      style={{ cursor: 'default' }}
      tabIndex={0}
      aria-label="Constellation timeline canvas"
    >
      <canvas ref={ref} style={{ width: '100%', height }} />
      {hover.nodeIndex !== null && (
        <div
          className="pointer-events-none absolute z-10 p-3 rounded-md text-xs bg-slate-900/90 border border-slate-700 text-slate-200 shadow-lg max-w-xs"
          style={{ left: hover.x, top: hover.y }}
        >
          <div className="font-semibold text-neon mb-1">{dataset.nodes[hover.nodeIndex].label}</div>
          {(dataset.nodes[hover.nodeIndex] as any).summary && (
            <div className="text-slate-300">{(dataset.nodes[hover.nodeIndex] as any).summary}</div>
          )}
          {dataset.nodes[hover.nodeIndex].tags && dataset.nodes[hover.nodeIndex].tags!.length > 0 && (
            <div className="mt-1 text-slate-400">Tags: {dataset.nodes[hover.nodeIndex].tags!.slice(0, 6).join(', ')}</div>
          )}
        </div>
      )}
      {selectedIndex !== null && (
        <div className="absolute right-3 bottom-3 z-10 max-w-sm p-4 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-200 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-neon font-semibold">{dataset.nodes[selectedIndex].label}</div>
              <div className="text-xs text-slate-400">{yearOf(dataset.nodes[selectedIndex].date)}</div>
            </div>
            <div className="flex gap-2 pointer-events-auto">
              <button
                onClick={() => {
                  const src = dataset.nodes[selectedIndex!].sources && dataset.nodes[selectedIndex!].sources![0];
                  if (src) window.open(src, '_blank');
                }}
                className="px-2 py-1 text-xs border border-slate-600 rounded hover:border-neon hover:text-neon"
              >Open source</button>
              <button
                onClick={async () => {
                  const base = window.location.href.split('#')[0];
                  const id = dataset.nodes[selectedIndex!].id;
                  const link = `${base}#sw-node=${encodeURIComponent(id)}`;
                  try { await navigator.clipboard.writeText(link); } catch {}
                }}
                className="px-2 py-1 text-xs border border-slate-600 rounded hover:border-neon hover:text-neon"
              >Copy link</button>
              <button
                onClick={() => setSelectedIndex(null)}
                className="text-slate-400 hover:text-neon"
                aria-label="Close details"
              >✕</button>
            </div>
          </div>
          {(dataset.nodes[selectedIndex] as any).summary && (
            <div className="mt-2 text-sm text-slate-300">{(dataset.nodes[selectedIndex] as any).summary}</div>
          )}
          {dataset.nodes[selectedIndex].sources && dataset.nodes[selectedIndex].sources!.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-slate-400 mb-1">Fontes primárias</div>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {dataset.nodes[selectedIndex].sources!.slice(0, 6).map((src: string, i: number) => (
                  <li key={i}>
                    <a className="text-neon hover:underline" href={src} target="_blank" rel="noreferrer">{src}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
