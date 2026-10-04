import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import confetti from 'canvas-confetti';
import { Tv, Play, CheckCircle2, ArrowLeft, AlertCircle, Sparkles, Clock } from 'lucide-react';

export const EarnAdsView: React.FC = () => {
  const { setActiveTab, refreshProfile, showToast, settings } = useApp();
  const [adStatus, setAdStatus] = useState<any>(null);
  const [watching, setWatching] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [activeOpportunity, setActiveOpportunity] = useState<{ id: string; token: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const data = await api.getAdStatus();
      setAdStatus(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load ad status', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleStartWatch = async () => {
    if (!adStatus?.adsEnabled) {
      showToast('Ad reward is currently unavailable.', 'info');
      return;
    }

    if (adStatus.remainingAds <= 0) {
      showToast('Daily ad limit reached. Come back tomorrow!', 'info');
      return;
    }

    try {
      const opp = await api.requestAdOpportunity();
      setActiveOpportunity({ id: opp.opportunityId, token: opp.token });
      setWatching(true);
      setCountdown(5);

      // Countdown ticker for verified view
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            completeAd(opp.opportunityId, opp.token);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      showToast(err.message || 'Failed to start ad', 'error');
    }
  };

  const completeAd = async (opportunityId: string, token: string) => {
    try {
      const res = await api.verifyAd(opportunityId, token);
      confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
      showToast(`এড ভেরিফিকেশন সফল! +${res.rewardAmount} SKX রিওয়ার্ড যোগ হয়েছে।`, 'success');
      setWatching(false);
      setActiveOpportunity(null);
      await refreshProfile();
      await fetchStatus();
    } catch (err: any) {
      showToast(err.message || 'Ad verification failed', 'error');
      setWatching(false);
      setActiveOpportunity(null);
    }
  };

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
        <h2 className="font-['Chakra_Petch'] font-bold text-xl text-white">📺 এড দেখে ইনকাম</h2>
      </div>

      {/* Main Ad Portal Card */}
      <div className="rounded-3xl bg-gradient-to-b from-gray-900 to-gray-950 border border-emerald-500/20 p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden text-center mb-5">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-950 border border-emerald-500/40 flex items-center justify-center">
          <Tv className="w-8 h-8 text-emerald-400" />
        </div>

        <h3 className="font-['Chakra_Petch'] font-bold text-2xl text-white mb-1">
          REWARDED AD PORTAL
        </h3>

        <p className="text-xs text-slate-400 mb-6 font-mono">
          ছোট ভিডিও এড দেখে প্রতিদিন অতিরিক্ত SKX রিওয়ার্ড অর্জন করুন।
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6 font-mono text-xs">
          <div className="p-3 rounded-2xl bg-gray-950/80 border border-gray-800 text-left">
            <span className="text-slate-400 block text-[10px]">REWARD PER AD</span>
            <span className="text-base font-bold text-emerald-400">
              +{adStatus?.rewardPerAd || settings?.adReward || '0.001'} SKX
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-gray-950/80 border border-gray-800 text-left">
            <span className="text-slate-400 block text-[10px]">DAILY LIMIT</span>
            <span className="text-base font-bold text-white">
              {adStatus?.adsWatchedToday || 0} / {adStatus?.dailyLimit || 20}
            </span>
          </div>
        </div>

        {/* Earnings progress bar */}
        <div className="mb-6 text-left">
          <div className="flex justify-between text-[11px] font-mono mb-1.5 text-slate-400">
            <span>Today's Ad Earnings:</span>
            <span className="text-emerald-400 font-bold">
              {adStatus?.todayEarnings || '0.0000'} / {adStatus?.maxDailyEarnings || '0.020'} SKX
            </span>
          </div>
          <div className="w-full h-2.5 bg-gray-950 rounded-full border border-gray-800 p-0.5">
            <div
              style={{
                width: `${Math.min(
                  100,
                  ((parseFloat(adStatus?.todayEarnings || '0') /
                    parseFloat(adStatus?.maxDailyEarnings || '0.02')) || 0) * 100
                )}%`,
              }}
              className="h-full rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"
            />
          </div>
        </div>

        {/* Watch Ad Action or Watching State */}
        {watching ? (
          <div className="p-5 rounded-2xl bg-gray-950 border border-emerald-500/40 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
            <p className="font-bold text-sm text-white mb-1 font-['Chakra_Petch']">
              SPONSORED AD PLAYING...
            </p>
            <p className="text-xs text-emerald-400 font-mono">
              অনুগ্রহ করে অপেক্ষা করুন: {countdown} সেকেন্ড
            </p>
          </div>
        ) : (
          <button
            onClick={handleStartWatch}
            disabled={!adStatus?.adsEnabled || adStatus?.remainingAds <= 0}
            className={`w-full py-4 rounded-2xl font-['Chakra_Petch'] font-bold text-sm tracking-wider uppercase transition-all shadow-lg flex items-center justify-center space-x-2 ${
              adStatus?.adsEnabled && adStatus?.remainingAds > 0
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95'
                : 'bg-gray-900 text-gray-500 border border-gray-800 cursor-not-allowed'
            }`}
          >
            {!adStatus?.adsEnabled ? (
              <span>এড রিওয়ার্ড বর্তমানে বন্ধ রয়েছে</span>
            ) : adStatus?.remainingAds <= 0 ? (
              <span>আজকের লিমিট শেষ ({adStatus.dailyLimit}/{adStatus.dailyLimit})</span>
            ) : (
              <>
                <Play className="w-4 h-4 fill-black" />
                <span>ভিডিও এড দেখুন (+{adStatus?.rewardPerAd || '0.001'} SKX)</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Rules Card */}
      <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 text-xs text-slate-400 space-y-2">
        <p className="font-bold text-slate-300">নিয়মাবলী:</p>
        <p>• প্রতিটি সম্পূর্ণ এড দেখার পর স্বয়ংক্রিয়ভাবে ব্যালেন্সে রিওয়ার্ড জমা হবে।</p>
        <p>• দৈনিক সর্বোচ্চ ২০টি এড দেখা যাবে (সর্বোচ্চ রিওয়ার্ড ০.০২০ SKX)।</p>
        <p>• ১০০ টি ট্যাপ সফল হলে অতিরিক্ত বোনাস এডের সুযোগ আনলক হয়।</p>
      </div>
    </div>
  );
};
