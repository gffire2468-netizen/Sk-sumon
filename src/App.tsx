import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { ToastContainer } from './components/ToastContainer';
import { MiningView } from './views/MiningView';
import { MiningCycleView } from './views/MiningCycleView';
import { RewardsView } from './views/RewardsView';
import { ReferralsView } from './views/ReferralsView';
import { WithdrawView } from './views/WithdrawView';
import { EarnAdsView } from './views/EarnAdsView';
import { CommunityView } from './views/CommunityView';
import { LeaderboardView } from './views/LeaderboardView';
import { ProfileView } from './views/ProfileView';
import { TransactionsView } from './views/TransactionsView';
import { SupportView } from './views/SupportView';
import { NotificationsView } from './views/NotificationsView';
import { AdminView } from './views/AdminView';
import { Zap } from 'lucide-react';

const MainContent: React.FC = () => {
  const { activeTab, loading, error, refreshProfile } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.3)] mb-4 animate-pulse">
          <Zap className="w-8 h-8 text-emerald-400 fill-emerald-400" />
        </div>
        <h2 className="font-['Chakra_Petch'] font-bold text-lg text-white tracking-widest">
          INITIALIZING SKX PROTOCOL...
        </h2>
        <p className="text-xs font-mono text-slate-500 mt-1">Connecting to Telegram & Mining Network</p>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4">
          <Zap className="w-7 h-7 text-rose-400" />
        </div>
        <h3 className="font-['Chakra_Petch'] font-bold text-lg text-white mb-2">CONNECTION ERROR</h3>
        <p className="text-xs text-slate-400 max-w-sm mb-6 font-mono">{error}</p>
        <button
          onClick={() => refreshProfile()}
          className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-['Chakra_Petch'] font-bold text-xs uppercase tracking-wider"
        >
          RETRY CONNECTION
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-slate-100 flex flex-col font-['Inter'] selection:bg-emerald-500 selection:text-black">
      <Header />

      <main className="flex-1 w-full max-w-md mx-auto relative">
        {activeTab === 'mining' && <MiningView />}
        {activeTab === 'cycle' && <MiningCycleView />}
        {activeTab === 'rewards' && <RewardsView />}
        {activeTab === 'referrals' && <ReferralsView />}
        {activeTab === 'withdraw' && <WithdrawView />}
        {activeTab === 'ads' && <EarnAdsView />}
        {activeTab === 'community' && <CommunityView />}
        {activeTab === 'leaderboard' && <LeaderboardView />}
        {activeTab === 'profile' && <ProfileView />}
        {activeTab === 'transactions' && <TransactionsView />}
        {activeTab === 'support' && <SupportView />}
        {activeTab === 'notifications' && <NotificationsView />}
        {activeTab === 'admin' && <AdminView />}
      </main>

      <BottomNav />
      <ToastContainer />
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}

export default App;
