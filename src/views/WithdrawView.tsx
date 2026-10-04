import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { Wallet, AlertTriangle, ArrowLeft, CheckCircle2, Clock, XCircle, ShieldCheck } from 'lucide-react';

export const WithdrawView: React.FC = () => {
  const { setActiveTab, refreshProfile, showToast, settings } = useApp();
  const [eligibility, setEligibility] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [method, setMethod] = useState<'bKash' | 'Nagad' | 'Rocket'>('bKash');
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const [elig, list] = await Promise.all([
        api.getWithdrawalEligibility(),
        api.getWithdrawals(),
      ]);
      setEligibility(elig);
      setWithdrawals(list);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch withdrawal data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eligibility?.canWithdraw) {
      showToast(eligibility?.reason || 'You do not meet withdrawal requirements', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.submitWithdrawal(method, accountNumber, amount);
      showToast('Withdrawal submitted for admin review!', 'success');
      setAmount('');
      setAccountNumber('');
      await refreshProfile();
      await fetchStatus();
    } catch (err: any) {
      showToast(err.message || 'Withdrawal submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const minAmount = parseFloat(eligibility?.minWithdrawal || settings?.minWithdrawal || '5');
  const userBal = parseFloat(eligibility?.currentBalance || '0');
  const validRefs = eligibility?.currentValidReferrals || 0;
  const reqRefs = eligibility?.requiredReferrals || 4;

  const canWithdraw = eligibility?.canWithdraw;

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
        <h2 className="font-['Chakra_Petch'] font-bold text-xl text-white">WITHDRAW FUNDS</h2>
      </div>

      {/* Mandatory Dual Verification Card */}
      <div
        className={`rounded-3xl p-5 border backdrop-blur-xl mb-4 transition-all ${
          canWithdraw
            ? 'bg-emerald-950/30 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
            : 'bg-gray-900/80 border-gray-800'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-['Chakra_Petch'] font-bold text-sm tracking-wider flex items-center gap-1.5 text-white">
            <ShieldCheck className={`w-4 h-4 ${canWithdraw ? 'text-emerald-400' : 'text-amber-400'}`} />
            WITHDRAWAL UNLOCK CRITERIA
          </h3>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
              canWithdraw
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            }`}
          >
            {canWithdraw ? 'UNLOCKED' : 'LOCKED'}
          </span>
        </div>

        {/* Dual Requirements checklist */}
        <div className="space-y-2 text-xs font-mono mb-2">
          {/* Condition 1: Balance >= 5 SKX */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-950/60 border border-gray-800">
            <div className="flex items-center space-x-2">
              {eligibility?.balanceEligible ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="text-slate-300">1. Balance &ge; {minAmount} SKX</span>
            </div>
            <span className={eligibility?.balanceEligible ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
              {userBal.toFixed(4)} / {minAmount}
            </span>
          </div>

          {/* Condition 2: Valid Referrals >= 4 */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-950/60 border border-gray-800">
            <div className="flex items-center space-x-2">
              {eligibility?.referralsEligible ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="text-slate-300">2. Active Referrals &ge; {reqRefs}</span>
            </div>
            <span className={eligibility?.referralsEligible ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
              {validRefs} / {reqRefs}
            </span>
          </div>
        </div>

        {!canWithdraw && eligibility?.reason && (
          <p className="text-[11px] text-amber-400/90 font-mono mt-2 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
            ⚠️ {eligibility.reason}
          </p>
        )}
      </div>

      {/* Withdrawal Submission Form */}
      <form onSubmit={handleWithdraw} className="rounded-3xl bg-gray-900/70 border border-gray-800 p-5 mb-5">
        <h4 className="font-['Chakra_Petch'] font-bold text-sm text-white mb-3">SUBMIT WITHDRAWAL</h4>

        {/* Method Selector */}
        <label className="text-[11px] font-mono text-slate-400 block mb-1.5 uppercase">Select Wallet Provider</label>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(['bKash', 'Nagad', 'Rocket'] as const).map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setMethod(m)}
              className={`py-2.5 rounded-xl font-['Chakra_Petch'] font-bold text-xs border transition-all ${
                method === m
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'bg-gray-950 border-gray-800 text-slate-400 hover:border-gray-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Account Number */}
        <div className="mb-4">
          <label className="text-[11px] font-mono text-slate-400 block mb-1.5 uppercase">
            {method} Mobile Number (11 digits)
          </label>
          <input
            type="text"
            placeholder="01XXXXXXXXX"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            disabled={!canWithdraw}
            className="w-full px-4 py-3 rounded-xl bg-gray-950 border border-gray-800 text-white font-mono text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/60 disabled:opacity-50"
            required
          />
        </div>

        {/* Amount */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5 text-[11px] font-mono">
            <span className="text-slate-400 uppercase">Amount (SKX)</span>
            <button
              type="button"
              disabled={!canWithdraw}
              onClick={() => setAmount(userBal.toString())}
              className="text-emerald-400 hover:underline"
            >
              Max: {userBal.toFixed(4)}
            </button>
          </div>
          <input
            type="number"
            step="0.0001"
            min={minAmount}
            max={eligibility?.maxWithdrawal || 1000}
            placeholder={`Min ${minAmount} SKX`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!canWithdraw}
            className="w-full px-4 py-3 rounded-xl bg-gray-950 border border-gray-800 text-white font-mono text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/60 disabled:opacity-50"
            required
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!canWithdraw || submitting}
          className={`w-full py-4 rounded-2xl font-['Chakra_Petch'] font-bold text-sm tracking-wider uppercase transition-all shadow-lg flex items-center justify-center space-x-2 ${
            canWithdraw && !submitting
              ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95'
              : 'bg-gray-800 text-gray-500 border border-gray-700/60 cursor-not-allowed'
          }`}
        >
          {submitting ? (
            <span>PROCESSING...</span>
          ) : (
            <>
              <Wallet className="w-5 h-5" />
              <span>REQUEST WITHDRAWAL</span>
            </>
          )}
        </button>
      </form>

      {/* Withdrawal History */}
      <div className="rounded-3xl bg-gray-900/60 border border-gray-800 p-5">
        <h4 className="font-['Chakra_Petch'] font-bold text-sm text-white mb-3 flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-emerald-400" />
          WITHDRAWAL HISTORY ({withdrawals.length})
        </h4>

        {withdrawals.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs font-mono">
            No withdrawal records yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {withdrawals.map((w) => (
              <div
                key={w.id}
                className="p-3.5 rounded-2xl bg-gray-950/80 border border-gray-800 text-xs font-mono"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-white">
                    {w.requested_amount} SKX ({w.method})
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                      w.status === 'COMPLETED'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : w.status === 'REJECTED' || w.status === 'CANCELLED'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {w.status}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 flex justify-between">
                  <span>To: {w.account_number}</span>
                  <span>{new Date(w.created_at).toLocaleDateString()}</span>
                </div>

                {w.provider_trx_id && (
                  <div className="mt-2 pt-2 border-t border-gray-800/80 text-[11px] text-emerald-300">
                    TrxID: <span className="text-white font-bold select-all">{w.provider_trx_id}</span>
                  </div>
                )}
                {w.admin_notes && (
                  <div className="mt-1 text-[10px] text-slate-400">
                    Note: {w.admin_notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
