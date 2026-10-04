export interface User {
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
}

export interface UserBalance {
  user_id: string;
  available_balance: string; // Stored as Decimal string (e.g. "0.0000")
  reserved_balance: string;  // Locked for pending withdrawals
  total_earned: string;
  updated_at: string;
}

export interface UserEnergy {
  user_id: string;
  current_energy: number;
  max_energy: number;
  last_regen_at: number; // Unix timestamp in ms
}

export interface MiningCycle {
  user_id: string;
  cycle_started_at: number; // Unix timestamp in ms
  cycle_duration_seconds: number; // 3600
  reward_claimed: boolean;
  last_claimed_at?: number;
}

export interface TapState {
  user_id: string;
  valid_taps_count: number;
  taps_since_last_ad: number;
  pending_ad_opportunity: boolean;
  last_tap_at: number;
}

export interface DailyRewardClaim {
  id: string;
  user_id: string;
  day_key: string; // YYYY-MM-DD (UTC)
  reward_amount: string;
  claimed_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  status: 'PENDING' | 'VALID' | 'REJECTED';
  reward_paid: boolean;
  reward_amount: string;
  created_at: string;
  validated_at?: string;
}

export type TransactionType =
  | 'TAP_REWARD'
  | 'MINING_REWARD'
  | 'DAILY_REWARD'
  | 'REFERRAL_REWARD'
  | 'COMMUNITY_REWARD'
  | 'AD_REWARD'
  | 'WITHDRAWAL'
  | 'WITHDRAWAL_FEE'
  | 'ADMIN_ADJUSTMENT'
  | 'REVERSAL';

export type TransactionStatus = 'COMPLETED' | 'PENDING' | 'REJECTED' | 'CANCELLED';

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: string;
  balance_before: string;
  balance_after: string;
  status: TransactionStatus;
  reference_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export type WithdrawalStatus =
  | 'PENDING'
  | 'ADMIN_REVIEW'
  | 'APPROVED'
  | 'MANUAL_PAYMENT'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED';

export interface Withdrawal {
  id: string;
  user_id: string;
  method: 'bKash' | 'Nagad' | 'Rocket';
  account_number: string;
  requested_amount: string;
  fee_amount: string;
  net_amount: string;
  status: WithdrawalStatus;
  provider_trx_id?: string;
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface CommunityMembership {
  user_id: string;
  verified: boolean;
  reward_claimed: boolean;
  claimed_at?: string;
  verified_at?: string;
}

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketCategory = 'MINING' | 'WITHDRAWAL' | 'REFERRAL' | 'ACCOUNT' | 'OTHER';

export interface SupportTicket {
  id: string;
  user_id: string;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  assigned_to?: string;
  internal_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: 'USER' | 'ADMIN';
  sender_id: string;
  message: string;
  created_at: string;
}

export type NotificationType =
  | 'REFERRAL_REWARD'
  | 'COMMUNITY_REWARD'
  | 'DAILY_REWARD'
  | 'MINING_REWARD'
  | 'AD_REWARD'
  | 'WITHDRAWAL_SUBMITTED'
  | 'WITHDRAWAL_APPROVED'
  | 'WITHDRAWAL_REJECTED'
  | 'WITHDRAWAL_COMPLETED'
  | 'SUPPORT_REPLY'
  | 'SECURITY_ALERT'
  | 'SYSTEM_ANNOUNCEMENT';

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
}

export interface AdDailyTracking {
  id: string;
  user_id: string;
  day_key: string;
  ads_watched: number;
  ad_earnings: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  username: string;
  password_hash: string;
  role: 'SUPER_ADMIN' | 'SUPPORT_ADMIN';
  created_at: string;
  last_login_at?: string;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  admin_username: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface SecurityEvent {
  id: string;
  user_id?: string;
  event_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: Record<string, any>;
  ip?: string;
  created_at: string;
}

export interface SystemSetting {
  key: string;
  value: string;
  description?: string;
  updated_at: string;
  updated_by?: string;
}
