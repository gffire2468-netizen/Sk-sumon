import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Zap, Pickaxe, Gift, Users, Wallet, Tv, Globe, HelpCircle, ArrowUpRight } from 'lucide-react';

interface FloatingNumber {
  id: number;
  x: number;
  y: number;
  value: string;
}

export const MiningView: React.FC = () => {
  const {
    profile,
    liveEnergy,
    maxEnergy,
    handleTap,
    tapReward,
    setActiveTab,
    hasAdOpportunity,
    settings,
  } = useApp();

  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([]);

  const onReactorClick = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    // Determine coordinate for floating reward animation
    let clientX = window.innerWidth / 2;
    let clientY = window.innerHeight / 2 - 50;

    if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if (e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    const id = Date.now() + Math.random();
    setFloatingNumbers((prev) => [
      ...prev.slice(-10),
      { id, x: clientX - 25, y: clientY - 30, value: `+${tapReward} SKX` },
    ]);

    setTimeout(() => {
      setFloatingNumbers((prev) => prev.filter((item) => item.id !== id));
    }, 900);

    handleTap();
  };

  const energyPercentage = Math.min(100, Math.max(0, (liveEnergy / maxEnergy) * 100));

  return (
    <div className="relative pb-24 px-4 pt-2 max-w-md mx-auto flex flex-col items-center">
      {/* Floating particles container */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {floatingNumbers.map((num) => (
          <div
            key={num.id}
            style={{ left: `${num.x}px`, top: `${num.y}px` }}
            className="absolute font-['JetBrains_Mono'] font-bold text-sm text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-float-fade"
          >
            {num.value}
          </div>
        ))}
      </div>

      {/* 100-Tap Ad Opportunity Notification Banner */}
      {hasAdOpportunity && (
        <div
          onClick={() => setActiveTab('ads')}
          className="w-full mb-3 cursor-pointer p-3 rounded-2xl bg-gradient-to-r from-emerald-950/90 to-gray-900 border border-emerald-400/60 shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-between animate-pulse"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-300 font-['Chakra_Petch']">
                🎯 100-TAP AD OPPORTUNITY UNLOCKED!
              </p>
              <p className="text-[11px] text-gray-300">
                এড দেখে বোনাস রিওয়ার্ড সংগ্রহ করুন (+{settings?.adReward || '0.001'} SKX)
              </p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-emerald-400" />
        </div>
      )}

      {/* Futuristic Balance Card */}
      <div className="w-full rounded-3xl bg-gradient-to-b from-gray-900/90 to-gray-950/90 border border-emerald-500/20 p-5 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden mb-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider font-mono text-emerald-400/80 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Active Balance
          </span>
          <span className="text-[11px] font-mono text-slate-400 bg-gray-950 px-2 py-0.5 rounded-full border border-gray-800">
            {profile?.user.telegram_id ? `ID: ${profile.user.telegram_id}` : 'Syncing...'}
          </span>
        </div>

        <div className="flex items-baseline space-x-2">
          <h1 className="font-['Chakra_Petch'] text-4xl font-extrabold text-white tracking-tight drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            {profile?.balance.available_balance || '0.00000000'}
          </h1>
          <span className="font-['Chakra_Petch'] font-bold text-emerald-400 text-lg">SKX</span>
        </div>

        {/* Sub-balance metrics */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-800/80 text-[11px] font-mono">
          <div className="flex justify-between text-slate-400">
            <span>Reserved:</span>
            <span className="text-amber-400">{profile?.balance.reserved_balance || '0.0000'} SKX</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Lifetime:</span>
            <span className="text-emerald-300">{profile?.balance.total_earned || '0.0000'} SKX</span>
          </div>
        </div>
      </div>

      {/* Main Tap Reactor Button */}
      <div className="relative my-4 flex items-center justify-center">
        {/* Outer Pulsing Glow Rings */}
        <div className="absolute w-64 h-64 rounded-full bg-emerald-500/10 blur-xl animate-pulse pointer-events-none" />
        <div className="absolute w-56 h-56 rounded-full border border-emerald-500/20 animate-spin-slow pointer-events-none" />

        <button
          onClick={onReactorClick}
          disabled={liveEnergy < (settings?.energyPerTap || 1)}
          className={`relative w-48 h-48 rounded-full flex flex-col items-center justify-center select-none outline-none transition-all duration-150 transform active:scale-95 shadow-[0_0_40px_rgba(16,185,129,0.25)] border-4 ${
            liveEnergy < (settings?.energyPerTap || 1)
              ? 'bg-gray-900 border-gray-700 opacity-60 cursor-not-allowed'
              : 'bg-gradient-to-br from-emerald-950 via-gray-950 to-black border-emerald-500/50 hover:border-emerald-400 hover:shadow-[0_0_60px_rgba(16,185,129,0.4)]'
          }`}
        >
          {/* Cyber reactor interior */}
          <div className="absolute inset-2 rounded-full border border-emerald-500/30 flex items-center justify-center bg-gray-950/40 backdrop-blur-sm">
            <div className="relative flex flex-col items-center">
              <Pickaxe className="w-12 h-12 text-emerald-400 mb-1 drop-shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-bounce" />
              <span className="font-['Chakra_Petch'] font-extrabold text-sm tracking-widest text-white">
                TAP TO MINE
              </span>
              <span className="text-[10px] font-mono text-emerald-400/90 mt-0.5">
                +{tapReward} SKX / tap
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Energy Status Bar */}
      <div className="w-full mt-4 bg-gray-900/80 border border-gray-800 rounded-2xl p-4 backdrop-blur-md">
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400" />
            <span className="font-medium">Energy Reserve</span>
          </div>
          <div className="flex items-center space-x-1 font-mono">
            <span className="font-bold text-white">{liveEnergy}</span>
            <span className="text-slate-500">/ {maxEnergy}</span>
            <span className="text-[10px] text-emerald-400 ml-1">(+1/s)</span>
          </div>
        </div>

        {/* Progress track */}
        <div className="w-full h-3 bg-gray-950 rounded-full overflow-hidden p-0.5 border border-gray-800">
          <div
            style={{ width: `${energyPercentage}%` }}
            className={`h-full rounded-full transition-all duration-300 ${
              energyPercentage > 30
                ? 'bg-gradient-to-r from-emerald-500 to-green-400 shadow-[0_0_10px_#10b981]'
                : 'bg-gradient-to-r from-amber-500 to-rose-500 shadow-[0_0_10px_#f43f5e]'
            }`}
          />
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="w-full grid grid-cols-3 gap-2.5 mt-4">
        <button
          onClick={() => setActiveTab('cycle')}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-900/60 border border-gray-800 hover:border-emerald-500/40 transition-all active:scale-95 text-slate-300"
        >
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 mb-1">
            <Pickaxe className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium">Hourly Cycle</span>
          <span className="text-[10px] text-emerald-400 font-mono">+0.05 SKX</span>
        </button>

        <button
          onClick={() => setActiveTab('referrals')}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-900/60 border border-gray-800 hover:border-emerald-500/40 transition-all active:scale-95 text-slate-300"
        >
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 mb-1">
            <Users className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium">Referrals</span>
          <span className="text-[10px] text-purple-400 font-mono">+0.2 SKX</span>
        </button>

        <button
          onClick={() => setActiveTab('withdraw')}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-900/60 border border-gray-800 hover:border-emerald-500/40 transition-all active:scale-95 text-slate-300"
        >
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 mb-1">
            <Wallet className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium">Withdraw</span>
          <span className="text-[10px] text-blue-400 font-mono">Min 5 SKX</span>
        </button>
      </div>

      {/* Secondary Quick Action Row */}
      <div className="w-full grid grid-cols-3 gap-2.5 mt-2.5">
        <button
          onClick={() => setActiveTab('ads')}
          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-gray-900/40 border border-gray-800/80 hover:border-emerald-500/40 transition-all active:scale-95 text-slate-300"
        >
          <Tv className="w-4 h-4 text-emerald-400 mb-1" />
          <span className="text-[11px] font-medium">এড দেখে ইনকাম</span>
        </button>

        <button
          onClick={() => setActiveTab('community')}
          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-gray-900/40 border border-gray-800/80 hover:border-emerald-500/40 transition-all active:scale-95 text-slate-300"
        >
          <Globe className="w-4 h-4 text-sky-400 mb-1" />
          <span className="text-[11px] font-medium">Community (+0.1)</span>
        </button>

        <button
          onClick={() => setActiveTab('support')}
          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-gray-900/40 border border-gray-800/80 hover:border-emerald-500/40 transition-all active:scale-95 text-slate-300"
        >
          <HelpCircle className="w-4 h-4 text-amber-400 mb-1" />
          <span className="text-[11px] font-medium">Support</span>
        </button>
      </div>
    </div>
  );
};
