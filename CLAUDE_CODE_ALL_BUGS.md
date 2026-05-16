# Claude Code — AI Rock Hero: Kaikki kriittiset bugit kerralla

## TILA KUVASTA
Peli toimii osittain:
✅ Results screen näkyy
✅ PERFECT/GREAT/GOOD/MISS lasketaan
✅ Score näkyy (37 175)
❌ Pisteet lakkaavat nousemasta kesken pelin
❌ Peli lagaa
❌ YouTube ei soi (piip piip = CORS/API ongelma)
❌ 4 simultaanista notea ei rekisteröidy
❌ Biisit eivät tallennu
❌ Pelin flow on rikki (ei selkeää start → valitse → soita → results)

---

## STEP 0 — LUE ENSIN, ÄLÄ KOSKE KOODIIN

```bash
cat src/App.tsx
cat src/App.css
find src -type f \( -name "*.ts" -o -name "*.tsx" \) | sort | xargs wc -l
```

Raportoi:
1. Miten score päivitetään tällä hetkellä? (setState vai ref?)
2. Miten YouTube audio haetaan?
3. Miten näppäinpainallukset käsitellään?
4. Onko game loop setInterval vai requestAnimationFrame?
5. Miten notet generoidaan — onko max_tokens tai aikarajoitus?

---

## BUGI #1 — PISTEET LAKKAAVAT NOUSEMASTA

### Syy
Score tallennetaan React stateen jota päivitetään game loopin sisällä.
React batching aiheuttaa sen että vain osa päivityksistä menee läpi.
Lisäksi jos note-array on rajattu, kaikki notet on jo "kulutettu" ja
hit detection ei löydä enää kohteita.

### Korjaus — kaikki game state refeihin

```typescript
// ❌ VÄÄRIN — React state game loopissa
const [score, setScore] = useState(0);
const [combo, setCombo] = useState(0);

function onHit(quality: string) {
  setScore(prev => prev + points); // batching syö päivityksiä
  setCombo(prev => prev + 1);
}

// ✅ OIKEIN — mutable ref, React state vain näyttöä varten
const gameRef = useRef({
  score: 0,
  combo: 0,
  maxCombo: 0,
  multiplier: 1,
  rockMeter: 50,
  perfectCount: 0,
  greatCount: 0,
  goodCount: 0,
  missCount: 0,
  notesHit: 0,
  notesTotal: 0,
  pendingNotes: [] as Note[],   // notet joita ei vielä osunut
  heldFrets: [false,false,false,false],
  lastRenderScore: -1,
});

// Päivitä React UI throttlattu — vain 10x sekunnissa
const uiUpdateIntervalRef = useRef<number>();
function startUISync() {
  uiUpdateIntervalRef.current = window.setInterval(() => {
    const g = gameRef.current;
    if (g.score !== g.lastRenderScore) {
      setDisplayScore(g.score);
      setDisplayCombo(g.combo);
      setDisplayMultiplier(g.multiplier);
      setDisplayRockMeter(g.rockMeter);
      g.lastRenderScore = g.score;
    }
  }, 100); // 10fps riittää score-displaylle
}
function stopUISync() {
  clearInterval(uiUpdateIntervalRef.current);
}
```

### Multiplieri nousee oikein

```typescript
function registerHit(note: Note, quality: 'PERFECT'|'GREAT'|'GOOD') {
  const g = gameRef.current;

  // Poista note pending-listasta HETI
  g.pendingNotes = g.pendingNotes.filter(n => n.id !== note.id);

  // Laske pisteet
  const basePoints = quality === 'PERFECT' ? 150 : quality === 'GREAT' ? 100 : 50;
  const points = basePoints * g.multiplier;

  g.score += points;
  g.combo += 1;
  g.maxCombo = Math.max(g.maxCombo, g.combo);
  g.notesHit += 1;

  // Multiplieri kasvaa joka 10. combo
  g.multiplier = Math.min(4, 1 + Math.floor(g.combo / 10));

  // Rock meter
  g.rockMeter = Math.min(100, g.rockMeter + 5);

  // Tilastot
  if (quality === 'PERFECT') g.perfectCount += 1;
  else if (quality === 'GREAT') g.greatCount += 1;
  else g.goodCount += 1;

  // Visuaalinen palaute — tämä saa triggeröidä setState koska ei ole loopissa
  spawnHitFeedback(note.lane, quality, points);
}

function registerMiss(note: Note) {
  const g = gameRef.current;
  g.pendingNotes = g.pendingNotes.filter(n => n.id !== note.id);
  g.combo = 0;
  g.multiplier = 1; // reset multiplier missistä
  g.rockMeter = Math.max(0, g.rockMeter - 10);
  g.missCount += 1;
  g.notesTotal += 1;
  triggerScreenShake();
  if (g.rockMeter === 0) endGame('failed');
}
```

---

## BUGI #2 — YOUTUBE EI SOI (PIIP PIIP)

### Syy
YouTube-videoita ei voi hakea suoraan selaimesta CORS-eston takia.
"Piip piip" tarkoittaa että audio context yrittää soittaa tyhjää tai
virheellistä audiobufferia.

### Ratkaisu — yt-dlp proxy tai oma backend

**Vaihtoehto A (suositeltava): Käytä cobalt.tools API:a**

```typescript
// cobalt.tools on ilmainen, CORS-vapaa YouTube audio extractor
async function fetchYouTubeAudio(youtubeUrl: string): Promise<ArrayBuffer> {
  // 1. Hae audio URL cobalt API:lta
  const cobaltRes = await fetch('https://api.cobalt.tools/api/json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      url: youtubeUrl,
      aFormat: 'mp3',
      isAudioOnly: true,
      disableMetadata: false,
    }),
  });

  if (!cobaltRes.ok) throw new Error('Could not reach audio service');
  const cobaltData = await cobaltRes.json();

  if (cobaltData.status !== 'stream' && cobaltData.status !== 'redirect') {
    throw new Error(`Audio service error: ${cobaltData.text || 'unknown'}`);
  }

  // 2. Hae itse audio
  const audioRes = await fetch(cobaltData.url);
  if (!audioRes.ok) throw new Error('Could not download audio');
  return audioRes.arrayBuffer();
}
```

**Vaihtoehto B: Oma Vite proxy (jos cobalt ei toimi)**

```typescript
// vite.config.ts — lisää proxy
export default defineConfig({
  server: {
    proxy: {
      '/yt-proxy': {
        target: 'https://api.cobalt.tools',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yt-proxy/, ''),
      },
    },
  },
});

// Käyttö:
const res = await fetch('/yt-proxy/api/json', { method: 'POST', ... });
```

**Vaihtoehto C: Jos ei mikään toimi — näytä selkeä virhe + MP3 upload fallback**

```typescript
// Älä anna pelin yrittää soittaa tyhjää bufferia
// Näytä sen sijaan selkeä virhe ja ohjaa MP3-uploadiin

async function handleYouTubeUrl(url: string) {
  setAnalysisState('loading');
  setAnalysisStep('Fetching audio...');

  try {
    const audioData = await fetchYouTubeAudio(url);
    const audioBuffer = await audioCtx.decodeAudioData(audioData);
    // success path...
  } catch (err) {
    setAnalysisState('error');
    setAnalysisError(
      'YouTube audio could not be fetched due to browser restrictions. ' +
      'Please download the MP3 and upload it directly — or try a different song.'
    );
    // Näytä upload-painike prominent
    setShowUploadFallback(true);
  }
}

// Älä KOSKAAN soita tyhjää AudioBuffer — tarkista aina:
function safeStartAudio(buffer: AudioBuffer | null) {
  if (!buffer || buffer.length === 0) {
    console.error('Tried to play empty audio buffer');
    setAnalysisError('Audio failed to load. Please try MP3 upload.');
    return false;
  }
  // ok, jatka
  return true;
}
```

---

## BUGI #3 — 4 SIMULTAANISTA NOTEA EI REKISTERÖIDY

### Syy
Hit detection tarkistaa yhden kaistan kerrallaan tai vaatii
että vain yksi näppäin on alas. "Chord" (4 notea samaan aikaan)
ei toimi koska input handling käsittelee vain yhden kerrallaan.

### Korjaus — chord-aware hit detection

```typescript
// Näppäintila — KAIKKI neljä kaistaa seurataan itsenäisesti
const heldFrets = useRef([false, false, false, false]);

// Strum — tarkistaa KAIKKI pidetyt kaistat samanaikaisesti
function strum() {
  const pressTime = audioCtx.currentTime - audioStartTimeRef.current;
  const g = gameRef.current;

  // Kerää KAIKKI pidetyt kaistat
  const activeFretsLanes = heldFrets.current
    .map((held, lane) => held ? lane : -1)
    .filter(lane => lane >= 0);

  if (activeFretsLanes.length === 0) {
    // Strummattu ilman frettejä — early strum penalty
    g.rockMeter = Math.max(0, g.rockMeter - 3);
    return;
  }

  // Etsi matching notet KAIKILLE pidetyille kaistoille yhtä aikaa
  const window = 0.090; // 90ms good window
  let anyHit = false;

  for (const lane of activeFretsLanes) {
    const laneNotes = g.pendingNotes
      .filter(n => n.lane === lane)
      .sort((a, b) => Math.abs(a.time - pressTime) - Math.abs(b.time - pressTime));

    if (laneNotes.length === 0) continue;
    const nearest = laneNotes[0];
    const delta = Math.abs(nearest.time - pressTime);

    if (delta <= 0.030) { registerHit(nearest, 'PERFECT'); anyHit = true; }
    else if (delta <= 0.060) { registerHit(nearest, 'GREAT'); anyHit = true; }
    else if (delta <= 0.090) { registerHit(nearest, 'GOOD'); anyHit = true; }
  }

  if (!anyHit) {
    // Strummattu väärään aikaan
    g.combo = 0;
    g.multiplier = 1;
  }
}

// Näppäinkäsittely — ei repeat, kaikki 4 itsenäisiä
useEffect(() => {
  const onDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const lane = {'1':0,'2':1,'3':2,'4':3}[e.key];
    if (lane !== undefined) {
      heldFrets.current[lane] = true;
      gameRef.current.heldFrets[lane] = true;
      setFretVisual(lane, true); // CSS active state
    }
    if (e.key === 'Enter') { e.preventDefault(); strum(); }
    if (e.key === 'Escape' || e.key === 'p') pauseGame();
  };
  const onUp = (e: KeyboardEvent) => {
    const lane = {'1':0,'2':1,'3':2,'4':3}[e.key];
    if (lane !== undefined) {
      heldFrets.current[lane] = false;
      gameRef.current.heldFrets[lane] = false;
      setFretVisual(lane, false);
    }
  };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  return () => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
  };
}, [gamePhase]); // re-register kun gamePhase muuttuu
```

### Miss detection — automaattinen

```typescript
// Game loop tarkistaa missed notet joka frame
function checkMissedNotes(currentTime: number) {
  const g = gameRef.current;
  const missWindow = 0.120; // 120ms ohi = miss

  const missed = g.pendingNotes.filter(n => currentTime - n.time > missWindow);
  for (const note of missed) {
    registerMiss(note);
  }
}
```

---

## BUGI #4 — BIISIT EIVÄT TALLENNU

### Luo src/lib/songStorage.ts

```typescript
const DB_NAME = 'AIRockHeroDB';
const DB_VERSION = 2;

export interface StoredSong {
  id: string;
  title: string;
  artist: string;
  duration: number;
  bpm: number;
  thumbnailUrl: string;
  sourceType: 'youtube' | 'file';
  sourceUrl?: string;
  audioArrayBuffer?: ArrayBuffer; // MP3 data — vain file-uploadille
  chart: SerializedNote[];        // chart tallennetaan biisin mukana
  addedAt: number;
  highScore: number;
  timesPlayed: number;
}

export interface SerializedNote {
  id: string; lane: number; time: number; duration: number;
}

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('songs')) {
        db.createObjectStore('songs', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function upsertSong(song: StoredSong): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('songs', 'readwrite');
    tx.objectStore('songs').put(song);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllSongs(): Promise<StoredSong[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('songs', 'readonly');
    const req = tx.objectStore('songs').getAll();
    req.onsuccess = () => resolve(
      (req.result as StoredSong[]).sort((a, b) => b.addedAt - a.addedAt)
    );
    req.onerror = () => reject(req.error);
  });
}

export async function getSong(id: string): Promise<StoredSong | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('songs','readonly').objectStore('songs').get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSong(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('songs', 'readwrite');
    tx.objectStore('songs').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateHighScore(id: string, score: number): Promise<void> {
  const song = await getSong(id);
  if (!song) return;
  if (score > song.highScore) {
    await upsertSong({
      ...song,
      highScore: score,
      timesPlayed: song.timesPlayed + 1,
    });
  } else {
    await upsertSong({ ...song, timesPlayed: song.timesPlayed + 1 });
  }
}

export async function hashString(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 16);
}
```

### Käytä tallennusta analysoinnin jälkeen

```typescript
// App.tsx — analysoinnin jälkeen:
async function afterAnalysis(audioBuffer: AudioBuffer, chart: Note[], meta: TrackMeta) {
  const songId = await hashString(currentSourceUrl || currentFileName);

  // Tallenna IndexedDB:hen
  await upsertSong({
    id: songId,
    title: meta.title,
    artist: meta.artist,
    duration: audioBuffer.duration,
    bpm: meta.bpm,
    thumbnailUrl: meta.thumbnailUrl ?? '',
    sourceType: currentFile ? 'file' : 'youtube',
    sourceUrl: currentFile ? undefined : currentSourceUrl,
    audioArrayBuffer: currentFile ? await currentFile.arrayBuffer() : undefined,
    chart: chart.map(n => ({ id: n.id, lane: n.lane, time: n.time, duration: n.duration })),
    addedAt: Date.now(),
    highScore: 0,
    timesPlayed: 0,
  });
}

// SONGS-välilehti — soita tallennettu biisi ILMAN uudelleenanalyysiä
async function playSavedSong(song: StoredSong) {
  // 1. Lataa audio
  let audioBuffer: AudioBuffer;
  if (song.audioArrayBuffer) {
    audioBuffer = await audioCtx.decodeAudioData(song.audioArrayBuffer.slice(0));
  } else if (song.sourceUrl) {
    // YouTube — täytyy hakea uudelleen (ei voi tallentaa tekijänoikeussyistä)
    const data = await fetchYouTubeAudio(song.sourceUrl);
    audioBuffer = await audioCtx.decodeAudioData(data);
  } else {
    throw new Error('No audio source available');
  }

  // 2. Palauta chart suoraan — EI uudelleenanalyysiä
  const chart: Note[] = song.chart.map(n => ({ ...n }));

  // 3. Aloita peli
  setCurrentSong(song);
  setCurrentAudioBuffer(audioBuffer);
  setCurrentChart(chart);
  setActiveTab('play');
  startCountdown(); // 3-2-1 ja sitten startGame()
}
```

---

## BUGI #5 — PELIN FLOW ON RIKKI

### Oikea flow: START → VALITSE BIISI → COUNTDOWN → SOITA → RESULTS

```typescript
type GamePhase =
  | 'menu'        // Etusivu, biisivalinta näkyvissä
  | 'analyzing'   // AI analysoi biisiä
  | 'countdown'   // 3... 2... 1...
  | 'playing'     // Biisi soi, notet scrollaa
  | 'paused'      // ESC / P painettu
  | 'results'     // Biisi loppui, näytetään tulokset
  | 'failed';     // Rock meter tyhjenee

const [gamePhase, setGamePhase] = useState<GamePhase>('menu');
```

### Countdown — älä aloita suoraan

```tsx
// 3 sekuntia ennen kuin audio alkaa
async function startCountdown() {
  setGamePhase('countdown');

  for (const count of [3, 2, 1]) {
    setCountdownValue(count);
    await sleep(1000);
  }

  setCountdownValue(0); // "GO!"
  await sleep(500);

  startGameForReal();
}

function startGameForReal() {
  // Nollaa game state
  gameRef.current = {
    score: 0, combo: 0, maxCombo: 0, multiplier: 1,
    rockMeter: 50, perfectCount: 0, greatCount: 0,
    goodCount: 0, missCount: 0, notesHit: 0, notesTotal: currentChart.length,
    pendingNotes: [...currentChart], // KOPIO — ei mutaatiota alkuperäiseen
    heldFrets: [false,false,false,false],
    lastRenderScore: -1,
  };

  // Käynnistä audio
  audioStartTimeRef.current = audioCtx.currentTime;
  const source = audioCtx.createBufferSource();
  source.buffer = currentAudioBuffer;
  source.connect(gainNodeRef.current);
  gainNodeRef.current.connect(audioCtx.destination);
  source.start(0);
  sourceRef.current = source;

  // Kuuntele biisin loppua
  source.onended = () => {
    if (gamePhaseRef.current === 'playing') {
      endGame('completed');
    }
  };

  // Käynnistä game loop ja UI sync
  setGamePhase('playing');
  startGameLoop();
  startUISync();
}

// Countdown UI
{gamePhase === 'countdown' && (
  <div className="countdown-overlay">
    <div className={`countdown-number ${countdownValue === 0 ? 'go' : ''}`}>
      {countdownValue === 0 ? 'GO!' : countdownValue}
    </div>
    <div className="song-info-preview">
      {currentSong.title} — {currentSong.artist}
    </div>
  </div>
)}
```

### Results screen — oikeat tiedot

```tsx
function endGame(reason: 'completed' | 'failed' | 'quit') {
  stopGameLoop();
  stopUISync();
  sourceRef.current?.stop();
  setGamePhase('results');

  const g = gameRef.current;
  const totalNotes = g.perfectCount + g.greatCount + g.goodCount + g.missCount;
  const accuracy = totalNotes > 0
    ? ((g.perfectCount + g.greatCount + g.goodCount) / totalNotes) * 100
    : 0;

  const grade = accuracy >= 95 ? 'S'
    : accuracy >= 80 ? 'A'
    : accuracy >= 65 ? 'B'
    : accuracy >= 50 ? 'C'
    : 'D';

  const session: SessionResult = {
    songId: currentSong.id,
    songTitle: currentSong.title,
    score: g.score,
    maxCombo: g.maxCombo,
    accuracy,
    grade,
    perfectCount: g.perfectCount,
    greatCount: g.greatCount,
    goodCount: g.goodCount,
    missCount: g.missCount,
    completedAt: Date.now(),
    reason,
  };

  setLastSession(session);
  updateHighScore(currentSong.id, g.score);
}

{gamePhase === 'results' && lastSession && (
  <div className="results-overlay">
    <div className="results-modal">
      <div className={`grade grade-${lastSession.grade}`}>{lastSession.grade}</div>
      <h2>{lastSession.songTitle}</h2>
      {lastSession.reason === 'failed' && (
        <div className="failed-banner">💀 ROCK METER EMPTY</div>
      )}

      <div className="result-grid">
        <div className="result-card">
          <span className="label">FINAL SCORE</span>
          <span className="value score">{lastSession.score.toLocaleString()}</span>
        </div>
        <div className="result-card">
          <span className="label">ACCURACY</span>
          <span className="value accuracy">{lastSession.accuracy.toFixed(1)}%</span>
        </div>
      </div>

      <div className="note-breakdown">
        <span className="perfect">PERFECT <strong>{lastSession.perfectCount}</strong></span>
        <span className="great">GREAT <strong>{lastSession.greatCount}</strong></span>
        <span className="good">GOOD <strong>{lastSession.goodCount}</strong></span>
        <span className="miss">MISS <strong>{lastSession.missCount}</strong></span>
      </div>

      {lastSession.score > (currentSong.highScore) && (
        <div className="new-record">🏆 NEW HIGH SCORE!</div>
      )}

      <div className="result-actions">
        <button onClick={() => startCountdown()}>▶ Play Again</button>
        <button onClick={shareResult}>📱 Share</button>
        <button onClick={submitToLeaderboard}>📤 Submit Score</button>
        <button onClick={() => setGamePhase('menu')}>◀ Menu</button>
      </div>
    </div>
  </div>
)}
```

---

## BUGI #6 — GAME LOOP LAGAA

### Ongelma
Game loop käyttää setInterval tai päivittää React statea joka frame.

### Täydellinen canvas-pohjainen game loop

```typescript
const rafRef = useRef<number>();

function startGameLoop() {
  let lastTime = performance.now();

  function frame(now: number) {
    const delta = Math.min((now - lastTime) / 1000, 0.05); // max 50ms step
    lastTime = now;

    const currentTime = audioCtx.currentTime - audioStartTimeRef.current;

    // 1. Miss check
    checkMissedNotes(currentTime);

    // 2. Piirrä
    drawFrame(currentTime);

    // 3. Jatka
    rafRef.current = requestAnimationFrame(frame);
  }

  rafRef.current = requestAnimationFrame(frame);
}

function stopGameLoop() {
  if (rafRef.current) cancelAnimationFrame(rafRef.current);
}

// Canvas piirto — EI React, suoraan DOM
function drawFrame(currentTime: number) {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const g = gameRef.current;
  const { width: W, height: H } = canvas;

  ctx.clearRect(0, 0, W, H);

  // Näkyvyysikkuna: 2.5 sekuntia eteenpäin
  const lookAhead = 2.5;
  const visible = g.pendingNotes.filter(
    n => n.time >= currentTime - 0.15 && n.time <= currentTime + lookAhead
  );

  for (const note of visible) {
    const ratio = (note.time - currentTime) / lookAhead; // 0 = hit zone, 1 = kaukana
    const perspective = 0.25 + ratio * 0.75;

    const laneX = getLaneX(note.lane, W, perspective);
    const y = H * 0.85 - ratio * H * 0.75; // perspective scroll
    const w = 60 * perspective;
    const h = 22 * perspective;

    const color = ['#ff2d55','#ffd60a','#0a84ff','#30d158'][note.lane];

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 20 * perspective;
    ctx.fillStyle = color;

    // Rounded rect
    const r = 8 * perspective;
    ctx.beginPath();
    ctx.roundRect(laneX - w/2, y - h/2, w, h, r);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.roundRect(laneX - w/2 + 2, y - h/2 + 2, w - 4, h/2 - 2, r/2);
    ctx.fill();

    ctx.restore();
  }

  // Hit zones
  drawHitZones(ctx, g.heldFrets, W, H);
}

function getLaneX(lane: number, W: number, perspective: number): number {
  const laneWidth = W * 0.12;
  const totalWidth = laneWidth * 4;
  const startX = (W - totalWidth * perspective) / 2;
  return startX + (lane + 0.5) * laneWidth * perspective;
}

function drawHitZones(ctx: CanvasRenderingContext2D, held: boolean[], W: number, H: number) {
  const colors = ['#ff2d55','#ffd60a','#0a84ff','#30d158'];
  const y = H * 0.85;
  const laneW = W * 0.12;
  const startX = (W - laneW * 4) / 2;

  for (let i = 0; i < 4; i++) {
    const x = startX + (i + 0.5) * laneW;
    const r = 36;
    const color = colors[i];

    ctx.save();
    if (held[i]) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 40;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    if (held[i]) {
      ctx.fillStyle = color + '44';
      ctx.fill();
    }
    ctx.restore();
  }
}
```

---

## MOCK POISTETAAN — TÄYSI LIVE

### Leaderboard — ei mock dataa

```typescript
// Leaderboard lukee oikeasta backendistä tai localStoragesta
// EI KOSKAAN hardcodattuja tuloksia

// Yksinkertainen versio: localStorage-pohjainen global leaderboard ei toimi
// mutta SONGS-näkymässä omat high scoret OVAT oikeita

// Leaderboard API call:
async function fetchLeaderboard(period: 'week'|'month'|'all') {
  try {
    const res = await fetch(`https://api.airockhero.com/leaderboard?period=${period}`);
    if (!res.ok) throw new Error('API unavailable');
    return res.json();
  } catch {
    // Fallback: omat tulokset localStoragesta
    const myScores = JSON.parse(localStorage.getItem('airockhero_scores') ?? '[]');
    return { entries: myScores, isLocal: true };
  }
}

// Jos API ei ole käytössä → näytä "Local scores" label
{leaderboard.isLocal && (
  <p className="local-notice">Showing your local scores — connect wallet to join global leaderboard</p>
)}
```

### Session tallennus — oikeasti

```typescript
// Jokaisen pelin jälkeen tallenna localStorageen
function saveSessionResult(session: SessionResult) {
  const existing = JSON.parse(localStorage.getItem('airockhero_scores') ?? '[]');
  existing.unshift(session); // uusin ensin
  // Pidä max 100 tulosta
  localStorage.setItem('airockhero_scores', JSON.stringify(existing.slice(0, 100)));
}
```

---

## TARKISTUSLISTA — aja tässä järjestyksessä

```
KORJAUS 1: Score ei nousemasta
  □ Muuta score/combo/multiplier → useRef
  □ UI sync setInterval 100ms tahdilla
  □ Testaa: pelaa 2min, score nousee koko ajan ✅

KORJAUS 2: YouTube audio
  □ Kokeile cobalt.tools API
  □ Jos ei toimi → selkeä virhe + MP3 fallback
  □ Testaa: paste YouTube URL → audio soi ✅
  □ Testaa: MP3 upload → audio soi ✅

KORJAUS 3: 4 simultaanista notea
  □ strum() tarkistaa KAIKKI heldFrets.current
  □ Chord hit rekisteröi kaikki kaistat
  □ Testaa: paina 1+2+3+4 alas, paina Enter → kaikki 4 rekisteröityy ✅

KORJAUS 4: Tallennus
  □ Luo src/lib/songStorage.ts
  □ Tallenna analysoinnin jälkeen
  □ SONGS-välilehti käyttää getAllSongs()
  □ Testaa: lataa MP3 → analysoi → F5 → SONGS näyttää sen ✅
  □ Testaa: klikkaa ▶ → peli alkaa ILMAN uudelleenanalyysiä ✅

KORJAUS 5: Pelin flow
  □ GamePhase: menu→analyzing→countdown→playing→results
  □ Countdown 3-2-1 ennen aloitusta
  □ Results näyttää oikeat luvut
  □ Testaa: koko flow alusta loppuun ✅

KORJAUS 6: Lagging
  □ Game loop → requestAnimationFrame canvas-pohjainen
  □ Ei React setState game loopissa
  □ Testaa: DevTools Performance → >55fps ✅

LOPUKSI: grep-tarkistus
  grep -rn "TODO\|mock\|placeholder\|coming soon\|onClick={() => {}}\|href=\"#\"" src/
  → 0 tulosta ✅
```
