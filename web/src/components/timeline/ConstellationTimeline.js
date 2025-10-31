import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import dataset from '../../data/sw-timeline/seed.json';
function yearOf(date) {
    const y = parseInt(date.slice(0, 4), 10);
    return Number.isFinite(y) ? y : 0;
}
export const ConstellationTimeline = ({ height = 600, query = '', mode = 'highlight' }) => {
    const ref = useRef(null);
    const containerRef = useRef(null);
    // pan/zoom state
    const transformRef = useRef({ offsetX: 0, offsetY: 0, scale: 1 });
    const isPanningRef = useRef(false);
    const lastPosRef = useRef({ x: 0, y: 0 });
    const [hover, setHover] = useState({ x: 0, y: 0, nodeIndex: null });
    const [tick, setTick] = useState(0); // force redraws
    useEffect(() => {
        const canvas = ref.current;
        if (!canvas)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
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
        const yScale = (y) => {
            const t = (y - minY) / (maxY - minY || 1);
            return 40 + t * (height - 80);
        };
        const xBuckets = { person: 0.2, work: 0.5, paradigm: 0.8, event: 0.65, technology: 0.35 };
        const xScale = (type) => Math.floor((xBuckets[type] ?? 0.5) * (canvas.clientWidth - 80)) + 40;
        const q = query.trim().toLowerCase();
        const matches = (label) => q.length === 0 || label.toLowerCase().includes(q);
        const { offsetX, offsetY, scale } = transformRef.current;
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        // Draw edges
        ctx.strokeStyle = 'rgba(0,240,255,0.15)';
        ctx.lineWidth = 1.2;
        dataset.edges.forEach((e) => {
            const a = dataset.nodes.find(n => n.id === e.from);
            const b = dataset.nodes.find(n => n.id === e.to);
            if (!a || !b)
                return;
            if (mode === 'filter') {
                const aText = `${a.label} ${a.tags?.join(' ') ?? ''}`;
                const bText = `${b.label} ${b.tags?.join(' ') ?? ''}`;
                if (!(matches(aText) || matches(bText)))
                    return;
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
            }
            else {
                ctx.stroke();
            }
        });
        // Draw nodes
        dataset.nodes.forEach((n) => {
            const x = xScale(n.type);
            const y = yScale(yearOf(n.date));
            const text = `${n.label} ${(n.tags ?? []).join(' ')}`;
            const isMatch = matches(text);
            if (mode === 'filter' && q && !isMatch)
                return;
            // base point
            ctx.fillStyle = isMatch && q ? '#00f0ff' : '#fff';
            ctx.beginPath();
            ctx.arc(x, y, isMatch && q ? 5 : 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = isMatch && q ? 'rgba(0,240,255,0.95)' : 'rgba(226,232,240,0.9)';
            ctx.font = '12px Inter, system-ui, sans-serif';
            ctx.fillText(`${n.label} (${yearOf(n.date)})`, x + 8, y - 8);
        });
        ctx.restore();
    }, [height, query, mode, tick]);
    // interactions: pan, zoom, hover tooltip
    useEffect(() => {
        const canvas = ref.current;
        if (!canvas)
            return;
        const redraw = () => setTick(t => t + 1);
        const onWheel = (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const t = transformRef.current;
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            const newScale = Math.min(4, Math.max(0.25, t.scale * factor));
            const worldX = (mx - t.offsetX) / t.scale;
            const worldY = (my - t.offsetY) / t.scale;
            const newOffsetX = mx - worldX * newScale;
            const newOffsetY = my - worldY * newScale;
            transformRef.current = { offsetX: newOffsetX, offsetY: newOffsetY, scale: newScale };
            redraw();
        };
        const onMouseDown = (e) => {
            isPanningRef.current = true;
            lastPosRef.current = { x: e.clientX, y: e.clientY };
            if (containerRef.current)
                containerRef.current.style.cursor = 'grabbing';
        };
        const onMouseMove = (e) => {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            if (isPanningRef.current) {
                const dx = e.clientX - lastPosRef.current.x;
                const dy = e.clientY - lastPosRef.current.y;
                lastPosRef.current = { x: e.clientX, y: e.clientY };
                const t = transformRef.current;
                transformRef.current = { offsetX: t.offsetX + dx, offsetY: t.offsetY + dy, scale: t.scale };
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
            const yScale = (y) => {
                const tt = (y - minY) / (maxY - minY || 1);
                return 40 + tt * (height - 80);
            };
            const xBuckets = { person: 0.2, work: 0.5, paradigm: 0.8, event: 0.65, technology: 0.35 };
            const xScale = (type) => Math.floor((xBuckets[type] ?? 0.5) * (canvas.clientWidth - 80)) + 40;
            const q = query.trim().toLowerCase();
            const inFilter = (n) => {
                if (!q)
                    return true;
                const text = `${n.label} ${(n.tags ?? []).join(' ')}`.toLowerCase();
                return text.includes(q);
            };
            let found = null;
            for (let i = 0; i < dataset.nodes.length; i++) {
                const n = dataset.nodes[i];
                if (mode === 'filter' && q && !inFilter(n))
                    continue;
                const x = xScale(n.type);
                const y = yScale(yearOf(n.date));
                const dx = wx - x;
                const dy = wy - y;
                if (dx * dx + dy * dy <= 9 * 9) { // radius 9 world units
                    found = i;
                    break;
                }
            }
            if (found !== null)
                setHover({ x: mx + 12, y: my + 12, nodeIndex: found });
            else if (hover.nodeIndex !== null)
                setHover(h => ({ ...h, nodeIndex: null }));
        };
        const onMouseUp = () => {
            isPanningRef.current = false;
            if (containerRef.current)
                containerRef.current.style.cursor = 'default';
        };
        const onMouseLeave = () => {
            isPanningRef.current = false;
            if (containerRef.current)
                containerRef.current.style.cursor = 'default';
            if (hover.nodeIndex !== null)
                setHover(h => ({ ...h, nodeIndex: null }));
        };
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('mouseleave', onMouseLeave);
        return () => {
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('mouseleave', onMouseLeave);
        };
    }, [height, query, mode, hover.nodeIndex]);
    return (_jsxs("div", { ref: containerRef, className: "w-full relative", style: { cursor: 'default' }, children: [_jsx("canvas", { ref: ref, style: { width: '100%', height } }), hover.nodeIndex !== null && (_jsxs("div", { className: "pointer-events-none absolute z-10 p-3 rounded-md text-xs bg-slate-900/90 border border-slate-700 text-slate-200 shadow-lg max-w-xs", style: { left: hover.x, top: hover.y }, children: [_jsx("div", { className: "font-semibold text-neon mb-1", children: dataset.nodes[hover.nodeIndex].label }), dataset.nodes[hover.nodeIndex].summary && (_jsx("div", { className: "text-slate-300", children: dataset.nodes[hover.nodeIndex].summary })), dataset.nodes[hover.nodeIndex].tags && dataset.nodes[hover.nodeIndex].tags.length > 0 && (_jsxs("div", { className: "mt-1 text-slate-400", children: ["Tags: ", dataset.nodes[hover.nodeIndex].tags.slice(0, 6).join(', ')] }))] }))] }));
};
