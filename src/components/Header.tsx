import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Zap, Bell, Shield, User, RefreshCw } from 'lucide-react';

export const Header: React.FC = () => {
  const { profile, activeTab, setActiveTab, unreadNotifications, refreshProfile, demoUserSwitch, settings } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [showDemoSelector, setShowDemoSelector] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-emerald-500/20 bg-gray-950/80 backdrop-blur-xl px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <div
          className="flex items-center space-x-2.5 cursor-pointer group"
          onClick={() => setActiveTab('mining')}
        >
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-950 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.3)] group-hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all">
            <Zap className="w-5 h-5 text-emerald-400 fill-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-['Chakra_Petch'] text-lg font-bold tracking-wider text-white">
                SKX<span className="text-emerald-400">MINING</span>
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                v2.0
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400 -mt-0.5">
              {profile?.user.username ? `@${profile.user.username}` : profile?.user.first_name || 'Cyber Miner'}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center space-x-2">
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            title="Sync Server State"
            className="p-2 rounded-lg bg-gray-900/80 border border-gray-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 active:scale-95 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          {/* Notifications */}
          <button
            onClick={() => setActiveTab('notifications')}
            title="Notifications"
            className="relative p-2 rounded-lg bg-gray-900/80 border border-gray-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 active:scale-95 transition-all"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-black animate-bounce">
                {unreadNotifications}
              </span>
            )}
          </button>

          {/* Admin Toggle */}
          <button
            onClick={() => setActiveTab('admin')}
            title="Admin Console"
            className={`p-2 rounded-lg border text-xs font-mono flex items-center space-x-1 transition-all ${
              activeTab === 'admin'
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                : 'bg-gray-900/80 border-gray-800 text-slate-400 hover:border-emerald-500/40 hover:text-emerald-400'
            }`}
          >
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">ADMIN</span>
          </button>

          {/* Demo User Switcher if Demo Mode */}
          {settings?.demoMode && (
            <div className="relative">
              <button
                onClick={() => setShowDemoSelector(!showDemoSelector)}
                title="Switch Demo User"
                className="p-2 rounded-lg bg-purple-950/40 border border-purple-500/30 text-purple-400 hover:bg-purple-900/50 text-xs font-mono"
              >
                <User className="w-4 h-4" />
              </button>

              {showDemoSelector && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-gray-900 border border-purple-500/40 shadow-xl p-2 z-50 text-xs">
                  <p className="font-bold text-purple-300 px-2 py-1 border-b border-gray-800">
                    Switch Test Account
                  </p>
                  <button
                    onClick={() => {
                      demoUserSwitch(1001);
                      setShowDemoSelector(false);
                    }}
                    className="w-full text-left px-2 py-1.5 hover:bg-purple-950/50 rounded text-slate-300 flex justify-between"
                  >
                    <span>Pilot Miner</span>
                    <span className="text-gray-500">#1001</span>
                  </button>
                  <button
                    onClick={() => {
                      demoUserSwitch(1002);
                      setShowDemoSelector(false);
                    }}
                    className="w-full text-left px-2 py-1.5 hover:bg-purple-950/50 rounded text-slate-300 flex justify-between"
                  >
                    <span>Test Cadet</span>
                    <span className="text-gray-500">#1002</span>
                  </button>
                  <button
                    onClick={() => {
                      demoUserSwitch(1003);
                      setShowDemoSelector(false);
                    }}
                    className="w-full text-left px-2 py-1.5 hover:bg-purple-950/50 rounded text-slate-300 flex justify-between"
                  >
                    <span>Referral Tester</span>
                    <span className="text-gray-500">#1003</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
