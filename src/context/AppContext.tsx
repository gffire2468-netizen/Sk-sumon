import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { UserProfile, PublicSettings } from '../types';

export type ActiveTab =
  | 'mining'
  | 'cycle'
  | 'rewards'
  | 'referrals'
  | 'withdraw'
  | 'community'
  | 'ads'
  | 'leaderboard'
  | 'profile'
  | 'transactions'
  | 'support'
  | 'notifications'
  | 'admin';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppContextType {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  profile: UserProfile | null;
  settings: PublicSettings | null;
  loading: boolean;
  error: string | null;
  liveEnergy: number;
  maxEnergy: number;
  unreadNotifications: number;
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  refreshProfile: () => Promise<void>;
  handleTap: () => void;
  isTapping: boolean;
  tapReward: string;
  hasAdOpportunity: boolean;
  setHasAdOpportunity: (val: boolean) => void;
  demoUserSwitch: (demoId: number) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('mining');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveEnergy, setLiveEnergy] = useState(1000);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isTapping, setIsTapping] = useState(false);
  const [hasAdOpportunity, setHasAdOpportunity] = useState(false);

  // Tapping batch accumulator
  const pendingTapsRef = useRef(0);
  const tapTimeoutRef = useRef<any>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch initial profile & public settings
  const refreshProfile = useCallback(async () => {
    try {
      const [profData, settsData, notifData] = await Promise.all([
        api.getUserProfile(),
        api.getPublicSettings(),
        api.getNotifications().catch(() => ({ unreadCount: 0 })),
      ]);
      setProfile(profData);
      setSettings(settsData);
      setLiveEnergy(profData.energy.current_energy);
      setUnreadNotifications(notifData.unreadCount || 0);
      setHasAdOpportunity(profData.tapState.pending_ad_opportunity);
      setError(null);
    } catch (err: any) {
      console.error('[AppContext] Failed to refresh profile:', err);
      setError(err.message || 'Failed to connect to SKX server');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize Telegram WebApp SDK
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      try {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
      } catch (e) {
        console.warn('Telegram SDK initialization failed:', e);
      }
    }
    refreshProfile();
  }, [refreshProfile]);

  // Real-time energy regeneration ticker (1 unit per second up to maxEnergy)
  useEffect(() => {
    const maxE = settings?.maxEnergy || 1000;
    const regenRate = settings?.energyRegenRate || 1;

    const interval = setInterval(() => {
      setLiveEnergy((prev) => {
        if (prev < maxE) {
          return Math.min(maxE, prev + regenRate);
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [settings?.maxEnergy, settings?.energyRegenRate]);

  // Flush pending taps to server
  const flushTaps = useCallback(async () => {
    const count = pendingTapsRef.current;
    if (count <= 0) return;
    pendingTapsRef.current = 0;

    try {
      const res = await api.submitTaps(count);
      setProfile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          balance: res.balance,
          tapState: {
            ...prev.tapState,
            valid_taps_count: prev.tapState.valid_taps_count + count,
            pending_ad_opportunity: res.adOpportunityAvailable,
          },
        };
      });
      if (res.adOpportunityAvailable) {
        setHasAdOpportunity(true);
      }
    } catch (err: any) {
      console.error('[Tap Submit Error]', err);
      showToast(err.message || 'Tap failed', 'error');
      // Refresh to resync authoritative server state
      refreshProfile();
    }
  }, [refreshProfile, showToast]);

  const handleTap = useCallback(() => {
    const maxE = settings?.maxEnergy || 1000;
    const cost = settings?.energyPerTap || 1;

    if (liveEnergy < cost) {
      showToast('Energy depleted! Wait for regeneration.', 'info');
      return;
    }

    // Trigger haptic feedback if running inside Telegram
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }

    // Optimistic UI updates
    setLiveEnergy((prev) => Math.max(0, prev - cost));
    setIsTapping(true);
    setTimeout(() => setIsTapping(false), 150);

    pendingTapsRef.current += 1;

    // Debounce flush taps in 300ms batches
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    tapTimeoutRef.current = setTimeout(() => {
      flushTaps();
    }, 300);
  }, [liveEnergy, settings?.energyPerTap, settings?.maxEnergy, flushTaps, showToast]);

  const demoUserSwitch = useCallback((demoId: number) => {
    api.setCustomInitData(`demo_user_${demoId}`);
    setLoading(true);
    refreshProfile().then(() => {
      showToast(`Switched to demo miner #${demoId}`, 'info');
    });
  }, [refreshProfile, showToast]);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        profile,
        settings,
        loading,
        error,
        liveEnergy,
        maxEnergy: settings?.maxEnergy || 1000,
        unreadNotifications,
        toasts,
        showToast,
        dismissToast,
        refreshProfile,
        handleTap,
        isTapping,
        tapReward: settings?.tapReward || '0.0001',
        hasAdOpportunity,
        setHasAdOpportunity,
        demoUserSwitch,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
