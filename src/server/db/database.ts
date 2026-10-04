import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { AsyncLocalStorage } from 'async_hooks';
import { ConfigService } from '../config/configService';

const lockContext = new AsyncLocalStorage<Set<string>>();
import {
  User,
  UserBalance,
  UserEnergy,
  MiningCycle,
  TapState,
  DailyRewardClaim,
  Referral,
  Transaction,
  Withdrawal,
  CommunityMembership,
  SupportTicket,
  SupportMessage,
  AppNotification,
  AdDailyTracking,
  AdminUser,
  AuditLog,
  SecurityEvent,
  SystemSetting,
} from '../types';

interface InMemoryData {
  users: Map<string, User>;
  telegramToUserId: Map<string, string>;
  balances: Map<string, UserBalance>;
  energies: Map<string, UserEnergy>;
  miningCycles: Map<string, MiningCycle>;
  tapStates: Map<string, TapState>;
  dailyRewards: Map<string, DailyRewardClaim>; // key: user_id:day_key
  referrals: Map<string, Referral>;
  transactions: Map<string, Transaction>;
  withdrawals: Map<string, Withdrawal>;
  communityMemberships: Map<string, CommunityMembership>;
  supportTickets: Map<string, SupportTicket>;
  supportMessages: Map<string, SupportMessage>;
  notifications: Map<string, AppNotification>;
  adDailyTracking: Map<string, AdDailyTracking>; // key: user_id:day_key
  adminUsers: Map<string, AdminUser>;
  auditLogs: Map<string, AuditLog>;
  securityEvents: Map<string, SecurityEvent>;
  systemSettings: Map<string, SystemSetting>;
}

class DatabaseService {
  private pgPool: Pool | null = null;
  private isPostgresActive = false;
  private memoryData: InMemoryData = {
    users: new Map(),
    telegramToUserId: new Map(),
    balances: new Map(),
    energies: new Map(),
    miningCycles: new Map(),
    tapStates: new Map(),
    dailyRewards: new Map(),
    referrals: new Map(),
    transactions: new Map(),
    withdrawals: new Map(),
    communityMemberships: new Map(),
    supportTickets: new Map(),
    supportMessages: new Map(),
    notifications: new Map(),
    adDailyTracking: new Map(),
    adminUsers: new Map(),
    auditLogs: new Map(),
    securityEvents: new Map(),
    systemSettings: new Map(),
  };

  private locks: Map<string, Promise<void>> = new Map();

  public async initialize(): Promise<void> {
    const isDemo = ConfigService.get('DEMO_MODE');
    const dbUrl = ConfigService.getDatabaseUrl();

    if (!isDemo && !dbUrl) {
      throw new Error('DATABASE_URL is required when DEMO_MODE=false. Please provide a valid PostgreSQL connection string.');
    }

    if (dbUrl) {
      try {
        this.pgPool = new Pool({
          connectionString: dbUrl,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
          max: 20,
          idleTimeoutMillis: 30000,
        });

        // Run migrations
        const migrationPath = path.resolve(process.cwd(), 'migrations/001_init_schema.sql');
        if (fs.existsSync(migrationPath)) {
          const sql = fs.readFileSync(migrationPath, 'utf8');
          await this.pgPool.query(sql);
        }
        this.isPostgresActive = true;
        console.log('[Database] Connected to PostgreSQL successfully.');
        return;
      } catch (err) {
        if (!isDemo) {
          throw new Error(`[Database] PostgreSQL connection failed in production mode: ${err}`);
        }
        console.warn('[Database] PostgreSQL connection failed. Falling back to internal engine in DEMO_MODE.', err);
        this.pgPool = null;
        this.isPostgresActive = false;
      }
    } else {
      console.warn('[Database] DATABASE_URL is not set. Running in safe resilient memory mode (DEMO_MODE=true).');
    }
  }

  // Mutex lock for atomic balance and transaction safety per user
  public async withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const currentLocks = lockContext.getStore();
    if (currentLocks && currentLocks.has(userId)) {
      // Reentrant lock: already held in current async execution stack
      return await fn();
    }

    while (this.locks.has(userId)) {
      await this.locks.get(userId);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((res) => {
      resolveLock = res;
    });
    this.locks.set(userId, lockPromise);

    const nextLocks = new Set(currentLocks || []);
    nextLocks.add(userId);

    return lockContext.run(nextLocks, async () => {
      try {
        return await fn();
      } finally {
        this.locks.delete(userId);
        resolveLock();
      }
    });
  }

  // ==================== USERS ====================
  public async getUserByTelegramId(telegramId: string): Promise<User | null> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<User>('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
      return res.rows[0] || null;
    }
    const userId = this.memoryData.telegramToUserId.get(telegramId);
    if (!userId) return null;
    return this.memoryData.users.get(userId) || null;
  }

  public async getUserById(id: string): Promise<User | null> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<User>('SELECT * FROM users WHERE id = $1', [id]);
      return res.rows[0] || null;
    }
    return this.memoryData.users.get(id) || null;
  }

  public async createUser(user: User): Promise<User> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO users (id, telegram_id, username, first_name, last_name, language_code, is_suspended, suspension_reason, referrer_id, created_at, last_active_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          user.id,
          user.telegram_id,
          user.username || null,
          user.first_name,
          user.last_name || null,
          user.language_code || null,
          user.is_suspended,
          user.suspension_reason || null,
          user.referrer_id || null,
          user.created_at,
          user.last_active_at,
        ]
      );
      return user;
    }
    this.memoryData.users.set(user.id, { ...user });
    this.memoryData.telegramToUserId.set(user.telegram_id, user.id);
    return user;
  }

  public async updateUser(user: User): Promise<User> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `UPDATE users SET username = $1, first_name = $2, last_name = $3, language_code = $4, is_suspended = $5, suspension_reason = $6, last_active_at = $7
         WHERE id = $8`,
        [
          user.username || null,
          user.first_name,
          user.last_name || null,
          user.language_code || null,
          user.is_suspended,
          user.suspension_reason || null,
          user.last_active_at,
          user.id,
        ]
      );
      return user;
    }
    this.memoryData.users.set(user.id, { ...user });
    return user;
  }

  public async getAllUsers(limit = 100, offset = 0, search = ''): Promise<{ users: User[]; total: number }> {
    if (this.isPostgresActive && this.pgPool) {
      const searchPattern = `%${search}%`;
      const countRes = await this.pgPool.query(
        `SELECT COUNT(*) FROM users WHERE username ILIKE $1 OR first_name ILIKE $1 OR telegram_id ILIKE $1`,
        [searchPattern]
      );
      const res = await this.pgPool.query<User>(
        `SELECT * FROM users WHERE username ILIKE $1 OR first_name ILIKE $1 OR telegram_id ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [searchPattern, limit, offset]
      );
      return { users: res.rows, total: parseInt(countRes.rows[0].count, 10) };
    }

    let all = Array.from(this.memoryData.users.values());
    if (search) {
      const s = search.toLowerCase();
      all = all.filter(
        (u) =>
          u.username?.toLowerCase().includes(s) ||
          u.first_name.toLowerCase().includes(s) ||
          u.telegram_id.includes(s)
      );
    }
    const total = all.length;
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { users: all.slice(offset, offset + limit), total };
  }

  // ==================== BALANCES ====================
  public async getBalance(userId: string): Promise<UserBalance | null> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<UserBalance>('SELECT * FROM balances WHERE user_id = $1', [userId]);
      return res.rows[0] || null;
    }
    return this.memoryData.balances.get(userId) || null;
  }

  public async saveBalance(balance: UserBalance): Promise<UserBalance> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO balances (user_id, available_balance, reserved_balance, total_earned, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET
           available_balance = EXCLUDED.available_balance,
           reserved_balance = EXCLUDED.reserved_balance,
           total_earned = EXCLUDED.total_earned,
           updated_at = EXCLUDED.updated_at`,
        [
          balance.user_id,
          balance.available_balance,
          balance.reserved_balance,
          balance.total_earned,
          balance.updated_at,
        ]
      );
      return balance;
    }
    this.memoryData.balances.set(balance.user_id, { ...balance });
    return balance;
  }

  // ==================== ENERGY ====================
  public async getEnergy(userId: string): Promise<UserEnergy | null> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<UserEnergy>('SELECT * FROM energies WHERE user_id = $1', [userId]);
      return res.rows[0] || null;
    }
    return this.memoryData.energies.get(userId) || null;
  }

  public async saveEnergy(energy: UserEnergy): Promise<UserEnergy> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO energies (user_id, current_energy, max_energy, last_regen_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET
           current_energy = EXCLUDED.current_energy,
           max_energy = EXCLUDED.max_energy,
           last_regen_at = EXCLUDED.last_regen_at`,
        [energy.user_id, energy.current_energy, energy.max_energy, energy.last_regen_at]
      );
      return energy;
    }
    this.memoryData.energies.set(energy.user_id, { ...energy });
    return energy;
  }

  // ==================== MINING CYCLE ====================
  public async getMiningCycle(userId: string): Promise<MiningCycle | null> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<MiningCycle>('SELECT * FROM mining_cycles WHERE user_id = $1', [userId]);
      return res.rows[0] || null;
    }
    return this.memoryData.miningCycles.get(userId) || null;
  }

  public async saveMiningCycle(cycle: MiningCycle): Promise<MiningCycle> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO mining_cycles (user_id, cycle_started_at, cycle_duration_seconds, reward_claimed, last_claimed_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET
           cycle_started_at = EXCLUDED.cycle_started_at,
           cycle_duration_seconds = EXCLUDED.cycle_duration_seconds,
           reward_claimed = EXCLUDED.reward_claimed,
           last_claimed_at = EXCLUDED.last_claimed_at`,
        [cycle.user_id, cycle.cycle_started_at, cycle.cycle_duration_seconds, cycle.reward_claimed, cycle.last_claimed_at || null]
      );
      return cycle;
    }
    this.memoryData.miningCycles.set(cycle.user_id, { ...cycle });
    return cycle;
  }

  // ==================== TAP STATE ====================
  public async getTapState(userId: string): Promise<TapState | null> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<TapState>('SELECT * FROM tap_states WHERE user_id = $1', [userId]);
      return res.rows[0] || null;
    }
    return this.memoryData.tapStates.get(userId) || null;
  }

  public async saveTapState(tapState: TapState): Promise<TapState> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO tap_states (user_id, valid_taps_count, taps_since_last_ad, pending_ad_opportunity, last_tap_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET
           valid_taps_count = EXCLUDED.valid_taps_count,
           taps_since_last_ad = EXCLUDED.taps_since_last_ad,
           pending_ad_opportunity = EXCLUDED.pending_ad_opportunity,
           last_tap_at = EXCLUDED.last_tap_at`,
        [
          tapState.user_id,
          tapState.valid_taps_count,
          tapState.taps_since_last_ad,
          tapState.pending_ad_opportunity,
          tapState.last_tap_at,
        ]
      );
      return tapState;
    }
    this.memoryData.tapStates.set(tapState.user_id, { ...tapState });
    return tapState;
  }

  // ==================== DAILY REWARDS ====================
  public async getDailyRewardClaim(userId: string, dayKey: string): Promise<DailyRewardClaim | null> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<DailyRewardClaim>(
        'SELECT * FROM daily_rewards WHERE user_id = $1 AND day_key = $2',
        [userId, dayKey]
      );
      return res.rows[0] || null;
    }
    return this.memoryData.dailyRewards.get(`${userId}:${dayKey}`) || null;
  }

  public async saveDailyRewardClaim(claim: DailyRewardClaim): Promise<DailyRewardClaim> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO daily_rewards (id, user_id, day_key, reward_amount, claimed_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [claim.id, claim.user_id, claim.day_key, claim.reward_amount, claim.claimed_at]
      );
      return claim;
    }
    this.memoryData.dailyRewards.set(`${claim.user_id}:${claim.day_key}`, { ...claim });
    return claim;
  }

  // ==================== REFERRALS ====================
  public async getReferralByReferredUserId(referredUserId: string): Promise<Referral | null> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<Referral>(
        'SELECT * FROM referrals WHERE referred_user_id = $1',
        [referredUserId]
      );
      return res.rows[0] || null;
    }
    for (const ref of this.memoryData.referrals.values()) {
      if (ref.referred_user_id === referredUserId) return ref;
    }
    return null;
  }

  public async getReferralsByReferrerId(referrerId: string): Promise<Referral[]> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<Referral>(
        'SELECT * FROM referrals WHERE referrer_id = $1 ORDER BY created_at DESC',
        [referrerId]
      );
      return res.rows;
    }
    return Array.from(this.memoryData.referrals.values())
      .filter((r) => r.referrer_id === referrerId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async getValidReferralsCount(referrerId: string): Promise<number> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query(
        "SELECT COUNT(*) FROM referrals WHERE referrer_id = $1 AND status = 'VALID'",
        [referrerId]
      );
      return parseInt(res.rows[0].count, 10);
    }
    return Array.from(this.memoryData.referrals.values()).filter(
      (r) => r.referrer_id === referrerId && r.status === 'VALID'
    ).length;
  }

  public async saveReferral(referral: Referral): Promise<Referral> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO referrals (id, referrer_id, referred_user_id, status, reward_paid, reward_amount, created_at, validated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (referred_user_id) DO UPDATE SET
           status = EXCLUDED.status,
           reward_paid = EXCLUDED.reward_paid,
           reward_amount = EXCLUDED.reward_amount,
           validated_at = EXCLUDED.validated_at`,
        [
          referral.id,
          referral.referrer_id,
          referral.referred_user_id,
          referral.status,
          referral.reward_paid,
          referral.reward_amount,
          referral.created_at,
          referral.validated_at || null,
        ]
      );
      return referral;
    }
    this.memoryData.referrals.set(referral.id, { ...referral });
    return referral;
  }

  // ==================== TRANSACTIONS ====================
  public async createTransaction(tx: Transaction): Promise<Transaction> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO transactions (id, user_id, type, amount, balance_before, balance_after, status, reference_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          tx.id,
          tx.user_id,
          tx.type,
          tx.amount,
          tx.balance_before,
          tx.balance_after,
          tx.status,
          tx.reference_id || null,
          tx.metadata ? JSON.stringify(tx.metadata) : null,
          tx.created_at,
        ]
      );
      return tx;
    }
    this.memoryData.transactions.set(tx.id, { ...tx });
    return tx;
  }

  public async getTransactionsByUserId(userId: string, limit = 50): Promise<Transaction[]> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<Transaction>(
        'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [userId, limit]
      );
      return res.rows;
    }
    return Array.from(this.memoryData.transactions.values())
      .filter((t) => t.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  public async getAllTransactions(limit = 100, offset = 0): Promise<{ transactions: Transaction[]; total: number }> {
    if (this.isPostgresActive && this.pgPool) {
      const countRes = await this.pgPool.query('SELECT COUNT(*) FROM transactions');
      const res = await this.pgPool.query<Transaction>(
        'SELECT * FROM transactions ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      return { transactions: res.rows, total: parseInt(countRes.rows[0].count, 10) };
    }
    const all = Array.from(this.memoryData.transactions.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return { transactions: all.slice(offset, offset + limit), total: all.length };
  }

  // ==================== WITHDRAWALS ====================
  public async createWithdrawal(w: Withdrawal): Promise<Withdrawal> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO withdrawals (id, user_id, method, account_number, requested_amount, fee_amount, net_amount, status, provider_trx_id, admin_notes, reviewed_by, reviewed_at, completed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          w.id,
          w.user_id,
          w.method,
          w.account_number,
          w.requested_amount,
          w.fee_amount,
          w.net_amount,
          w.status,
          w.provider_trx_id || null,
          w.admin_notes || null,
          w.reviewed_by || null,
          w.reviewed_at || null,
          w.completed_at || null,
          w.created_at,
        ]
      );
      return w;
    }
    this.memoryData.withdrawals.set(w.id, { ...w });
    return w;
  }

  public async updateWithdrawal(w: Withdrawal): Promise<Withdrawal> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `UPDATE withdrawals SET status = $1, provider_trx_id = $2, admin_notes = $3, reviewed_by = $4, reviewed_at = $5, completed_at = $6
         WHERE id = $7`,
        [
          w.status,
          w.provider_trx_id || null,
          w.admin_notes || null,
          w.reviewed_by || null,
          w.reviewed_at || null,
          w.completed_at || null,
          w.id,
        ]
      );
      return w;
    }
    this.memoryData.withdrawals.set(w.id, { ...w });
    return w;
  }

  public async getWithdrawalById(id: string): Promise<Withdrawal | null> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<Withdrawal>('SELECT * FROM withdrawals WHERE id = $1', [id]);
      return res.rows[0] || null;
    }
    return this.memoryData.withdrawals.get(id) || null;
  }

  public async getWithdrawalsByUserId(userId: string): Promise<Withdrawal[]> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<Withdrawal>(
        'SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return res.rows;
    }
    return Array.from(this.memoryData.withdrawals.values())
      .filter((w) => w.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async getAllWithdrawals(status?: string): Promise<Withdrawal[]> {
    if (this.isPostgresActive && this.pgPool) {
      let query = 'SELECT * FROM withdrawals';
      const params: any[] = [];
      if (status) {
        query += ' WHERE status = $1';
        params.push(status);
      }
      query += ' ORDER BY created_at DESC';
      const res = await this.pgPool.query<Withdrawal>(query, params);
      return res.rows;
    }
    let all = Array.from(this.memoryData.withdrawals.values());
    if (status) {
      all = all.filter((w) => w.status === status);
    }
    return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // ==================== COMMUNITY MEMBERSHIP ====================
  public async getCommunityMembership(userId: string): Promise<CommunityMembership | null> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<CommunityMembership>(
        'SELECT * FROM community_memberships WHERE user_id = $1',
        [userId]
      );
      return res.rows[0] || null;
    }
    return this.memoryData.communityMemberships.get(userId) || null;
  }

  public async saveCommunityMembership(membership: CommunityMembership): Promise<CommunityMembership> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO community_memberships (user_id, verified, reward_claimed, claimed_at, verified_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET
           verified = EXCLUDED.verified,
           reward_claimed = EXCLUDED.reward_claimed,
           claimed_at = EXCLUDED.claimed_at,
           verified_at = EXCLUDED.verified_at`,
        [membership.user_id, membership.verified, membership.reward_claimed, membership.claimed_at || null, membership.verified_at || null]
      );
      return membership;
    }
    this.memoryData.communityMemberships.set(membership.user_id, { ...membership });
    return membership;
  }

  // ==================== SUPPORT TICKETS & MESSAGES ====================
  public async createSupportTicket(ticket: SupportTicket): Promise<SupportTicket> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO support_tickets (id, user_id, category, subject, status, assigned_to, internal_notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          ticket.id,
          ticket.user_id,
          ticket.category,
          ticket.subject,
          ticket.status,
          ticket.assigned_to || null,
          ticket.internal_notes || null,
          ticket.created_at,
          ticket.updated_at,
        ]
      );
      return ticket;
    }
    this.memoryData.supportTickets.set(ticket.id, { ...ticket });
    return ticket;
  }

  public async updateSupportTicket(ticket: SupportTicket): Promise<SupportTicket> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `UPDATE support_tickets SET status = $1, assigned_to = $2, internal_notes = $3, updated_at = $4 WHERE id = $5`,
        [ticket.status, ticket.assigned_to || null, ticket.internal_notes || null, ticket.updated_at, ticket.id]
      );
      return ticket;
    }
    this.memoryData.supportTickets.set(ticket.id, { ...ticket });
    return ticket;
  }

  public async getSupportTicketById(id: string): Promise<SupportTicket | null> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<SupportTicket>('SELECT * FROM support_tickets WHERE id = $1', [id]);
      return res.rows[0] || null;
    }
    return this.memoryData.supportTickets.get(id) || null;
  }

  public async getSupportTicketsByUserId(userId: string): Promise<SupportTicket[]> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<SupportTicket>(
        'SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY updated_at DESC',
        [userId]
      );
      return res.rows;
    }
    return Array.from(this.memoryData.supportTickets.values())
      .filter((t) => t.user_id === userId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  public async getAllSupportTickets(status?: string): Promise<SupportTicket[]> {
    if (this.isPostgresActive && this.pgPool) {
      let query = 'SELECT * FROM support_tickets';
      const params: any[] = [];
      if (status) {
        query += ' WHERE status = $1';
        params.push(status);
      }
      query += ' ORDER BY updated_at DESC';
      const res = await this.pgPool.query<SupportTicket>(query, params);
      return res.rows;
    }
    let all = Array.from(this.memoryData.supportTickets.values());
    if (status) {
      all = all.filter((t) => t.status === status);
    }
    return all.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  public async createSupportMessage(msg: SupportMessage): Promise<SupportMessage> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO support_messages (id, ticket_id, sender_type, sender_id, message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [msg.id, msg.ticket_id, msg.sender_type, msg.sender_id, msg.message, msg.created_at]
      );
      return msg;
    }
    this.memoryData.supportMessages.set(msg.id, { ...msg });
    return msg;
  }

  public async getSupportMessagesByTicketId(ticketId: string): Promise<SupportMessage[]> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<SupportMessage>(
        'SELECT * FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC',
        [ticketId]
      );
      return res.rows;
    }
    return Array.from(this.memoryData.supportMessages.values())
      .filter((m) => m.ticket_id === ticketId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  // ==================== NOTIFICATIONS ====================
  public async createNotification(notif: AppNotification): Promise<AppNotification> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [notif.id, notif.user_id, notif.title, notif.message, notif.type, notif.is_read, notif.created_at]
      );
      return notif;
    }
    this.memoryData.notifications.set(notif.id, { ...notif });
    return notif;
  }

  public async getNotificationsByUserId(userId: string, limit = 50): Promise<AppNotification[]> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<AppNotification>(
        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [userId, limit]
      );
      return res.rows;
    }
    return Array.from(this.memoryData.notifications.values())
      .filter((n) => n.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  public async markNotificationAsRead(id: string, userId: string): Promise<boolean> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query(
        'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      return (res.rowCount ?? 0) > 0;
    }
    const notif = this.memoryData.notifications.get(id);
    if (notif && notif.user_id === userId) {
      notif.is_read = true;
      return true;
    }
    return false;
  }

  public async markAllNotificationsAsRead(userId: string): Promise<void> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [userId]);
      return;
    }
    for (const notif of this.memoryData.notifications.values()) {
      if (notif.user_id === userId) {
        notif.is_read = true;
      }
    }
  }

  // ==================== AD TRACKING ====================
  public async getAdDailyTracking(userId: string, dayKey: string): Promise<AdDailyTracking | null> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<AdDailyTracking>(
        'SELECT * FROM ad_daily_tracking WHERE user_id = $1 AND day_key = $2',
        [userId, dayKey]
      );
      return res.rows[0] || null;
    }
    return this.memoryData.adDailyTracking.get(`${userId}:${dayKey}`) || null;
  }

  public async saveAdDailyTracking(tracking: AdDailyTracking): Promise<AdDailyTracking> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO ad_daily_tracking (id, user_id, day_key, ads_watched, ad_earnings, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, day_key) DO UPDATE SET
           ads_watched = EXCLUDED.ads_watched,
           ad_earnings = EXCLUDED.ad_earnings,
           updated_at = EXCLUDED.updated_at`,
        [tracking.id, tracking.user_id, tracking.day_key, tracking.ads_watched, tracking.ad_earnings, tracking.updated_at]
      );
      return tracking;
    }
    this.memoryData.adDailyTracking.set(`${tracking.user_id}:${tracking.day_key}`, { ...tracking });
    return tracking;
  }

  // ==================== ADMIN USERS ====================
  public async getAdminByUsername(username: string): Promise<AdminUser | null> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<AdminUser>('SELECT * FROM admin_users WHERE username = $1', [username]);
      return res.rows[0] || null;
    }
    for (const admin of this.memoryData.adminUsers.values()) {
      if (admin.username === username) return admin;
    }
    return null;
  }

  public async saveAdminUser(admin: AdminUser): Promise<AdminUser> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO admin_users (id, username, password_hash, role, created_at, last_login_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (username) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           last_login_at = EXCLUDED.last_login_at`,
        [admin.id, admin.username, admin.password_hash, admin.role, admin.created_at, admin.last_login_at || null]
      );
      return admin;
    }
    this.memoryData.adminUsers.set(admin.id, { ...admin });
    return admin;
  }

  // ==================== AUDIT LOGS ====================
  public async createAuditLog(log: AuditLog): Promise<AuditLog> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO audit_logs (id, admin_id, admin_username, action, target_type, target_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [log.id, log.admin_id, log.admin_username, log.action, log.target_type, log.target_id, log.metadata ? JSON.stringify(log.metadata) : null, log.created_at]
      );
      return log;
    }
    this.memoryData.auditLogs.set(log.id, { ...log });
    return log;
  }

  public async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<AuditLog>('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1', [limit]);
      return res.rows;
    }
    return Array.from(this.memoryData.auditLogs.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  // ==================== SECURITY EVENTS ====================
  public async createSecurityEvent(event: SecurityEvent): Promise<SecurityEvent> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO security_events (id, user_id, event_type, severity, details, ip, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [event.id, event.user_id || null, event.event_type, event.severity, JSON.stringify(event.details), event.ip || null, event.created_at]
      );
      return event;
    }
    this.memoryData.securityEvents.set(event.id, { ...event });
    return event;
  }

  public async getSecurityEvents(limit = 100): Promise<SecurityEvent[]> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<SecurityEvent>('SELECT * FROM security_events ORDER BY created_at DESC LIMIT $1', [limit]);
      return res.rows;
    }
    return Array.from(this.memoryData.securityEvents.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  // ==================== SYSTEM SETTINGS ====================
  public async getSystemSetting(key: string): Promise<string | null> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<SystemSetting>('SELECT * FROM system_settings WHERE key = $1', [key]);
      return res.rows[0]?.value || null;
    }
    return this.memoryData.systemSettings.get(key)?.value || null;
  }

  public async setSystemSetting(setting: SystemSetting): Promise<void> {
    if (this.isPostgresActive && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO system_settings (key, value, description, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value,
           description = EXCLUDED.description,
           updated_at = EXCLUDED.updated_at,
           updated_by = EXCLUDED.updated_by`,
        [setting.key, setting.value, setting.description || null, setting.updated_at, setting.updated_by || null]
      );
      return;
    }
    this.memoryData.systemSettings.set(setting.key, { ...setting });
  }

  public async getAllSystemSettings(): Promise<SystemSetting[]> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<SystemSetting>('SELECT * FROM system_settings');
      return res.rows;
    }
    return Array.from(this.memoryData.systemSettings.values());
  }

  // ==================== LEADERBOARD & METRICS ====================
  public async getLeaderboard(limit = 100): Promise<{ rank: number; display_name: string; balance: string }[]> {
    if (this.isPostgresActive && this.pgPool) {
      const res = await this.pgPool.query<{
        first_name: string;
        username: string | null;
        available_balance: string;
      }>(
        `SELECT u.first_name, u.username, b.available_balance
         FROM balances b
         JOIN users u ON u.id = b.user_id
         WHERE u.is_suspended = FALSE
         ORDER BY b.available_balance::numeric DESC
         LIMIT $1`,
        [limit]
      );
      return res.rows.map((row, idx) => ({
        rank: idx + 1,
        display_name: row.username ? `@${row.username}` : row.first_name,
        balance: row.available_balance,
      }));
    }

    const leaderboardItems: { user: User; balance: UserBalance }[] = [];
    for (const [userId, balance] of this.memoryData.balances.entries()) {
      const user = this.memoryData.users.get(userId);
      if (user && !user.is_suspended) {
        leaderboardItems.push({ user, balance });
      }
    }
    leaderboardItems.sort((a, b) => parseFloat(b.balance.available_balance) - parseFloat(a.balance.available_balance));
    return leaderboardItems.slice(0, limit).map((item, idx) => ({
      rank: idx + 1,
      display_name: item.user.username ? `@${item.user.username}` : item.user.first_name,
      balance: item.balance.available_balance,
    }));
  }

  public async getDashboardStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalDistributedSKX: string;
    totalTaps: number;
    totalReferrals: number;
    pendingWithdrawals: number;
    completedWithdrawals: number;
    adRewardsGranted: number;
    communityRewardsGranted: number;
    openTickets: number;
    securityEventsCount: number;
  }> {
    let totalUsers = this.memoryData.users.size;
    let activeUsers = 0;
    let totalDistributed = '0.00000000';
    let totalTaps = 0;
    let totalReferrals = this.memoryData.referrals.size;
    let pendingWithdrawals = 0;
    let completedWithdrawals = 0;
    let adRewardsGranted = 0;
    let communityRewardsGranted = 0;
    let openTickets = 0;
    let securityEventsCount = this.memoryData.securityEvents.size;

    const oneDayAgo = Date.now() - 24 * 3600 * 1000;

    for (const u of this.memoryData.users.values()) {
      if (new Date(u.last_active_at).getTime() >= oneDayAgo) activeUsers++;
    }
    for (const ts of this.memoryData.tapStates.values()) {
      totalTaps += ts.valid_taps_count;
    }
    for (const b of this.memoryData.balances.values()) {
      totalDistributed = (parseFloat(totalDistributed) + parseFloat(b.total_earned)).toFixed(8);
    }
    for (const w of this.memoryData.withdrawals.values()) {
      if (w.status === 'PENDING' || w.status === 'ADMIN_REVIEW') pendingWithdrawals++;
      if (w.status === 'COMPLETED') completedWithdrawals++;
    }
    for (const tx of this.memoryData.transactions.values()) {
      if (tx.type === 'AD_REWARD' && tx.status === 'COMPLETED') adRewardsGranted++;
      if (tx.type === 'COMMUNITY_REWARD' && tx.status === 'COMPLETED') communityRewardsGranted++;
    }
    for (const t of this.memoryData.supportTickets.values()) {
      if (t.status === 'OPEN' || t.status === 'IN_PROGRESS') openTickets++;
    }

    if (this.isPostgresActive && this.pgPool) {
      try {
        const uRes = await this.pgPool.query('SELECT COUNT(*) FROM users');
        totalUsers = parseInt(uRes.rows[0].count, 10);

        const actRes = await this.pgPool.query('SELECT COUNT(*) FROM users WHERE last_active_at >= NOW() - INTERVAL \'24 hours\'');
        activeUsers = parseInt(actRes.rows[0].count, 10);

        const balRes = await this.pgPool.query('SELECT COALESCE(SUM(total_earned), 0) as total FROM balances');
        totalDistributed = parseFloat(balRes.rows[0].total).toFixed(8);

        const tapRes = await this.pgPool.query('SELECT COALESCE(SUM(valid_taps_count), 0) as total FROM tap_states');
        totalTaps = parseInt(tapRes.rows[0].total, 10);

        const refRes = await this.pgPool.query('SELECT COUNT(*) FROM referrals');
        totalReferrals = parseInt(refRes.rows[0].count, 10);

        const pendWRes = await this.pgPool.query("SELECT COUNT(*) FROM withdrawals WHERE status IN ('PENDING', 'ADMIN_REVIEW')");
        pendingWithdrawals = parseInt(pendWRes.rows[0].count, 10);

        const compWRes = await this.pgPool.query("SELECT COUNT(*) FROM withdrawals WHERE status = 'COMPLETED'");
        completedWithdrawals = parseInt(compWRes.rows[0].count, 10);

        const tktRes = await this.pgPool.query("SELECT COUNT(*) FROM support_tickets WHERE status IN ('OPEN', 'IN_PROGRESS')");
        openTickets = parseInt(tktRes.rows[0].count, 10);

        const secRes = await this.pgPool.query('SELECT COUNT(*) FROM security_events');
        securityEventsCount = parseInt(secRes.rows[0].count, 10);
      } catch (err) {
        console.error('[Database] Failed to compute stats from PG:', err);
      }
    }

    return {
      totalUsers,
      activeUsers,
      totalDistributedSKX: totalDistributed,
      totalTaps,
      totalReferrals,
      pendingWithdrawals,
      completedWithdrawals,
      adRewardsGranted,
      communityRewardsGranted,
      openTickets,
      securityEventsCount,
    };
  }

  // Helper for tests to clean state
  public clearMemory(): void {
    this.memoryData.users.clear();
    this.memoryData.telegramToUserId.clear();
    this.memoryData.balances.clear();
    this.memoryData.energies.clear();
    this.memoryData.miningCycles.clear();
    this.memoryData.tapStates.clear();
    this.memoryData.dailyRewards.clear();
    this.memoryData.referrals.clear();
    this.memoryData.transactions.clear();
    this.memoryData.withdrawals.clear();
    this.memoryData.communityMemberships.clear();
    this.memoryData.supportTickets.clear();
    this.memoryData.supportMessages.clear();
    this.memoryData.notifications.clear();
    this.memoryData.adDailyTracking.clear();
    this.memoryData.adminUsers.clear();
    this.memoryData.auditLogs.clear();
    this.memoryData.securityEvents.clear();
    this.memoryData.systemSettings.clear();
    this.locks.clear();
  }
}

export const db = new DatabaseService();
