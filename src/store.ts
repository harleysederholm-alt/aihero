import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Note = {
  id: string;
  time: number;
  lane: number;
  duration?: number;
};

export type HitResult = 'perfect' | 'great' | 'good' | 'miss';

export interface SavedSong {
  id: string;
  url: string;
  title: string;
  artist: string;
  duration: number;
  bpm: number;
  thumbnailUrl: string;
  chartData?: Note[]; // We can cache the chart here
  addedAt: number;
  highScore: number;
  timesPlayed: number;
}

export interface SessionResult {
  songId: string;
  songTitle: string;
  score: number;
  maxCombo: number;
  accuracy: number;
  grade: string;
  perfectCount: number;
  greatCount: number;
  goodCount: number;
  missCount: number;
  timestamp: number;
  previousHighScore: number;
  durationSeconds: number;
  reason?: 'completed' | 'failed' | 'quit';
}

export interface PlayerStats {
  totalSongsPlayed: number;
  totalNotesHit: number;
  totalNotesMissed: number;
  bestCombo: number;
  totalPlaytimeSeconds: number;
  sessions: SessionResult[];
}

export interface GameSettings {
  audioLatencyMs: number;
  noteSpeed: 'slow' | 'medium' | 'fast' | 'expert';
  sfxVolume: number;
  musicVolume: number;
  showFPS: boolean;
  reducedMotion: boolean;
  colorblindMode: boolean;
  fullscreen: boolean;
}

export interface GameState {
  score: number;
  combo: number;
  maxCombo: number;
  multiplier: number;
  accuracy: number;
  totalNotes: number;
  perfectHits: number;
  greatHits: number;
  goodHits: number;
  missHits: number;
  isPlaying: boolean;
  currentTime: number;
  hitFlash: { active: boolean; lane: number; result: HitResult; time: number } | null;
  rockMeter: number;
  walletAddress: string | null;
  hitNotes: Set<string>;

  // Actions
  addScore: (points: number) => void;
  incrementCombo: () => void;
  resetCombo: () => void;
  recordHit: (result: HitResult) => void;
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setHitFlash: (flash: any) => void;
  setRockMeter: (value: number) => void;
  setWalletAddress: (address: string | null) => void;
  addHitNote: (id: string) => void;
  resetGame: () => void;
}

export interface PersistedState {
  stats: PlayerStats;
  settings: GameSettings;
  savedSongs: SavedSong[];
  updateSettings: (newSettings: Partial<GameSettings>) => void;
  addSavedSong: (song: SavedSong) => void;
  removeSavedSong: (id: string) => void;
  recordSessionStats: (session: SessionResult) => void;
}

// Game State (Ephemeral)
export const useGameStore = create<GameState>((set) => ({
  score: 0,
  combo: 0,
  maxCombo: 0,
  multiplier: 1,
  accuracy: 100,
  totalNotes: 0,
  perfectHits: 0,
  greatHits: 0,
  goodHits: 0,
  missHits: 0,
  isPlaying: false,
  currentTime: 0,
  hitFlash: null,
  rockMeter: 50,
  walletAddress: null,
  hitNotes: new Set(),
  addScore: (points) => set((state) => ({ score: state.score + points })),
  incrementCombo: () => set((state) => {
    const newCombo = state.combo + 1;
    let newMultiplier = state.multiplier;
    if (newCombo >= 10 && newCombo < 25) newMultiplier = 2;
    else if (newCombo >= 25 && newCombo < 50) newMultiplier = 3;
    else if (newCombo >= 50) newMultiplier = 4;
    const newRockMeter = Math.min(100, state.rockMeter + (newMultiplier * 1.5));
    return {
      combo: newCombo,
      maxCombo: Math.max(state.maxCombo, newCombo),
      multiplier: newMultiplier,
      rockMeter: newRockMeter
    };
  }),
  resetCombo: () => set((state) => ({
    combo: 0,
    multiplier: 1,
    rockMeter: Math.max(0, state.rockMeter - 10)
  })),
  recordHit: (result) => set((state) => {
    const total = state.totalNotes + 1;
    let perfect = state.perfectHits;
    let great = state.greatHits;
    let good = state.goodHits;
    let miss = state.missHits;
    if (result === 'perfect') perfect++;
    else if (result === 'great') great++;
    else if (result === 'good') good++;
    else if (result === 'miss') miss++;
    const accuracy = total === 0 ? 100 : ((perfect * 100 + great * 70 + good * 40) / total);
    return {
      totalNotes: total,
      perfectHits: perfect,
      greatHits: great,
      goodHits: good,
      missHits: miss,
      accuracy
    };
  }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setHitFlash: (flash) => set({ hitFlash: flash }),
  setRockMeter: (value) => set({ rockMeter: value }),
  setWalletAddress: (address) => set({ walletAddress: address }),
  addHitNote: (id) => set((state) => ({ hitNotes: new Set(state.hitNotes).add(id) })),
  resetGame: () => set({
    score: 0,
    combo: 0,
    maxCombo: 0,
    multiplier: 1,
    accuracy: 100,
    totalNotes: 0,
    perfectHits: 0,
    greatHits: 0,
    goodHits: 0,
    missHits: 0,
    rockMeter: 50,
    hitFlash: null,
    currentTime: 0,
    hitNotes: new Set()
  })
}));

// Persisted State (localStorage)
export const usePersistedStore = create<PersistedState>()(
  persist(
    (set) => ({
      stats: {
        totalSongsPlayed: 0,
        totalNotesHit: 0,
        totalNotesMissed: 0,
        bestCombo: 0,
        totalPlaytimeSeconds: 0,
        sessions: []
      },
      settings: {
        audioLatencyMs: 0,
        noteSpeed: 'medium',
        sfxVolume: 80,
        musicVolume: 80,
        showFPS: false,
        reducedMotion: false,
        colorblindMode: false,
        fullscreen: false
      },
      savedSongs: [],
      
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),
      
      addSavedSong: (song) => set((state) => {
        const existingIdx = state.savedSongs.findIndex(s => s.id === song.id);
        const newSongs = [...state.savedSongs];
        if (existingIdx >= 0) {
          newSongs[existingIdx] = { ...newSongs[existingIdx], ...song };
        } else {
          newSongs.push(song);
        }
        return { savedSongs: newSongs };
      }),
      
      removeSavedSong: (id) => set((state) => ({
        savedSongs: state.savedSongs.filter(s => s.id !== id)
      })),
      
      recordSessionStats: (session) => set((state) => {
        const newStats = { ...state.stats };
        newStats.totalSongsPlayed += 1;
        newStats.totalNotesHit += (session.perfectCount + session.greatCount + session.goodCount);
        newStats.totalNotesMissed += session.missCount;
        newStats.bestCombo = Math.max(newStats.bestCombo, session.maxCombo);
        newStats.totalPlaytimeSeconds += session.durationSeconds;
        
        // Add session to history (keep last 50)
        newStats.sessions = [session, ...newStats.sessions].slice(0, 50);
        
        // Update song highscore
        const newSongs = state.savedSongs.map(song => {
          if (song.id === session.songId) {
            return {
              ...song,
              timesPlayed: song.timesPlayed + 1,
              highScore: Math.max(song.highScore, session.score)
            };
          }
          return song;
        });

        return { stats: newStats, savedSongs: newSongs };
      })
    }),
    {
      name: 'airockhero-storage',
    }
  )
);
