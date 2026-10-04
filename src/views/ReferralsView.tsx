import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { Users, Copy, Check, Share2, ArrowLeft, ShieldAlert, CheckCircle2, UserCheck } from 'lucide-react';

export const ReferralsView: React.FC = () => {
  const { setActiveTab, showToast, settings } = useApp();
  const [summary, setSummary] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    try {
      const data = await api.getReferralsSummary();
      setSummary(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch referral summary', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleCopyLink = () => {
    if (!summary?.botLink) return;
    navigator.clipboard.writeText(summary.botLink);
    setCopied(true);
    showToast('Referral link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTelegram = () => {
    if (!summary?.botLink) return;
    const text = encodeURIComponent(
      `⚡ Join SKX MINING and mine free SKX rewards! Start now:`
    );
    const url = `https://t.me/share/url?url=${encodeURIComponent(summary.botLink)}&text=${text}`;
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const validCount = summary?.validReferrals || 0;
  const requiredCount = summary?.requiredReferrals || settings?.requiredReferrals || 4;
  const progressPercent = Math.min(100, (validCount / requiredCount) * 100);

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
        <h2 className="font-['Chakra_Petch'] font-bold text-xl text-white">REFERRAL PROGRAM</h2>
      </div>

      {/* Progress towards withdrawal unlock banner */}
      <div className="rounded-3xl bg-gradient-to-b from-gray-900 to-gray-950 border border-emerald-500/30 p-5 backdrop-blur-xl shadow-xl mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-['Chakra_Petch'] font-bold tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            WITHDRAWAL UNLOCK REQUIREMENT
          </span>
          <span className="text-xs font-mono font-bold text-white bg-gray-950 px-2.5 py-1 rounded-full border border-gray-800">
            {validCount} / {requiredCount} Valid
          </span>
        </div>

        <p className="text-xs text-slate-400 mb-3">
          To protect the reward pool, at least 4 active/valid referrals are mandatory before you can submit a withdrawal.
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-gray-950 rounded-full h-3 border border-gray-800 p-0.5 mb-2">
          <div
            style={{ width: `${progressPercent}%` }}
            className={`h-full rounded-full transition-all duration-500 ${
              validCount >= requiredCount
                ? 'bg-emerald-400 shadow-[0_0_12px_#10b981]'
                : 'bg-purple-500 shadow-[0_0_12px_#a855f7]'
            }`}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className={validCount >= requiredCount ? 'text-emerald-400' : 'text-amber-400'}>
            {validCount >= requiredCount ? '✅ Requirement Fulfilled' : `Need ${requiredCount - validCount} more valid miner(s)`}
          </span>
          <span className="text-slate-400">+{summary?.rewardPerReferral || '0.2'} SKX / referral</span>
        </div>
      </div>

      {/* Share / Copy Link Box */}
      <div className="rounded-3xl bg-gray-900/70 border border-gray-800 p-5 mb-4">
        <h4 className="font-['Chakra_Petch'] font-bold text-sm text-white mb-2">YOUR UNIQUE INVITE LINK</h4>
        <div className="flex items-center space-x-2 bg-gray-950 border border-gray-800 rounded-2xl p-2.5 mb-3 font-mono text-xs text-slate-300 overflow-hidden">
          <span className="truncate flex-1 select-all">
            {loading ? 'Generating link...' : summary?.botLink || 'https://t.me/SKXMiningBot'}
          </span>
          <button
            onClick={handleCopyLink}
            className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-emerald-400 shrink-0 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleCopyLink}
            className="w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-['Chakra_Petch'] font-bold text-xs flex items-center justify-center space-x-1.5 transition-all"
          >
            <Copy className="w-4 h-4 text-emerald-400" />
            <span>COPY LINK</span>
          </button>
          <button
            onClick={handleShareTelegram}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-black font-['Chakra_Petch'] font-bold text-xs flex items-center justify-center space-x-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>SHARE TO TELEGRAM</span>
          </button>
        </div>
      </div>

      {/* Referral Ledger / History */}
      <div className="rounded-3xl bg-gray-900/60 border border-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-['Chakra_Petch'] font-bold text-sm text-white flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            REFERRED MINERS ({summary?.referralsList?.length || 0})
          </h4>
          <span className="text-[11px] font-mono text-emerald-400">
            Earned: {summary?.totalEarnedSKX || '0.0000'} SKX
          </span>
        </div>

        {summary?.referralsList?.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs font-mono">
            No referred miners yet. Share your invite link to build your mining team!
          </div>
        ) : (
          <div className="space-y-2">
            {summary?.referralsList?.map((ref: any) => (
              <div
                key={ref.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-gray-950/70 border border-gray-800/80 text-xs font-mono"
              >
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    {ref.referredName}
                    {ref.referredUsername && (
                      <span className="text-slate-500 text-[10px]">@{ref.referredUsername}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {new Date(ref.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                      ref.status === 'VALID'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {ref.status}
                  </span>
                  <div className="text-[10px] text-emerald-400 mt-0.5">+{ref.rewardAmount} SKX</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
