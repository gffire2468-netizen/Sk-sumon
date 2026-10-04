import React, { useState } from 'react';
import { useApp, ActiveTab } from '../context/AppContext';
import { Pickaxe, Clock, Users, Wallet, Grid, Tv, Gift, HelpCircle, Trophy, User, Receipt, Globe } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, hasAdOpportunity } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const mainTabs = [
    { id: 'mining' as ActiveTab, label: 'Mine', icon: Pickaxe },
    { id: 'cycle' as ActiveTab, label: 'Cycle', icon: Clock },
    { id: 'referrals' as ActiveTab, label: 'Referrals', icon: Users },
    { id: 'withdraw' as ActiveTab, label: 'Withdraw', icon: Wallet },
  ];

  const menuItems = [
    { id: 'ads' as ActiveTab, label: 'এড দেখুন (Ads)', icon: Tv, highlight: hasAdOpportunity },
    { id: 'rewards' as ActiveTab, label: 'Daily Bonus', icon: Gift },
    { id: 'community' as ActiveTab, label: 'Community', icon: Globe },
    { id: 'leaderboard' as ActiveTab, label: 'Leaderboard', icon: Trophy },
    { id: 'transactions' as ActiveTab, label: 'Ledger', icon: Receipt },
    { id: 'profile' as ActiveTab, label: 'Profile', icon: User },
    { id: 'support' as ActiveTab, label: 'Support', icon: HelpCircle },
  ];

  return (
    <>
      {/* Expanded Quick Menu Drawer Modal */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end p-4 transition-all"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="w-full max-w-md mx-auto bg-gray-900 border border-emerald-500/30 rounded-3xl p-5 shadow-[0_0_30px_rgba(0,0,0,0.8)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
              <h3 className="font-['Chakra_Petch'] font-bold text-white text-base tracking-wide flex items-center gap-2">
                <Grid className="w-4 h-4 text-emerald-400" />
                SKX COMMAND CENTER
              </h3>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-gray-400 hover:text-white text-sm px-2 py-1 bg-gray-800 rounded-lg"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isSelected = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setDrawerOpen(false);
                    }}
                    className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                        : 'bg-gray-950/60 border-gray-800 text-slate-300 hover:border-gray-700 hover:text-white'
                    }`}
                  >
                    {item.highlight && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                    )}
                    <Icon className="w-5 h-5 mb-1.5 text-emerald-400" />
                    <span className="text-xs font-medium text-center truncate w-full">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 w-full border-t border-emerald-500/20 bg-gray-950/90 backdrop-blur-xl pb-safe">
        <div className="max-w-md mx-auto flex items-center justify-around px-2 py-2">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setDrawerOpen(false);
                }}
                className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-200 active:scale-90 ${
                  isSelected
                    ? 'text-emerald-400 font-semibold drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div
                  className={`p-1 rounded-lg transition-colors ${
                    isSelected ? 'bg-emerald-500/10' : 'bg-transparent'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-medium tracking-tight mt-0.5">{tab.label}</span>
                {isSelected && (
                  <span className="absolute -bottom-1 w-6 h-0.5 bg-emerald-400 rounded-full shadow-[0_0_6px_#10b981]" />
                )}
              </button>
            );
          })}

          {/* Quick Menu Button */}
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all active:scale-90 ${
              drawerOpen || !mainTabs.some((t) => t.id === activeTab)
                ? 'text-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Grid className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-[11px] font-medium tracking-tight mt-0.5">More</span>
            {hasAdOpportunity && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
};
