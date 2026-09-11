// src/components/common/CursorTrail.tsx
import React, { useEffect, useRef } from 'react';

export function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Target mouse position
    let targetX = -100;
    let targetY = -100;
    let hasMoved = false;

    // Fluid trailing points for the small blue area
    const TRAIL_COUNT = 6;
    const trail = Array.from({ length: TRAIL_COUNT }, () => ({
      x: -100,
      y: -100,
      radius: 18,
    }));

    const handleMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!hasMoved) {
        hasMoved = true;
        for (const p of trail) {
          p.x = targetX;
          p.y = targetY;
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (hasMoved) {
        // Smoothly interpolate each point toward the previous point (spring-damping chain)
        let prevX = targetX;
        let prevY = targetY;

        for (let i = 0; i < TRAIL_COUNT; i++) {
          const p = trail[i];
          // Easing factors: head moves fast, tail lags gently
          const speed = 0.38 - i * 0.045;
          p.x += (prevX - p.x) * speed;
          p.y += (prevY - p.y) * speed;

          prevX = p.x;
          prevY = p.y;
        }

        // Draw small oceanic blue trailing area circles (from tail to head for proper blending)
        for (let i = TRAIL_COUNT - 1; i >= 0; i--) {
          const p = trail[i];
          const factor = 1 - i / TRAIL_COUNT;
          const radius = Math.max(3, 16 * factor);
          const alpha = 0.45 * factor;

          ctx.save();
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
          grad.addColorStop(0, `rgba(0, 168, 255, ${alpha * 0.9})`);
          grad.addColorStop(0.45, `rgba(2, 132, 199, ${alpha * 0.6})`);
          grad.addColorStop(1, 'rgba(2, 132, 199, 0)');

          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.restore();
        }

        // Leading crisp accent core
        const lead = trail[0];
        ctx.save();
        const coreGrad = ctx.createRadialGradient(lead.x, lead.y, 0, lead.x, lead.y, 7);
        coreGrad.addColorStop(0, 'rgba(56, 189, 248, 0.7)');
        coreGrad.addColorStop(0.6, 'rgba(0, 168, 255, 0.3)');
        coreGrad.addColorStop(1, 'rgba(0, 168, 255, 0)');

        ctx.beginPath();
        ctx.arc(lead.x, lead.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 99999,
      }}
    />
  );
}
