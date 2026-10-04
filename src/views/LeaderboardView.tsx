import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { Trophy, ArrowLeft, Medal } from 'lucide-react';
import { LeaderboardItem } from '../types';

export const LeaderboardView: React.FC = () => {
  const { setActiveTab, showToast } = useApp();
  const [miners, setMiners] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getLeaderboard()
      .then((data) => setMiners(data))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  return (
    <div className="pb-24 px-4 pt-2 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-4">
        <button
          onClick={() => setActiveTab('mining')}
          className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-['Chakra_Petch'] font-bold text-xl text-white">MINERS LEADERBOARD</h2>
      </div>

      {/* Top 3 Podium Cards */}
      <div className="rounded-3xl bg-gradient-to-b from-gray-900 to-gray-950 border border-emerald-500/20 p-5 mb-5">
        <div className="flex items-center justify-between mb-3 text-xs font-mono text-emerald-400">
          <span className="flex items-center gap-1.5 font-bold">
            <Trophy className="w-4 h-4" />
            TOP CYBER MINERS
          </span>
          <span className="text-slate-500">Live Global Ranking</span>
        </div>

        {loading ? (
          <div className="text-center py-6 text-slate-500 text-xs font-mono">Syncing leaderboard...</div>
        ) : miners.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs font-mono">No ranked miners yet.</div>
        ) : (
          <div className="space-y-2">
            {miners.map((m) => {
              const isTop1 = m.rank === 1;
              const isTop2 = m.rank === 2;
              const isTop3 = m.rank === 3;

              return (
                <div
                  key={m.rank}
                  className={`flex items-center justify-between p-3 rounded-2xl border text-xs font-mono transition-all ${
                    isTop1
                      ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                      : isTop2
                      ? 'bg-slate-800/30 border-slate-400/40 text-slate-200'
                      : isTop3
                      ? 'bg-amber-900/10 border-amber-700/40 text-amber-300'
                      : 'bg-gray-950/60 border-gray-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span
                      className={`flex items-center justify-center w-7 h-7 rounded-xl font-bold ${
                        isTop1
                          ? 'bg-amber-500 text-black'
                          : isTop2
                          ? 'bg-slate-300 text-black'
                          : isTop3
                          ? 'bg-amber-700 text-white'
                          : 'bg-gray-900 text-slate-400 border border-gray-800'
                      }`}
                    >
                      {m.rank}
                    </span>
                    <span className="font-medium text-white truncate max-w-[140px]">{m.display_name}</span>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-emerald-400">{m.balance}</span>
                    <span className="text-[10px] text-slate-500 ml-1">SKX</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
