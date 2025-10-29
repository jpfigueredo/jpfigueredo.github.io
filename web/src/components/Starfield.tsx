import React, { useEffect, useRef } from 'react';

type Star = {
  x: number;
  y: number;
  z: number;
  pz: number;
  speed: number;
  size: number;
};

function createStar(width: number, height: number): Star {
  const maxDepth = Math.max(width, height);
  return {
    x: (Math.random() - 0.5) * width * 2,
    y: (Math.random() - 0.5) * height * 2,
    z: Math.random() * maxDepth,
    pz: 0,
    speed: 0.5 + Math.random() * 1.5,
    size: 0.5 + Math.random() * 1.5,
  };
}

export const Starfield: React.FC<{ density?: number; className?: string }>= ({ density = 250, className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const starsRef = useRef<Star[]>([]);
  const rafRef = useRef<number | null>(null);

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

      // Recreate stars on resize to fit new bounds
      const count = Math.floor((window.innerWidth * window.innerHeight) / (1600 * 900) * density) || density / 2;
      starsRef.current = Array.from({ length: Math.max(120, count) }, () => createStar(window.innerWidth, window.innerHeight));
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = (t: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(0,240,255,0.18)';

      for (const star of starsRef.current) {
        star.z -= star.speed;
        if (star.z <= 1) {
          // reset star to background
          Object.assign(star, createStar(w, h));
          star.z = Math.max(w, h);
          star.pz = star.z;
        }

        const sx = (star.x / star.z) * w + w / 2;
        const sy = (star.y / star.z) * h + h / 2;

        const px = (star.x / star.pz) * w + w / 2;
        const py = (star.y / star.pz) * h + h / 2;

        star.pz = star.z;

        // brightness and size scale
        const depth = 1 - star.z / Math.max(w, h);
        const r = Math.max(0.4, star.size * (1.2 + depth));

        // twinkle factor (subtle)
        const twinkle = 0.75 + 0.25 * Math.sin((t * 0.003) + (star.x + star.y) * 0.001);

        // radial glow
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 4);
        grad.addColorStop(0, `rgba(255,255,255,${0.75 * twinkle})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad as CanvasGradient;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 4, 0, Math.PI * 2);
        ctx.fill();

        // core
        ctx.fillStyle = `rgba(255,255,255,${0.9 * twinkle})`;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();

        // subtle trail
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        // star flare (cross)
        ctx.save();
        ctx.globalAlpha = 0.35 * twinkle;
        ctx.translate(sx, sy);
        const flare = r * 4;
        ctx.beginPath();
        ctx.moveTo(-flare, 0);
        ctx.lineTo(flare, 0);
        ctx.moveTo(0, -flare);
        ctx.lineTo(0, flare);
        ctx.stroke();
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame((ts) => draw(ts));

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none fixed inset-0 z-0 opacity-70 ${className ?? ''}`}
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
