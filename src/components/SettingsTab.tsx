import React from 'react';
import { usePersistedStore } from '../store';
import { MonitorPlay, Volume2, Gamepad2, Zap } from 'lucide-react';

export const SettingsTab: React.FC = () => {
  const { settings, updateSettings } = usePersistedStore();

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  const runLatencyTest = () => {
    // Simple mock for latency test
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
    
    // Listen for next keypress
    const t0 = performance.now();
    const handler = () => {
      const t1 = performance.now();
      const latency = Math.round(t1 - t0 - 100); // subtract the 100ms beep time 
      updateSettings({ audioLatencyMs: Math.min(Math.max(latency, -200), 200) });
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('keydown', handler);
  };

  return (
    <div className="w-full h-full pt-20 px-8 pb-8 text-white flex justify-center bg-[#050510] overflow-y-auto">
      <div className="w-full max-w-3xl flex flex-col gap-8">
        
        <div className="text-center mb-4">
          <h1 className="text-4xl font-black font-orbitron tracking-widest text-[#00ff9d] drop-shadow-[0_0_15px_rgba(0,255,157,0.5)]">
            SETTINGS
          </h1>
        </div>

        {/* Audio Section */}
        <section className="bg-white/5 border border-white/10 p-6 rounded-xl backdrop-blur-sm">
          <h2 className="flex items-center gap-2 text-xl font-bold font-rajdhani text-[#ff2a6d] mb-6">
            <Volume2 size={24} /> AUDIO
          </h2>
          
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="flex justify-between font-rajdhani text-lg">
                <span>Music Volume</span>
                <span className="text-[#00ff9d]">{settings.musicVolume}%</span>
              </label>
              <input
                type="range" min="0" max="100"
                value={settings.musicVolume}
                onChange={(e) => updateSettings({ musicVolume: Number(e.target.value) })}
                className="w-full accent-[#ff2a6d]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex justify-between font-rajdhani text-lg">
                <span>SFX Volume</span>
                <span className="text-[#00ff9d]">{settings.sfxVolume}%</span>
              </label>
              <input
                type="range" min="0" max="100"
                value={settings.sfxVolume}
                onChange={(e) => updateSettings({ sfxVolume: Number(e.target.value) })}
                className="w-full accent-[#ff2a6d]"
              />
            </div>
            
            <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
              <label className="flex justify-between font-rajdhani text-lg">
                <span>Audio Latency (ms)</span>
                <span className="text-[#00ff9d]">{settings.audioLatencyMs}ms</span>
              </label>
              <div className="flex gap-4 items-center">
                <input
                  type="range" min="-200" max="200" step="5"
                  value={settings.audioLatencyMs}
                  onChange={(e) => updateSettings({ audioLatencyMs: Number(e.target.value) })}
                  className="w-full accent-[#ff2a6d]"
                />
                <button 
                  onClick={runLatencyTest}
                  className="whitespace-nowrap px-4 py-2 bg-white/10 hover:bg-[#00ff9d]/20 hover:text-[#00ff9d] transition-colors rounded font-rajdhani font-bold flex items-center gap-2"
                >
                  <Zap size={16} /> Auto-Detect
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Gameplay Section */}
        <section className="bg-white/5 border border-white/10 p-6 rounded-xl backdrop-blur-sm">
          <h2 className="flex items-center gap-2 text-xl font-bold font-rajdhani text-[#ff2a6d] mb-6">
            <Gamepad2 size={24} /> GAMEPLAY
          </h2>
          
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="font-rajdhani text-lg">Note Speed</span>
              <select 
                value={settings.noteSpeed}
                onChange={(e) => updateSettings({ noteSpeed: e.target.value as any })}
                className="bg-[#0a0a1f] border border-white/20 rounded px-4 py-2 font-rajdhani text-white outline-none focus:border-[#00ff9d]"
              >
                <option value="slow">Slow</option>
                <option value="medium">Medium</option>
                <option value="fast">Fast</option>
                <option value="expert">Expert</option>
              </select>
            </div>
          </div>
        </section>

        {/* Display Section */}
        <section className="bg-white/5 border border-white/10 p-6 rounded-xl backdrop-blur-sm">
          <h2 className="flex items-center gap-2 text-xl font-bold font-rajdhani text-[#ff2a6d] mb-6">
            <MonitorPlay size={24} /> DISPLAY & ACCESSIBILITY
          </h2>
          
          <div className="flex flex-col gap-6">
            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex flex-col">
                <span className="font-rajdhani text-lg group-hover:text-white text-white/90">Show FPS</span>
                <span className="text-sm text-white/50">Display frames per second counter</span>
              </div>
              <input 
                type="checkbox" 
                checked={settings.showFPS}
                onChange={(e) => updateSettings({ showFPS: e.target.checked })}
                className="w-6 h-6 accent-[#00ff9d]"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex flex-col">
                <span className="font-rajdhani text-lg group-hover:text-white text-white/90">Reduced Motion</span>
                <span className="text-sm text-white/50">Disable screen shake and intense particles</span>
              </div>
              <input 
                type="checkbox" 
                checked={settings.reducedMotion}
                onChange={(e) => updateSettings({ reducedMotion: e.target.checked })}
                className="w-6 h-6 accent-[#00ff9d]"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex flex-col">
                <span className="font-rajdhani text-lg group-hover:text-white text-white/90">Colorblind Mode</span>
                <span className="text-sm text-white/50">Add shape indicators to notes</span>
              </div>
              <input 
                type="checkbox" 
                checked={settings.colorblindMode}
                onChange={(e) => updateSettings({ colorblindMode: e.target.checked })}
                className="w-6 h-6 accent-[#00ff9d]"
              />
            </label>
            
            <div className="pt-4 border-t border-white/10 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="font-rajdhani text-lg">Fullscreen Mode</span>
                <span className="text-sm text-white/50">Take over the entire screen</span>
              </div>
              <button 
                onClick={toggleFullscreen}
                className="px-6 py-2 bg-[#ff2a6d]/20 text-[#ff2a6d] border border-[#ff2a6d]/50 rounded hover:bg-[#ff2a6d]/40 transition-colors font-rajdhani font-bold"
              >
                Toggle Fullscreen
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};
