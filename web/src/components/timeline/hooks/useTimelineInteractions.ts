import { useEffect, useRef, type RefObject } from 'react';
import type { Node, Transform, LayoutPoint, Velocity } from '../types';
import type { SearchMode } from '../SearchBar';
import { yearOf } from '../utils';
import { clampTransform } from '../engine/transform';
import { createLayoutConfig, computeIndexToOffset, xScaleYear, type LayoutConfig } from '../engine/layout';

type HoverState = { screenX: number; screenY: number; nodeIndex: number | null };

type UseTimelineInteractionsOptions = {
  canvasRef: RefObject<HTMLCanvasElement>;
  containerRef: RefObject<HTMLDivElement>;
  transformRef: React.MutableRefObject<Transform>;
  layoutRef: React.MutableRefObject<LayoutPoint[]>;
  nodes: Node[];
  height: number;
  branchSpacing: number;
  query: string;
  mode: SearchMode;
  focusYear: number | null;
  yearsSorted: number[];
  setTick: (updater: (t: number) => number) => void;
  setHover: React.Dispatch<React.SetStateAction<HoverState>>;
  setSelectedIndex: (index: number | null) => void;
  setFocusYear: (year: number | null) => void;
  setDeepLink: (index: number) => void;
  centerOnYear: (year: number) => void;
  hover: HoverState;
  layoutConfig: LayoutConfig; // Pass layoutConfig for proper centering
};

export function useTimelineInteractions({
  canvasRef,
  containerRef,
  transformRef,
  layoutRef,
  nodes,
  height,
  branchSpacing,
  query,
  mode,
  focusYear,
  yearsSorted,
  setTick,
  setHover,
  setSelectedIndex,
  setFocusYear,
  setDeepLink,
  centerOnYear,
  hover,
  layoutConfig,
}: UseTimelineInteractionsOptions) {
  const isPanningRef = useRef(false);
  const lastMousePosRef = useRef<{ screenX: number; screenY: number }>({ screenX: 0, screenY: 0 });
  const velocityRef = useRef<Velocity>({ vx: 0, vy: 0 });
  const momentumRaf = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const redraw = () => setTick(t => t + 1);
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseScreenX = e.clientX - rect.left;
      const mouseScreenY = e.clientY - rect.top;
      const transform = transformRef.current;
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = clamp(transform.scale * zoomFactor, 0.25, 3.0);
      // Convert screen Y to world Y before scaling
      const worldY = (mouseScreenY - transform.offsetY) / transform.scale;
      // Keep horizontal offset fixed, adjust vertical to zoom towards cursor
      // Horizontal offset will be recalculated by clampTransform for centering during zoom
      const newOffsetY = mouseScreenY - worldY * newScale;
      const clampedTransform = clampTransform(
        { offsetX: transform.offsetX, offsetY: newOffsetY, scale: newScale },
        canvas,
        height,
        nodes,
        branchSpacing,
        layoutConfig,
        true // Force horizontal centering during zoom
      );
      transformRef.current = clampedTransform;
      redraw();
    };

    const onMouseDown = (e: MouseEvent) => {
      isPanningRef.current = true;
      lastMousePosRef.current = { screenX: e.clientX, screenY: e.clientY };
      if (containerRef.current) containerRef.current.style.cursor = 'grab';
      if (canvas) canvas.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseScreenX = e.clientX - rect.left;
      const mouseScreenY = e.clientY - rect.top;
      if (isPanningRef.current) {
        const deltaX = e.clientX - lastMousePosRef.current.screenX;
        const deltaY = e.clientY - lastMousePosRef.current.screenY;
        lastMousePosRef.current = { screenX: e.clientX, screenY: e.clientY };
        const transform = transformRef.current;
        // Allow horizontal and vertical panning
        const clampedTransform = clampTransform(
          { offsetX: transform.offsetX + deltaX, offsetY: transform.offsetY + deltaY, scale: transform.scale },
          canvas,
          height,
          nodes,
          branchSpacing,
          layoutConfig,
          false // Don't force center during panning
        );
        transformRef.current = clampedTransform;
        velocityRef.current = { vx: deltaX, vy: deltaY };
        setHover(h => ({ ...h, nodeIndex: null }));
        redraw();
        return;
      }

      // Hover hit test: convert screen coordinates to world coordinates
      const transform = transformRef.current;
      const worldX = (mouseScreenX - transform.offsetX) / transform.scale;
      const worldY = (mouseScreenY - transform.offsetY) / transform.scale;

      // Use constellation positions for hit testing
      const hoverIndexToPosition = computeIndexToOffset(nodes, layoutConfig);
      const q = query.trim().toLowerCase();
      const inFilter = (n: Node) => {
        if (!q) return true;
        const text = `${n.label} ${(n.tags ?? []).join(' ')}`.toLowerCase();
        return text.includes(q);
      };

      let foundNodeIndex: number | null = null;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (mode === 'filter' && q && !inFilter(node)) continue;
        const pos = hoverIndexToPosition.get(i);
        const nodeWorldX = pos?.x ?? xScaleYear(yearOf(node.date), layoutConfig);
        const nodeWorldY = pos?.y ?? layoutConfig.baselineY;
        const deltaWorldX = worldX - nodeWorldX;
        const deltaWorldY = worldY - nodeWorldY;
        const distanceSquared = deltaWorldX * deltaWorldX + deltaWorldY * deltaWorldY;
        const hitRadiusSquared = 9 * 9; // 9 world units radius
        if (distanceSquared <= hitRadiusSquared) {
          foundNodeIndex = i;
          break;
        }
      }

      if (foundNodeIndex !== null) {
        setHover({ screenX: mouseScreenX + 12, screenY: mouseScreenY + 12, nodeIndex: foundNodeIndex });
      } else if (hover.nodeIndex !== null) {
        setHover(h => ({ ...h, nodeIndex: null }));
      }
    };

    const onMouseUp = () => {
      isPanningRef.current = false;
      if (containerRef.current) containerRef.current.style.cursor = 'default';
      if (canvas) canvas.style.cursor = 'grab';
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
        const next = clampTransform(
          { offsetX: t.offsetX + vx, offsetY: t.offsetY + vy, scale: t.scale },
          canvas,
          height,
          nodes,
          branchSpacing,
          layoutConfig,
          false // Don't force center during momentum scrolling
        );
        transformRef.current = next;
        velocityRef.current = { vx: vx * decay, vy: vy * decay };
        redraw();
        momentumRaf.current = requestAnimationFrame(step);
      };
      if (!momentumRaf.current) momentumRaf.current = requestAnimationFrame(step);
    };

    const onMouseLeave = () => {
      isPanningRef.current = false;
      if (containerRef.current) containerRef.current.style.cursor = 'default';
      if (canvas) canvas.style.cursor = 'default';
      if (hover.nodeIndex !== null) setHover(h => ({ ...h, nodeIndex: null }));
    };

    const onClick = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseScreenX = e.clientX - rect.left;
      const mouseScreenY = e.clientY - rect.top;
      const transform = transformRef.current;
      const worldX = (mouseScreenX - transform.offsetX) / transform.scale;
      const worldY = (mouseScreenY - transform.offsetY) / transform.scale;
      let clickedNodeIndex: number | null = null;
      let bestDistanceSquared = Infinity;
      const clickRadiusSquared = 12 * 12; // 12 world units radius
      for (const layoutPoint of layoutRef.current) {
        const deltaWorldX = worldX - layoutPoint.x;
        const deltaWorldY = worldY - layoutPoint.y;
        const distanceSquared = deltaWorldX * deltaWorldX + deltaWorldY * deltaWorldY;
        if (distanceSquared < clickRadiusSquared && distanceSquared < bestDistanceSquared) {
          bestDistanceSquared = distanceSquared;
          clickedNodeIndex = layoutPoint.index;
        }
      }
      // Ctrl/Cmd+Click opens source link directly
      if (clickedNodeIndex !== null && (e.ctrlKey || e.metaKey)) {
        const clickedNode = nodes[clickedNodeIndex];
        const firstSource = clickedNode.sources && clickedNode.sources[0];
        if (firstSource) window.open(firstSource, '_blank');
        return;
      }
      setSelectedIndex(clickedNodeIndex);
      if (clickedNodeIndex !== null) {
        setDeepLink(clickedNodeIndex);
        const selectedYear = yearOf(nodes[clickedNodeIndex].date);
        setFocusYear(selectedYear);
        centerOnYear(selectedYear);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return;
      const t = transformRef.current;
      const step = 40;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!yearsSorted.length) return;
        const current = focusYear ?? yearsSorted[0];
        const idx = yearsSorted.findIndex(y => y === current);
        const nextIdx = e.key === 'ArrowLeft' ? Math.max(0, idx - 1) : Math.min(yearsSorted.length - 1, idx + 1);
        const nextYear = yearsSorted[nextIdx];
        setFocusYear(nextYear);
        centerOnYear(nextYear);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const dir = e.key === 'ArrowUp' ? 1 : -1;
        const next = clampTransform(
          { ...t, offsetY: t.offsetY + dir * step },
          canvas,
          height,
          nodes,
          branchSpacing,
          layoutConfig,
          false // Don't force center during keyboard navigation
        );
        transformRef.current = next;
        setTick(v => v + 1);
      } else if (e.key === '+' || e.key === '=') {
        const evt = new WheelEvent('wheel', { deltaY: -1 });
        canvas.dispatchEvent(evt);
      } else if (e.key === '-') {
        const evt = new WheelEvent('wheel', { deltaY: 1 });
        canvas.dispatchEvent(evt);
      } else if (e.key === 'Escape') {
        setSelectedIndex(null);
      }
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
  }, [height, query, mode, hover.nodeIndex, focusYear, yearsSorted, branchSpacing, nodes]);
}

