# AI Rock Hero — Northcrypto Hackathon Presentation

## What is AI Rock Hero?

**AI Rock Hero** is a browser-based, AI-powered Guitar Hero-style rhythm game built with React, TypeScript, and Three.js. Players import any song — from YouTube or a local file — and the AI engine automatically generates a playable note chart synced to the real beat of the music. No manual charting, no static song library: every song becomes playable in seconds.

---

## What Problem Does It Solve?

Traditional rhythm games (Guitar Hero, Clone Hero) require hundreds of hours of human charting work per song, locking players into a fixed licensed catalog. **AI Rock Hero removes that barrier entirely.**

- Any YouTube URL → playable guitar chart in under 10 seconds
- Any audio file (MP3, WAV, OGG, M4A) → same
- The AI analyses the actual audio waveform — not metadata — to place notes on real beats

This democratises the genre: any song, any time, zero licensing friction.

---

## Core Features

### 1. AI Beat Detection Engine
- **Energy-based analysis** over 50 ms windows of the decoded AudioBuffer
- **Adaptive local threshold** (1.6× rolling average of last 20 windows) to catch onsets across both quiet and loud songs
- Converts detected beat times into a 4-lane note chart with chord bursts on strong beats
- Falls back to a procedurally generated chart for silent or instrumental-only audio

### 2. YouTube Import (cobalt.tools integration)
- User pastes any YouTube URL
- Vite dev-proxy routes the request through `/cobalt-proxy/` → `api.cobalt.tools` (bypasses browser CORS)
- cobalt.tools returns a direct audio stream URL
- Audio decoded via Web Audio API, beat-detected, chart generated
- Synthesised-oscillator fallback if the network fetch fails

### 3. Local File Import
- Drag-and-drop or file picker accepts MP3, WAV, OGG, M4A, FLAC, AAC
- Decoded with `AudioContext.decodeAudioData` — same pipeline as YouTube audio
- Full-length coverage: `generateChart(decoded.duration)` tiles the pattern for the exact song length

### 4. 3D Guitar Highway (React Three Fiber + Three.js)
- Perspective camera at `(0, 3, 5)` looking toward `(0, 0, -10)` — classic Guitar Hero view
- Four coloured lane strips with emissive materials and bloom-style glow
- Note gems: rounded 3D boxes with per-lane point lights and floor-shadow planes
- Colorblind mode: lane 0 = circle, 1 = square, 2 = triangle, 3 = diamond (shape-coded)
- Speed settings: Slow / Medium / Fast / Expert (10–25 units/s)

### 5. Fret Controls
- **Keyboard:** A / S / D / F for lanes 0–3, Space to strum
- **On-screen guitar buttons:** pill-shaped fret pads with neon lane-colour glow
  - Pressed state: fills with lane colour, intense outer glow, scale + translate
  - Key hint (1/2/3/4) visible only on hover/press — clean at a glance
- **Chord-aware strum:** all held frets are checked simultaneously on each strum

### 6. Timing & Scoring
| Window | Rating | Points |
|--------|--------|--------|
| ±30 ms | PERFECT | 150 × multiplier |
| ±60 ms | GREAT | 100 × multiplier |
| ±90 ms | GOOD | 50 × multiplier |
| > 90 ms | MISS | 0, combo reset |

- Combo multiplier: 1× → 2× (10 combo) → 3× (25) → 4× (50)
- Rock Meter: rises on hits, drops on misses; game over at 0%
- Accuracy formula: `(perfect×100 + great×70 + good×40) / totalNotes`

### 7. Full Game Flow
```
Menu → Analyze → 3-2-1-GO Countdown → Playing → Results
                                     ↓ Pause/Resume
                                     ↓ Quit → Results
```
- Countdown overlay with animated scale
- Live HUD: Score, Combo, Multiplier, Accuracy, Rock Meter progress bar
- Hit feedback text (PERFECT / GREAT / GOOD / MISS) with per-rating neon colours
- Screen shake on MISS via CSS animation
- Results screen: grade (S/A/B/C/D), all stats, New High Score banner

### 8. Persistence
- **IndexedDB** (`AIRockHeroDB`): stores full audio ArrayBuffer + chart per song — survives refresh, handles files up to ~500 MB
- **Zustand + localStorage** (`airockhero-storage`): settings, song metadata, player stats
- Session history (last 50 sessions), per-song high scores, lifetime stats

### 9. Stats & Leaderboard
- StatsTab shows: songs played, accuracy, best combo, total playtime, top songs by high score
- WalletTab reads real session scores from localStorage and renders a live leaderboard
- Web3 wallet connect (RainbowKit + wagmi) for future on-chain score submission

### 10. Accessibility & Settings
- Audio latency compensation (adjustable ms offset)
- Note speed (4 levels)
- SFX volume / Music volume (0–100%)
- Reduced motion mode
- Colorblind mode (shape-coded notes)
- Fullscreen toggle
- FPS counter overlay

---

## Architecture

```
src/
├── App.tsx                 — Tab router, phase gate
├── store.ts                — Zustand: ephemeral GameState + persisted PersistedState
├── main.tsx                — React root, RainbowKit providers
├── index.css               — Global styles: glassmorphism HUD, fret pads, animations
├── ConcertBackground.tsx   — Canvas particle concert atmosphere
├── ParticleSystem.tsx      — Hit particle burst system
├── lib/
│   └── songStorage.ts      — IndexedDB CRUD (upsertSong, getAllSongs, getSong, deleteSong)
└── components/
    ├── Navigation.tsx       — Top nav with logo (3-column symmetric layout)
    ├── PlayTab.tsx          — Main game: analysis, 3D highway, game loop, controls
    ├── SongsTab.tsx         — Song library management
    ├── StatsTab.tsx         — Player statistics dashboard
    ├── SettingsTab.tsx      — Full settings panel
    └── WalletTab.tsx        — Web3 wallet + score leaderboard
```

**Key architectural decisions:**
- `gameRef` mutable object for score/combo/rockMeter/pendingNotes — zero re-render pressure during 60fps game loop
- `heldFretsRef` for chord detection — React state is too slow for simultaneous keydown events
- `pendingNotes` shrinks as notes are consumed — miss detection is O(n) with n→0 over time
- Score/combo UI updates at 10 fps via `setInterval` — decoupled from the 60 fps game loop

---

## Northcrypto Hackathon Alignment

| Criterion | AI Rock Hero |
|-----------|-------------|
| **Novel use of AI** | Real-time audio analysis generates unique note charts per song |
| **User engagement** | Addictive gameplay loop keeps users on the platform |
| **Web3 integration** | RainbowKit wallet connect, score storage ready for on-chain leaderboard |
| **Technical depth** | Web Audio API, IndexedDB, React Three Fiber, energy-based DSP |
| **Polish** | Full game flow, neon visual design, accessibility modes, persistence |

---

## Demo Flow

1. Open the app at `http://localhost:5174`
2. Navigate to **PLAY** tab
3. Paste a YouTube URL (e.g. any pop/rock track) → click **Analyze**
4. Watch the 3-2-1-GO countdown
5. Hold fret keys A/S/D/F + press Space to strum on beat
6. See PERFECT/GREAT/GOOD/MISS feedback with score and combo
7. Complete the song → view Results screen with grade and stats
8. Navigate to **STATS** to see session history
9. Navigate to **WALLET** to connect Web3 wallet and view leaderboard

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript + Vite |
| 3D / Graphics | React Three Fiber, Three.js, @react-three/drei |
| State | Zustand (ephemeral + persisted) |
| Animation | Framer Motion |
| Audio | Web Audio API (AudioContext, AudioBuffer, AnalyserNode) |
| Persistence | IndexedDB (audio), localStorage (settings/stats) |
| Styling | Tailwind CSS v4 + custom CSS (glassmorphism) |
| Fonts | Orbitron, Rajdhani (Google Fonts) |
| Web3 | RainbowKit + wagmi |
| YouTube | cobalt.tools API via Vite dev-proxy |

---

*Built for the Northcrypto Hackathon — AI Rock Hero turns any song into a playable guitar chart in seconds.*
