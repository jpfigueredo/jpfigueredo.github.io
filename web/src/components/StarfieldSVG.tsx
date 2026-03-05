import React, { useEffect, useRef } from 'react';

type Star = {
  x: number;
  y: number;
  z: number;
  pz: number;
  speed: number;
  size: number;
  type: 'white' | 'yellow' | 'blue';
  rotation: number;
  twinklePhase: number;
};

// Star color palettes (realistic star colors)
const STAR_COLORS = {
  white: {
    core: '#ffffff',
    inner: '#e0f2fe',
    middle: '#bfdbfe',
    outer: '#93c5fd',
  },
  yellow: {
    core: '#fef08a',
    inner: '#fde047',
    middle: '#facc15',
    outer: '#fbbf24',
  },
  blue: {
    core: '#bfdbfe',
    inner: '#93c5fd',
    middle: '#60a5fa',
    outer: '#3b82f6',
  },
};

function createStar(width: number, height: number): Star {
  const maxDepth = Math.max(width, height);
  const types: Array<'white' | 'yellow' | 'blue'> = ['white', 'yellow', 'blue'];
  return {
    x: (Math.random() - 0.5) * width * 2,
    y: (Math.random() - 0.5) * height * 2,
    z: Math.random() * maxDepth,
    pz: 0,
    speed: 0.3 + Math.random() * 1.2,
    size: 0.8 + Math.random() * 1.8,
    type: types[Math.floor(Math.random() * types.length)],
    rotation: Math.random() * 360,
    twinklePhase: Math.random() * Math.PI * 2,
  };
}

// Draw realistic star with spikes and glow (SVG-like quality on canvas)
function drawRealisticStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  type: 'white' | 'yellow' | 'blue',
  rotation: number,
  twinkle: number,
  depth: number
) {
  const colors = STAR_COLORS[type];
  const baseSize = size * (0.8 + depth * 0.6);
  const opacity = Math.min(1, (0.7 + depth * 0.3) * twinkle);
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);
  
  // Outer glow (largest, most transparent)
  const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, baseSize * 3);
  glowGradient.addColorStop(0, `rgba(${hexToRgb(colors.core)}, ${opacity * 0.3})`);
  glowGradient.addColorStop(0.3, `rgba(${hexToRgb(colors.inner)}, ${opacity * 0.2})`);
  glowGradient.addColorStop(0.6, `rgba(${hexToRgb(colors.middle)}, ${opacity * 0.1})`);
  glowGradient.addColorStop(1, `rgba(${hexToRgb(colors.outer)}, 0)`);
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.arc(0, 0, baseSize * 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Main star spikes (8-pointed star)
  const spikeLength = baseSize * 1.8;
  const spikeWidth = baseSize * 0.15;
  
  // 4 main spikes (cardinal directions)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    drawSpike(ctx, 0, 0, angle, spikeLength, spikeWidth, colors.core, opacity * 0.95);
  }
  
  // 4 diagonal spikes
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    drawSpike(ctx, 0, 0, angle, spikeLength * 0.85, spikeWidth * 0.8, colors.inner, opacity * 0.85);
  }
  
  // Bright core
  const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, baseSize * 0.5);
  coreGradient.addColorStop(0, `rgba(${hexToRgb(colors.core)}, ${opacity})`);
  coreGradient.addColorStop(0.5, `rgba(${hexToRgb(colors.inner)}, ${opacity * 0.8})`);
  coreGradient.addColorStop(1, `rgba(${hexToRgb(colors.middle)}, ${opacity * 0.4})`);
  ctx.fillStyle = coreGradient;
  ctx.beginPath();
  ctx.arc(0, 0, baseSize * 0.5, 0, Math.PI * 2);
  ctx.fill();
  
  // Tiny bright center dot
  ctx.fillStyle = `rgba(${hexToRgb(colors.core)}, ${opacity})`;
  ctx.beginPath();
  ctx.arc(0, 0, baseSize * 0.15, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

// Helper to draw a single spike
function drawSpike(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  color: string,
  opacity: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  
  const gradient = ctx.createLinearGradient(0, -length, 0, 0);
  gradient.addColorStop(0, `rgba(${hexToRgb(color)}, ${opacity * 0.6})`);
  gradient.addColorStop(0.5, `rgba(${hexToRgb(color)}, ${opacity * 0.9})`);
  gradient.addColorStop(1, `rgba(${hexToRgb(color)}, ${opacity})`);
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, -length);
  ctx.lineTo(-width / 2, 0);
  ctx.lineTo(0, length * 0.1);
  ctx.lineTo(width / 2, 0);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

// Convert hex to RGB string
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '255, 255, 255';
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `${r}, ${g}, ${b}`;
}

export const StarfieldSVG: React.FC<{ 
  density?: number; 
  className?: string; 
  showConstellations?: boolean;
}> = ({ 
  density = 250, 
  className,
  showConstellations = true 
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const starsRef = useRef<Star[]>([]);
  const rafRef = useRef<number | null>(null);
  
  // Helper to calculate screen position
  const getScreenPos = (star: Star, w: number, h: number) => {
    return {
      x: (star.x / star.z) * w + w / 2,
      y: (star.y / star.z) * h + h / 2,
      depth: star.z
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Recreate stars on resize
      const count = Math.floor((window.innerWidth * window.innerHeight) / (1600 * 900) * density) || density / 2;
      starsRef.current = Array.from({ length: Math.max(120, count) }, () => createStar(window.innerWidth, window.innerHeight));
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = (t: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      // Draw constellations first (behind stars)
      if (showConstellations) {
        ctx.strokeStyle = 'rgba(0,240,255,0.08)';
        ctx.lineWidth = 0.5;
        
        const screenStars = starsRef.current
          .map(star => ({
            ...getScreenPos(star, w, h),
            star
          }))
          .filter(pos => pos.x >= 0 && pos.x <= w && pos.y >= 0 && pos.y <= h);
        
        // Connect nearby stars (constellation effect)
        const maxDist = Math.min(w, h) * 0.15;
        for (let i = 0; i < screenStars.length; i++) {
          for (let j = i + 1; j < screenStars.length; j++) {
            const dx = screenStars[i].x - screenStars[j].x;
            const dy = screenStars[i].y - screenStars[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            const depthDiff = Math.abs(screenStars[i].depth - screenStars[j].depth);
            if (dist < maxDist && depthDiff < Math.max(w, h) * 0.3) {
              const alpha = 0.08 * (1 - dist / maxDist) * (1 - depthDiff / (Math.max(w, h) * 0.3));
              ctx.globalAlpha = alpha;
              ctx.beginPath();
              ctx.moveTo(screenStars[i].x, screenStars[i].y);
              ctx.lineTo(screenStars[j].x, screenStars[j].y);
              ctx.stroke();
            }
          }
        }
        ctx.globalAlpha = 1;
      }

      // Draw realistic stars with SVG-like quality
      for (const star of starsRef.current) {
        star.z -= star.speed;
        if (star.z <= 1) {
          Object.assign(star, createStar(w, h));
          star.z = Math.max(w, h);
          star.pz = star.z;
        }

        const sx = (star.x / star.z) * w + w / 2;
        const sy = (star.y / star.z) * h + h / 2;

        // Only draw if on screen (with margin for smooth transitions)
        if (sx < -100 || sx > w + 100 || sy < -100 || sy > h + 100) {
          continue;
        }

        // Calculate depth and twinkle
        const depth = 1 - star.z / Math.max(w, h);
        const twinkle = 0.75 + 0.25 * Math.sin((t * 0.002) + star.twinklePhase);
        
        // Slow rotation for dynamic effect
        star.rotation += 0.1 * (1 - depth);

        // Draw realistic star
        drawRealisticStar(ctx, sx, sy, star.size, star.type, star.rotation, twinkle, depth);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame((ts) => draw(ts));

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [density, showConstellations]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none fixed inset-0 z-0 ${className ?? ''}`}
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0
      }}
      aria-hidden="true"
    />
  );
};
