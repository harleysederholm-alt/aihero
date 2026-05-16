import { useEffect, useRef } from 'react';

// Procedural concert background — DRAMATIC version
export default function ConcertBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      time += 0.01;

      // 1. Deep dark gradient base
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#050510');
      grad.addColorStop(0.3, '#0a0520');
      grad.addColorStop(0.7, '#150a30');
      grad.addColorStop(1, '#1a0a2e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // 2. Intense god-rays from top center
      ctx.save();
      ctx.globalAlpha = 0.12 + Math.sin(time * 0.4) * 0.04;
      const rayGrad = ctx.createRadialGradient(W / 2, -50, 0, W / 2, -50, H * 0.9);
      rayGrad.addColorStop(0, 'rgba(200, 50, 255, 0.5)');
      rayGrad.addColorStop(0.3, 'rgba(255, 45, 85, 0.2)');
      rayGrad.addColorStop(0.6, 'rgba(100, 0, 200, 0.1)');
      rayGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = rayGrad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      // 3. 6 sweeping spotlight cones — BRIGHTER
      for (let i = 0; i < 6; i++) {
        ctx.save();
        const speed = 0.4 + i * 0.12;
        const angle = Math.sin(time * speed + i * 1.2) * 0.5;
        const cx = W * (0.1 + i * 0.16);
        
        ctx.translate(cx, 0);
        ctx.rotate(angle);
        ctx.globalAlpha = 0.08 + Math.sin(time * 1.5 + i * 0.8) * 0.03;

        const spotGrad = ctx.createLinearGradient(0, 0, 0, H * 0.85);
        const hues = [320, 280, 200, 300, 180, 340];
        spotGrad.addColorStop(0, `hsla(${hues[i]}, 90%, 65%, 0.5)`);
        spotGrad.addColorStop(0.5, `hsla(${hues[i]}, 70%, 50%, 0.15)`);
        spotGrad.addColorStop(1, 'transparent');

        ctx.fillStyle = spotGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-120, H * 0.85);
        ctx.lineTo(120, H * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 4. Stage glow at bottom-center
      ctx.save();
      const stageGlow = ctx.createRadialGradient(W / 2, H * 0.75, 0, W / 2, H * 0.75, W * 0.5);
      stageGlow.addColorStop(0, 'rgba(255, 45, 85, 0.12)');
      stageGlow.addColorStop(0.5, 'rgba(150, 0, 255, 0.06)');
      stageGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = stageGlow;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      // 5. Crowd silhouette — higher and more detailed
      ctx.save();
      const crowdY = H * 0.82;
      
      // Crowd uplighting
      const crowdGlow = ctx.createLinearGradient(0, crowdY - 60, 0, crowdY + 5);
      crowdGlow.addColorStop(0, 'rgba(255, 45, 85, 0.15)');
      crowdGlow.addColorStop(0.5, 'rgba(150, 0, 255, 0.08)');
      crowdGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = crowdGlow;
      ctx.fillRect(0, crowdY - 60, W, 65);

      // Crowd body
      ctx.fillStyle = 'rgba(5, 2, 12, 1)';
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 6) {
        const bump = Math.sin(x * 0.04 + time * 0.4) * 10
          + Math.sin(x * 0.1 + time * 0.8) * 6
          + Math.sin(x * 0.025) * 15
          + Math.cos(x * 0.07 + time * 1.2) * 4
          + Math.sin(x * 0.15 + time * 2) * 2; // subtle head bobbing
        ctx.lineTo(x, crowdY + bump);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
      
      // Raised hands scattered
      for (let i = 0; i < 12; i++) {
        const hx = W * (0.1 + (i / 12) * 0.8) + Math.sin(time * 0.5 + i * 3) * 20;
        const handBob = Math.sin(time * 2 + i * 1.5) * 8;
        ctx.fillStyle = 'rgba(5, 2, 12, 1)';
        ctx.fillRect(hx - 2, crowdY - 25 + handBob, 4, 20);
        ctx.beginPath();
        ctx.arc(hx, crowdY - 28 + handBob, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 6. Floating embers/particles — more visible
      ctx.save();
      for (let i = 0; i < 50; i++) {
        const px = (Math.sin(time * 0.15 + i * 7.3) * 0.5 + 0.5) * W;
        const py = (Math.cos(time * 0.12 + i * 4.1) * 0.5 + 0.5) * H * 0.75;
        const size = 1.5 + Math.sin(time + i) * 0.8;
        ctx.globalAlpha = 0.25 + Math.sin(time * 2 + i) * 0.15;
        ctx.fillStyle = i % 4 === 0 ? '#ff2d55' : i % 4 === 1 ? '#b44dff' : i % 4 === 2 ? '#05d9e8' : '#ffd60a';
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} id="bg-canvas" />;
}
