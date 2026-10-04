// Global Telegram WebApp type definition
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe?: any;
        ready: () => void;
        expand: () => void;
        close: () => void;
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        openLink?: (url: string) => void;
        openTelegramLink?: (url: string) => void;
        BackButton?: {
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
        };
      };
    };
  }
}

class ApiClient {
  private customInitData: string | null = null;
  private adminToken: string | null = localStorage.getItem('skx_admin_token');

  public setCustomInitData(initData: string) {
    this.customInitData = initData;
  }

  public getInitData(): string {
    if (this.customInitData) return this.customInitData;
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      return window.Telegram.WebApp.initData;
    }
    return 'demo_user_1001';
  }

  public setAdminToken(token: string | null) {
    this.adminToken = token;
    if (token) {
      localStorage.setItem('skx_admin_token', token);
    } else {
      localStorage.removeItem('skx_admin_token');
    }
  }

  public getAdminToken(): string | null {
    return this.adminToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, isAdmin = false): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (isAdmin) {
      if (this.adminToken) {
        headers['Authorization'] = `Bearer ${this.adminToken}`;
      }
    } else {
      headers['x-telegram-init-data'] = this.getInitData();
    }

    const res = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Network request failed');
    }

    return data.data;
  }

  // --- Public ---
  public getPublicSettings() {
    return this.request<any>('/settings/public');
  }

  public verifyAuth() {
    return this.request<any>('/auth/verify', { method: 'POST' });
  }

  // --- User & Mining ---
  public getUserProfile() {
    return this.request<any>('/user/me');
  }

  public submitTaps(tapsCount: number) {
    return this.request<any>('/taps/submit', {
      method: 'POST',
      body: JSON.stringify({ tapsCount, timestamp: Date.now() }),
    });
  }

  public getMiningCycleStatus() {
    return this.request<any>('/mining/status');
  }

  public claimMiningCycle() {
    return this.request<any>('/mining/claim', { method: 'POST' });
  }

  public getDailyRewardStatus() {
    return this.request<any>('/rewards/daily/status');
  }

  public claimDailyReward() {
    return this.request<any>('/rewards/daily/claim', { method: 'POST' });
  }

  public getReferralsSummary() {
    return this.request<any>('/referrals/summary');
  }

  public getLeaderboard() {
    return this.request<any[]>('/leaderboard');
  }

  public getTransactions() {
    return this.request<any[]>('/transactions');
  }

  public getWithdrawalEligibility() {
    return this.request<any>('/withdrawals/eligibility');
  }

  public getWithdrawals() {
    return this.request<any[]>('/withdrawals');
  }

  public submitWithdrawal(method: string, accountNumber: string, amount: string) {
    return this.request<any>('/withdrawals', {
      method: 'POST',
      body: JSON.stringify({ method, accountNumber, amount }),
    });
  }

  public getCommunityStatus() {
    return this.request<any>('/community/status');
  }

  public verifyCommunity() {
    return this.request<any>('/community/verify', { method: 'POST' });
  }

  public getSupportTickets() {
    return this.request<any[]>('/support/tickets');
  }

  public createSupportTicket(category: string, subject: string, message: string) {
    return this.request<any>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify({ category, subject, message }),
    });
  }

  public getSupportTicketDetails(id: string) {
    return this.request<any>(`/support/tickets/${id}`);
  }

  public replyToSupportTicket(id: string, message: string) {
    return this.request<any>(`/support/tickets/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  public getNotifications() {
    return this.request<any>('/notifications');
  }

  public markNotificationAsRead(id: string) {
    return this.request<any>(`/notifications/${id}/read`, { method: 'POST' });
  }

  public markAllNotificationsAsRead() {
    return this.request<any>('/notifications/read-all', { method: 'POST' });
  }

  public getAdStatus() {
    return this.request<any>('/ads/status');
  }

  public requestAdOpportunity() {
    return this.request<any>('/ads/opportunity', { method: 'POST' });
  }

  public verifyAd(opportunityId: string, token: string) {
    return this.request<any>('/ads/verify', {
      method: 'POST',
      body: JSON.stringify({ opportunityId, token }),
    });
  }

  // --- Admin ---
  public adminLogin(username: string, password: string) {
    return this.request<any>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  public getAdminDashboard() {
    return this.request<any>('/admin/dashboard', {}, true);
  }

  public getAdminUsers(limit = 50, offset = 0, search = '') {
    return this.request<any>(`/admin/users?limit=${limit}&offset=${offset}&search=${encodeURIComponent(search)}`, {}, true);
  }

  public getAdminUserDetails(id: string) {
    return this.request<any>(`/admin/users/${id}`, {}, true);
  }

  public adminAdjustBalance(userId: string, amount: string, direction: 'CREDIT' | 'DEBIT', reason: string) {
    return this.request<any>(`/admin/users/${userId}/adjust-balance`, {
      method: 'POST',
      body: JSON.stringify({ amount, direction, reason }),
    }, true);
  }

  public adminToggleSuspension(userId: string, suspended: boolean, reason: string) {
    return this.request<any>(`/admin/users/${userId}/suspension`, {
      method: 'POST',
      body: JSON.stringify({ suspended, reason }),
    }, true);
  }

  public getAdminWithdrawals(status?: string) {
    const q = status ? `?status=${status}` : '';
    return this.request<any[]>(`/admin/withdrawals${q}`, {}, true);
  }

  public adminUpdateWithdrawal(id: string, status: string, providerTrxId?: string, adminNotes?: string) {
    return this.request<any>(`/admin/withdrawals/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, providerTrxId, adminNotes }),
    }, true);
  }

  public getAdminSupportTickets(status?: string) {
    const q = status ? `?status=${status}` : '';
    return this.request<any[]>(`/admin/support${q}`, {}, true);
  }

  public getAdminSupportTicketDetails(id: string) {
    return this.request<any>(`/admin/support/${id}`, {}, true);
  }

  public adminReplySupportTicket(id: string, message: string) {
    return this.request<any>(`/admin/support/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }, true);
  }

  public adminUpdateSupportTicket(id: string, status: string, assignedTo?: string, internalNotes?: string) {
    return this.request<any>(`/admin/support/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, assignedTo, internalNotes }),
    }, true);
  }

  public getAdminTransactions(limit = 100, offset = 0) {
    return this.request<any>(`/admin/transactions?limit=${limit}&offset=${offset}`, {}, true);
  }

  public getAdminSettings() {
    return this.request<any>('/admin/settings', {}, true);
  }

  public adminUpdateSetting(key: string, value: string, description?: string) {
    return this.request<any>('/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ key, value, description }),
    }, true);
  }

  public getAdminAuditLogs(limit = 100) {
    return this.request<any[]>(`/admin/audit-logs?limit=${limit}`, {}, true);
  }

  public getAdminSecurityEvents(limit = 100) {
    return this.request<any[]>(`/admin/security-events?limit=${limit}`, {}, true);
  }
}

export const api = new ApiClient();
