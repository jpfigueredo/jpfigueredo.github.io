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
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { alpha: true })!;

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

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeStyle = 'rgba(0,240,255,0.25)';

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

        // draw star point
        const r = Math.max(0.5, star.size * (1.5 - star.z / Math.max(w, h)));
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();

        // draw subtle trail
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      className={
        `pointer-events-none fixed inset-0 -z-10 opacity-60 ${className ?? ''}`
      }
      aria-hidden="true"
    />
  );
};
