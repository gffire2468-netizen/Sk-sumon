import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import confetti from 'canvas-confetti';
import { Clock, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';

export const MiningCycleView: React.FC = () => {
  const { setActiveTab, refreshProfile, showToast, settings } = useApp();
  const [cycleStatus, setCycleStatus] = useState<any>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(3600);
  const [claiming, setClaiming] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const data = await api.getMiningCycleStatus();
      setCycleStatus(data);
      setRemainingSeconds(data.remainingSeconds);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch cycle status', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          fetchStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingSeconds]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const res = await api.claimMiningCycle();
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      showToast(`Successfully claimed +${res.rewardAmount} SKX!`, 'success');
      await refreshProfile();
      await fetchStatus();
    } catch (err: any) {
      showToast(err.message || 'Claim failed', 'error');
    } finally {
      setClaiming(false);
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalDuration = cycleStatus?.durationSeconds || settings?.miningCycleDuration || 3600;
  const progressPercent = Math.min(100, Math.max(0, ((totalDuration - remainingSeconds) / totalDuration) * 100));
  const isClaimable = remainingSeconds === 0 && cycleStatus && !cycleStatus.rewardClaimed;

  return (
    <div className="pb-24 px-4 pt-2 max-w-md mx-auto">
      {/* Header Back button */}
      <div className="flex items-center space-x-3 mb-4">
        <button
          onClick={() => setActiveTab('mining')}
          className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-['Chakra_Petch'] font-bold text-xl text-white">HOURLY MINING CYCLE</h2>
      </div>

      {/* Main Cycle Reactor Card */}
      <div className="rounded-3xl bg-gradient-to-b from-gray-900 to-gray-950 border border-emerald-500/20 p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <Clock className={`w-8 h-8 text-emerald-400 ${remainingSeconds > 0 ? 'animate-pulse' : ''}`} />
        </div>

        <h3 className="font-['Chakra_Petch'] font-bold text-2xl text-white mb-1">
          {loading ? 'SYNCING...' : remainingSeconds === 0 ? 'CYCLE READY!' : formatTime(remainingSeconds)}
        </h3>

        <p className="text-xs text-slate-400 mb-6 font-mono">
          {remainingSeconds === 0
            ? 'Cycle finished! Claim your mining rewards.'
            : 'Automated background mining reactor is running.'}
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-gray-950 rounded-full h-3 border border-gray-800 p-0.5 mb-6">
          <div
            style={{ width: `${progressPercent}%` }}
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-500 shadow-[0_0_12px_#10b981]"
          />
        </div>

        {/* Reward Spec */}
        <div className="grid grid-cols-2 gap-3 mb-6 font-mono text-xs">
          <div className="p-3 rounded-2xl bg-gray-950/60 border border-gray-800 text-left">
            <span className="text-slate-400 block text-[10px]">CYCLE REWARD</span>
            <span className="text-base font-bold text-emerald-400">
              +{cycleStatus?.rewardAmount || settings?.miningCycleReward || '0.05'} SKX
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-gray-950/60 border border-gray-800 text-left">
            <span className="text-slate-400 block text-[10px]">DURATION</span>
            <span className="text-base font-bold text-white">60 Minutes</span>
          </div>
        </div>

        {/* Claim Action */}
        <button
          onClick={handleClaim}
          disabled={!isClaimable || claiming}
          className={`w-full py-4 rounded-2xl font-['Chakra_Petch'] font-bold text-sm tracking-wider uppercase transition-all shadow-lg flex items-center justify-center space-x-2 ${
            isClaimable && !claiming
              ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-black shadow-[0_0_25px_rgba(16,185,129,0.5)] active:scale-95'
              : 'bg-gray-900 border border-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          {claiming ? (
            <span>CLAIMING...</span>
          ) : isClaimable ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-black" />
              <span>CLAIM {cycleStatus?.rewardAmount || '0.05'} SKX NOW</span>
            </>
          ) : (
            <>
              <Clock className="w-4 h-4 text-gray-500" />
              <span>MINING IN PROGRESS...</span>
            </>
          )}
        </button>
      </div>

      {/* Rules Notice */}
      <div className="mt-4 p-4 rounded-2xl bg-gray-900/50 border border-gray-800 text-xs text-slate-400 flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <p>
          Each cycle lasts exactly 1 hour (3,600 seconds). The reward is determined server-authoritatively and
          credited directly to your immutable transaction ledger. You can tap simultaneously while the cycle runs.
        </p>
      </div>
    </div>
  );
};
