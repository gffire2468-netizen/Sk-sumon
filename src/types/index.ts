export interface UserProfile {
  user: {
    id: string;
    telegram_id: string;
    username?: string;
    first_name: string;
    last_name?: string;
    language_code?: string;
    is_suspended: boolean;
    suspension_reason?: string;
    referrer_id?: string;
    created_at: string;
    last_active_at: string;
  };
  balance: {
    available_balance: string;
    reserved_balance: string;
    total_earned: string;
  };
  energy: {
    current_energy: number;
    max_energy: number;
    last_regen_at: number;
  };
  miningCycle: {
    cycle_started_at: number;
    cycle_duration_seconds: number;
    reward_claimed: boolean;
    last_claimed_at?: number;
  };
  tapState: {
    valid_taps_count: number;
    taps_since_last_ad: number;
    pending_ad_opportunity: boolean;
    last_tap_at: number;
  };
  referralsCount: number;
  validReferralsCount: number;
  withdrawalEligibility: {
    canWithdraw: boolean;
    isBalanceEligible: boolean;
    isReferralEligible: boolean;
    requiredBalance: string;
    requiredReferrals: number;
    currentBalance: string;
    currentValidReferrals: number;
  };
}

export interface PublicSettings {
  tapReward: string;
  energyPerTap: number;
  maxEnergy: number;
  energyRegenRate: number;
  miningCycleDuration: number;
  miningCycleReward: string;
  requiredReferrals: number;
  referralReward: string;
  minWithdrawal: string;
  maxWithdrawal: string;
  withdrawalFeeType: 'FIXED' | 'PERCENTAGE';
  withdrawalFeeValue: string;
  communityRewardEnabled: boolean;
  communityInviteLink: string;
  communityReward: string;
  supportEnabled: boolean;
  adsEnabled: boolean;
  adReward: string;
  dailyAdLimit: number;
  dailyAdReward: string;
  tapAdTriggerEnabled: boolean;
  tapAdThreshold: number;
  dailyRewardMode: 'DAILY_BONUS' | 'ADS' | 'BOTH';
  dailyRewardBase: string;
  skxUsdRate: string;
  skxBdtRate: string;
  demoMode: boolean;
  paymentMethods: {
    bKash: boolean;
    nagad: boolean;
    rocket: boolean;
  };
}

export interface TransactionItem {
  id: string;
  user_id: string;
  type: string;
  amount: string;
  balance_before: string;
  balance_after: string;
  status: string;
  reference_id?: string;
  metadata?: any;
  created_at: string;
}

export interface WithdrawalItem {
  id: string;
  user_id: string;
  method: 'bKash' | 'Nagad' | 'Rocket';
  account_number: string;
  requested_amount: string;
  fee_amount: string;
  net_amount: string;
  status: string;
  provider_trx_id?: string;
  admin_notes?: string;
  created_at: string;
  completed_at?: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface SupportTicketItem {
  id: string;
  user_id: string;
  category: 'MINING' | 'WITHDRAWAL' | 'REFERRAL' | 'ACCOUNT' | 'OTHER';
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  created_at: string;
  updated_at: string;
}

export interface SupportMessageItem {
  id: string;
  ticket_id: string;
  sender_type: 'USER' | 'ADMIN';
  sender_id: string;
  message: string;
  created_at: string;
}

export interface LeaderboardItem {
  rank: number;
  display_name: string;
  balance: string;
}
