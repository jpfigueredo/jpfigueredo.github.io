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
import { TimelineThreeRenderer } from './engine/three-renderer';
import { renderTimelineThree, clearTimelineCache } from './engine/render-three';
import { useTimelineInteractions } from './hooks/useTimelineInteractions';

export const ConstellationTimeline: React.FC<{ height?: number; query?: string; mode?: SearchMode }>= ({ height = 600, query = '', mode = 'highlight' }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const threeRendererRef = useRef<TimelineThreeRenderer | null>(null);
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
  
  // On-demand rendering: only animate when needed
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeoutRef = useRef<number | null>(null);

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

  // Initialize Three.js renderer
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    
    if (!threeRendererRef.current) {
      threeRendererRef.current = new TimelineThreeRenderer(canvas, canvas.clientWidth, height);
      
      // Load NASA background asynchronously (composited over procedural)
      setTimeout(() => {
        if (threeRendererRef.current) {
          threeRendererRef.current.loadNASABackground(canvas.clientWidth, height).catch((err: unknown) => {
            console.warn('NASA background load failed, using procedural texture:', err);
          });
        }
      }, 500);
    }
    
    return () => {
      if (threeRendererRef.current) {
        threeRendererRef.current.dispose();
        threeRendererRef.current = null;
        clearTimelineCache(); // Clear object cache on unmount
      }
    };
  }, [height]);

  // Render function (Three.js) - on-demand rendering
  const renderCanvas = React.useCallback(() => {
    const canvas = ref.current;
    const threeRenderer = threeRendererRef.current;
    if (!canvas || !threeRenderer) return;

    // Update animation time only if animating
    if (isAnimating) {
      animationTimeRef.current = performance.now();
    }

    // Constellation layout: organic 2D positioning
    const layoutConfig = createLayoutConfig(dataset.nodes, canvas.clientWidth, height, branchSpacing);
    const indexToPosition = computeIndexToOffset(dataset.nodes, layoutConfig);

    // Update layout points for hit testing
    layoutRef.current = [];
    dataset.nodes.forEach((node, i) => {
      const pos = indexToPosition.get(i);
      if (pos) {
        layoutRef.current.push({ x: pos.x, y: pos.y, index: i });
      }
    });

    // Render with Three.js
    renderTimelineThree({
      renderer: threeRenderer,
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
      animationTime: animationTimeRef.current,
    });
  }, [height, query, mode, tick, selectedIndex, showConstellations, branchSpacing, isAnimating]);

  // On-demand rendering: only render when needed (not continuously)
  // This prevents constant rendering and improves performance
  const needsRenderRef = useRef(true);
  
  // Trigger render when dependencies change
  useEffect(() => {
    needsRenderRef.current = true;
    // Use requestAnimationFrame for next frame (non-blocking)
    const rafId = requestAnimationFrame(() => {
      if (needsRenderRef.current) {
        renderCanvas();
        needsRenderRef.current = false;
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [renderCanvas]);

  // Animation for comet particles - only when animating flag is true
  useEffect(() => {
    if (!isAnimating) return;
    
    let rafId: number;
    let lastFrameTime = 0;
    const targetFPS = 30; // Reduced from 60 for better performance
    const frameInterval = 1000 / targetFPS;
    
    const animate = (currentTime: number) => {
      if (!isAnimating) {
        cancelAnimationFrame(rafId);
        return;
      }
      
      // Throttle to target FPS
      if (currentTime - lastFrameTime >= frameInterval) {
        animationTimeRef.current = currentTime;
        needsRenderRef.current = true; // Mark as needing render
        renderCanvas(); // Render directly
        lastFrameTime = currentTime;
      }
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isAnimating, renderCanvas]);
  
  // Auto-start/stop animation based on interactions
  // Animation starts on any change and stops after 1.5 seconds of inactivity
  useEffect(() => {
    setIsAnimating(true); // Start animation when component mounts or state changes
    
    // Stop animation after 1.5 seconds of inactivity
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    animationTimeoutRef.current = window.setTimeout(() => {
      setIsAnimating(false);
    }, 1500); // Reduced from 2000ms for faster stop
    
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [tick, selectedIndex, query, mode, showConstellations, branchSpacing]);

  // Resize handler - render immediately for responsive behavior
  useEffect(() => {
    let resizeTimeout: number | null = null;
    const handleResize = () => {
      if (resizeTimeout) window.cancelAnimationFrame(resizeTimeout);
      resizeTimeout = requestAnimationFrame(() => {
        const canvas = ref.current;
        const threeRenderer = threeRendererRef.current;
        if (!canvas || !threeRenderer) return;

        // Resize Three.js renderer
        threeRenderer.resize(canvas.clientWidth, height);

        // Re-clamp transform to new bounds
        const layoutConfig = createLayoutConfig(dataset.nodes, canvas.clientWidth, height, branchSpacing);
        transformRef.current = clampTransform(
          transformRef.current,
          canvas,
          height,
          dataset.nodes,
          branchSpacing,
          layoutConfig,
          true // Force center on resize
        );

        // Trigger re-render
        setTick(t => t + 1);
        resizeTimeout = null;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) window.cancelAnimationFrame(resizeTimeout);
    };
  }, [height, branchSpacing]);

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
    layoutConfig: currentLayoutConfig || createLayoutConfig(dataset.nodes, 800, height, branchSpacing),
    threeRendererRef,
  });

  return (
    <div
      ref={containerRef}
      className="w-full relative outline-none focus:ring-2 focus:ring-neon/60 focus:rounded-md"
      style={{ cursor: 'default' }}
      tabIndex={0}
      aria-label="Constellation timeline canvas"
    >
      <canvas 
        ref={ref} 
        style={{ width: '100%', height, cursor: 'grab', pointerEvents: 'auto', position: 'relative', zIndex: 1 }}
        tabIndex={-1}
      />
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
