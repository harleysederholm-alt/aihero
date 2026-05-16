# OPUS 4.6 — ROCKDEV-PRIME Visual Upgrade Command

## STEP 0: READ EVERYTHING FIRST (mandatory)
```
cat src/App.tsx
cat src/App.css  
cat src/index.css
cat src/main.tsx
```
Do NOT write a single line of code until you have read all files above completely.
Report back: current game state machine, how notes render, how audio timing works.

---

## STEP 1: CONCERT BACKGROUND (Canvas procedural)
Add a `<canvas id="bg-canvas">` behind the highway.
Draw procedurally:
- Dark gradient base (#0a0a1a → #1a0a2e)
- 6 spotlight cones sweeping slowly (conic-gradient via canvas arc)
- Crowd silhouette at bottom (noise-based bumps, rgba(20,10,40,1))
- Subtle purple/pink god-rays from top center
NO external image files. Pure canvas drawing. 60fps via requestAnimationFrame.

---

## STEP 2: LANE HIGHWAY (CSS 3D Perspective)
Current highway → upgrade to:
```css
.highway-container {
  perspective: 600px;
  perspective-origin: 50% 20%;
}
.highway {
  transform: rotateX(55deg);
  transform-origin: 50% 100%;
}
```
Lane colors (CSS vars, add to :root):
--lane-0: #ff2d55;   /* red */
--lane-1: #ffd60a;   /* yellow */
--lane-2: #0a84ff;   /* blue */
--lane-3: #30d158;   /* green */

Lane glow lines: box-shadow inset + ::before pseudo with lane color blur.

---

## STEP 3: NOTE GEMS
Replace current note elements with:
```css
.note-gem {
  border-radius: 10px 10px 6px 6px;
  background: linear-gradient(180deg, 
    rgba(255,255,255,0.5) 0%,
    var(--lane-color) 40%,
    color-mix(in srgb, var(--lane-color) 70%, black) 100%
  );
  box-shadow:
    0 0 12px var(--lane-color),
    0 0 30px var(--lane-color),
    0 0 60px color-mix(in srgb, var(--lane-color) 40%, transparent),
    inset 0 2px 4px rgba(255,255,255,0.4);
  animation: gem-breathe 0.8s ease-in-out infinite alternate;
}
@keyframes gem-breathe {
  from { filter: brightness(1); }
  to   { filter: brightness(1.3); }
}
```

---

## STEP 4: HIT ZONES (bottom fret buttons)
Replace current buttons with glowing rings:
```css
.hit-zone {
  width: 72px; height: 72px;
  border-radius: 50%;
  border: 3px solid var(--lane-color);
  background: radial-gradient(circle at 50% 30%,
    rgba(255,255,255,0.15),
    rgba(0,0,0,0.6)
  );
  box-shadow:
    0 0 20px var(--lane-color),
    0 0 40px color-mix(in srgb, var(--lane-color) 50%, transparent),
    inset 0 0 20px rgba(0,0,0,0.8);
  transition: all 0.05s ease;
}
.hit-zone.pressed {
  background: radial-gradient(circle, var(--lane-color) 0%, transparent 70%);
  box-shadow:
    0 0 40px var(--lane-color),
    0 0 80px var(--lane-color),
    inset 0 0 30px var(--lane-color);
  transform: scale(1.12);
}
```

---

## STEP 5: PARTICLE SYSTEM
Add lightweight canvas particle system (separate from bg-canvas):
```typescript
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
}

function spawnHitParticles(laneX: number, hitY: number, color: string, quality: string) {
  const count = quality === 'PERFECT' ? 18 : quality === 'GREAT' ? 10 : 5;
  // Radial burst + upward streaks
  // Gold accent particles on PERFECT
}
```
Run particle update in the main game loop. Clear and redraw each frame.

---

## STEP 6: HUD PANELS
Score/Combo/Accuracy panels:
```css
.hud-panel {
  background: linear-gradient(135deg,
    rgba(0,0,20,0.9),
    rgba(10,0,30,0.85)
  );
  border: 1px solid rgba(255,45,85,0.35);
  border-radius: 12px;
  backdrop-filter: blur(16px);
  box-shadow:
    0 0 30px rgba(255,45,85,0.15),
    inset 0 1px 0 rgba(255,255,255,0.08);
}

.score-number {
  font-family: 'Orbitron', 'Courier New', monospace;
  color: #ff2d55;
  text-shadow: 0 0 20px #ff2d55, 0 0 40px rgba(255,45,85,0.5);
  font-variant-numeric: tabular-nums;
}
```
Add to index.html: `<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap" rel="stylesheet">`

---

## STEP 7: HIT FEEDBACK TEXT
```css
.hit-feedback {
  font-family: 'Orbitron', monospace;
  font-size: 2.5rem;
  font-weight: 900;
  position: absolute;
  bottom: 25%;
  left: 50%;
  transform: translateX(-50%);
  animation: feedback-pop 0.6s ease-out forwards;
  pointer-events: none;
}
@keyframes feedback-pop {
  0%   { transform: translateX(-50%) scale(0.5); opacity: 1; }
  60%  { transform: translateX(-50%) scale(1.15); opacity: 1; }
  100% { transform: translateX(-50%) scale(1) translateY(-60px); opacity: 0; }
}
.hit-feedback.PERFECT { color: #ffd60a; text-shadow: 0 0 30px #ffd60a; }
.hit-feedback.GREAT   { color: #30d158; text-shadow: 0 0 20px #30d158; }
.hit-feedback.GOOD    { color: #0a84ff; text-shadow: 0 0 15px #0a84ff; }
.hit-feedback.MISS    { color: #ff3b30; text-shadow: 0 0 15px #ff3b30; }
```

---

## STEP 8: SCREEN SHAKE ON MISS
```typescript
function triggerScreenShake(intensity: number = 8, duration: number = 300) {
  const highway = document.querySelector('.highway-container') as HTMLElement;
  if (!highway) return;
  const start = performance.now();
  function shake(now: number) {
    const elapsed = now - start;
    if (elapsed > duration) { highway.style.transform = ''; return; }
    const decay = 1 - elapsed / duration;
    const x = (Math.random() - 0.5) * intensity * decay;
    const y = (Math.random() - 0.5) * intensity * decay;
    highway.style.transform = `translate(${x}px, ${y}px)`;
    requestAnimationFrame(shake);
  }
  requestAnimationFrame(shake);
}
```

---

## IMPLEMENTATION ORDER
1. Read all files → report current architecture
2. Add Orbitron font to index.html
3. Add CSS vars to :root in index.css
4. Implement concert background canvas (non-breaking, purely additive)
5. Upgrade highway CSS (test: notes still appear and scroll correctly)
6. Upgrade note gem styles
7. Upgrade hit zones
8. Add particle canvas
9. Upgrade HUD panels
10. Add hit feedback text component
11. Add screen shake
12. Test full game loop: audio → notes → hit → score → miss

## SUCCESS CRITERIA
- [ ] 60fps in Chrome DevTools (no frame drops)
- [ ] Notes visible and hitting correctly at all speeds
- [ ] Particles fire on every hit
- [ ] Screen shakes on miss
- [ ] HUD readable and beautiful
- [ ] Matches reference image aesthetic >85%
- [ ] No console errors
