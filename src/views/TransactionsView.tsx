import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { Receipt, ArrowLeft, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { TransactionItem } from '../types';

export const TransactionsView: React.FC = () => {
  const { setActiveTab, showToast } = useApp();
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getTransactions()
      .then((data) => setTransactions(data))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'TAP_REWARD':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'MINING_REWARD':
        return 'text-green-300 bg-green-500/10 border-green-500/20';
      case 'DAILY_REWARD':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'REFERRAL_REWARD':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'COMMUNITY_REWARD':
        return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
      case 'AD_REWARD':
        return 'text-pink-400 bg-pink-500/10 border-pink-500/20';
      case 'WITHDRAWAL':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'REVERSAL':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      default:
        return 'text-slate-400 bg-gray-800 border-gray-700';
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
        <h2 className="font-['Chakra_Petch'] font-bold text-xl text-white">TRANSACTION LEDGER</h2>
      </div>

      <div className="rounded-3xl bg-gray-900/60 border border-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-['Chakra_Petch'] font-bold text-sm text-white flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-emerald-400" />
            IMMUTABLE LEDGER ({transactions.length})
          </h4>
          <span className="text-[10px] font-mono text-slate-500">Authoritative</span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-500 text-xs font-mono">Loading transaction records...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs font-mono">No transaction ledger entries yet.</div>
        ) : (
          <div className="space-y-2.5">
            {transactions.map((tx) => {
              const isCredit = tx.type !== 'WITHDRAWAL';
              return (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-2xl bg-gray-950/80 border border-gray-800/80 font-mono text-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getTypeBadge(
                        tx.type
                      )}`}
                    >
                      {tx.type.replace('_', ' ')}
                    </span>
                    <span
                      className={`font-bold flex items-center ${
                        isCredit ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 mr-0.5 inline" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 mr-0.5 inline" />
                      )}
                      {isCredit ? '+' : '-'}
                      {tx.amount} SKX
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 pt-2 border-t border-gray-900">
                    <div>
                      <span>Before: </span>
                      <span className="text-slate-400">{tx.balance_before}</span>
                    </div>
                    <div className="text-right">
                      <span>After: </span>
                      <span className="text-slate-300 font-bold">{tx.balance_after}</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-600 mt-1 flex justify-between">
                    <span className="truncate max-w-[150px]">Ref: {tx.reference_id || tx.id.slice(0, 8)}</span>
                    <span>{new Date(tx.created_at).toLocaleString()}</span>
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
