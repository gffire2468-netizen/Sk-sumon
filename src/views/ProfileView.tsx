import React from 'react';
import { useApp } from '../context/AppContext';
import { User, Shield, Zap, Users, ArrowLeft, Receipt, Wallet, Award } from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { profile, setActiveTab } = useApp();

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
        <h2 className="font-['Chakra_Petch'] font-bold text-xl text-white">MINER PROFILE</h2>
      </div>

      {/* Identity Card */}
      <div className="rounded-3xl bg-gradient-to-b from-gray-900 to-gray-950 border border-emerald-500/20 p-5 backdrop-blur-xl mb-4 text-center relative overflow-hidden">
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-950 border border-emerald-500/40 flex items-center justify-center">
          <User className="w-8 h-8 text-emerald-400" />
        </div>

        <h3 className="font-['Chakra_Petch'] font-bold text-xl text-white">
          {profile?.user.first_name} {profile?.user.last_name || ''}
        </h3>
        {profile?.user.username && (
          <p className="text-xs font-mono text-emerald-400">@{profile.user.username}</p>
        )}

        <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-around font-mono text-xs">
          <div>
            <span className="text-slate-500 block text-[10px]">TELEGRAM ID</span>
            <span className="text-slate-300 font-bold">{profile?.user.telegram_id}</span>
          </div>
          <div className="h-6 w-px bg-gray-800" />
          <div>
            <span className="text-slate-500 block text-[10px]">JOINED</span>
            <span className="text-slate-300">
              {profile?.user.created_at ? new Date(profile.user.created_at).toLocaleDateString() : 'Active'}
            </span>
          </div>
          <div className="h-6 w-px bg-gray-800" />
          <div>
            <span className="text-slate-500 block text-[10px]">STATUS</span>
            <span className="text-emerald-400 font-bold">VERIFIED</span>
          </div>
        </div>
      </div>

      {/* Lifetime Mining Stats Card */}
      <div className="rounded-3xl bg-gray-900/70 border border-gray-800 p-5 mb-4 font-mono">
        <h4 className="font-['Chakra_Petch'] font-bold text-sm text-white mb-3 flex items-center gap-1.5">
          <Award className="w-4 h-4 text-emerald-400" />
          MINING & REWARD METRICS
        </h4>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-gray-950 border border-gray-800">
            <span className="text-slate-500 block text-[10px]">AVAILABLE BALANCE</span>
            <span className="text-base font-bold text-emerald-400">
              {profile?.balance.available_balance || '0.0000'} SKX
            </span>
          </div>

          <div className="p-3 rounded-xl bg-gray-950 border border-gray-800">
            <span className="text-slate-500 block text-[10px]">RESERVED BALANCE</span>
            <span className="text-base font-bold text-amber-400">
              {profile?.balance.reserved_balance || '0.0000'} SKX
            </span>
          </div>

          <div className="p-3 rounded-xl bg-gray-950 border border-gray-800">
            <span className="text-slate-500 block text-[10px]">LIFETIME EARNINGS</span>
            <span className="text-base font-bold text-white">
              {profile?.balance.total_earned || '0.0000'} SKX
            </span>
          </div>

          <div className="p-3 rounded-xl bg-gray-950 border border-gray-800">
            <span className="text-slate-500 block text-[10px]">TOTAL VALID TAPS</span>
            <span className="text-base font-bold text-white">
              {profile?.tapState.valid_taps_count || 0}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-gray-950 border border-gray-800">
            <span className="text-slate-500 block text-[10px]">TOTAL REFERRALS</span>
            <span className="text-base font-bold text-purple-400">
              {profile?.referralsCount || 0}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-gray-950 border border-gray-800">
            <span className="text-slate-500 block text-[10px]">VALID REFERRALS</span>
            <span className="text-base font-bold text-emerald-400">
              {profile?.validReferralsCount || 0} / 4
            </span>
          </div>
        </div>
      </div>

      {/* Navigation shortcuts */}
      <div className="space-y-2">
        <button
          onClick={() => setActiveTab('transactions')}
          className="w-full p-4 rounded-2xl bg-gray-900 border border-gray-800 hover:border-emerald-500/40 flex items-center justify-between text-xs font-['Chakra_Petch'] font-bold text-slate-300 transition-all"
        >
          <div className="flex items-center space-x-2.5">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span>TRANSACTION LEDGER</span>
          </div>
          <span className="text-slate-500">&rarr;</span>
        </button>

        <button
          onClick={() => setActiveTab('withdraw')}
          className="w-full p-4 rounded-2xl bg-gray-900 border border-gray-800 hover:border-emerald-500/40 flex items-center justify-between text-xs font-['Chakra_Petch'] font-bold text-slate-300 transition-all"
        >
          <div className="flex items-center space-x-2.5">
            <Wallet className="w-4 h-4 text-blue-400" />
            <span>PAYOUT & WITHDRAWAL</span>
          </div>
          <span className="text-slate-500">&rarr;</span>
        </button>
      </div>
    </div>
  );
};
