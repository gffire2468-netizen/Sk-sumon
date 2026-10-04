import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import confetti from 'canvas-confetti';
import { Globe, CheckCircle2, ArrowLeft, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';

export const CommunityView: React.FC = () => {
  const { setActiveTab, refreshProfile, showToast, settings } = useApp();
  const [commStatus, setCommStatus] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const data = await api.getCommunityStatus();
      setCommStatus(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch community status', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleJoinClick = () => {
    const link = commStatus?.inviteLink || settings?.communityInviteLink || 'https://t.me/SKXMiningCommunity';
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(link);
    } else {
      window.open(link, '_blank');
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await api.verifyCommunity();
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      showToast(`Membership verified! +${res.rewardAmount} SKX granted.`, 'success');
      await refreshProfile();
      await fetchStatus();
    } catch (err: any) {
      showToast(err.message || 'Verification failed. Make sure you joined the channel.', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const isClaimed = commStatus?.isRewardClaimed;

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
        <h2 className="font-['Chakra_Petch'] font-bold text-xl text-white">TELEGRAM COMMUNITY</h2>
      </div>

      {/* Main Community Card */}
      <div className="rounded-3xl bg-gradient-to-b from-gray-900 to-gray-950 border border-sky-500/20 p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden text-center mb-5">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-sky-500/20 to-blue-950 border border-sky-500/40 flex items-center justify-center">
          <Globe className="w-8 h-8 text-sky-400" />
        </div>

        <h3 className="font-['Chakra_Petch'] font-bold text-2xl text-white mb-1">
          JOIN SKX COMMUNITY
        </h3>

        <p className="text-xs text-slate-400 mb-6 font-mono">
          Join our official Telegram community to receive instant announcements, mining tips, and claim your one-time welcome reward!
        </p>

        {/* Reward badge */}
        <div className="p-3.5 rounded-2xl bg-gray-950/80 border border-gray-800 mb-6 font-mono flex items-center justify-between">
          <span className="text-xs text-slate-400">ONE-TIME REWARD:</span>
          <span className="text-base font-bold text-emerald-400">
            +{commStatus?.rewardAmount || settings?.communityReward || '0.1'} SKX
          </span>
        </div>

        {/* Dual Step Actions */}
        <div className="space-y-3">
          {/* Step 1: Open Join Link */}
          <button
            onClick={handleJoinClick}
            className="w-full py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-['Chakra_Petch'] font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-[0_0_15px_rgba(2,132,199,0.3)]"
          >
            <span>🚀 1. JOIN TELEGRAM CHANNEL</span>
            <ExternalLink className="w-4 h-4" />
          </button>

          {/* Step 2: Verify Membership */}
          <button
            onClick={handleVerify}
            disabled={isClaimed || verifying}
            className={`w-full py-4 rounded-2xl font-['Chakra_Petch'] font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center justify-center space-x-2 ${
              !isClaimed && !verifying
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95'
                : 'bg-gray-900 border border-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            {verifying ? (
              <span>VERIFYING TELEGRAM MEMBERSHIP...</span>
            ) : isClaimed ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>REWARD ALREADY CLAIMED</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-black" />
                <span>✅ 2. VERIFY MEMBERSHIP & CLAIM +{commStatus?.rewardAmount || '0.1'} SKX</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
