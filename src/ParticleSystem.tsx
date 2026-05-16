import { useEffect, useRef, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  isGold: boolean;
}

const LANE_COLORS = ['#ff2d55', '#ffd60a', '#0a84ff', '#30d158'];

// Hit zone positions (matching the 4 circular buttons at bottom)
const getLaneX = (lane: number, width: number): number => {
  const center = width / 2;
  const gap = 100; // matches gap-8 = ~100px with circle sizes
  return center + (lane - 1.5) * gap;
};

const HIT_Y_RATIO = 0.92; // 92% from top = near bottom where hit zones are

export function useParticleSystem() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number>(0);

  const spawnParticles = useCallback((lane: number, quality: 'perfect' | 'great' | 'good') => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const x = getLaneX(lane, canvas.width);
    const y = canvas.height * HIT_Y_RATIO;
    const color = LANE_COLORS[lane];

    const count = quality === 'perfect' ? 18 : quality === 'great' ? 10 : 5;
    const newParticles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      // Radial burst
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 2 + Math.random() * 4;
      newParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3, // bias upward
        life: 1,
        maxLife: 0.6 + Math.random() * 0.4,
        color: quality === 'perfect' && i % 3 === 0 ? '#ffd60a' : color,
        size: quality === 'perfect' ? 4 + Math.random() * 3 : 2 + Math.random() * 3,
        isGold: quality === 'perfect' && i % 3 === 0,
      });
    }

    // Upward streaks for perfect
    if (quality === 'perfect') {
      for (let i = 0; i < 6; i++) {
        newParticles.push({
          x: x + (Math.random() - 0.5) * 40,
          y,
          vx: (Math.random() - 0.5) * 1,
          vy: -6 - Math.random() * 6,
          life: 1,
          maxLife: 0.8 + Math.random() * 0.3,
          color: '#ffd60a',
          size: 2 + Math.random() * 2,
          isGold: true,
        });
      }
    }

    particlesRef.current.push(...newParticles);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.life -= 0.02;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;

        // Glow
        ctx.shadowBlur = p.isGold ? 20 : 12;
        ctx.shadowColor = p.color;

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();

        // Inner bright core
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return { canvasRef, spawnParticles };
}
