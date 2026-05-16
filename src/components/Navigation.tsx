import React from 'react';
import { Play, Music, Activity, Settings, Wallet } from 'lucide-react';

export type TabType = 'play' | 'songs' | 'stats' | 'settings' | 'wallet';

interface NavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'play', icon: Play, label: 'PLAY' },
    { id: 'songs', icon: Music, label: 'SONGS' },
    { id: 'stats', icon: Activity, label: 'STATS' },
    { id: 'settings', icon: Settings, label: 'SETTINGS' },
    { id: 'wallet', icon: Wallet, label: 'WALLET' },
  ] as const;

  return (
    <nav className="absolute top-0 left-0 w-full h-16 bg-[#0a0a1f]/95 backdrop-blur-md border-b border-white/10 z-[100] flex items-center px-6">
      {/* Logo */}
      <div className="flex-shrink-0 w-44 flex items-center">
        <img src="/logo.png" alt="AI Rock Hero" className="h-10 w-auto drop-shadow-[0_0_10px_rgba(255,42,109,0.5)]" />
      </div>
      {/* Tabs centered */}
      <div className="flex-1 flex items-center justify-center gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-rajdhani font-bold tracking-widest transition-all duration-300 ${
                isActive
                  ? 'bg-[#ff2a6d]/20 text-[#ff2a6d] border border-[#ff2a6d]/50 shadow-[0_0_15px_rgba(255,42,109,0.3)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon size={18} className={isActive ? 'animate-pulse' : ''} />
              {tab.label}
            </button>
          );
        })}
      </div>
      {/* Balance spacer */}
      <div className="flex-shrink-0 w-44" />
    </nav>
  );
};
