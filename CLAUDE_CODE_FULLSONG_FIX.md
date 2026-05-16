# Claude Code — AI Rock Hero: Full Song Fix + Persistence + Performance

## KONTEKSTI
Tämä on Guitar Hero -tyylinen selainpeli (React + TypeScript + Vite).
Pelissä on kolme kriittistä bugia jotka korjataan nyt. Lue KAIKKI lähdekooditiedostot
ennen kuin muutat mitään.

```bash
# Lue ensin
cat src/App.tsx
cat src/App.css
find src -name "*.ts" -o -name "*.tsx" | xargs ls -la
```

---

## KRIITTINEN BUGI #1 — NOTET LOPPUVAT 30 SEKUNNIN KOHDALLA

### Ongelma
Notet generoidaan vain biisin ensimmäisille 30 sekunnille. Sen jälkeen highway on
tyhjä mutta musiikki soi. Pelattavuus loppuu käytännössä heti.

### Diagnoosi — etsi nämä ongelmat koodista:

```bash
# Etsi rajoitukset
grep -n "30\|slice\|limit\|maxNote\|MAX_NOTES\|preview\|duration.*0\." src/App.tsx
grep -n "noteCount\|chartLength\|generateNotes\|createChart" src/App.tsx
```

Tyypillisiä syyllisiä:
```typescript
// BUGI TYYPPI A — aikarajoitus generoinnissa
const notes = beats.filter(b => b.time < 30); // ← POISTA tämä

// BUGI TYYPPI B — liian pieni max_tokens AI-kutsussa
max_tokens: 1000  // ← riittää vain ~30s chartille, nosta 8000:een

// BUGI TYYPPI C — array truncaus
const chart = allNotes.slice(0, 50); // ← POISTA slice-rajoitus

// BUGI TYYPPI D — AI-prompti pyytää vain osan
"generate a sample chart" // ← vaihda "generate complete full-length chart"

// BUGI TYYPPI E — beat detection ajaa vain osalle
const sampleBuffer = audioBuffer.slice(0, sampleRate * 30); // ← käytä koko buffer
```

### Korjaus

**1. Beat detection — koko biisi:**
```typescript
// VÄÄRIN — vain alku
async function detectBeats(audioBuffer: AudioBuffer): Promise<Beat[]> {
  const data = audioBuffer.getChannelData(0).slice(0, 44100 * 30);
  // ...
}

// OIKEIN — koko biisi
async function detectBeats(audioBuffer: AudioBuffer): Promise<Beat[]> {
  const data = audioBuffer.getChannelData(0); // koko kanava
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration; // käytä tätä
  // analysoi KAIKKI data alusta loppuun
}
```

**2. AI-kutsu notechart-generointiin — nosta max_tokens:**
```typescript
body: JSON.stringify({
  model: "claude-sonnet-4-20250514",
  max_tokens: 8000,  // ← oli 1000, nosta 8000
  system: `You are a Guitar Hero chart generator.
    Generate a COMPLETE note chart covering the ENTIRE song from 0 to ${durationSeconds} seconds.
    Return ONLY valid JSON. The chart MUST have notes distributed across the full duration.
    Minimum note density: at least 1 note every 2 seconds throughout the entire song.
    NEVER truncate. NEVER stop early. Cover 100% of the song.`,
  messages: [{
    role: "user",
    content: `Song duration: ${durationSeconds} seconds (${Math.floor(durationSeconds/60)}:${String(Math.floor(durationSeconds%60)).padStart(2,'0')}).
    BPM: ${bpm}. Beats: ${JSON.stringify(beats)}.
    Generate complete note chart for ALL ${durationSeconds} seconds.`
  }]
})
```

**3. Validoi generoitu chart ennen käyttöä:**
```typescript
function validateChart(chart: NoteChart, songDuration: number): boolean {
  if (!chart.notes || chart.notes.length === 0) return false;

  const lastNote = chart.notes[chart.notes.length - 1];
  const coverage = lastNote.time / songDuration;

  if (coverage < 0.85) {
    console.error(`Chart only covers ${(coverage*100).toFixed(0)}% of song — regenerating`);
    return false;
  }

  // Tarkista että ei ole yli 8s aukkoja
  for (let i = 1; i < chart.notes.length; i++) {
    const gap = chart.notes[i].time - chart.notes[i-1].time;
    if (gap > 8) {
      console.warn(`Gap of ${gap.toFixed(1)}s at ${chart.notes[i-1].time.toFixed(1)}s`);
    }
  }

  return true;
}

// Jos validointi epäonnistuu → generoi uudelleen fallback-algoritmilla:
function generateFallbackChart(beats: Beat[], duration: number): NoteChart {
  // Algoritminen generaatio joka VARMASTI kattaa koko biisin
  // Jokainen beat → note jollekin kaistalle (lane = beat.intensity % 4)
  const notes = beats.map((beat, i) => ({
    id: `note-${i}`,
    lane: Math.floor(beat.intensity * 4) % 4,
    time: beat.time,
    duration: beat.type === 'long' ? 0.5 : 0,
  }));
  return { notes, songDuration: duration };
}
```

---

## KRIITTINEN BUGI #2 — MP3 EI TALLENNU, PITÄÄ LADATA AINA UUDELLEEN

### Ongelma
Kun käyttäjä lataa MP3-tiedoston tai YouTube-biisin, se katoaa sivun päivityksessä.
Analyysi pitää tehdä joka kerta alusta. Tämä on dealbreaker UX:n kannalta.

### Ratkaisu — IndexedDB tallennusjärjestelmä

Älä käytä localStorage (liian pieni). Käytä IndexedDB AudioBuffer-datalle ja
localStorage vain metadatalle.

```typescript
// src/lib/songStorage.ts — LUO TÄMÄ TIEDOSTO

const DB_NAME = 'AIRockHeroDB';
const DB_VERSION = 1;
const SONGS_STORE = 'songs';
const CHARTS_STORE = 'charts';

interface StoredSong {
  id: string;           // MD5 tai URL hash
  title: string;
  artist: string;
  duration: number;
  bpm: number;
  thumbnailUrl?: string;
  sourceType: 'youtube' | 'file';
  sourceUrl?: string;   // YouTube URL
  audioData?: ArrayBuffer; // MP3/WAV raw bytes (vain file-uploadeille)
  addedAt: number;
  highScore: number;
  timesPlayed: number;
}

interface StoredChart {
  songId: string;
  notes: Note[];
  generatedAt: number;
}

// Avaa DB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SONGS_STORE)) {
        db.createObjectStore(SONGS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CHARTS_STORE)) {
        db.createObjectStore(CHARTS_STORE, { keyPath: 'songId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Tallenna biisi
export async function saveSong(song: StoredSong, chart: StoredChart): Promise<void> {
  const db = await openDB();
  await Promise.all([
    new Promise<void>((res, rej) => {
      const tx = db.transaction(SONGS_STORE, 'readwrite');
      const req = tx.objectStore(SONGS_STORE).put(song);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    }),
    new Promise<void>((res, rej) => {
      const tx = db.transaction(CHARTS_STORE, 'readwrite');
      const req = tx.objectStore(CHARTS_STORE).put(chart);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    }),
  ]);
}

// Hae kaikki biisit
export async function getAllSongs(): Promise<StoredSong[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SONGS_STORE, 'readonly');
    const req = tx.objectStore(SONGS_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Hae chart biisille
export async function getChart(songId: string): Promise<StoredChart | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHARTS_STORE, 'readonly');
    const req = tx.objectStore(CHARTS_STORE).get(songId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

// Poista biisi
export async function deleteSong(songId: string): Promise<void> {
  const db = await openDB();
  await Promise.all([
    new Promise<void>((res) => {
      const tx = db.transaction(SONGS_STORE, 'readwrite');
      tx.objectStore(SONGS_STORE).delete(songId);
      tx.oncomplete = () => res();
    }),
    new Promise<void>((res) => {
      const tx = db.transaction(CHARTS_STORE, 'readwrite');
      tx.objectStore(CHARTS_STORE).delete(songId);
      tx.oncomplete = () => res();
    }),
  ]);
}

// Päivitä highscore
export async function updateHighScore(songId: string, score: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(SONGS_STORE, 'readwrite');
  const store = tx.objectStore(SONGS_STORE);
  const song = await new Promise<StoredSong>((res, rej) => {
    const req = store.get(songId);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  if (song && score > song.highScore) {
    song.highScore = score;
    song.timesPlayed += 1;
    store.put(song);
  }
}
```

### Integraatio App.tsx:ään

```typescript
// App.tsx — käytä tallennusta analysoinnin jälkeen

const handleAnalyze = async () => {
  // 1. Generoi uniikki ID URL:sta tai tiedoston nimestä
  const songId = await hashString(youtubeUrl || uploadedFile.name);

  // 2. Tarkista onko jo tallennettu
  const existingChart = await getChart(songId);
  if (existingChart) {
    console.log('Ladataan tallennettu chart — ei tarvita uudelleenanalyysiä');
    loadSongFromStorage(songId, existingChart);
    return; // ← TÄRKEÄ: ei uudelleenanalyysiä
  }

  // 3. Analysoi vasta jos ei ole cachessa
  setAnalysisState('loading');
  const chart = await analyzeFullSong(youtubeUrl || uploadedFile);

  // 4. Tallenna IndexedDB:hen
  await saveSong({
    id: songId,
    title: trackInfo.title,
    artist: trackInfo.artist,
    duration: trackInfo.duration,
    bpm: trackInfo.bpm,
    thumbnailUrl: trackInfo.thumbnailUrl,
    sourceType: uploadedFile ? 'file' : 'youtube',
    sourceUrl: youtubeUrl || undefined,
    audioData: uploadedFile ? await uploadedFile.arrayBuffer() : undefined,
    addedAt: Date.now(),
    highScore: 0,
    timesPlayed: 0,
  }, {
    songId,
    notes: chart.notes,
    generatedAt: Date.now(),
  });

  startGame(chart);
};

// SONGS-välilehti — lataa kaikki tallennetut biisit
useEffect(() => {
  getAllSongs().then(setSavedSongs);
}, [activeTab === 'songs']);
```

### Song Library UI (SONGS-välilehti)
```tsx
// Jokainen tallennettu biisi näytetään listassa:
// [Thumbnail/icon] [Nimi - Artisti] [Kesto] [BPM] [Highscore] [▶ Soita] [🗑 Poista]
// Klikkaamalla ▶ Soita → lataa chart suoraan IndexedDB:stä → ei analyysiä → peli alkaa

const playSavedSong = async (song: StoredSong) => {
  const chart = await getChart(song.id);
  if (!chart) return;

  // Lataa audio
  if (song.audioData) {
    // MP3/WAV joka on tallennettu
    const audioBuffer = await audioCtx.decodeAudioData(song.audioData.slice(0));
    setCurrentAudioBuffer(audioBuffer);
  } else if (song.sourceUrl) {
    // YouTube — pitää hakea uudelleen (ei voi tallentaa tekijänoikeussyistä)
    await fetchAndDecodeYouTube(song.sourceUrl);
  }

  setCurrentChart(chart);
  setCurrentSong(song);
  setActiveTab('play');
  startGame();
};
```

---

## KRIITTINEN BUGI #3 — PELI LAGAA, EI TOIMI KUIN OIKEA GUITAR HERO

### Ongelma
Game loop ei pyöri 60fps:ssä. Notet eivät liiku sulavasti. Input lag tuntuu.
Peli ei tunnu Guitar Herolta — tuntuu demolta.

### Diagnoosi
```bash
# Etsi suorituskykyongelmat
grep -n "setInterval\|setTimeout.*game\|setState.*loop\|new Date\|Date.now" src/App.tsx
```

### Korjaus A — Game loop React:n ulkopuolelle

```typescript
// VÄÄRIN — React state game loopissa (aiheuttaa re-renderöinnin joka frame)
useEffect(() => {
  const interval = setInterval(() => {
    setNotes(prev => updateNotes(prev)); // ← triggeröi render 60x/s = HIDAS
    setScore(prev => prev + points);
  }, 16);
}, []);

// OIKEIN — kaikki game state ref:ssä, canvas piirtää suoraan
const gameStateRef = useRef<GameState>({
  notes: [],
  score: 0,
  combo: 0,
  rockMeter: 50,
  heldFrets: [false, false, false, false],
});

// React state vain UI-päivityksiin (score display) — throttlattu
const [displayScore, setDisplayScore] = useState(0);

// Game loop canvas-pohjaisena
const animationFrameRef = useRef<number>();

function startGameLoop() {
  const canvas = highwayCanvasRef.current;
  const ctx = canvas.getContext('2d');

  let lastTime = performance.now();

  function frame(now: number) {
    const delta = (now - lastTime) / 1000; // sekunteina
    lastTime = now;

    // 1. Päivitä game state (ei React statea)
    updateGameState(gameStateRef.current, delta, audioEngine.getCurrentTime());

    // 2. Piirrä canvas suoraan
    drawHighway(ctx, gameStateRef.current);

    // 3. Päivitä React UI vain 10fps tahdilla (score, combo)
    // ei joka frame — se on liikaa
    if (Math.floor(now / 100) !== Math.floor(lastTime / 100)) {
      setDisplayScore(gameStateRef.current.score);
      setDisplayCombo(gameStateRef.current.combo);
    }

    animationFrameRef.current = requestAnimationFrame(frame);
  }

  animationFrameRef.current = requestAnimationFrame(frame);
}

function stopGameLoop() {
  if (animationFrameRef.current) {
    cancelAnimationFrame(animationFrameRef.current);
  }
}
```

### Korjaus B — Note-positioiden laskenta

```typescript
// VÄÄRIN — lasketaan joka frame kaikille noteille
function updateNotes(notes: Note[], currentTime: number): Note[] {
  return notes.map(note => ({
    ...note,
    y: calculateYPosition(note.time, currentTime), // ← hidasta jos 500+ notea
  }));
}

// OIKEIN — laske vain näkyvät notet, käytä suoraa matikkaa
const HIGHWAY_LENGTH_SECONDS = 2.5; // kuinka monta sekuntia näkyy

function getVisibleNotes(allNotes: Note[], currentTime: number) {
  const windowStart = currentTime - 0.1; // 100ms taustalle (jo ohi menneet)
  const windowEnd = currentTime + HIGHWAY_LENGTH_SECONDS;

  // Binary search startista (notet on järjestyksessä)
  let start = 0, end = allNotes.length;
  while (start < end) {
    const mid = (start + end) >> 1;
    if (allNotes[mid].time < windowStart) start = mid + 1;
    else end = mid;
  }

  const visible = [];
  for (let i = start; i < allNotes.length; i++) {
    if (allNotes[i].time > windowEnd) break;
    visible.push(allNotes[i]);
  }
  return visible; // tyypillisesti 5-20 notea kerrallaan, ei 500
}
```

### Korjaus C — Canvas-piirto optimointi

```typescript
function drawHighway(ctx: CanvasRenderingContext2D, state: GameState) {
  const { width, height } = ctx.canvas;
  const currentTime = audioEngine.getCurrentTime();

  // Tyhjennä
  ctx.clearRect(0, 0, width, height);

  // 1. Piirrä taustakaista (nopea — yksi operaatio)
  drawBackground(ctx, width, height);

  // 2. Piirrä vain näkyvät notet
  const visible = getVisibleNotes(state.notes, currentTime);
  for (const note of visible) {
    const yRatio = (note.time - currentTime) / HIGHWAY_LENGTH_SECONDS;
    // Perspektiivi: kauempana = pienempi + ylempänä
    const y = height * (1 - yRatio);
    const perspective = 0.3 + yRatio * 0.7;
    const noteWidth = LANE_WIDTH * perspective;
    const noteHeight = 20 * perspective;
    const x = getLaneX(note.lane, width) - noteWidth / 2;

    // Piirrä note gem
    ctx.save();
    ctx.shadowColor = LANE_COLORS[note.lane];
    ctx.shadowBlur = 20 * perspective;
    ctx.fillStyle = LANE_COLORS[note.lane];
    roundRect(ctx, x, y - noteHeight/2, noteWidth, noteHeight, 6 * perspective);
    ctx.fill();
    ctx.restore();
  }

  // 3. Hit zone (aina sama positio)
  drawHitZones(ctx, state.heldFrets, width, height);
}
```

### Korjaus D — Audio timing, ei input lag

```typescript
// VÄÄRIN — käyttää Date.now() joka ei ole synkronoitu audion kanssa
const currentGameTime = (Date.now() - gameStartWallTime) / 1000;

// OIKEIN — AudioContext.currentTime on sama klokkisignaali kuin audio
const audioStartTime = useRef<number>(0);

function startGame() {
  audioSource.start(0);
  audioStartTime.current = audioCtx.currentTime;
}

function getCurrentGameTime(): number {
  return audioCtx.currentTime - audioStartTime.current;
}

// Näppäimen painallus käyttää tätä:
function strum() {
  const pressTime = getCurrentGameTime(); // ← synkroninen audion kanssa
  checkNoteHit(pressTime);
}
```

### Korjaus E — Note hit detection

```typescript
const TIMING_WINDOWS = {
  PERFECT: 0.030, // ±30ms
  GREAT:   0.060, // ±60ms
  GOOD:    0.090, // ±90ms
};

function checkNoteHit(pressTime: number) {
  const state = gameStateRef.current;
  const heldLanes = state.heldFrets
    .map((held, i) => held ? i : -1)
    .filter(i => i >= 0);

  // Etsi lähin note jokaiselle pidetylle kaistalle
  for (const lane of heldLanes) {
    const laneNotes = state.pendingNotes.filter(n => n.lane === lane);
    if (laneNotes.length === 0) continue;

    const nearest = laneNotes.reduce((a, b) =>
      Math.abs(a.time - pressTime) < Math.abs(b.time - pressTime) ? a : b
    );

    const delta = Math.abs(nearest.time - pressTime);

    if (delta <= TIMING_WINDOWS.PERFECT) {
      registerHit(nearest, 'PERFECT', 150);
    } else if (delta <= TIMING_WINDOWS.GREAT) {
      registerHit(nearest, 'GREAT', 100);
    } else if (delta <= TIMING_WINDOWS.GOOD) {
      registerHit(nearest, 'GOOD', 50);
    }
    // else: väärässä kohtaa painettu — ei mitään
  }
}
```

---

## TESTAUS — ajettava tarkistuslista

### Bugi #1 — Notet koko biisiin
```
1. Lataa 4+ minuutin biisi (esim. Thunderstruck 4:52)
2. Analysoi → peli alkaa
3. Katso onko noteja vielä 2:00 kohdalla → pitää olla ✅
4. Katso onko noteja vielä 4:00 kohdalla → pitää olla ✅
5. Biisi loppuu luonnollisesti → results screen ✅
6. Console.log: `Chart covers: ${lastNote.time}s / ${song.duration}s`
   → täytyy olla >90%
```

### Bugi #2 — Tallennus toimii
```
1. Lataa MP3-tiedosto → analysoi → pelaa
2. Päivitä sivu (F5)
3. Avaa SONGS-välilehti → biisi näkyy listassa ✅
4. Klikkaa ▶ Soita → peli alkaa VÄLITTÖMÄSTI, ei uudelleenanalyysiä ✅
5. Highscore näkyy listassa ✅
6. Poista biisi → katoaa listasta ✅
```

### Bugi #3 — Suorituskyky
```
1. Avaa Chrome DevTools → Performance-välilehti
2. Record 10 sekuntia peliä
3. Frame rate: >55fps koko ajan ✅
4. Ei "Long Tasks" yli 50ms ✅
5. Input lag tuntuu <100ms ✅
6. Notet liikkuvat sulavasti perspektiivissä ✅
```

---

## PRIORITEETTIJÄRJESTYS

Tee tässä järjestyksessä — jokainen on toimiva ennen seuraavaa:

1. **Diagnosoi ensin** — aja grep-komennot, raportoi mitä löydät
2. **Korjaa bugi #1** — notet koko biisiin (pelin ydin)
3. **Testaa #1** — varmista 4-min biisillä ennen jatkamista
4. **Luo songStorage.ts** — IndexedDB-moduuli
5. **Integroi tallennus** — App.tsx käyttää storaget
6. **Testaa #2** — F5 → songs-lista → soita ilman analyysiä
7. **Game loop uudelleenkirjoitus** — ref-pohjainen, canvas-pohjainen
8. **Testaa #3** — DevTools performance profile
9. **Audio timing** — AudioContext.currentTime kaikkialle

Älä yhdistä useita bugeja yhteen committiin. Yksi korjaus kerrallaan.
