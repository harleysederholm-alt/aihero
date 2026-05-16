import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Box, Plane, Sparkles, RoundedBox } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { Activity, Disc, MonitorPlay, Music } from 'lucide-react';
import ConcertBackground from '../ConcertBackground';
import { useParticleSystem } from '../ParticleSystem';
import { useGameStore, usePersistedStore } from '../store';
import type { Note, HitResult, SavedSong } from '../store';
import { upsertSong, getSong, hashString, updateHighScore } from '../lib/songStorage';
import { loadMidiChart } from '../lib/midiLoader';

// ==================== CHART GENERATION ====================
const generateChart = (duration: number = 300): Note[] => {
  const notes: Note[] = [];
  let id = 1;
  const add = (t: number, l: number) => {
    if (t < duration - 1) notes.push({ id: `n${id++}`, time: t, lane: l });
  };
  let offset = 0;
  while (offset < duration) {
    for (let i = 0; i < 8; i++) add(offset + 1.0 + i * 0.5, 0);
    add(offset + 5.0, 0); add(offset + 5.25, 1); add(offset + 5.5, 0); add(offset + 5.75, 1);
    add(offset + 6.0, 2); add(offset + 6.25, 0); add(offset + 6.5, 2); add(offset + 6.75, 3);
    add(offset + 7.0, 0); add(offset + 7.15, 1); add(offset + 7.3, 2); add(offset + 7.45, 3);
    add(offset + 7.6, 0); add(offset + 7.75, 1); add(offset + 7.9, 2); add(offset + 8.05, 3);
    add(offset + 8.5, 0); add(offset + 8.8, 0); add(offset + 9.1, 1); add(offset + 9.4, 0);
    add(offset + 9.7, 2); add(offset + 10.0, 0); add(offset + 10.3, 1); add(offset + 10.5, 3);
    add(offset + 10.8, 0); add(offset + 11.0, 0); add(offset + 11.2, 2); add(offset + 11.5, 1);
    add(offset + 11.8, 0); add(offset + 12.0, 3); add(offset + 12.3, 0); add(offset + 12.5, 2);
    add(offset + 12.8, 1); add(offset + 13.0, 0); add(offset + 13.2, 0); add(offset + 13.5, 1);
    add(offset + 13.7, 3); add(offset + 14.0, 0);
    add(offset + 14.5, 0); add(offset + 14.5, 1);
    add(offset + 15.0, 2); add(offset + 15.0, 3);
    add(offset + 15.5, 0); add(offset + 15.5, 1);
    add(offset + 16.0, 0); add(offset + 16.25, 1); add(offset + 16.5, 2); add(offset + 16.75, 3);
    add(offset + 17.0, 3); add(offset + 17.0, 2);
    add(offset + 17.5, 0); add(offset + 17.5, 1);
    add(offset + 18.0, 0); add(offset + 18.15, 1); add(offset + 18.3, 2); add(offset + 18.45, 3);
    for (let i = 0; i < 12; i++) add(offset + 18.5 + i * 0.25, i % 4);
    add(offset + 21.5, 0); add(offset + 21.7, 1); add(offset + 21.9, 2); add(offset + 22.1, 3);
    add(offset + 22.3, 0); add(offset + 22.5, 0); add(offset + 22.7, 1); add(offset + 22.9, 3);
    add(offset + 23.1, 2); add(offset + 23.3, 0); add(offset + 23.5, 1); add(offset + 23.7, 0);
    add(offset + 24.0, 0); add(offset + 24.0, 1); add(offset + 24.0, 2); add(offset + 24.0, 3);
    add(offset + 24.5, 0); add(offset + 25.0, 0); add(offset + 25.3, 0); add(offset + 25.5, 0);
    add(offset + 25.8, 1); add(offset + 26.0, 0); add(offset + 26.2, 2); add(offset + 26.5, 0);
    add(offset + 26.7, 3); add(offset + 27.0, 0); add(offset + 27.2, 1); add(offset + 27.5, 0);
    add(offset + 27.8, 0); add(offset + 27.9, 1); add(offset + 28.0, 2); add(offset + 28.1, 3);
    add(offset + 28.2, 3); add(offset + 28.3, 2); add(offset + 28.4, 1); add(offset + 28.5, 0);
    add(offset + 28.7, 0); add(offset + 28.85, 1); add(offset + 29.0, 2); add(offset + 29.15, 3);
    add(offset + 29.3, 0); add(offset + 29.45, 1); add(offset + 29.6, 2); add(offset + 29.75, 3);
    add(offset + 29.9, 0); add(offset + 29.9, 1); add(offset + 29.9, 2); add(offset + 29.9, 3);
    offset += 30;
  }
  return notes;
};

// ==================== BEAT ANALYSIS ====================
async function analyzeBeats(audioBuffer: AudioBuffer): Promise<Note[]> {
  const data = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;

  // 50ms energy windows, step by 10 for speed
  const windowMs = 0.05;
  const windowSamples = Math.floor(sampleRate * windowMs);
  const step = Math.max(1, Math.floor(windowSamples / 10));
  const energies: number[] = [];

  for (let i = 0; i < data.length - windowSamples; i += windowSamples) {
    let e = 0;
    for (let j = i; j < i + windowSamples; j += step) e += data[j] * data[j];
    energies.push(e);
  }

  // Local adaptive threshold
  const historyLen = 20;
  const beatTimes: number[] = [];
  let lastBeat = -0.25;

  for (let i = historyLen; i < energies.length - 1; i++) {
    const localAvg = energies.slice(i - historyLen, i).reduce((a, b) => a + b, 0) / historyLen;
    if (energies[i] > localAvg * 1.6 && energies[i] >= energies[i - 1] && energies[i] > energies[i + 1]) {
      const t = i * windowMs;
      if (t - lastBeat > 0.18) { beatTimes.push(t); lastBeat = t; }
    }
  }

  // If too few beats detected (quiet song), fall back to generated chart
  if (beatTimes.length < Math.floor(duration / 2)) {
    return generateChart(duration);
  }

  // Convert beat times to notes with varied lanes
  const notes: Note[] = [];
  let id = 1;
  const lanePattern = [0, 2, 1, 3, 0, 1, 2, 3, 1, 0, 3, 2];

  beatTimes.forEach((time, bi) => {
    const lane = lanePattern[bi % lanePattern.length];
    notes.push({ id: `n${id++}`, time, lane });
    // Add chord on strong beats
    if (bi % 8 === 0 && bi > 0) {
      notes.push({ id: `n${id++}`, time: time + 0.05, lane: (lane + 2) % 4 });
    }
  });

  return notes.sort((a, b) => a.time - b.time);
}

// ==================== 3D COMPONENTS (unchanged) ====================
const LANE_COLORS = ['#ff2d55', '#ffd60a', '#0a84ff', '#30d158'];

const NoteObject = ({ position, lane, isHit, isPerfect, colorblindMode }: { position: [number, number, number]; lane: number; isHit: boolean; isPerfect: boolean; colorblindMode: boolean }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (meshRef.current) {
      const pulse = 1 + Math.sin(Date.now() * 0.006 + lane * 2) * 0.08;
      meshRef.current.scale.set(isHit ? 2.2 : pulse, isHit ? 2.2 : pulse, isHit ? 2.2 : pulse);
    }
  });
  const color = isPerfect ? '#ffffff' : LANE_COLORS[lane];
  return (
    <group position={position}>
      {colorblindMode ? (
        <group ref={meshRef}>
          {lane === 0 && <mesh><cylinderGeometry args={[0.5, 0.5, 0.4, 32]} /><meshStandardMaterial color={color} emissive={LANE_COLORS[lane]} emissiveIntensity={2.5} /></mesh>}
          {lane === 1 && <mesh><boxGeometry args={[0.8, 0.4, 0.8]} /><meshStandardMaterial color={color} emissive={LANE_COLORS[lane]} emissiveIntensity={2.5} /></mesh>}
          {lane === 2 && <mesh><coneGeometry args={[0.6, 0.5, 3]} /><meshStandardMaterial color={color} emissive={LANE_COLORS[lane]} emissiveIntensity={2.5} /></mesh>}
          {lane === 3 && <mesh><cylinderGeometry args={[0.6, 0.6, 0.4, 4]} /><meshStandardMaterial color={color} emissive={LANE_COLORS[lane]} emissiveIntensity={2.5} /></mesh>}
        </group>
      ) : (
        <group ref={meshRef as any}>
          {/* Main gem body */}
          <RoundedBox args={[1.1, 0.32, 0.58]} radius={0.11} smoothness={4}>
            <meshStandardMaterial color={color} emissive={LANE_COLORS[lane]} emissiveIntensity={2.5} metalness={0.88} roughness={0.06} transparent opacity={0.97} />
          </RoundedBox>
          {/* Top specular highlight strip */}
          <mesh position={[-0.25, 0.115, -0.1]}>
            <boxGeometry args={[0.55, 0.018, 0.18]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={isPerfect ? 1 : 0.45} />
          </mesh>
          {/* Edge glow outline */}
          <RoundedBox args={[1.14, 0.36, 0.62]} radius={0.12} smoothness={4}>
            <meshBasicMaterial color={LANE_COLORS[lane]} transparent opacity={0.18} side={THREE.BackSide} />
          </RoundedBox>
        </group>
      )}
      {/* Floor shadow disc — CIRCLE not rectangle */}
      <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.72, 32]} />
        <meshBasicMaterial color={LANE_COLORS[lane]} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <pointLight color={LANE_COLORS[lane]} intensity={1.8} distance={4.5} position={[0, 0.4, 0]} />
    </group>
  );
};

const Highway = ({ notes, currentTime, hitNotes, hitFlash }: any) => {
  const settings = usePersistedStore(s => s.settings);
  const speedMap = { slow: 10, medium: 15, fast: 20, expert: 25 };
  const speed = speedMap[settings.noteSpeed] || 15;
  const visibleNotes = notes.filter((n: Note) => !hitNotes.has(n.id) && currentTime < n.time + 0.5 && currentTime > n.time - 3);
  return (
    <>
      {visibleNotes.map((n: Note) => {
        const z = -(n.time - currentTime) * speed;
        if (z > 2 || z < -45) return null;
        const xOffset = (n.lane - 1.5) * 1.5;
        const isHitFlashActive = hitFlash?.active && hitFlash.lane === n.lane && Math.abs(hitFlash.time - n.time) < 0.05;
        return <NoteObject key={n.id} position={[xOffset, 0, z]} lane={n.lane} isHit={isHitFlashActive} isPerfect={hitFlash?.result === 'perfect'} colorblindMode={settings.colorblindMode} />;
      })}
    </>
  );
};

const LaneStrip = ({ lane, color }: { lane: number; color: string }) => (
  <group>
    <Plane args={[0.4, 50, 1, 1]} position={[(lane - 1.5) * 1.5, -0.1, -20]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} transparent opacity={0.8} />
    </Plane>
    <Plane args={[1.3, 50, 1, 1]} position={[(lane - 1.5) * 1.5, -0.19, -20]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshBasicMaterial color={color} transparent opacity={0.06} side={THREE.DoubleSide} />
    </Plane>
  </group>
);

// ==================== FRET PAD TARGETS — polished chrome dome design ====================
const FretPadTarget = ({ lane, pressed, hitFlash }: { lane: number; pressed: boolean; hitFlash: any }) => {
  const color = LANE_COLORS[lane];
  const isFlashing = hitFlash?.active && hitFlash.lane === lane && hitFlash.result !== 'miss';
  const rimRef    = useRef<THREE.Mesh>(null);
  const domeRef   = useRef<THREE.Mesh>(null);
  const glowRef   = useRef<THREE.Mesh>(null);
  const accentRef = useRef<THREE.Mesh>(null);
  const xOffset   = (lane - 1.5) * 1.5;

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * 2.2 + lane * 1.6;
    const breathe = 1.3 + Math.sin(t) * 0.45;

    if (rimRef.current) {
      const mat = rimRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = THREE.MathUtils.lerp(
        mat.emissiveIntensity, pressed ? 6.5 : isFlashing ? 4.5 : breathe, 0.18
      );
      (mat as any).color.set(pressed ? '#ffffff' : color);
    }
    if (domeRef.current) {
      const mat = domeRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = THREE.MathUtils.lerp(
        mat.emissiveIntensity, pressed ? 3.5 : isFlashing ? 2.2 : 0.16 + Math.sin(t * 0.9) * 0.06, 0.16
      );
      (mat as any).color.set(pressed ? color : '#ffffff');
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, pressed ? 0.8 : 0.15, 0.1);
      domeRef.current.scale.y = THREE.MathUtils.lerp(domeRef.current.scale.y, pressed ? 1.35 : 1, 0.14);
    }
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, pressed ? 0.52 : 0.07, 0.15);
    }
    if (accentRef.current) {
      const mat = accentRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = THREE.MathUtils.lerp(
        mat.emissiveIntensity, pressed ? 3 : 0.55, 0.15
      );
    }
  });

  return (
    <group position={[xOffset, -0.05, 0.3]}>

      {/* ── Hollow base ring ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <torusGeometry args={[0.65, 0.08, 16, 64]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={0.5} transparent opacity={0.4} metalness={0.9} roughness={0.1} />
      </mesh>

      {/* ── Chrome outer rim (main torus, thick) ── */}
      <mesh ref={rimRef} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.585, 0.125, 22, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          metalness={0.97}
          roughness={0.025}
        />
      </mesh>

      {/* ── Thin accent halo ring (outer edge) ── */}
      <mesh ref={accentRef} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.73, 0.018, 8, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          transparent
          opacity={0.65}
        />
      </mesh>

      {/* ── Inner glow disc — CIRCLE geometry (no squares) ── */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <circleGeometry args={[0.458, 56]} />
        <meshBasicMaterial color={color} transparent opacity={0.07} side={THREE.DoubleSide} />
      </mesh>

      {/* ── Raised dome (top hemisphere) ── */}
      <mesh ref={domeRef} position={[0, 0.018, 0]}>
        <sphereGeometry args={[0.33, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={0.16}
          metalness={0.68}
          roughness={0.16}
          transparent
          opacity={0.15}
        />
      </mesh>

      {/* ── Dome inner rim (base of dome, catches more light) ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <torusGeometry args={[0.325, 0.025, 8, 40]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={pressed ? 2 : 0.4}
          metalness={0.95}
          roughness={0.05}
          transparent
          opacity={0.75}
        />
      </mesh>

      {/* ── Primary specular highlight (upper-left of dome) ── */}
      <mesh position={[-0.092, 0.295, -0.098]}>
        <sphereGeometry args={[0.052, 10, 10]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={pressed ? 0.96 : 0.38} />
      </mesh>

      {/* ── Secondary specular (smaller, shifted) ── */}
      <mesh position={[0.058, 0.26, -0.115]}>
        <sphereGeometry args={[0.024, 8, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={pressed ? 0.72 : 0.18} />
      </mesh>

      {/* ── Circular floor glow — disc, not rectangle ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.055, 0]}>
        <circleGeometry args={[0.85, 48]} />
        <meshBasicMaterial color={color} transparent opacity={pressed ? 0.38 : 0.06} side={THREE.DoubleSide} />
      </mesh>

      {/* ── Lights ── */}
      <pointLight color={color} intensity={pressed ? 12 : isFlashing ? 7 : 2} distance={pressed ? 9 : 5} position={[0, 1.2, 0]} />
      {pressed && <pointLight color={color} intensity={5} distance={3.5} position={[0, -0.4, 0.6]} />}
    </group>
  );
};

const Scene = ({ notes, currentTime, hitNotes, hitFlash, fretVisual }: any) => {
  const { camera } = useThree();
  const combo = useGameStore(s => s.combo);
  useEffect(() => { camera.position.set(0, 4.2, 6); camera.lookAt(0, 0, -8); }, [camera]);
  useFrame(() => {
    if (hitFlash?.active && hitFlash.result === 'miss') {
      camera.position.x += (Math.random() - 0.5) * 0.14;
      camera.position.y = 4.2 + (Math.random() - 0.5) * 0.14;
    } else {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.1);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, 4.2, 0.1);
    }
    const targetZ = 6 - Math.min(combo * 0.012, 1.8);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.05);
  });
  return (
    <>
      <fog attach="fog" args={['#080818', 20, 55]} />
      <ambientLight intensity={0.08} />
      <pointLight position={[0, 6, 0]} intensity={1.2} color="#ffffff" />
      <spotLight position={[-5, 10, -8]} angle={0.4} penumbra={0.7} intensity={2.5} color="#ff2d55" castShadow={false} />
      <spotLight position={[5, 10, -8]} angle={0.4} penumbra={0.7} intensity={2.5} color="#0a84ff" castShadow={false} />
      <spotLight position={[0, 8, -20]} angle={0.6} penumbra={1} intensity={2} color="#b44dff" castShadow={false} />
      <spotLight position={[-2, 5, -3]} angle={0.5} penumbra={0.9} intensity={1} color="#ffd60a" castShadow={false} />
      <spotLight position={[2, 5, -3]} angle={0.5} penumbra={0.9} intensity={1} color="#30d158" castShadow={false} />
      {/* ── Highway floor — ultra-reflective dark mirror ── */}
      <Plane args={[9.2, 65]} position={[0, -0.2, -24]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#00000a" metalness={0.995} roughness={0.008} />
      </Plane>

      {/* ── Lane strips ── */}
      {[0, 1, 2, 3].map(lane => <LaneStrip key={lane} lane={lane} color={LANE_COLORS[lane]} />)}

      {/* ── Lane separator lines (vertical, between lanes) ── */}
      {[0, 1, 2].map(i => {
        const x = (i - 1) * 1.5 + 0.75;
        return (
          <mesh key={`sep-${i}`} position={[x, -0.12, -22]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.025, 55]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.06} />
          </mesh>
        );
      })}

      {/* ── Beat marker lines (fret lines across highway, like a guitar neck) ── */}
      {Array.from({ length: 24 }, (_, i) => (
        <mesh key={`beat-${i}`} position={[0, -0.185, -((i + 1) * 2.2)]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[6.8, 0.03]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.05} />
        </mesh>
      ))}

      {/* ── Highway left wall ── */}
      <mesh position={[-3.45, 0.15, -22]}>
        <boxGeometry args={[0.07, 0.7, 55]} />
        <meshStandardMaterial color="#080816" metalness={0.98} roughness={0.05} emissive="#ff2d55" emissiveIntensity={0.12} />
      </mesh>
      {/* ── Highway right wall ── */}
      <mesh position={[3.45, 0.15, -22]}>
        <boxGeometry args={[0.07, 0.7, 55]} />
        <meshStandardMaterial color="#080816" metalness={0.98} roughness={0.05} emissive="#0a84ff" emissiveIntensity={0.12} />
      </mesh>

      {/* ── Hit zone line (glowing white bar) ── */}
      <Box args={[6.8, 0.035, 0.07]} position={[0, -0.04, 0.32]}>
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.5} transparent opacity={0.8} />
      </Box>
      {/* ── Hit zone under-glow ── */}
      <mesh position={[0, -0.195, 0.32]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6.8, 0.9]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.07} />
      </mesh>

      {/* ── Fret pad circles ── */}
      {[0, 1, 2, 3].map(lane => (
        <FretPadTarget key={`fret-${lane}`} lane={lane} pressed={fretVisual?.[lane] || false} hitFlash={hitFlash} />
      ))}

      <Highway notes={notes} currentTime={currentTime} hitNotes={hitNotes} hitFlash={hitFlash} />

      {hitFlash?.active && hitFlash.result !== 'miss' && (
        <group position={[(hitFlash.lane - 1.5) * 1.5, 0.5, 0.3]}>
          <Sparkles count={55} scale={[2.8, 4.5, 2.8]} size={7} speed={4.5} opacity={1} color={hitFlash.result === 'perfect' ? '#ffd60a' : LANE_COLORS[hitFlash.lane]} />
          <pointLight position={[0, 1.5, 0]} intensity={7} distance={9} color={LANE_COLORS[hitFlash.lane]} />
        </group>
      )}

      {/* ── Atmospheric sparkles (crowd / stage dust) ── */}
      <Sparkles count={70} scale={[16, 7, 30]} position={[0, 3, -20]} size={1.4} speed={0.1} opacity={0.18} color="#b44dff" />
      <Sparkles count={30} scale={[8, 4, 10]} position={[-4, 2, -12]} size={1.2} speed={0.15} opacity={0.14} color="#ff2d55" />
      <Sparkles count={30} scale={[8, 4, 10]} position={[4, 2, -12]} size={1.2} speed={0.15} opacity={0.14} color="#0a84ff" />
    </>
  );
};

// ==================== GAME TYPES ====================
type GamePhase = 'menu' | 'analyzing' | 'countdown' | 'playing' | 'paused' | 'results';

interface GameRef {
  score: number;
  combo: number;
  maxCombo: number;
  multiplier: number;
  rockMeter: number;
  perfectCount: number;
  greatCount: number;
  goodCount: number;
  missCount: number;
  pendingNotes: Note[];
}

interface SongMeta {
  id: string;
  title: string;
  artist: string;
  duration: number;
  bpm: number;
}

// ==================== MAIN COMPONENT ====================
interface PlayTabProps {
  songToPlay?: SavedSong | null;
}

export const PlayTab: React.FC<PlayTabProps> = ({ songToPlay }) => {
  const store = useGameStore();
  const { recordSessionStats, addSavedSong, savedSongs, settings } = usePersistedStore();

  // Phase
  const [gamePhase, setGamePhase] = useState<GamePhase>('menu');
  const [countdownValue, setCountdownValue] = useState(3);
  const gamePhaseRef = useRef<GamePhase>('menu');

  // Song
  const [notes, setNotes] = useState<Note[]>(() => generateChart(300));
  const notesRef = useRef<Note[]>([]);
  const [songMeta, setSongMeta] = useState<SongMeta | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState('Awaiting input...');
  const [analysisProgress, setAnalysisProgress] = useState(0);

  // Audio
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number>(0);

  // Display (updated at 10fps from gameRef — never block 60fps loop)
  const [displayScore, setDisplayScore] = useState(0);
  const [displayCombo, setDisplayCombo] = useState(0);
  const [displayMultiplier, setDisplayMultiplier] = useState(1);
  const [displayRockMeter, setDisplayRockMeter] = useState(50);
  const [displayAccuracy, setDisplayAccuracy] = useState(100);

  // Fret visuals (React state only for CSS)
  const [fretVisual, setFretVisual] = useState([false, false, false, false]);

  // Results
  const [lastSession, setLastSession] = useState<any>(null);

  // Mutable game state (never causes re-renders)
  const gameRef = useRef<GameRef>({
    score: 0, combo: 0, maxCombo: 0, multiplier: 1,
    rockMeter: 50, perfectCount: 0, greatCount: 0, goodCount: 0, missCount: 0,
    pendingNotes: [],
  });
  const heldFretsRef = useRef([false, false, false, false]);
  const rafRef = useRef<number>(0);
  const uiSyncRef = useRef<number>(0);
  const missedSoundCooldownRef = useRef<number>(0);

  const { canvasRef: particleCanvasRef, spawnParticles } = useParticleSystem();

  // Keep refs in sync with state
  useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { audioContextRef.current = audioContext; }, [audioContext]);
  useEffect(() => { audioBufferRef.current = audioBuffer; }, [audioBuffer]);

  // When audioBuffer changes, regenerate notes from real beat analysis
  // BUT only if we don't have a manual (pro) chart already loaded
  useEffect(() => {
    if (!audioBuffer) return;
    // Check if it's a known pro chart ID to avoid overwriting
    if (songMeta?.id.includes('pro')) return;
    
    analyzeBeats(audioBuffer).then(chart => {
      setNotes(chart);
      notesRef.current = chart;
    });
  }, [audioBuffer, songMeta?.id]);

  // ==================== SFX ====================
  const playSfx = useCallback((type: 'hit' | 'miss') => {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    const vol = settings.sfxVolume / 100;
    if (vol === 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (type === 'hit') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(vol * 0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(); osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(100, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(vol * 0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(); osc.stop(ctx.currentTime + 0.15);
    }
  }, [settings.sfxVolume]);

  // ==================== STRUM — chord-aware ====================
  const strum = useCallback(() => {
    if (gamePhaseRef.current !== 'playing') return;
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const pressTime = ctx.currentTime - startTimeRef.current + (settings.audioLatencyMs / 1000);
    const g = gameRef.current;

    // Gather all lanes currently held
    const activeLanes = heldFretsRef.current
      .map((held, i) => held ? i : -1)
      .filter(i => i >= 0);

    if (activeLanes.length === 0) return;

    let anyHit = false;

    for (const lane of activeLanes) {
      // Find closest pending note for this lane
      const laneNotes = g.pendingNotes
        .filter(n => n.lane === lane)
        .sort((a, b) => Math.abs(a.time - pressTime) - Math.abs(b.time - pressTime));

      if (laneNotes.length === 0) continue;
      const nearest = laneNotes[0];
      const delta = Math.abs(nearest.time - pressTime);

      let result: HitResult | null = null;
      let points = 0;
      if (delta <= 0.030) { result = 'perfect'; points = 150; }
      else if (delta <= 0.060) { result = 'great'; points = 100; }
      else if (delta <= 0.090) { result = 'good'; points = 50; }

      if (result) {
        g.pendingNotes = g.pendingNotes.filter(n => n.id !== nearest.id);
        g.score += points * g.multiplier;
        g.combo += 1;
        g.maxCombo = Math.max(g.maxCombo, g.combo);
        g.multiplier = Math.min(4, 1 + Math.floor(g.combo / 10));
        g.rockMeter = Math.min(100, g.rockMeter + 5);
        if (result === 'perfect') g.perfectCount++;
        else if (result === 'great') g.greatCount++;
        else g.goodCount++;

        // Zustand only for 3D hit flash (low frequency)
        store.addHitNote(nearest.id);
        store.setHitFlash({ active: true, lane, result, time: pressTime });
        setTimeout(() => store.setHitFlash(null), 150);

        playSfx('hit');
        spawnParticles(lane, result);
        anyHit = true;
      }
    }

    if (!anyHit) {
      g.combo = 0;
      g.multiplier = 1;
      g.rockMeter = Math.max(0, g.rockMeter - 5);
      playSfx('miss');
    }
  }, [settings.audioLatencyMs, store, playSfx, spawnParticles]);

  // ==================== KEYBOARD ====================
  useEffect(() => {
    const LANE_MAP: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3 };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const lane = LANE_MAP[e.key];
      if (lane !== undefined) {
        heldFretsRef.current[lane] = true;
        setFretVisual(p => { const n = [...p]; n[lane] = true; return n; });
      }
      if (e.key === 'Enter') { e.preventDefault(); strum(); }
      if (e.key === ' ' && gamePhaseRef.current === 'menu' && audioBufferRef.current) {
        e.preventDefault(); startCountdown();
      }
      if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && gamePhaseRef.current === 'playing') {
        e.preventDefault(); pauseGame();
      }
      if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && gamePhaseRef.current === 'paused') {
        e.preventDefault(); resumeGame();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const lane = LANE_MAP[e.key];
      if (lane !== undefined) {
        heldFretsRef.current[lane] = false;
        setFretVisual(p => { const n = [...p]; n[lane] = false; return n; });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [strum]);

  // ==================== GAME LOOP ====================
  const stopGameLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    clearInterval(uiSyncRef.current);
  }, []);

  const startGameLoop = useCallback(() => {
    const ctx = audioContextRef.current!;

    const frame = () => {
      if (gamePhaseRef.current !== 'playing') return;
      const currentTime = ctx.currentTime - startTimeRef.current + (settings.audioLatencyMs / 1000);

      // Update Three.js time (needed every frame for smooth note scrolling)
      store.setCurrentTime(currentTime);

      // Efficient miss detection — only check notes near current time
      const g = gameRef.current;
      const MISS_WINDOW = 0.120;
      let missedCount = 0;
      g.pendingNotes = g.pendingNotes.filter(n => {
        if (currentTime - n.time > MISS_WINDOW) { missedCount++; return false; }
        return true;
      });

      if (missedCount > 0) {
        g.combo = 0;
        g.multiplier = 1;
        g.rockMeter = Math.max(0, g.rockMeter - missedCount * 8);
        g.missCount += missedCount;
        // Throttle miss sound to avoid audio spam
        if (performance.now() - missedSoundCooldownRef.current > 300) {
          playSfx('miss');
          missedSoundCooldownRef.current = performance.now();
        }
      }

      // Song ended
      const buf = audioBufferRef.current;
      if (buf && currentTime >= buf.duration + 1.5) {
        endGame('completed');
        return;
      }

      // Failed — rock meter empty
      if (g.rockMeter <= 0 && missedCount > 0) {
        endGame('failed');
        return;
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    // Sync display state at 10fps (score, combo, etc.) — not every frame
    uiSyncRef.current = window.setInterval(() => {
      const g = gameRef.current;
      setDisplayScore(g.score);
      setDisplayCombo(g.combo);
      setDisplayMultiplier(g.multiplier);
      setDisplayRockMeter(g.rockMeter);
      const total = g.perfectCount + g.greatCount + g.goodCount + g.missCount;
      setDisplayAccuracy(total > 0 ? ((g.perfectCount * 100 + g.greatCount * 70 + g.goodCount * 40) / total) : 100);
    }, 100);
  }, [settings.audioLatencyMs, store, playSfx, stopGameLoop]);

  // ==================== PHASE TRANSITIONS ====================
  const endGame = useCallback((reason: 'completed' | 'failed' | 'quit') => {
    stopGameLoop();
    gamePhaseRef.current = 'results';
    try { sourceNodeRef.current?.stop(); } catch {}

    const g = gameRef.current;
    const total = g.perfectCount + g.greatCount + g.goodCount + g.missCount;
    const accuracy = total > 0 ? ((g.perfectCount * 100 + g.greatCount * 70 + g.goodCount * 40) / total) : 0;
    const grade = accuracy >= 95 ? 'S' : accuracy >= 80 ? 'A' : accuracy >= 65 ? 'B' : accuracy >= 50 ? 'C' : 'D';
    const meta = songMeta;

    const session = {
      songId: meta?.id || 'unknown',
      songTitle: meta ? `${meta.title}` : 'Unknown Song',
      score: g.score,
      maxCombo: g.maxCombo,
      accuracy,
      grade,
      perfectCount: g.perfectCount,
      greatCount: g.greatCount,
      goodCount: g.goodCount,
      missCount: g.missCount,
      reason,
      timestamp: Date.now(),
      previousHighScore: savedSongs.find(s => s.id === meta?.id)?.highScore || 0,
      durationSeconds: audioBufferRef.current?.duration || 0,
    };

    setLastSession(session);
    setGamePhase('results');
    recordSessionStats(session);

    // Save to localStorage for leaderboard
    const existing = JSON.parse(localStorage.getItem('airockhero_scores') ?? '[]');
    existing.unshift(session);
    localStorage.setItem('airockhero_scores', JSON.stringify(existing.slice(0, 100)));

    if (meta?.id) updateHighScore(meta.id, g.score, 1).catch(() => {});
  }, [stopGameLoop, songMeta, savedSongs, recordSessionStats]);

  const startCountdown = useCallback(async () => {
    const ctx = audioContextRef.current;
    if (ctx?.state === 'suspended') await ctx.resume();
    const buf = audioBufferRef.current;
    if (!ctx || !buf) return;

    setGamePhase('countdown');
    gamePhaseRef.current = 'countdown';
    store.resetGame();
    gameRef.current = {
      score: 0, combo: 0, maxCombo: 0, multiplier: 1,
      rockMeter: 50, perfectCount: 0, greatCount: 0, goodCount: 0, missCount: 0,
      pendingNotes: [...notesRef.current],
    };
    heldFretsRef.current = [false, false, false, false];
    setFretVisual([false, false, false, false]);
    setDisplayScore(0); setDisplayCombo(0); setDisplayMultiplier(1);
    setDisplayRockMeter(50); setDisplayAccuracy(100);

    for (const n of [3, 2, 1]) {
      setCountdownValue(n);
      await new Promise(r => setTimeout(r, 1000));
    }
    setCountdownValue(0);
    await new Promise(r => setTimeout(r, 500));

    // Stop any existing source
    try { sourceNodeRef.current?.stop(); } catch {}

    const gain = ctx.createGain();
    gain.gain.value = settings.musicVolume / 100;
    gainNodeRef.current = gain;
    gain.connect(ctx.destination);

    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.connect(gain);
    source.start(0);
    sourceNodeRef.current = source;
    startTimeRef.current = ctx.currentTime;

    source.onended = () => {
      if (gamePhaseRef.current === 'playing') endGame('completed');
    };

    gamePhaseRef.current = 'playing';
    setGamePhase('playing');
    startGameLoop();
  }, [store, settings.musicVolume, startGameLoop, endGame]);

  const pauseGame = useCallback(() => {
    audioContextRef.current?.suspend();
    stopGameLoop();
    gamePhaseRef.current = 'paused';
    setGamePhase('paused');
  }, [stopGameLoop]);

  const resumeGame = useCallback(() => {
    audioContextRef.current?.resume();
    gamePhaseRef.current = 'playing';
    setGamePhase('playing');
    startGameLoop();
  }, [startGameLoop]);

  // ==================== SONG ANALYSIS ====================
  const processAudio = useCallback(async (
    ctx: AudioContext,
    buf: AudioBuffer,
    meta: SongMeta,
    rawBuffer?: ArrayBuffer,
    sourceUrl?: string,
  ) => {
    setAnalysisStep('Analyzing beats...');
    setAnalysisProgress(75);
    const chart = await analyzeBeats(buf);
    setAudioContext(ctx);
    setAudioBuffer(buf);
    setNotes(chart);
    setSongMeta(meta);

    // Save metadata + chart to zustand (for SongsTab)
    addSavedSong({
      id: meta.id,
      url: sourceUrl || '',
      title: meta.title,
      artist: meta.artist,
      duration: buf.duration,
      bpm: meta.bpm,
      thumbnailUrl: '',
      chartData: chart,
      addedAt: Date.now(),
      highScore: 0,
      timesPlayed: 0,
    });

    // Save audio bytes to IndexedDB (file uploads only)
    if (rawBuffer) {
      upsertSong({
        id: meta.id,
        title: meta.title,
        artist: meta.artist,
        duration: buf.duration,
        bpm: meta.bpm,
        thumbnailUrl: '',
        sourceType: sourceUrl ? 'youtube' : 'file',
        sourceUrl,
        audioArrayBuffer: rawBuffer,
        chart: chart.map(n => ({ id: n.id, lane: n.lane, time: n.time })),
        addedAt: Date.now(),
        highScore: 0,
        timesPlayed: 0,
      }).catch(() => {});
    }

    setGamePhase('menu');
    setAnalysisError(null);
    setAnalysisProgress(100);
    setAnalysisStep('Ready to rock!');
  }, [addSavedSong]);

  // File upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGamePhase('analyzing');
    setAnalysisError(null);
    setAnalysisStep('Reading file...');
    setAnalysisProgress(10);
    try {
      const rawBuffer = await file.arrayBuffer();
      setAnalysisStep('Decoding audio...');
      setAnalysisProgress(40);
      const ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(rawBuffer.slice(0));
      setAnalysisStep('Generating note chart...');
      setAnalysisProgress(80);
      const nameParts = file.name.replace(/\.[^/.]+$/, '').split(' - ');
      const title = nameParts.length >= 2 ? nameParts.slice(1).join(' - ') : nameParts[0];
      const artist = nameParts.length >= 2 ? nameParts[0] : 'Unknown Artist';
      const id = await hashString(file.name + String(file.size));
      await processAudio(ctx, decoded, { id, title, artist, duration: decoded.duration, bpm: 120 }, rawBuffer);
    } catch (err: any) {
      setGamePhase('menu');
      setAnalysisError(`Failed to load: ${err.message}`);
    }
  };

  const loadSlipknotPro = async () => {
    setGamePhase('analyzing');
    setAnalysisError(null);
    setAnalysisStep('Loading professional chart...');
    setAnalysisProgress(20);
    
    try {
      setAnalysisStep('Fetching MIDI...');
      setAnalysisProgress(40);
      const chartNotes = await loadMidiChart('/songs/duality/notes.mid');
      
      setAnalysisStep('Decoding audio...');
      setAnalysisProgress(70);
      const ctx = new AudioContext();
      const audioRes = await fetch('/songs/duality/song.mp3');
      const rawBuffer = await audioRes.arrayBuffer();
      const decoded = await ctx.decodeAudioData(rawBuffer.slice(0));
      
      const meta = {
        id: 'slipknot-duality-pro',
        title: 'Duality (Pro - Official Video)',
        artist: 'Slipknot',
        duration: decoded.duration,
        bpm: 145
      };

      setAudioContext(ctx);
      setAudioBuffer(decoded);
      setNotes(chartNotes);
      setSongMeta(meta);
      
      setGamePhase('menu');
      setAnalysisProgress(100);
      setAnalysisStep('Pro Chart Loaded!');
    } catch (err: any) {
      setGamePhase('menu');
      setAnalysisError(`Failed to load pro chart: ${err.message}`);
    }
  };

  // YouTube / URL analyze
  const handleAnalyze = async () => {
    const url = youtubeUrl.trim();
    if (!url) return;
    setGamePhase('analyzing');
    setAnalysisError(null);
    setAnalysisStep('Fetching audio...');
    setAnalysisProgress(10);

    try {
      // Try cobalt.tools via Vite proxy (no CORS issues)
      const cobaltRes = await fetch('/cobalt-proxy/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ url, downloadMode: 'audio', audioFormat: 'mp3' }),
      });

      if (!cobaltRes.ok) throw new Error(`Cobalt API error ${cobaltRes.status}`);
      const cobaltData = await cobaltRes.json();

      if (!['stream', 'redirect', 'tunnel'].includes(cobaltData.status)) {
        throw new Error(cobaltData.text || 'Could not extract audio');
      }

      setAnalysisStep('Downloading audio...');
      setAnalysisProgress(40);
      const audioRes = await fetch(cobaltData.url);
      if (!audioRes.ok) throw new Error('Audio download failed');

      setAnalysisStep('Decoding audio...');
      setAnalysisProgress(65);
      const rawBuffer = await audioRes.arrayBuffer();
      const ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(rawBuffer.slice(0));

      setAnalysisStep('Generating note chart...');
      setAnalysisProgress(85);

      const id = await hashString(url);
      const filename = cobaltData.filename || '';
      const nameParts = filename.replace(/\.[^/.]+$/, '').split(' - ');
      const title = nameParts.length >= 2 ? nameParts.slice(1).join(' - ') : (filename || `Song (${url.slice(-11)})`);
      const artist = nameParts.length >= 2 ? nameParts[0] : 'YouTube';

      await processAudio(ctx, decoded, { id, title, artist, duration: decoded.duration, bpm: 120 }, rawBuffer, url);
    } catch (err: any) {
      // Fallback: synthesized audio so the game still works
      setAnalysisStep('Cobalt unavailable — generating offline playback...');
      setAnalysisProgress(60);

      const ctx = new AudioContext();
      const duration = 300;
      const buf = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buf.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
          const t = i / ctx.sampleRate;
          data[i] = Math.sin(2 * Math.PI * 110 * t) * 0.15
            + (Math.abs(Math.sin(2 * Math.PI * 2 * t)) > 0.95 ? 0.2 * Math.sin(2 * Math.PI * 440 * t) : 0);
        }
      }
      const id = await hashString(url);
      await processAudio(ctx, buf, { id, title: 'YouTube Song (offline)', artist: 'YouTube', duration, bpm: 120 }, undefined, url);
      setAnalysisError('YouTube audio requires cobalt.tools. Loaded with synthesized audio. For real audio, download the MP3 and use "Upload Audio".');
    }
  };

  // ==================== LOAD SAVED SONG ====================
  useEffect(() => {
    if (!songToPlay) return;
    const load = async () => {
      setGamePhase('analyzing');
      setAnalysisStep('Loading saved song...');
      setAnalysisProgress(20);
      try {
        const stored = await getSong(songToPlay.id);
        const ctx = new AudioContext();
        let buf: AudioBuffer;

        if (stored?.audioArrayBuffer) {
          setAnalysisStep('Decoding cached audio...');
          setAnalysisProgress(60);
          buf = await ctx.decodeAudioData(stored.audioArrayBuffer.slice(0));
        } else {
          throw new Error('No cached audio. Re-analyze from URL.');
        }

        const chart = songToPlay.chartData || generateChart(buf.duration);
        setAudioContext(ctx);
        setAudioBuffer(buf);
        setNotes(chart);
        setSongMeta({ id: songToPlay.id, title: songToPlay.title, artist: songToPlay.artist, duration: buf.duration, bpm: songToPlay.bpm });
        setGamePhase('menu');
        setAnalysisProgress(100);
        setAnalysisStep('Ready to rock!');
      } catch (err: any) {
        setGamePhase('menu');
        setAnalysisError(`Could not load: ${err.message}`);
        if (songToPlay.url) setYoutubeUrl(songToPlay.url);
      }
    };
    load();
  }, [songToPlay]);

  // Cleanup on unmount
  useEffect(() => () => { stopGameLoop(); try { sourceNodeRef.current?.stop(); } catch {} }, [stopGameLoop]);

  // ==================== HELPERS ====================
  const getRockColor = () => displayRockMeter > 75 ? '#00ff9d' : displayRockMeter > 35 ? '#f9e45b' : '#ff2a6d';
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const songLoaded = audioBuffer !== null && (gamePhase === 'menu' || gamePhase === 'playing' || gamePhase === 'paused' || gamePhase === 'countdown');

  return (
    <div id="game-container" className="w-full h-screen relative bg-[#0a0a1f] overflow-hidden select-none">
      <ConcertBackground />

      <canvas
        ref={particleCanvasRef}
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 50, pointerEvents: 'none' }}
      />

      <div className="absolute inset-0" style={{ zIndex: 1 }}>
        <Canvas camera={{ position: [0, 4.2, 6], fov: 65 }}>
          <Scene notes={notes} currentTime={store.currentTime} hitNotes={store.hitNotes} hitFlash={store.hitFlash} fretVisual={fretVisual} />
        </Canvas>
      </div>

      {/* LEFT PANEL */}
      <div className="absolute left-6 top-24 w-80 flex flex-col gap-4 z-10">
        <div className="hud-panel-cyan p-5 shadow-[0_0_15px_rgba(5,217,232,0.1)]">
          <h2 className="text-sm font-bold mb-3 font-orbitron">1. SELECT YOUR SONG</h2>
          <div className="flex gap-2 mb-3 border-b border-gray-700 pb-2">
            <span className="text-pink-500 text-xs font-bold border-b border-pink-500 pb-1 flex-1 text-center">YOUTUBE URL</span>
            <label className="text-gray-400 text-xs font-bold flex-1 text-center cursor-pointer hover:text-white transition-colors relative">
              UPLOAD AUDIO
              <input type="file" accept="audio/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
          </div>
          <div className="relative mb-3">
            <input
              type="text"
              placeholder="https://youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={e => setYoutubeUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              className="w-full bg-[#111] border border-gray-700 rounded-md py-2 px-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
            />
            <MonitorPlay size={14} className="absolute right-3 top-2.5 text-red-500" />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={!youtubeUrl.trim() || gamePhase === 'analyzing'}
            className="w-full py-2 bg-transparent border border-pink-500 text-pink-500 rounded-md text-xs font-bold hover:bg-pink-500/10 transition-colors flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed mb-2"
            style={{ boxShadow: 'inset 0 0 10px rgba(255,42,109,0.2)' }}
          >
            <Activity size={14} className={gamePhase === 'analyzing' ? 'animate-spin' : ''} />
            {gamePhase === 'analyzing' ? 'ANALYZING...' : 'ANALYZE TRACK'}
          </button>

          <button
            onClick={loadSlipknotPro}
            disabled={gamePhase === 'analyzing'}
            className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md text-xs font-bold hover:from-purple-500 hover:to-indigo-500 transition-all flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(147,51,234,0.4)]"
          >
            <Music size={14} /> LOAD PRO (SLIPKNOT)
          </button>
        </div>

        <div className="hud-panel p-5 shadow-[0_0_15px_rgba(255,42,109,0.1)]">
          <h2 className="text-sm font-bold mb-3 font-orbitron">2. AI ANALYSIS ENGINE</h2>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg border border-pink-500 flex items-center justify-center text-pink-500 flex-shrink-0">
              <Activity size={20} className={gamePhase === 'analyzing' ? 'animate-pulse' : ''} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-300 mb-1.5 leading-tight truncate">{analysisStep}</p>
              <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-pink-500 transition-all duration-500" style={{ width: `${analysisProgress}%` }} />
              </div>
            </div>
          </div>
          {analysisError && (
            <p className="text-xs text-yellow-400 mt-2 leading-tight">{analysisError}</p>
          )}
        </div>

        <div className="hud-panel-cyan p-5">
          <h2 className="text-sm font-bold mb-3 font-orbitron">3. TRACK INFO</h2>
          <div className="flex gap-4">
            <div className="w-14 h-14 bg-gray-800 rounded-md border border-gray-600 flex items-center justify-center flex-shrink-0">
              <Disc size={22} className="text-gray-500" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <div className="font-bold text-sm truncate">{songMeta ? songMeta.title : '---'}</div>
              <div className="text-xs text-gray-400 mb-1">{songMeta ? songMeta.artist : '---'}</div>
              <div className="text-xs text-cyan-400">
                ⏱ {audioBuffer ? fmt(audioBuffer.duration) : '--:--'} &nbsp; ⚡ BPM: {songMeta?.bpm ?? '--'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-black/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-4">
          <h2 className="text-xs font-bold text-gray-400 mb-3">CONTROLS</h2>
          <div className="flex items-center gap-2 text-xs mb-2">
            {['1','2','3','4'].map(k => <kbd key={k} className="px-2 py-1 bg-gray-800 border border-gray-600 rounded">{k}</kbd>)}
            <span className="ml-1 text-gray-400">Hold Frets</span>
          </div>
          <div className="flex items-center gap-2 text-xs mb-1">
            <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded w-16 text-center">ENTER</kbd>
            <span className="ml-1 text-gray-400">Strum</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded w-16 text-center">SPACE</kbd>
            <span className="ml-1 text-gray-400">Start / P = Pause</span>
          </div>
        </div>
      </div>

      {/* CENTER TOP — Song progress */}
      <div className="absolute top-24 left-1/2 transform -translate-x-1/2 w-[500px] z-10 flex flex-col items-center">
        <div className="flex justify-between w-full text-xs font-mono mb-1">
          <span>{fmt(store.currentTime)}</span>
          <span>{audioBuffer ? fmt(audioBuffer.duration) : '00:00'}</span>
        </div>
        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-pink-500 transition-none" style={{ width: `${audioBuffer ? Math.min(100, (store.currentTime / audioBuffer.duration) * 100) : 0}%` }} />
        </div>
        <div className="mt-1 text-sm italic font-bold">
          {songMeta ? `${songMeta.title} — ${songMeta.artist}` : ''}
        </div>
      </div>

      {/* RIGHT PANEL — Stats */}
      <div className="absolute right-6 top-24 w-60 flex flex-col gap-3 z-10">
        {/* Score */}
        <div className="hud-panel p-4 flex flex-col items-center relative overflow-hidden shadow-[0_0_25px_rgba(255,45,85,0.15)]">
          <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(ellipse_at_top,_#ff2d55,_transparent_70%)]" />
          <span className="text-[10px] font-bold tracking-[0.3em] text-gray-400 z-10">SCORE</span>
          <div className="score-number text-4xl font-black z-10 leading-none mt-1">{displayScore.toLocaleString()}</div>
        </div>
        {/* MAX COMBO */}
        <div className="hud-panel-cyan p-3 flex flex-col items-center">
          <span className="text-[10px] font-bold tracking-[0.3em] text-gray-400">MAX COMBO</span>
          <span className="text-2xl font-black text-white">{gameRef.current.maxCombo}</span>
        </div>
        {/* ACCURACY */}
        <div className="hud-panel-cyan p-3 flex flex-col items-center">
          <span className="text-[10px] font-bold tracking-[0.3em] text-gray-400">ACCURACY</span>
          <span className="text-2xl font-black text-cyan-400">{displayAccuracy.toFixed(1)}%</span>
        </div>
        {/* COMBO + MULTIPLIER */}
        <div className="hud-panel p-4 flex flex-col items-center shadow-[0_0_25px_rgba(168,85,247,0.2)]">
          <span className="text-[10px] font-bold tracking-[0.3em] text-gray-400 mb-1">MULTIPLIER</span>
          <div className="text-6xl font-black italic font-orbitron text-purple-400 drop-shadow-[0_0_25px_rgba(168,85,247,0.9)] leading-none">
            {displayMultiplier}x
          </div>
          <div className="mt-2 text-xs text-gray-500">COMBO <span className="text-white font-bold">{displayCombo}</span></div>
        </div>

        {/* Rock Meter */}
        <div className="hud-panel p-5 flex flex-col items-center gap-3">
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-[210deg]">
              {/* Track */}
              <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeDasharray="240 62" strokeLinecap="round" />
              {/* Fill */}
              <circle
                cx="60" cy="60" r="48" fill="none"
                stroke={getRockColor()} strokeWidth="10"
                strokeDasharray={`${(displayRockMeter / 100) * 240} 302`}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 8px ${getRockColor()})`, transition: 'stroke-dasharray 0.2s, stroke 0.3s' }}
              />
            </svg>
            {/* Rock icon — SVG guitar pick + lightning bolt */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ filter: `drop-shadow(0 0 8px ${getRockColor()})` }}>
              <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
                {/* Guitar pick shape */}
                <path d="M20 4 C28 4 34 10 34 18 C34 26 20 38 20 38 C20 38 6 26 6 18 C6 10 12 4 20 4 Z"
                  fill={getRockColor()} opacity="0.18" />
                <path d="M20 4 C28 4 34 10 34 18 C34 26 20 38 20 38 C20 38 6 26 6 18 C6 10 12 4 20 4 Z"
                  stroke={getRockColor()} strokeWidth="1.5" fill="none" opacity="0.7" />
                {/* Lightning bolt inside */}
                <polygon points="23,8 15,21 20,21 17,33 25,19 20,19"
                  fill={getRockColor()} opacity="0.95" />
              </svg>
            </div>
          </div>
          <div className="text-xs font-bold tracking-widest font-orbitron" style={{ color: getRockColor() }}>ROCK METER</div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-200" style={{ width: `${displayRockMeter}%`, background: getRockColor(), boxShadow: `0 0 8px ${getRockColor()}` }} />
          </div>
        </div>
      </div>

      {/* TOUCH FRET PADS (mobile) — invisible overlay on the bottom 1/4 of canvas, split into 4 zones */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10 flex" style={{ width: 340, height: 100 }}>
        {[0, 1, 2, 3].map(lane => (
          <div
            key={lane}
            className="flex-1 h-full cursor-pointer select-none"
            onMouseDown={() => { heldFretsRef.current[lane] = true; setFretVisual(p => { const n=[...p]; n[lane]=true; return n; }); }}
            onMouseUp={() => { heldFretsRef.current[lane] = false; setFretVisual(p => { const n=[...p]; n[lane]=false; return n; }); }}
            onMouseLeave={() => { heldFretsRef.current[lane] = false; setFretVisual(p => { const n=[...p]; n[lane]=false; return n; }); }}
            onTouchStart={e => { e.preventDefault(); heldFretsRef.current[lane] = true; setFretVisual(p => { const n=[...p]; n[lane]=true; return n; }); }}
            onTouchEnd={e => { e.preventDefault(); heldFretsRef.current[lane] = false; setFretVisual(p => { const n=[...p]; n[lane]=false; return n; }); }}
          />
        ))}
      </div>

      {/* STRUM BAR — minimal, at very bottom */}
      <button
        className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 w-[340px] h-9 flex items-center justify-center gap-3 bg-white/[0.04] border-t border-white/10 backdrop-blur-sm hover:bg-white/[0.08] transition-colors select-none"
        onMouseDown={strum}
        onTouchStart={e => { e.preventDefault(); strum(); }}
      >
        <span className="text-white/30 text-[10px] font-bold tracking-[0.25em] font-orbitron">STRUM</span>
        <kbd className="text-white/20 text-[10px] bg-white/[0.06] px-2 py-0.5 rounded border border-white/10 font-mono">ENTER</kbd>
      </button>

      {/* HIT FEEDBACK */}
      <AnimatePresence>
        {store.hitFlash?.active && (
          <motion.div
            key={store.hitFlash.time}
            initial={{ opacity: 0, y: 30, scale: 0.4 }}
            animate={{ opacity: 1, y: 0, scale: 1.15 }}
            exit={{ opacity: 0, y: -40, scale: 1.4 }}
            transition={{ duration: 0.28 }}
            className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center z-20 pointer-events-none"
            style={{ bottom: '22%' }}
          >
            <div
              className="text-5xl font-black italic font-orbitron drop-shadow-[0_0_30px_currentColor]"
              style={{ color: store.hitFlash.result === 'miss' ? '#ff3b30' : store.hitFlash.result === 'perfect' ? '#ffd60a' : store.hitFlash.result === 'great' ? '#30d158' : '#0a84ff' }}
            >
              {store.hitFlash.result === 'perfect' ? 'PERFECT!' : store.hitFlash.result === 'great' ? 'GREAT!' : store.hitFlash.result === 'good' ? 'GOOD!' : 'MISS'}
            </div>
            {store.hitFlash.result !== 'miss' && (
              <div className="text-2xl font-bold text-white drop-shadow-[0_0_12px_white] mt-1">
                +{store.hitFlash.result === 'perfect' ? 150 * displayMultiplier : store.hitFlash.result === 'great' ? 100 * displayMultiplier : 50 * displayMultiplier}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* START BUTTON */}
      {gamePhase === 'menu' && songLoaded && (
        <div className="absolute left-1/2 -translate-x-1/2 z-20" style={{ bottom: '12%' }}>
          <motion.button
            onClick={startCountdown}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
            className="px-14 py-4 bg-gradient-to-r from-pink-600 to-pink-500 text-white font-black italic text-2xl rounded-full shadow-[0_0_40px_rgba(255,42,109,0.9)] transition-shadow font-orbitron"
          >
            LET'S ROCK
          </motion.button>
        </div>
      )}

      {/* COUNTDOWN OVERLAY */}
      <AnimatePresence>
        {gamePhase === 'countdown' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm z-40 flex flex-col items-center justify-center"
          >
            {songMeta && (
              <div className="text-white/60 text-lg font-rajdhani mb-8">
                {songMeta.title} — {songMeta.artist}
              </div>
            )}
            <motion.div
              key={countdownValue}
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`font-orbitron font-black ${countdownValue === 0 ? 'text-[#00ff9d] text-8xl' : 'text-white text-9xl'}`}
              style={{ textShadow: countdownValue === 0 ? '0 0 40px #00ff9d' : '0 0 40px white' }}
            >
              {countdownValue === 0 ? 'GO!' : countdownValue}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PAUSE MENU */}
      <AnimatePresence>
        {gamePhase === 'paused' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-6 bg-[#0a0a1f] p-10 rounded-xl border border-white/20 w-72">
              <h2 className="text-4xl font-black font-orbitron tracking-widest text-white">PAUSED</h2>
              {songMeta && <p className="text-sm text-gray-400 text-center">{songMeta.title}</p>}
              <div className="flex flex-col gap-3 w-full">
                <button onClick={resumeGame} className="px-6 py-3 bg-[#00ff9d] text-black font-bold rounded font-rajdhani hover:bg-[#00ff9d]/80 transition-colors">
                  ▶ RESUME
                </button>
                <button
                  onClick={() => { stopGameLoop(); try { sourceNodeRef.current?.stop(); } catch {} store.resetGame(); setGamePhase('menu'); gamePhaseRef.current = 'menu'; }}
                  className="px-6 py-3 bg-white/10 text-white font-bold rounded font-rajdhani hover:bg-white/20 transition-colors"
                >
                  ◀ QUIT TO MENU
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RESULTS SCREEN */}
      <AnimatePresence>
        {gamePhase === 'results' && lastSession && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center"
          >
            <div className="bg-[#0a0a1f] border border-cyan-500 rounded-2xl p-8 max-w-xl w-full shadow-[0_0_50px_rgba(5,217,232,0.3)] text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-purple-500" />

              {lastSession.reason === 'failed' && (
                <div className="text-red-400 font-bold mb-2 font-orbitron">💀 ROCK METER EMPTY</div>
              )}

              <div className={`text-7xl font-black font-orbitron mb-1 ${lastSession.grade === 'S' ? 'text-yellow-400' : lastSession.grade === 'A' ? 'text-green-400' : lastSession.grade === 'B' ? 'text-cyan-400' : lastSession.grade === 'C' ? 'text-blue-400' : 'text-gray-400'}`}
                style={{ textShadow: '0 0 30px currentColor' }}
              >
                {lastSession.grade}
              </div>

              <h1 className="text-2xl font-black font-orbitron text-white mb-1">PERFORMANCE</h1>
              <div className="text-sm text-gray-400 mb-6">{lastSession.songTitle}</div>

              <div className="grid grid-cols-2 gap-4 mb-6 text-left">
                <div className="bg-black/50 p-4 rounded-xl border border-gray-800">
                  <div className="text-gray-400 text-xs mb-1">FINAL SCORE</div>
                  <div className="text-3xl font-bold text-pink-500">{lastSession.score.toLocaleString()}</div>
                </div>
                <div className="bg-black/50 p-4 rounded-xl border border-gray-800">
                  <div className="text-gray-400 text-xs mb-1">ACCURACY</div>
                  <div className="text-3xl font-bold text-cyan-400">{lastSession.accuracy.toFixed(1)}%</div>
                </div>
                <div className="col-span-2 grid grid-cols-4 gap-3 bg-black/50 p-4 rounded-xl border border-gray-800 text-center">
                  <div><div className="text-yellow-400 text-xs font-bold mb-1">PERFECT</div><div className="text-lg">{lastSession.perfectCount}</div></div>
                  <div><div className="text-green-400 text-xs font-bold mb-1">GREAT</div><div className="text-lg">{lastSession.greatCount}</div></div>
                  <div><div className="text-blue-400 text-xs font-bold mb-1">GOOD</div><div className="text-lg">{lastSession.goodCount}</div></div>
                  <div><div className="text-red-500 text-xs font-bold mb-1">MISS</div><div className="text-lg">{lastSession.missCount}</div></div>
                </div>
              </div>

              {lastSession.score > lastSession.previousHighScore && lastSession.score > 0 && (
                <div className="text-yellow-400 font-bold font-orbitron mb-4">🏆 NEW HIGH SCORE!</div>
              )}

              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  onClick={() => startCountdown()}
                  className="px-6 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-lg transition-all"
                >
                  ▶ Play Again
                </button>
                <button
                  onClick={() => {
                    const text = `I scored ${lastSession.score.toLocaleString()} on AI Rock Hero! Grade: ${lastSession.grade} | Accuracy: ${lastSession.accuracy.toFixed(1)}%`;
                    if (navigator.share) navigator.share({ title: 'AI Rock Hero Score', text });
                    else { navigator.clipboard.writeText(text); }
                  }}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-all"
                >
                  📱 Share
                </button>
                <button
                  onClick={() => { store.resetGame(); setGamePhase('menu'); gamePhaseRef.current = 'menu'; setLastSession(null); }}
                  className="px-6 py-2.5 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded-lg transition-all"
                >
                  ◀ Menu
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
