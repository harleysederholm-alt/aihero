import React, { useState } from 'react';
import { usePersistedStore } from '../store';
import type { SavedSong } from '../store';
import { Play, Trash2, Search, Music } from 'lucide-react';

interface SongsTabProps {
  onPlaySong: (song: SavedSong) => void;
}

export const SongsTab: React.FC<SongsTabProps> = ({ onPlaySong }) => {
  const { savedSongs, removeSavedSong } = usePersistedStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSongs = savedSongs.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.artist.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => b.addedAt - a.addedAt);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (savedSongs.length === 0) {
    return (
      <div className="w-full h-full pt-20 flex flex-col items-center justify-center text-white bg-[#050510]">
        <Music size={64} className="text-[#ff2a6d] mb-6 opacity-50" />
        <h2 className="text-3xl font-rajdhani font-bold mb-4">No Songs Yet</h2>
        <p className="text-white/60">Paste a YouTube URL on the Play tab to add your first song.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full pt-20 px-8 pb-8 text-white flex justify-center bg-[#050510] overflow-y-auto">
      <div className="w-full max-w-5xl flex flex-col gap-6">
        
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-4xl font-black font-orbitron tracking-widest text-[#00ff9d] drop-shadow-[0_0_15px_rgba(0,255,157,0.5)]">
            SONG LIBRARY
          </h1>
          
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" size={18} />
            <input 
              type="text" 
              placeholder="Search songs..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-full py-2 pl-10 pr-4 text-white font-rajdhani focus:outline-none focus:border-[#00ff9d]"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex flex-col gap-2">
          {filteredSongs.length === 0 ? (
            <p className="text-center text-white/50 py-10 font-rajdhani">No songs match your search.</p>
          ) : (
            filteredSongs.map(song => (
              <div 
                key={song.id} 
                className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-black/40 border border-white/10 hover:bg-white/5 hover:border-white/20 transition-all rounded-xl"
              >
                <div className="flex items-center gap-4 w-full sm:w-auto mb-4 sm:mb-0">
                  <div className="relative w-16 h-16 rounded overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                    <img src={song.thumbnailUrl || 'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?q=80&w=150&auto=format&fit=crop'} alt={song.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onPlaySong(song)}
                        className="text-[#00ff9d] hover:text-white"
                      >
                        <Play size={24} fill="currentColor" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col flex-grow">
                    <span className="font-bold font-rajdhani text-xl text-white group-hover:text-[#ff2a6d] transition-colors">{song.title}</span>
                    <span className="text-white/60 text-sm">{song.artist}</span>
                  </div>
                </div>

                <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="flex flex-col sm:items-end text-sm text-white/50 w-24">
                    <span>{formatTime(song.duration)}</span>
                    <span>{song.bpm} BPM</span>
                  </div>
                  
                  <div className="flex flex-col sm:items-end text-sm w-32">
                    <span className="text-[#00ff9d] font-orbitron font-bold">HS: {song.highScore.toLocaleString()}</span>
                    <span className="text-white/40">Played {song.timesPlayed}x</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onPlaySong(song)}
                      className="px-4 py-2 bg-[#ff2a6d]/20 text-[#ff2a6d] hover:bg-[#ff2a6d] hover:text-white font-rajdhani font-bold rounded flex items-center gap-2 transition-colors"
                    >
                      <Play size={16} fill="currentColor" /> PLAY
                    </button>
                    <button 
                      onClick={() => {
                        if (window.confirm(`Delete ${song.title}?`)) removeSavedSong(song.id);
                      }}
                      className="p-2 text-white/30 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};
