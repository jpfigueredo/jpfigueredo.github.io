import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
function createStar(width, height) {
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
export const Starfield = ({ density = 250, className, showConstellations = true }) => {
    const canvasRef = useRef(null);
    const starsRef = useRef([]);
    const rafRef = useRef(null);
    // Helper to calculate screen position
    const getScreenPos = (star, w, h) => {
        return {
            x: (star.x / star.z) * w + w / 2,
            y: (star.y / star.z) * h + h / 2,
            depth: star.z
        };
    };
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx)
            return;
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
        const draw = (t) => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            ctx.clearRect(0, 0, w, h);
            ctx.strokeStyle = 'rgba(0,240,255,0.18)';
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
                const maxDist = Math.min(w, h) * 0.15; // 15% of screen
                for (let i = 0; i < screenStars.length; i++) {
                    for (let j = i + 1; j < screenStars.length; j++) {
                        const dx = screenStars[i].x - screenStars[j].x;
                        const dy = screenStars[i].y - screenStars[j].y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        // Only connect if stars are close and at similar depth
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
            // Draw stars with trails
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
                ctx.fillStyle = grad;
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
            if (rafRef.current)
                cancelAnimationFrame(rafRef.current);
            window.removeEventListener('resize', resize);
        };
    }, [density, showConstellations]);
    return (_jsx("canvas", { ref: canvasRef, className: `pointer-events-none fixed inset-0 z-0 opacity-70 ${className ?? ''}`, style: {
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 0
        }, "aria-hidden": "true" }));
};
