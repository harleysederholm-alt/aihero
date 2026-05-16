import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

interface LeaderboardEntry {
  rank: number;
  address: string;
  song: string;
  score: number;
  accuracy: number;
  date: string;
}

export const WalletTab: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('all');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      const stored = JSON.parse(localStorage.getItem('airockhero_scores') ?? '[]');
      const entries: LeaderboardEntry[] = stored.slice(0, 20).map((s: any, i: number) => ({
        rank: i + 1,
        address: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Player',
        song: s.songTitle || 'Unknown',
        score: s.score || 0,
        accuracy: s.accuracy || 0,
        date: new Date(s.timestamp || Date.now()).toLocaleDateString(),
      }));
      setLeaderboard(entries.length > 0 ? entries : []);
      setLoading(false);
    }, 400);
  }, [period, address]);

  return (
    <div className="w-full h-full pt-20 px-8 pb-8 text-white flex justify-center bg-[#050510] overflow-y-auto">
      <div className="w-full max-w-4xl flex flex-col gap-8">
        
        {/* Premium Connect Banner */}
        <div className="hud-panel p-8 flex flex-col items-center relative overflow-hidden shadow-[0_0_40px_rgba(0,255,157,0.15)] flex-shrink-0">
          <div className="absolute inset-0 opacity-[0.05] bg-[radial-gradient(circle_at_center,_#00ff9d,_transparent_70%)]" />
          
          {!isConnected ? (
            <div className="text-center z-10 flex flex-col items-center gap-6">
              <h2 className="text-4xl font-black font-orbitron text-[#00ff9d] tracking-tighter drop-shadow-[0_0_15px_rgba(0,255,157,0.5)]">
                CONNECT TO COMPETE
              </h2>
              <p className="text-white/70 max-w-md font-rajdhani text-lg leading-tight">
                Submit your legendary scores to the global leaderboard and compete for exclusive prizes.
              </p>
              <div className="scale-110 hover:scale-115 transition-transform">
                <ConnectButton />
              </div>
              <div className="mt-4 pt-4 border-t border-white/10 w-full flex flex-col items-center">
                <p className="text-xs text-white/30 uppercase tracking-[0.2em]">Partnered with</p>
                <a href="https://northcrypto.com" target="_blank" rel="noopener noreferrer" className="text-[#00ff9d] font-bold hover:text-white transition-colors mt-2 text-lg">
                  NORTHCRYPTO
                </a>
              </div>
            </div>
          ) : (
            <div className="w-full z-10 flex flex-col sm:flex-row items-center justify-between gap-6 px-4">
              <div className="flex flex-col">
                <span className="text-white/40 font-rajdhani text-sm uppercase tracking-widest">Active Wallet</span>
                <span className="text-3xl font-black font-orbitron text-[#00ff9d] drop-shadow-[0_0_10px_rgba(0,255,157,0.3)]">
                  {address?.slice(0,6)}<span className="text-white/20">...</span>{address?.slice(-4)}
                </span>
              </div>
              <div className="flex gap-4 items-center">
                <div className="hidden md:flex flex-col items-end mr-4">
                  <span className="text-white/30 text-xs uppercase">Network</span>
                  <span className="text-white/70 font-bold">Mainnet</span>
                </div>
                <ConnectButton />
              </div>
            </div>
          )}
        </div>

        {/* Leaderboard Section */}
        <div className="flex flex-col gap-4 flex-shrink-0 pb-12">
          <div className="flex justify-between items-center mb-2">
            <div className="flex flex-col">
              <h2 className="text-3xl font-black font-orbitron text-white italic tracking-tighter">GLOBAL LEADERBOARD</h2>
              <div className="h-1 w-24 bg-gradient-to-r from-[#ff2a6d] to-transparent mt-1" />
            </div>
            <div className="flex gap-2 p-1 bg-white/5 rounded-full border border-white/10">
              {(['week', 'month', 'all'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-5 py-1.5 text-xs uppercase tracking-widest font-bold rounded-full transition-all ${
                    period === p 
                      ? 'bg-[#ff2a6d] text-white shadow-[0_0_15px_rgba(255,42,109,0.4)]' 
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All Time'}
                </button>
              ))}
            </div>
          </div>

          {isConnected && (
            <div className="mb-2 p-4 bg-[#00ff9d]/5 border border-[#00ff9d]/20 rounded-xl flex items-center gap-4">
              <div className="w-2 h-2 bg-[#00ff9d] rounded-full animate-pulse shadow-[0_0_10px_#00ff9d]" />
              <p className="text-[#00ff9d]/80 font-rajdhani text-sm tracking-wide">
                WALLET CONNECTED — YOUR SCORES ARE NOW ELIGIBLE FOR LEADERBOARD PRIZES
              </p>
            </div>
          )}

          <div className="hud-panel-cyan overflow-hidden shadow-[0_0_30px_rgba(5,217,232,0.1)]">
            <table className="w-full text-left font-rajdhani border-collapse">
              <thead>
                <tr className="bg-white/[0.03] text-white/40 border-b border-white/10 uppercase text-[10px] tracking-[0.2em] font-bold">
                  <th className="p-5">Rank</th>
                  <th className="p-5">Player Entity</th>
                  <th className="p-5">Track Title</th>
                  <th className="p-5 text-right">Raw Score</th>
                  <th className="p-5 text-right">ACC%</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="border-b border-white/5 animate-pulse">
                      <td className="p-4"><div className="h-4 bg-white/10 rounded w-4"></div></td>
                      <td className="p-4"><div className="h-4 bg-white/10 rounded w-24"></div></td>
                      <td className="p-4"><div className="h-4 bg-white/10 rounded w-16"></div></td>
                      <td className="p-4 flex justify-end"><div className="h-4 bg-white/10 rounded w-16"></div></td>
                      <td className="p-4"><div className="h-4 bg-white/10 rounded w-12 ml-auto"></div></td>
                    </tr>
                  ))
                ) : leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-white/40 font-rajdhani">
                      No scores yet. Play a song to appear on the leaderboard!
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((entry, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-white/[0.03] hover:bg-white/[0.05] transition-colors group ${
                        isConnected && address?.toLowerCase().includes(entry.address.split('...')[0].toLowerCase())
                          ? 'bg-[#00ff9d]/5 border-l-2 border-l-[#00ff9d]'
                          : ''
                      }`}
                    >
                      <td className="p-5 font-black font-orbitron italic text-xl">
                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                      </td>
                      <td className="p-5">
                        <div className="flex flex-col">
                          <span className="text-white font-bold">{entry.address}</span>
                          <span className="text-[10px] text-white/20 uppercase tracking-tighter">{entry.date}</span>
                        </div>
                      </td>
                      <td className="p-5">
                        <span className="text-[#ff2a6d] font-black text-sm uppercase italic tracking-tighter drop-shadow-[0_0_8px_rgba(255,45,85,0.3)]">
                          {entry.song}
                        </span>
                      </td>
                      <td className="p-5 text-right">
                        <span className="font-orbitron font-bold text-[#00ff9d] text-2xl tracking-tighter drop-shadow-[0_0_10px_rgba(0,255,157,0.2)]">
                          {/* Use standard font fallback to prevent box characters for zero */}
                          <span style={{ fontFamily: 'Orbitron, sans-serif' }}>
                            {Math.floor(entry.score || 0).toLocaleString()}
                          </span>
                        </span>
                      </td>
                      <td className="p-5 text-right font-bold text-white/80">
                        {entry.accuracy.toFixed(1)}<span className="text-[10px] text-white/30 ml-0.5">%</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>
    </div>
  );
};
