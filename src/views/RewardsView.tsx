import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import confetti from 'canvas-confetti';
import { Gift, CheckCircle2, ArrowLeft, Calendar, Sparkles } from 'lucide-react';

export const RewardsView: React.FC = () => {
  const { setActiveTab, refreshProfile, showToast, settings } = useApp();
  const [dailyStatus, setDailyStatus] = useState<any>(null);
  const [claiming, setClaiming] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const data = await api.getDailyRewardStatus();
      setDailyStatus(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch reward status', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const res = await api.claimDailyReward();
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      showToast(`Daily Bonus Claimed: +${res.rewardAmount} SKX!`, 'success');
      await refreshProfile();
      await fetchStatus();
    } catch (err: any) {
      showToast(err.message || 'Failed to claim daily reward', 'error');
    } finally {
      setClaiming(false);
    }
  };

  const isClaimed = dailyStatus?.todayClaimed;

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
        <h2 className="font-['Chakra_Petch'] font-bold text-xl text-white">DAILY REWARD MATRIX</h2>
      </div>

      {/* Main Reward Card */}
      <div className="rounded-3xl bg-gradient-to-b from-gray-900 to-gray-950 border border-emerald-500/20 p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-purple-950 border border-emerald-500/40 flex items-center justify-center">
          <Gift className={`w-8 h-8 text-emerald-400 ${!isClaimed ? 'animate-bounce' : ''}`} />
        </div>

        <h3 className="font-['Chakra_Petch'] font-bold text-2xl text-white mb-1">
          {loading ? 'CHECKING...' : isClaimed ? 'CLAIMED TODAY' : 'BONUS UNLOCKED'}
        </h3>

        <p className="text-xs text-slate-400 mb-6 font-mono">
          {isClaimed
            ? 'You have already collected today’s daily reward. Next bonus available tomorrow (UTC 00:00).'
            : 'Claim your daily attendance bonus to boost your SKX mining balance!'}
        </p>

        {/* Reward Value Display */}
        <div className="p-4 rounded-2xl bg-gray-950/80 border border-gray-800 mb-6 flex items-center justify-between font-mono">
          <div className="text-left">
            <span className="text-[10px] text-slate-400 uppercase block">Daily Reward</span>
            <span className="text-xl font-bold text-emerald-400">
              +{dailyStatus?.rewardAmount || settings?.dailyRewardBase || '0.01'} SKX
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase block">UTC Date</span>
            <span className="text-xs text-slate-300">{dailyStatus?.dayKey || 'Today'}</span>
          </div>
        </div>

        <button
          onClick={handleClaim}
          disabled={isClaimed || claiming || loading}
          className={`w-full py-4 rounded-2xl font-['Chakra_Petch'] font-bold text-sm tracking-wider uppercase transition-all shadow-lg flex items-center justify-center space-x-2 ${
            !isClaimed && !claiming && !loading
              ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-black shadow-[0_0_25px_rgba(16,185,129,0.5)] active:scale-95'
              : 'bg-gray-900 border border-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          {claiming ? (
            <span>CLAIMING...</span>
          ) : isClaimed ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>COLLECTED FOR TODAY</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-black" />
              <span>COLLECT TODAY'S BONUS</span>
            </>
          )}
        </button>
      </div>

      {/* Daily Streak Grid Showcase */}
      <div className="rounded-3xl bg-gray-900/60 border border-gray-800 p-5">
        <div className="flex items-center space-x-2 mb-3">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <h4 className="font-['Chakra_Petch'] font-bold text-sm text-white">ATTENDANCE CALENDAR</h4>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'].map((day, idx) => (
            <div
              key={day}
              className={`p-2 rounded-xl text-center border text-[10px] font-mono ${
                idx === 0 && isClaimed
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-gray-950/60 border-gray-800 text-slate-500'
              }`}
            >
              <div className="font-bold">{day}</div>
              <div className="text-[9px] mt-1 text-emerald-400">+0.01</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
