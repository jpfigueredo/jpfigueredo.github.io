import React, { useEffect, useRef, useState } from 'react';
import type { SearchMode } from './SearchBar';
import dataset from '../../data/sw-timeline/seed.json';
import { yearOf, uniqueSortedYears } from './utils';
import { ControlsBar } from './molecules/ControlsBar';
import { DetailPanel } from './molecules/DetailPanel';
import { Tooltip } from './molecules/Tooltip';
import type { Transform, LayoutPoint } from './types';
import { createLayoutConfig, computeIndexToOffset, type LayoutConfig } from './engine/layout';
import { easeInOutQuad, clampTransform } from './engine/transform';
import { renderTimeline } from './engine/renderer';
import { useTimelineInteractions } from './hooks/useTimelineInteractions';

export const ConstellationTimeline: React.FC<{ height?: number; query?: string; mode?: SearchMode }>= ({ height = 600, query = '', mode = 'highlight' }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // pan/zoom state
  const transformRef = useRef<Transform>({ offsetX: 0, offsetY: 0, scale: 1 });
  const [hover, setHover] = useState<{ screenX: number; screenY: number; nodeIndex: number | null }>({ screenX: 0, screenY: 0, nodeIndex: null });
  const [tick, setTick] = useState(0); // force redraws
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const layoutRef = useRef<LayoutPoint[]>([]);
  const [focusYear, setFocusYear] = useState<number | null>(null);
  const animRafRef = useRef<number | null>(null);
  const [showConstellations, setShowConstellations] = useState(true);
  const [branchSpacing, setBranchSpacing] = useState(96); // Valor máximo por padrão
  const yearsSorted = React.useMemo(() => uniqueSortedYears(dataset.nodes), []);
  const centerDebounceRef = useRef<number | null>(null);
  const animationTimeRef = useRef<number>(0); // For animated meteorite

  // helper: smooth-center on a given year
  const centerOnYear = (year: number) => {
    const canvasEl = ref.current;
    if (!canvasEl) return;
    if (!yearsSorted.length) return;
    const minYear = yearsSorted[0];
    const maxYear = yearsSorted[yearsSorted.length - 1];
    const yearX = 40 + ((year - minYear) / (maxYear - minYear || 1)) * (canvasEl.clientWidth - 80);
    const targetScreenX = canvasEl.clientWidth / 2;
    const t = transformRef.current;
    const desiredOffsetX = targetScreenX - yearX * t.scale;
    const startOffsetX = t.offsetX;
    const startTime = performance.now();
    const duration = 300;
    if (animRafRef.current) cancelAnimationFrame(animRafRef.current);
    const animate = (ts:number)=>{
      const p = Math.min(1, (ts - startTime)/duration);
      const v = startOffsetX + (desiredOffsetX - startOffsetX) * easeInOutQuad(p);
      // Temporarily set offsetX for animation, but allow clampTransform to handle centering during zoom
      transformRef.current = { ...transformRef.current, offsetX: v };
      setTick(vv=>vv+1);
      if (p < 1) animRafRef.current = requestAnimationFrame(animate);
    };
    animRafRef.current = requestAnimationFrame(animate);
  };

  const nearestYear = (y: number): number => {
    if (!yearsSorted.length) return y;
    let best = yearsSorted[0];
    let bestDiff = Math.abs(y - best);
    for (let i = 1; i < yearsSorted.length; i++) {
      const d = Math.abs(y - yearsSorted[i]);
      if (d < bestDiff) { best = yearsSorted[i]; bestDiff = d; }
    }
    return best;
  };

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

  // Render function
  const renderCanvas = React.useCallback(() => {
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

    // Update animation time for meteorite
    animationTimeRef.current = performance.now();

    // Constellation layout: organic 2D positioning
    const layoutConfig = createLayoutConfig(dataset.nodes, canvas.clientWidth, height, branchSpacing);
    const indexToPosition = computeIndexToOffset(dataset.nodes, layoutConfig); // Returns Map<number, {x, y}>

    // Don't force center on render - only during zoom interactions
    // This allows centerOnYear animation to work smoothly

    renderTimeline({
      ctx,
      canvasWidth: canvas.clientWidth,
      height,
      transform: transformRef.current,
      layoutConfig,
      indexToPosition,
      nodes: dataset.nodes,
      edges: dataset.edges,
      query,
      mode,
      showConstellations,
      selectedIndex,
      layoutPoints: layoutRef.current,
      animationTime: animationTimeRef.current,
    });
  }, [height, query, mode, tick, selectedIndex, showConstellations, branchSpacing]);

  // Initial render and on dependencies change
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Animation loop for meteorite particles
  useEffect(() => {
    let rafId: number;
    const animate = () => {
      animationTimeRef.current = performance.now();
      setTick(t => t + 1); // Trigger re-render
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Resize handler - render immediately for responsive behavior (debounced but responsive)
  useEffect(() => {
    let resizeTimeout: number | null = null;
    const handleResize = () => {
      // Cancel any pending resize
      if (resizeTimeout) window.cancelAnimationFrame(resizeTimeout);
      // Force immediate render on resize
      resizeTimeout = requestAnimationFrame(() => {
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

        // Update animation time
        animationTimeRef.current = performance.now();

        // Recompute layout with new dimensions
        const layoutConfig = createLayoutConfig(dataset.nodes, canvas.clientWidth, height, branchSpacing);
        const indexToPosition = computeIndexToOffset(dataset.nodes, layoutConfig);

        // Re-clamp transform to new bounds (baseline always at 70% = 30% do fundo)
        // Force center horizontally on resize to maintain view
        transformRef.current = clampTransform(
          transformRef.current,
          canvas,
          height,
          dataset.nodes,
          branchSpacing,
          layoutConfig,
          true // Force center on resize
        );

        renderTimeline({
          ctx,
          canvasWidth: canvas.clientWidth,
          height,
          transform: transformRef.current,
          layoutConfig,
          indexToPosition: indexToPosition,
          nodes: dataset.nodes,
          edges: dataset.edges,
          query,
          mode,
          showConstellations,
          selectedIndex,
          layoutPoints: layoutRef.current,
          animationTime: animationTimeRef.current,
        });
        resizeTimeout = null;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) window.cancelAnimationFrame(resizeTimeout);
    };
  }, [height, query, mode, selectedIndex, showConstellations, branchSpacing]);

  // Compute layout config for interactions (needs canvas width, computed in render)
  const [currentLayoutConfig, setCurrentLayoutConfig] = useState<LayoutConfig | null>(null);
  
  // Update layout config when dimensions change
  useEffect(() => {
    if (ref.current) {
      const config = createLayoutConfig(dataset.nodes, ref.current.clientWidth, height, branchSpacing);
      setCurrentLayoutConfig(config);
    }
  }, [height, branchSpacing]);

  useTimelineInteractions({
    canvasRef: ref,
    containerRef,
    transformRef,
    layoutRef,
    nodes: dataset.nodes,
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
    layoutConfig: currentLayoutConfig || createLayoutConfig(dataset.nodes, 800, height, branchSpacing), // Fallback
  });

  return (
    <div
      ref={containerRef}
      className="w-full relative outline-none focus:ring-2 focus:ring-neon/60 focus:rounded-md"
      style={{ cursor: 'default' }}
      tabIndex={0}
      aria-label="Constellation timeline canvas"
    >
      <canvas ref={ref} style={{ width: '100%', height, cursor: 'grab' }} />
      <ControlsBar
        onPrevYear={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))}
        onNextYear={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))}
        showConstellations={showConstellations}
        setShowConstellations={setShowConstellations}
        branchSpacing={branchSpacing}
        setBranchSpacing={setBranchSpacing}
        years={yearsSorted.length ? [yearsSorted[0], yearsSorted[yearsSorted.length-1]] : null}
        focusYear={focusYear ?? (yearsSorted.length ? yearsSorted[0] : null)}
        onYearChange={(val: number) => {
          const y = nearestYear(val);
          setFocusYear(y);
          if (centerDebounceRef.current) window.clearTimeout(centerDebounceRef.current);
          centerDebounceRef.current = window.setTimeout(() => centerOnYear(y), 120);
        }}
      />
      {hover.nodeIndex !== null && (
        <Tooltip node={dataset.nodes[hover.nodeIndex]} x={hover.screenX} y={hover.screenY} />
      )}
      {selectedIndex !== null && (
        <DetailPanel
          node={dataset.nodes[selectedIndex]}
          onClose={() => setSelectedIndex(null)}
          onCenter={() => centerOnYear(yearOf(dataset.nodes[selectedIndex!].date))}
          onOpenSource={() => {
            const src = dataset.nodes[selectedIndex!].sources && dataset.nodes[selectedIndex!].sources![0];
            if (src) window.open(src, '_blank');
          }}
          onCopyLink={async () => {
            const base = window.location.href.split('#')[0];
            const id = dataset.nodes[selectedIndex!].id;
            const link = `${base}#sw-node=${encodeURIComponent(id)}`;
            try { await navigator.clipboard.writeText(link); } catch {}
          }}
        />
      )}
    </div>
  );
};
