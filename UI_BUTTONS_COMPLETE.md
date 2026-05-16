# 🎮 AI ROCK HERO — UI Completeness Skill
> **Zero mock buttons. Zero dead links. Every interaction wired end-to-end.**

---

## ☠️ PRIME DIRECTIVE

**EVERY button, tab, link, input, toggle, and menu item MUST be fully functional.**
If it renders on screen, it works. No exceptions.

Before shipping ANY UI change, run this audit:
```
grep -n "TODO\|FIXME\|mock\|placeholder\|coming soon\|disabled\|onClick={() => {}}\|href=\"#\"\|href=\"\"\|console.log('click')" src/**/*.tsx
```
Result must be zero matches. Every single one is a bug.

---

## 📍 HEADER NAV — All 5 tabs wired

```
[ ▶ PLAY ]  [ 🎵 SONGS ]  [ 📊 STATS ]  [ ⚙ SETTINGS ]  [ Ξ WALLET ]
```

### PLAY tab
- **What it does**: Shows the main game view (highway + left panel + right HUD)
- **State**: `activeTab === 'play'`
- **Always renders**: highway canvas, song selector panel, score HUD
- **No sub-navigation needed**

```tsx
// Tab click handler
const [activeTab, setActiveTab] = useState<'play'|'songs'|'stats'|'settings'|'wallet'>('play');

<nav>
  {(['play','songs','stats','settings','wallet'] as const).map(tab => (
    <button
      key={tab}
      className={`nav-tab ${activeTab === tab ? 'active' : ''}`}
      onClick={() => setActiveTab(tab)}
    >
      <TabIcon tab={tab} />
      {tab.toUpperCase()}
    </button>
  ))}
</nav>
```

### SONGS tab — Full song library
```tsx
// Songs tab renders:
// 1. Search bar (filters songs list in real time)
// 2. List of previously analyzed songs (stored in localStorage)
// 3. Each row: [Thumbnail] [Title - Artist] [BPM] [Duration] [▶ Play] [🗑 Delete]
// 4. [▶ Play] → loads song into game, switches to PLAY tab, starts analysis if needed
// 5. [🗑 Delete] → removes from localStorage after confirm dialog
// 6. Empty state: "No songs yet. Paste a YouTube URL on the Play tab to add your first song."

interface SavedSong {
  id: string;           // hash of URL
  url: string;
  title: string;
  artist: string;
  duration: number;     // seconds
  bpm: number;
  thumbnailUrl: string;
  chartData: NoteChart; // cached — no re-analysis needed
  addedAt: number;
  highScore: number;
  timesPlayed: number;
}

// Load on mount
const [songs, setSongs] = useState<SavedSong[]>(() =>
  JSON.parse(localStorage.getItem('airockhero_songs') ?? '[]')
);

// Play button
const playSavedSong = (song: SavedSong) => {
  loadSong(song);       // sets current song state
  setActiveTab('play'); // switch to play tab
  startGame();          // begin immediately
};
```

### STATS tab — Real numbers, no placeholders
```tsx
// Stats tab renders live data from localStorage:
// - Total songs played (count)
// - Total notes hit / missed (lifetime)
// - Average accuracy % (lifetime)
// - Best combo (all time)
// - Total play time (formatted: "3h 24m")
// - Top 5 songs by high score (table)
// - Accuracy over last 10 sessions (sparkline chart — canvas or SVG)

// ALL numbers come from real gameplay data stored after each session.
// If no sessions yet: show "Play your first song to see your stats!"
// NEVER show hardcoded numbers like "96.4%" or "256 combo"

interface PlayerStats {
  totalSongsPlayed: number;
  totalNotesHit: number;
  totalNotesMissed: number;
  bestCombo: number;
  totalPlaytimeSeconds: number;
  sessions: SessionResult[];
}

const stats: PlayerStats = JSON.parse(
  localStorage.getItem('airockhero_stats') ?? '{"totalSongsPlayed":0,"totalNotesHit":0,"totalNotesMissed":0,"bestCombo":0,"totalPlaytimeSeconds":0,"sessions":[]}'
);
```

### SETTINGS tab — Every toggle functional
```tsx
// Settings tab: all values read from / written to localStorage immediately on change

interface GameSettings {
  audioLatencyMs: number;      // -200 to +200ms, default 0
  noteSpeed: 'slow'|'medium'|'fast'|'expert';  // affects scroll speed
  sfxVolume: number;           // 0-100
  musicVolume: number;         // 0-100
  showFPS: boolean;            // overlay FPS counter
  reducedMotion: boolean;      // disables particles + screen shake
  colorblindMode: boolean;     // adds shape indicators to notes
  fullscreen: boolean;         // triggers document.fullscreenElement
}

// Every input wired:
<input
  type="range" min="-200" max="200" step="5"
  value={settings.audioLatencyMs}
  onChange={e => updateSetting('audioLatencyMs', Number(e.target.value))}
/>

// Fullscreen toggle — actually calls the API:
const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};

// Latency test button — plays a click sound and asks user to tap to measure latency:
<button onClick={runLatencyTest}>🎯 Auto-detect latency</button>
// Shows: "Tap any key when you hear the click" → measures roundtrip → sets audioLatencyMs
```

### WALLET tab — Real Web3, not mock
```tsx
// Wallet tab states:
// A) Not connected: [Connect Wallet] button → opens RainbowKit modal
// B) Connected: shows address, ETH balance, game token balance
// C) Score submission: sign + submit last session score
// D) Leaderboard: top 20 scores this week (fetched from backend or contract)

// State A — not connected:
<div className="wallet-connect-prompt">
  <h2>Connect to compete</h2>
  <p>Submit your scores to the global leaderboard and compete for Northcrypto prizes.</p>
  <ConnectButton />  {/* RainbowKit — real modal, not fake */}
  <p className="fine-print">
    Prize eligibility requires a verified Northcrypto customer account.
    <a href="https://northcrypto.com" target="_blank" rel="noopener">Create account →</a>
  </p>
</div>

// State B — connected:
<div className="wallet-info">
  <p>Connected: {address?.slice(0,6)}...{address?.slice(-4)}</p>
  <p>Network: {chain?.name}</p>
  {lastSession && (
    <button onClick={submitScore}>
      Submit score: {lastSession.score.toLocaleString()} pts
    </button>
  )}
</div>

// State D — leaderboard:
// Fetched from API, displayed as real table
// Columns: Rank | Player (truncated address) | Song | Score | Date
// If player is in top 20 → their row highlighted
```

---

## 📋 LEFT PANEL — All 3 sections wired

### Section 1: SELECT YOUR SONG

#### YouTube URL tab
```tsx
// Input field
<input
  type="url"
  placeholder="https://youtube.com/watch?v=..."
  value={youtubeUrl}
  onChange={e => setYoutubeUrl(e.target.value)}
  onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
/>

// Paste button (clipboard icon inside input)
<button onClick={async () => {
  const text = await navigator.clipboard.readText();
  setYoutubeUrl(text);
}}>📋</button>

// ANALYZE TRACK button — states:
// idle:     "⚡ ANALYZE TRACK"   → onClick: handleAnalyze()
// loading:  "Analyzing... 34%"   → disabled, shows real progress
// error:    "⚠ Invalid URL"      → red border, error message below
// done:     "✓ Chart Ready"      → green, auto-starts game after 1s

const handleAnalyze = async () => {
  if (!youtubeUrl.trim()) return;
  if (!isValidYouTubeUrl(youtubeUrl)) {
    setError('Please enter a valid YouTube URL');
    return;
  }
  setAnalysisState('loading');
  try {
    await analyzeTrack(youtubeUrl);
    setAnalysisState('done');
    setTimeout(startGame, 1000);
  } catch (err) {
    setAnalysisState('error');
    setError(err.message);
  }
};
```

#### UPLOAD AUDIO tab
```tsx
// Clicking the tab switches to file upload mode — tab switch is real
const [inputMode, setInputMode] = useState<'youtube'|'upload'>('youtube');

// Upload area — drag & drop + click to browse
<div
  className={`upload-zone ${isDragging ? 'dragging' : ''}`}
  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
  onDragLeave={() => setIsDragging(false)}
  onDrop={handleFileDrop}
  onClick={() => fileInputRef.current?.click()}
>
  <input
    ref={fileInputRef}
    type="file"
    accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a"
    onChange={e => handleFileSelect(e.target.files?.[0])}
    style={{ display: 'none' }}
  />
  <p>{isDragging ? 'Drop it!' : 'Drop audio file here or click to browse'}</p>
  <p className="hint">MP3, WAV, FLAC, OGG, M4A supported</p>
</div>

// After file selected → shows filename + size + [ANALYZE] button
// File is decoded via AudioContext.decodeAudioData — no server needed
```

### Section 2: AI ANALYSIS ENGINE
```tsx
// Shows real-time analysis progress — never a fake progress bar
// States:
// idle:      Pulsing waveform icon + "Awaiting input..."
// analyzing: Animated AI brain icon + real step messages + real % progress
//            Steps: "Fetching audio..." → "Decoding waveform..." →
//                   "Detecting BPM..." → "Finding beats..." →
//                   "Generating note chart..." → "Optimizing for fun..."
// done:      Green checkmark + "Chart ready! Starting in 1s..."
// error:     Red X + error message + [Retry] button

// Progress is calculated from actual work done:
// fetchAudio: 0-15%
// decode:     15-30%
// bpmDetect:  30-50%
// beatFind:   50-70%
// chartGen:   70-90%
// optimize:   90-100%

// [Retry] button on error:
<button onClick={() => { setError(null); setAnalysisState('idle'); }}>
  ↺ Try again
</button>
```

### Section 3: TRACK INFO
```tsx
// Shows real metadata fetched from YouTube or audio file
// When no song loaded: dashes (--) for all fields — no fake data

// When song loaded:
interface TrackInfo {
  title: string;       // Real song title
  artist: string;      // Real artist name
  duration: number;    // Real duration in seconds, displayed as "4:52"
  bpm: number;         // Detected from audio analysis
  thumbnailUrl: string;// YouTube thumbnail or generated waveform image
}

// Waveform visualization at bottom of section:
// Canvas element showing real decoded audio waveform
// Color: lane-red gradient, mirrors audio amplitude
// Clicking waveform → seeks playback position (if song is loaded)

const seekToPosition = (clickX: number, canvasWidth: number) => {
  const ratio = clickX / canvasWidth;
  const seekTime = ratio * currentSong.duration;
  audioEngine.seekTo(seekTime);
};
```

---

## 🎮 GAMEPLAY CONTROLS

### Fret buttons [1][2][3][4]
```tsx
// Both keyboard AND on-screen buttons work identically
// Keyboard: keys '1','2','3','4' map to lanes 0,1,2,3
// On-screen: touch/click events map to same lanes

// Key down → fret held (visual: button glows, scale 1.1)
// Key up   → fret released (visual: button returns to normal)
// ENTER    → strum/pick

useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return; // ignore held key repeat
    switch(e.key) {
      case '1': pressFret(0); break;
      case '2': pressFret(1); break;
      case '3': pressFret(2); break;
      case '4': pressFret(3); break;
      case 'Enter': strum(); break;
      case 'Escape': pauseGame(); break;
      case 'p': case 'P': pauseGame(); break;
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    switch(e.key) {
      case '1': releaseFret(0); break;
      case '2': releaseFret(1); break;
      case '3': releaseFret(2); break;
      case '4': releaseFret(3); break;
    }
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}, [gameState]);

// On-screen fret buttons — touch support:
<button
  className={`fret-btn lane-${i} ${heldFrets[i] ? 'pressed' : ''}`}
  onMouseDown={() => pressFret(i)}
  onMouseUp={() => releaseFret(i)}
  onTouchStart={e => { e.preventDefault(); pressFret(i); }}
  onTouchEnd={e => { e.preventDefault(); releaseFret(i); }}
>
  {i + 1}
</button>
```

### ENTER / Strum button
```tsx
// On-screen strum button — actually triggers strumming
<button
  className="strum-btn"
  onMouseDown={strum}
  onTouchStart={e => { e.preventDefault(); strum(); }}
>
  ENTER — Strum (Pick)
</button>
```

---

## ⏸️ PAUSE MENU — Full implementation

```tsx
// Triggered by: ESC key, P key, or clicking pause icon during gameplay
// Pauses: AudioContext, game loop, note scroll
// Renders overlay with:

const PauseMenu = () => (
  <div className="pause-overlay">
    <div className="pause-modal">
      <h2>PAUSED</h2>
      <div className="pause-song-info">
        {currentSong.title} — {formatTime(currentTime)} / {formatTime(currentSong.duration)}
      </div>

      <button onClick={resumeGame}>▶ Resume</button>
      {/* Actually resumes AudioContext and game loop */}

      <button onClick={restartSong}>↺ Restart Song</button>
      {/* Seeks audio to 0, resets score/combo, regenerates notes from same chart */}

      <button onClick={() => { stopGame(); setActiveTab('play'); }}>
        ◀ Back to Menu
      </button>
      {/* Stops audio, clears game state, returns to song selector */}

      <div className="pause-settings">
        <label>Music volume</label>
        <input type="range" min="0" max="100"
          value={settings.musicVolume}
          onChange={e => updateSetting('musicVolume', Number(e.target.value))}
        />
        <label>Note speed</label>
        <select value={settings.noteSpeed}
          onChange={e => updateSetting('noteSpeed', e.target.value as any)}>
          <option value="slow">Slow</option>
          <option value="medium">Medium</option>
          <option value="fast">Fast</option>
          <option value="expert">Expert</option>
        </select>
      </div>
    </div>
  </div>
);
```

---

## 🏁 RESULTS SCREEN — After song ends

```tsx
// Shown when: last note passes + audio ends naturally
// NOT shown if player quits mid-song

const ResultsScreen = ({ session }: { session: SessionResult }) => {
  const grade = calcGrade(session.accuracy); // S/A/B/C/D based on accuracy

  return (
    <div className="results-overlay">
      <h1 className={`grade grade-${grade}`}>{grade}</h1>
      <h2>{session.songTitle}</h2>

      <div className="result-stats">
        <stat>SCORE: {session.score.toLocaleString()}</stat>
        <stat>MAX COMBO: {session.maxCombo}</stat>
        <stat>ACCURACY: {session.accuracy.toFixed(1)}%</stat>
        <stat>PERFECT: {session.perfectCount}</stat>
        <stat>GREAT: {session.greatCount}</stat>
        <stat>GOOD: {session.goodCount}</stat>
        <stat>MISS: {session.missCount}</stat>
      </div>

      {session.score > session.previousHighScore && (
        <div className="new-highscore">🏆 NEW HIGH SCORE!</div>
      )}

      {/* All buttons fully wired: */}
      <button onClick={restartSong}>▶ Play Again</button>

      <button onClick={() => setActiveTab('songs')}>🎵 Song Library</button>

      <button onClick={submitScoreToLeaderboard}>
        {isWalletConnected ? '📤 Submit Score' : '🔗 Connect Wallet to Submit'}
      </button>
      {/* If not connected → opens RainbowKit wallet modal */}
      {/* If connected → signs score message + POSTs to leaderboard API */}

      <button onClick={shareScore}>
        📱 Share Score
        {/* Web Share API → native share sheet on mobile */}
        {/* Fallback: copies "I scored X on AI Rock Hero! airockhero.com" to clipboard */}
      </button>

      <button onClick={() => setActiveTab('play')}>◀ Back to Menu</button>
    </div>
  );
};

// Save session to localStorage immediately on results screen mount:
useEffect(() => {
  saveSessionToStats(session);  // updates PlayerStats in localStorage
  saveSongHighScore(session);   // updates SavedSong.highScore if new record
}, []);
```

---

## 🎵 WAVEFORM / PROGRESS BAR

```tsx
// Top center of game view — shows during gameplay
// Clicking it seeks to that position in the song

// Left timestamp: current time
// Right timestamp: total duration
// Pink progress fill: current position / total duration
// Waveform texture: real audio amplitude data (pre-computed during analysis)

const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
  if (gamePhase !== 'playing') return;
  const rect = e.currentTarget.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  seekTo(ratio * currentSong.duration);
  // seekTo: AudioContext offset + clear notes already passed + re-sync note scroll
};
```

---

## 🔊 AUDIO CONTROLS

```tsx
// Volume slider — actually changes AudioContext gain node
const gainNode = useRef<GainNode>();

const setMusicVolume = (vol: number) => {  // vol: 0-100
  if (gainNode.current) {
    gainNode.current.gain.setValueAtTime(vol / 100, audioCtx.currentTime);
  }
  updateSetting('musicVolume', vol);
};

// Mute toggle (if added) — sets gain to 0, restores on unmute
```

---

## 🏆 LEADERBOARD

```tsx
// Shown in WALLET tab, also accessible from Results screen
// Tabs: [ This Week ] [ This Month ] [ All Time ]
// Each tab fetches fresh data — not cached mock

const fetchLeaderboard = async (period: 'week'|'month'|'all') => {
  setLeaderboardLoading(true);
  try {
    const res = await fetch(`/api/leaderboard?period=${period}`);
    const data = await res.json();
    setLeaderboard(data.entries);
  } catch {
    setLeaderboardError('Could not load leaderboard. Check your connection.');
  } finally {
    setLeaderboardLoading(false);
  }
};

// Loading state: skeleton rows (animated pulse) — not spinner
// Error state: "Could not load" + [Retry] button
// Empty state: "No scores yet this week. Be the first!"

// Each leaderboard row:
// [Rank] [Player address truncated] [Song] [Score] [Accuracy] [Date]
// Current player's row: highlighted with neon border
// Top 3: 🥇🥈🥉 emoji prefix on rank

// "Create Northcrypto account" CTA always visible below leaderboard:
<div className="northcrypto-cta">
  <p>Prize eligibility requires a verified Northcrypto customer account.</p>
  <a href="https://northcrypto.com" target="_blank" rel="noopener noreferrer">
    Create your Northcrypto account →
  </a>
</div>
```

---

## 🔍 PRE-SHIP UI AUDIT CHECKLIST

Run this before every commit. Every item must be ✅.

### Navigation
- [ ] PLAY tab → renders game view
- [ ] SONGS tab → renders song library with real data
- [ ] STATS tab → renders real stats from localStorage
- [ ] SETTINGS tab → renders all settings, every input saves immediately
- [ ] WALLET tab → renders wallet state (connected/not), real leaderboard

### Left Panel
- [ ] YouTube URL input accepts text
- [ ] Clipboard paste button reads from clipboard
- [ ] YouTube URL tab ↔ Upload Audio tab toggle works
- [ ] Upload zone accepts drag & drop
- [ ] Upload zone accepts click-to-browse
- [ ] ANALYZE TRACK button disabled when input empty
- [ ] ANALYZE TRACK shows real progress %
- [ ] ANALYZE TRACK error state shows message + Retry button
- [ ] Track info shows real metadata after analysis
- [ ] Waveform is real audio data, not decorative

### Gameplay
- [ ] Keys 1/2/3/4 trigger fret press (visual feedback)
- [ ] ENTER triggers strum
- [ ] On-screen fret buttons work (mouse + touch)
- [ ] ESC / P pauses game
- [ ] Pause menu Resume works
- [ ] Pause menu Restart works
- [ ] Pause menu Back to Menu works
- [ ] Pause volume slider changes audio
- [ ] Pause note speed selector changes scroll speed

### Results Screen
- [ ] Shows after song ends naturally (not on quit)
- [ ] All stats are real from that session
- [ ] Grade (S/A/B/C/D) reflects real accuracy
- [ ] High score banner shows when new record
- [ ] Play Again restarts same song
- [ ] Song Library → switches to SONGS tab
- [ ] Submit Score: if no wallet → opens wallet modal
- [ ] Submit Score: if wallet → signs + submits
- [ ] Share Score: calls Web Share API or copies to clipboard
- [ ] Back to Menu → PLAY tab

### Settings
- [ ] Audio latency slider changes value + saves
- [ ] Note speed selector changes speed immediately
- [ ] Music volume slider changes audio gain
- [ ] SFX volume slider changes SFX gain
- [ ] Show FPS toggle shows/hides FPS overlay
- [ ] Fullscreen toggle calls requestFullscreen API
- [ ] Colorblind mode adds shape indicators to notes
- [ ] Auto-detect latency button runs latency test
- [ ] All settings persist after page refresh (localStorage)

### Wallet
- [ ] Connect Wallet button opens real wallet modal
- [ ] After connect: shows real address
- [ ] Submit score signs real message with wallet
- [ ] Leaderboard This Week / Month / All Time tabs all fetch data
- [ ] Northcrypto CTA link opens northcrypto.com in new tab

---

## 🚫 ZERO TOLERANCE — INSTANT BUG

These patterns are BUGS, not TODOs:

```
onClick={() => {}}                    // dead button
onClick={() => console.log('click')}  // debug stub
href="#"                              // dead link
href=""                               // dead link
disabled={true} // (without reason)   // unexplained disable
// TODO: implement this               // not shipped
alert('Coming soon')                  // placeholder
toast('Feature coming soon')          // placeholder
return null // (on a visible tab)     // empty view
<div>Coming soon</div>               // placeholder
```

---

## 🧪 MANUAL QA FLOW

After implementing all buttons, do this full run-through:

```
1. Open game in fresh browser (no localStorage)
2. Verify: SONGS tab shows empty state message
3. Verify: STATS tab shows "Play your first song" message
4. Verify: WALLET tab shows Connect button
5. Click SETTINGS → change note speed → refresh → setting persists
6. Return to PLAY → paste real YouTube URL → click Analyze
7. Watch real progress % increment through all steps
8. Song starts → play 20+ notes → hit some, miss some
9. Press P → pause menu appears → change volume → Resume
10. Play to end of full song → Results screen appears
11. Verify real score / accuracy / combo on results
12. Click Submit Score → wallet modal opens (if not connected)
13. Click Share Score → share sheet or clipboard copy
14. Click Song Library → SONGS tab shows the song just played
15. STATS tab now shows real numbers from that session
16. Click the song in SONGS tab → Play button → game starts immediately
```

All 16 steps must complete without any dead ends, errors, or placeholder text.

---

*ROCKDEV-PRIME UI Completeness Skill — Zero mocks, zero dead buttons, full end-to-end*
