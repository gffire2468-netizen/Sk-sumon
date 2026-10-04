import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { Bell, ArrowLeft, CheckCheck, Gift, Users, Wallet, Tv, Globe, HelpCircle, ShieldAlert } from 'lucide-react';
import { NotificationItem } from '../types';

export const NotificationsView: React.FC = () => {
  const { setActiveTab, refreshProfile, showToast } = useApp();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      await refreshProfile();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      showToast('All notifications marked as read', 'success');
      await refreshProfile();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'REFERRAL_REWARD':
        return <Users className="w-4 h-4 text-purple-400" />;
      case 'DAILY_REWARD':
      case 'MINING_REWARD':
        return <Gift className="w-4 h-4 text-emerald-400" />;
      case 'COMMUNITY_REWARD':
        return <Globe className="w-4 h-4 text-sky-400" />;
      case 'AD_REWARD':
        return <Tv className="w-4 h-4 text-pink-400" />;
      case 'WITHDRAWAL_SUBMITTED':
      case 'WITHDRAWAL_APPROVED':
      case 'WITHDRAWAL_COMPLETED':
        return <Wallet className="w-4 h-4 text-emerald-400" />;
      case 'WITHDRAWAL_REJECTED':
        return <Wallet className="w-4 h-4 text-rose-400" />;
      case 'SUPPORT_REPLY':
        return <HelpCircle className="w-4 h-4 text-amber-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
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
        <div className="flex-1 flex items-center justify-between">
          <h2 className="font-['Chakra_Petch'] font-bold text-xl text-white">NOTIFICATIONS</h2>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500 text-xs font-mono">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="rounded-3xl bg-gray-900/50 border border-gray-800 p-8 text-center text-slate-500 text-xs font-mono">
          <Bell className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          No notifications yet.
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.is_read && handleMarkAsRead(n.id)}
              className={`p-3.5 rounded-2xl border transition-all font-mono text-xs cursor-pointer ${
                !n.is_read
                  ? 'bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                  : 'bg-gray-900/60 border-gray-800/80 text-slate-400'
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-xl bg-gray-950 border border-gray-800 shrink-0">
                  {getIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white text-xs truncate">{n.title}</span>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">{n.message}</p>
                </div>
                {!n.is_read && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1 shadow-[0_0_6px_#10b981]" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
