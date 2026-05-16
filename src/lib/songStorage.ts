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
  audioArrayBuffer?: ArrayBuffer;
  chart: SerializedNote[];
  addedAt: number;
  highScore: number;
  timesPlayed: number;
}

export interface SerializedNote {
  id: string;
  lane: number;
  time: number;
  duration?: number;
}

function openDB(): Promise<IDBDatabase> {
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
    req.onsuccess = () => resolve((req.result as StoredSong[]).sort((a, b) => b.addedAt - a.addedAt));
    req.onerror = () => reject(req.error);
  });
}

export async function getSong(id: string): Promise<StoredSong | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('songs', 'readonly').objectStore('songs').get(id);
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

export async function updateHighScore(id: string, score: number, timesPlayed: number): Promise<void> {
  const song = await getSong(id);
  if (!song) return;
  await upsertSong({
    ...song,
    highScore: Math.max(song.highScore, score),
    timesPlayed: song.timesPlayed + timesPlayed,
  });
}

export async function hashString(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}
