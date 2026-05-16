import { useState } from 'react';
import { Navigation } from './components/Navigation';
import type { TabType } from './components/Navigation';
import { PlayTab } from './components/PlayTab';
import { SongsTab } from './components/SongsTab';
import { StatsTab } from './components/StatsTab';
import { SettingsTab } from './components/SettingsTab';
import { WalletTab } from './components/WalletTab';
import type { SavedSong } from './store';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('play');
  
  // State to hold the song to play when transitioning from SongsTab to PlayTab
  const [songToPlay, setSongToPlay] = useState<SavedSong | null>(null);

  const handlePlaySong = (song: SavedSong) => {
    setSongToPlay(song);
    setActiveTab('play');
  };

  return (
    <div className="w-full h-screen bg-[#050510] overflow-hidden flex flex-col relative font-rajdhani text-white select-none">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="flex-1 w-full h-full relative">
        {activeTab === 'play' && <PlayTab songToPlay={songToPlay} />}
        {activeTab === 'songs' && <SongsTab onPlaySong={handlePlaySong} />}
        {activeTab === 'stats' && <StatsTab />}
        {activeTab === 'settings' && <SettingsTab />}
        {activeTab === 'wallet' && <WalletTab />}
      </div>
    </div>
  );
}
