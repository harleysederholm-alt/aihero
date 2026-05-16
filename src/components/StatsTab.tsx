import React from 'react';
import { usePersistedStore } from '../store';
import { Activity, Target, Zap, Clock, Trophy, Music } from 'lucide-react';

export const StatsTab: React.FC = () => {
  const { stats, savedSongs } = usePersistedStore();

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const calculateLifetimeAccuracy = () => {
    const total = stats.totalNotesHit + stats.totalNotesMissed;
    if (total === 0) return 0;
    return (stats.totalNotesHit / total) * 100;
  };

  const topSongs = [...savedSongs]
    .filter(s => s.timesPlayed > 0)
    .sort((a, b) => b.highScore - a.highScore)
    .slice(0, 5);

  if (stats.totalSongsPlayed === 0) {
    return (
      <div className="w-full h-full pt-20 px-8 flex flex-col items-center justify-center text-white bg-[#050510]">
        <Activity size={64} className="text-[#ff2a6d] mb-6 opacity-50" />
        <h2 className="text-3xl font-rajdhani font-bold mb-4">No Stats Yet</h2>
        <p className="text-white/60">Play your first song to see your stats!</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full pt-20 px-8 pb-8 text-white flex justify-center bg-[#050510] overflow-y-auto">
      <div className="w-full max-w-4xl flex flex-col gap-8">
        
        <div className="text-center mb-4">
          <h1 className="text-4xl font-black font-orbitron tracking-widest text-[#00ff9d] drop-shadow-[0_0_15px_rgba(0,255,157,0.5)]">
            LIFETIME STATS
          </h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 p-6 rounded-xl backdrop-blur-sm flex flex-col items-center justify-center text-center">
            <Music size={32} className="text-[#ff2a6d] mb-2" />
            <span className="text-3xl font-bold font-orbitron">{stats.totalSongsPlayed}</span>
            <span className="text-sm font-rajdhani text-white/60">SONGS PLAYED</span>
          </div>
          
          <div className="bg-white/5 border border-white/10 p-6 rounded-xl backdrop-blur-sm flex flex-col items-center justify-center text-center">
            <Target size={32} className="text-[#00ff9d] mb-2" />
            <span className="text-3xl font-bold font-orbitron">{calculateLifetimeAccuracy().toFixed(1)}%</span>
            <span className="text-sm font-rajdhani text-white/60">AVG ACCURACY</span>
          </div>

          <div className="bg-white/5 border border-white/10 p-6 rounded-xl backdrop-blur-sm flex flex-col items-center justify-center text-center">
            <Zap size={32} className="text-[#f9e45b] mb-2" />
            <span className="text-3xl font-bold font-orbitron">{stats.bestCombo}</span>
            <span className="text-sm font-rajdhani text-white/60">BEST COMBO</span>
          </div>

          <div className="bg-white/5 border border-white/10 p-6 rounded-xl backdrop-blur-sm flex flex-col items-center justify-center text-center">
            <Clock size={32} className="text-[#00ffff] mb-2" />
            <span className="text-3xl font-bold font-orbitron">{formatTime(stats.totalPlaytimeSeconds)}</span>
            <span className="text-sm font-rajdhani text-white/60">PLAY TIME</span>
          </div>
        </div>

        <section className="bg-white/5 border border-white/10 p-6 rounded-xl backdrop-blur-sm mt-4">
          <h2 className="flex items-center gap-2 text-xl font-bold font-rajdhani text-[#ff2a6d] mb-6">
            <Trophy size={24} /> TOP SONGS
          </h2>
          
          {topSongs.length === 0 ? (
            <p className="text-white/50 text-center py-8">Finish a song to get a high score.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {topSongs.map((song, idx) => (
                <div key={song.id} className="flex items-center justify-between p-4 bg-black/40 rounded border border-white/5">
                  <div className="flex items-center gap-4">
                    <span className="font-orbitron font-bold text-xl text-white/40 w-6">#{idx + 1}</span>
                    <img src={song.thumbnailUrl || 'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?q=80&w=150&auto=format&fit=crop'} alt="thumb" className="w-12 h-12 rounded object-cover" />
                    <div className="flex flex-col">
                      <span className="font-bold font-rajdhani text-lg">{song.title}</span>
                      <span className="text-sm text-white/60">{song.artist}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-orbitron font-bold text-[#00ff9d] text-xl">{song.highScore.toLocaleString()}</span>
                    <span className="text-xs text-white/50">Played {song.timesPlayed} times</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
};
