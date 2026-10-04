import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import {
  Shield,
  LayoutDashboard,
  Users,
  Wallet,
  Tv,
  Globe,
  HelpCircle,
  Settings,
  FileText,
  AlertTriangle,
  Lock,
  LogOut,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Search,
  RefreshCw,
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const { setActiveTab, showToast } = useApp();
  const [token, setToken] = useState<string | null>(api.getAdminToken());
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState(''); // MUST START EMPTY per requirement 27 & 55
  const [loginLoading, setLoginLoading] = useState(false);

  // Active section in Admin Panel
  const [adminTab, setAdminTab] = useState<
    'dashboard' | 'users' | 'withdrawals' | 'support' | 'ads' | 'community' | 'settings' | 'audit' | 'security'
  >('dashboard');

  // Section States
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [allSettings, setAllSettings] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Actions states
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDirection, setAdjustDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjustReason, setAdjustReason] = useState('');

  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [providerTrxId, setProviderTrxId] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [ticketReply, setTicketReply] = useState('');
  const [ticketInternalNotes, setTicketInternalNotes] = useState('');

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const res = await api.adminLogin(loginUsername, loginPassword);
      api.setAdminToken(res.token);
      setToken(res.token);
      showToast('Admin authenticated successfully', 'success');
      setLoginPassword('');
    } catch (err: any) {
      showToast(err.message || 'Authentication failed', 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    api.setAdminToken(null);
    setToken(null);
    showToast('Logged out of Admin Console', 'info');
  };

  // Fetch admin section data
  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (adminTab === 'dashboard') {
        const data = await api.getAdminDashboard();
        setStats(data);
      } else if (adminTab === 'users') {
        const data = await api.getAdminUsers(50, 0, searchQuery);
        setUsers(data.users);
      } else if (adminTab === 'withdrawals') {
        const data = await api.getAdminWithdrawals();
        setWithdrawals(data);
      } else if (adminTab === 'support') {
        const data = await api.getAdminSupportTickets();
        setTickets(data);
      } else if (adminTab === 'audit') {
        const data = await api.getAdminAuditLogs();
        setAuditLogs(data);
      } else if (adminTab === 'security') {
        const data = await api.getAdminSecurityEvents();
        setSecurityEvents(data);
      } else if (adminTab === 'ads') {
        const res = await fetch('/api/admin/ads/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        if (d.success) setProviders(d.data);
      } else if (adminTab === 'settings' || adminTab === 'community') {
        const data = await api.getAdminSettings();
        setAllSettings(data);
      }
    } catch (err: any) {
      if (err.message?.includes('session')) {
        handleLogout();
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, adminTab]);

  // Balance adjustment handler
  const handleBalanceAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await api.adminAdjustBalance(selectedUser.id, adjustAmount, adjustDirection, adjustReason);
      showToast(`Balance adjusted: ${adjustDirection} ${adjustAmount} SKX`, 'success');
      setSelectedUser(null);
      setAdjustAmount('');
      setAdjustReason('');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // User suspension handler
  const handleToggleSuspension = async (user: any) => {
    const nextState = !user.is_suspended;
    const reason = nextState ? 'Suspicious activity or fraud investigation' : 'Resolved';
    try {
      await api.adminToggleSuspension(user.id, nextState, reason);
      showToast(`User ${nextState ? 'suspended' : 'unsuspended'}`, 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Withdrawal status updater
  const handleUpdateWithdrawal = async (status: string) => {
    if (!selectedWithdrawal) return;
    if (status === 'COMPLETED' && (!providerTrxId || providerTrxId.trim().length < 6)) {
      showToast('A valid real provider transaction ID (TrxID) is required to complete withdrawal', 'error');
      return;
    }
    try {
      await api.adminUpdateWithdrawal(selectedWithdrawal.id, status, providerTrxId, adminNotes);
      showToast(`Withdrawal status updated to ${status}`, 'success');
      setSelectedWithdrawal(null);
      setProviderTrxId('');
      setAdminNotes('');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Ticket reply handler
  const handleTicketReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !ticketReply.trim()) return;
    try {
      await api.adminReplySupportTicket(selectedTicket.id, ticketReply);
      if (ticketInternalNotes) {
        await api.adminUpdateSupportTicket(selectedTicket.id, selectedTicket.status, undefined, ticketInternalNotes);
      }
      showToast('Reply dispatched to user', 'success');
      setTicketReply('');
      setSelectedTicket(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Setting updater
  const handleUpdateSetting = async (key: string, value: string, desc?: string) => {
    try {
      await api.adminUpdateSetting(key, value, desc);
      showToast(`Setting ${key} updated`, 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // ==================== LOGIN VIEW ====================
  if (!token) {
    return (
      <div className="pb-24 px-4 pt-6 max-w-md mx-auto">
        <div className="flex items-center space-x-3 mb-6">
          <button
            onClick={() => setActiveTab('mining')}
            className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="font-['Chakra_Petch'] font-bold text-xl text-white">ADMIN CONSOLE</h2>
        </div>

        <div className="rounded-3xl bg-gray-900/90 border border-emerald-500/30 p-6 backdrop-blur-xl shadow-2xl">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Lock className="w-7 h-7 text-emerald-400" />
          </div>

          <h3 className="font-['Chakra_Petch'] font-bold text-xl text-center text-white mb-1">
            SECURITY CLEARANCE REQUIRED
          </h3>
          <p className="text-xs text-center text-slate-400 mb-6 font-mono">
            Enter administrative credentials to access the central SKX command center.
          </p>

          <form onSubmit={handleLogin} className="space-y-4 font-mono text-xs">
            <div>
              <label className="text-slate-400 block mb-1 uppercase">Username</label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-4 py-3 rounded-xl bg-gray-950 border border-gray-800 text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1 uppercase">Password</label>
              <input
                type="password"
                value={loginPassword} // MUST START EMPTY per requirement 27 & 55
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full px-4 py-3 rounded-xl bg-gray-950 border border-gray-800 text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 text-black font-['Chakra_Petch'] font-bold text-sm tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95"
            >
              {loginLoading ? 'AUTHENTICATING...' : 'AUTHENTICATE'}
            </button>
          </form>

          <p className="text-[10px] text-center text-slate-500 mt-4">
            Default credentials are set via ADMIN_DEFAULT_USERNAME and ADMIN_DEFAULT_PASSWORD.
          </p>
        </div>
      </div>
    );
  }

  // ==================== AUTHENTICATED ADMIN DASHBOARD ====================
  return (
    <div className="pb-24 px-4 pt-2 max-w-2xl mx-auto">
      {/* Admin Top Bar */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
        <div className="flex items-center space-x-2.5">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h2 className="font-['Chakra_Petch'] font-bold text-lg text-white">SKX ADMIN CONSOLE</h2>
        </div>

        <div className="flex items-center space-x-2 font-mono text-xs">
          <button
            onClick={fetchData}
            className="p-2 rounded-lg bg-gray-900 border border-gray-800 text-slate-400 hover:text-emerald-400"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleLogout}
            className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 hover:bg-rose-900/40 flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Admin Tab Navigation */}
      <div className="flex overflow-x-auto space-x-1.5 pb-2 mb-4 scrollbar-none font-['Chakra_Petch'] text-xs font-bold">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'withdrawals', label: 'Withdrawals', icon: Wallet },
          { id: 'support', label: 'Support', icon: HelpCircle },
          { id: 'ads', label: 'Ads', icon: Tv },
          { id: 'community', label: 'Community', icon: Globe },
          { id: 'settings', label: 'Settings', icon: Settings },
          { id: 'audit', label: 'Audit Logs', icon: FileText },
          { id: 'security', label: 'Security', icon: AlertTriangle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = adminTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setAdminTab(tab.id as any);
                setSelectedUser(null);
                setSelectedWithdrawal(null);
                setSelectedTicket(null);
              }}
              className={`flex items-center space-x-1 px-3 py-2 rounded-xl whitespace-nowrap border transition-all ${
                isSelected
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                  : 'bg-gray-900/60 border-gray-800 text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= SECTION: DASHBOARD ================= */}
      {adminTab === 'dashboard' && stats && (
        <div className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800">
              <span className="text-slate-500 text-[10px] uppercase block">Total Users</span>
              <span className="text-xl font-bold text-white">{stats.totalUsers}</span>
            </div>
            <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800">
              <span className="text-slate-500 text-[10px] uppercase block">Active (24h)</span>
              <span className="text-xl font-bold text-emerald-400">{stats.activeUsers}</span>
            </div>
            <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800">
              <span className="text-slate-500 text-[10px] uppercase block">Total Distributed</span>
              <span className="text-lg font-bold text-emerald-300">{stats.totalDistributedSKX} SKX</span>
            </div>
            <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800">
              <span className="text-slate-500 text-[10px] uppercase block">Total Taps Validated</span>
              <span className="text-xl font-bold text-white">{stats.totalTaps}</span>
            </div>
            <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800">
              <span className="text-slate-500 text-[10px] uppercase block">Pending Withdrawals</span>
              <span className="text-xl font-bold text-amber-400">{stats.pendingWithdrawals}</span>
            </div>
            <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800">
              <span className="text-slate-500 text-[10px] uppercase block">Completed Withdrawals</span>
              <span className="text-xl font-bold text-emerald-400">{stats.completedWithdrawals}</span>
            </div>
            <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800">
              <span className="text-slate-500 text-[10px] uppercase block">Ad Rewards Granted</span>
              <span className="text-xl font-bold text-pink-400">{stats.adRewardsGranted}</span>
            </div>
            <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800">
              <span className="text-slate-500 text-[10px] uppercase block">Open Support Tickets</span>
              <span className="text-xl font-bold text-sky-400">{stats.openTickets}</span>
            </div>
            <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800">
              <span className="text-slate-500 text-[10px] uppercase block">Security Events</span>
              <span className="text-xl font-bold text-rose-400">{stats.securityEventsCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* ================= SECTION: USERS ================= */}
      {adminTab === 'users' && (
        <div className="space-y-4 font-mono text-xs">
          {/* Search box */}
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
              <input
                type="text"
                placeholder="Search by username, name, or telegram ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchData()}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              onClick={fetchData}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 text-black font-bold font-['Chakra_Petch']"
            >
              Search
            </button>
          </div>

          {/* User Adjustment Modal */}
          {selectedUser && (
            <div className="p-4 rounded-2xl bg-gray-900 border border-emerald-500/50 mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">
                  Balance Adjustment: {selectedUser.first_name} (@{selectedUser.username || selectedUser.telegram_id})
                </span>
                <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleBalanceAdjust} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 block text-[10px]">DIRECTION</label>
                    <select
                      value={adjustDirection}
                      onChange={(e: any) => setAdjustDirection(e.target.value)}
                      className="w-full p-2 rounded-lg bg-gray-950 border border-gray-800 text-white"
                    >
                      <option value="CREDIT">CREDIT (+)</option>
                      <option value="DEBIT">DEBIT (-)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block text-[10px]">AMOUNT (SKX)</label>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="0.0000"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      className="w-full p-2 rounded-lg bg-gray-950 border border-gray-800 text-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block text-[10px]">MANDATORY AUDIT REASON</label>
                  <input
                    type="text"
                    placeholder="e.g. Promotional bonus or error correction"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full p-2 rounded-lg bg-gray-950 border border-gray-800 text-white"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-500 text-black font-bold font-['Chakra_Petch']"
                >
                  Confirm Adjustment
                </button>
              </form>
            </div>
          )}

          {/* User List */}
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="p-3 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">
                    {u.first_name} {u.last_name || ''}{' '}
                    {u.username && <span className="text-emerald-400">@{u.username}</span>}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    TG: {u.telegram_id} • Balance: <span className="text-emerald-300 font-bold">{u.balance} SKX</span> • Valid Refs: {u.validReferrals}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedUser(u)}
                    className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-slate-200 text-[11px]"
                  >
                    Adjust
                  </button>
                  <button
                    onClick={() => handleToggleSuspension(u)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${
                      u.is_suspended
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-gray-800 text-slate-400 hover:text-rose-400'
                    }`}
                  >
                    {u.is_suspended ? 'Suspended' : 'Suspend'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= SECTION: WITHDRAWALS ================= */}
      {adminTab === 'withdrawals' && (
        <div className="space-y-4 font-mono text-xs">
          {/* Action modal for completing withdrawal */}
          {selectedWithdrawal && (
            <div className="p-4 rounded-2xl bg-gray-900 border border-emerald-500/50 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white">
                  Review Payout: {selectedWithdrawal.requested_amount} SKX ({selectedWithdrawal.method})
                </span>
                <button onClick={() => setSelectedWithdrawal(null)} className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>

              <div className="text-[11px] text-slate-300 p-2 rounded bg-gray-950">
                <div>Recipient Wallet: <span className="text-emerald-400 font-bold">{selectedWithdrawal.account_number}</span></div>
                <div>Net Payout: <span className="text-white font-bold">{selectedWithdrawal.net_amount} SKX</span> (Fee: {selectedWithdrawal.fee_amount})</div>
              </div>

              <div>
                <label className="text-slate-400 block text-[10px] mb-1">
                  REAL PROVIDER TRANSACTION ID (MANDATORY FOR COMPLETION)
                </label>
                <input
                  type="text"
                  placeholder="e.g. BKX102938475"
                  value={providerTrxId}
                  onChange={(e) => setProviderTrxId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-gray-950 border border-gray-800 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block text-[10px] mb-1">ADMIN INTERNAL NOTES (OPTIONAL)</label>
                <input
                  type="text"
                  placeholder="e.g. Paid manually from merchant wallet #1"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full p-2 rounded-xl bg-gray-950 border border-gray-800 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <button
                  onClick={() => handleUpdateWithdrawal('APPROVED')}
                  className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleUpdateWithdrawal('COMPLETED')}
                  className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
                >
                  Complete (TrxID)
                </button>
                <button
                  onClick={() => handleUpdateWithdrawal('REJECTED')}
                  className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  Reject & Refund
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {withdrawals.map((w) => (
              <div
                key={w.id}
                onClick={() => setSelectedWithdrawal(w)}
                className="p-3.5 rounded-2xl bg-gray-900 border border-gray-800 hover:border-emerald-500/40 cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white">
                    {w.requested_amount} SKX • {w.method}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      w.status === 'COMPLETED'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : w.status === 'REJECTED'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {w.status}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex justify-between">
                  <span>To: {w.account_number}</span>
                  <span>{new Date(w.created_at).toLocaleString()}</span>
                </div>
                {w.provider_trx_id && (
                  <div className="text-[10px] text-emerald-400 mt-1">TrxID: {w.provider_trx_id}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= SECTION: SUPPORT ================= */}
      {adminTab === 'support' && (
        <div className="space-y-4 font-mono text-xs">
          {selectedTicket && (
            <div className="p-4 rounded-2xl bg-gray-900 border border-emerald-500/50 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white">Ticket: {selectedTicket.subject}</span>
                <button onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>

              <div className="text-slate-400 text-[10px]">
                Status: {selectedTicket.status} • Category: {selectedTicket.category}
              </div>

              <form onSubmit={handleTicketReply} className="space-y-3">
                <div>
                  <label className="text-slate-400 block text-[10px] mb-1">REPLY TO USER</label>
                  <textarea
                    rows={3}
                    placeholder="Write response message..."
                    value={ticketReply}
                    onChange={(e) => setTicketReply(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-gray-950 border border-gray-800 text-white"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-400 block text-[10px] mb-1">INTERNAL ADMIN NOTES (HIDDEN FROM USER)</label>
                  <input
                    type="text"
                    placeholder="Staff notes..."
                    value={ticketInternalNotes}
                    onChange={(e) => setTicketInternalNotes(e.target.value)}
                    className="w-full p-2 rounded-xl bg-gray-950 border border-gray-800 text-white"
                  />
                </div>

                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-black font-bold font-['Chakra_Petch']"
                  >
                    Send Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      api.adminUpdateSupportTicket(selectedTicket.id, 'RESOLVED');
                      showToast('Ticket marked resolved', 'success');
                      setSelectedTicket(null);
                      fetchData();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold"
                  >
                    Mark Resolved
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-2">
            {tickets.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTicket(t)}
                className="p-3.5 rounded-2xl bg-gray-900 border border-gray-800 hover:border-emerald-500/40 cursor-pointer"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-white">{t.subject}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-slate-300">
                    {t.status}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 flex justify-between">
                  <span>{t.category}</span>
                  <span>{new Date(t.updated_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= SECTION: ADS ================= */}
      {adminTab === 'ads' && (
        <div className="space-y-4 font-mono text-xs">
          <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800">
            <h4 className="font-bold text-white text-sm mb-3">AD PROVIDER ADAPTER STATUS</h4>
            <div className="space-y-2">
              {providers.map((p) => (
                <div key={p.name} className="flex justify-between items-center p-2.5 rounded-xl bg-gray-950 border border-gray-800">
                  <span className="font-bold text-slate-300">{p.name} Adapter</span>
                  <div className="space-x-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${p.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                      {p.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] ${p.configured ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {p.configured ? 'CONFIGURED' : 'UNCONFIGURED'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= SECTION: SETTINGS ================= */}
      {(adminTab === 'settings' || adminTab === 'community') && allSettings && (
        <div className="space-y-4 font-mono text-xs">
          <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800">
            <h4 className="font-bold text-white text-sm mb-3">SYSTEM CONFIGURATION MATRIX</h4>
            <div className="space-y-2 max-h-[450px] overflow-y-auto">
              {Object.entries(allSettings.currentConfig || {}).map(([k, v]: [string, any]) => (
                <div key={k} className="p-2.5 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block text-[10px]">{k}</span>
                    <span className="font-bold text-white text-xs">{String(v)}</span>
                  </div>
                  <button
                    onClick={() => {
                      const newVal = prompt(`Update ${k}:`, String(v));
                      if (newVal !== null) {
                        handleUpdateSetting(k, newVal);
                      }
                    }}
                    className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-emerald-400 text-[10px]"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= SECTION: AUDIT LOGS ================= */}
      {adminTab === 'audit' && (
        <div className="space-y-2 font-mono text-xs">
          <h4 className="font-bold text-white text-sm mb-2">IMMUTABLE AUDIT LOGS</h4>
          {auditLogs.map((log) => (
            <div key={log.id} className="p-3 rounded-2xl bg-gray-900 border border-gray-800">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-emerald-400">{log.action}</span>
                <span className="text-[10px] text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
              </div>
              <div className="text-[10px] text-slate-400">
                Admin: {log.admin_username} • Target: {log.target_type} ({log.target_id.slice(0, 8)})
              </div>
              {log.metadata && (
                <pre className="mt-1 text-[9px] text-slate-500 overflow-x-auto p-1 bg-gray-950 rounded">
                  {JSON.stringify(log.metadata)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ================= SECTION: SECURITY EVENTS ================= */}
      {adminTab === 'security' && (
        <div className="space-y-2 font-mono text-xs">
          <h4 className="font-bold text-white text-sm mb-2">SECURITY & ANTI-CHEAT EVENTS</h4>
          {securityEvents.map((ev) => (
            <div key={ev.id} className="p-3 rounded-2xl bg-gray-900 border border-rose-500/20">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-rose-400">{ev.event_type}</span>
                <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold bg-rose-500/20 text-rose-300">
                  {ev.severity}
                </span>
              </div>
              <div className="text-[10px] text-slate-500">
                User: {ev.user_id ? ev.user_id.slice(0, 8) : 'Anonymous'} • Time: {new Date(ev.created_at).toLocaleString()}
              </div>
              {ev.details && (
                <pre className="mt-1 text-[9px] text-slate-400 overflow-x-auto p-1 bg-gray-950 rounded">
                  {JSON.stringify(ev.details)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
