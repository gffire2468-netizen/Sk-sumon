import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import Decimal from 'decimal.js';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';
import { db } from '../src/server/db/database';
import { ConfigService } from '../src/server/config/configService';
import { TelegramAuthService } from '../src/server/services/telegramAuthService';
import { UserService } from '../src/server/services/userService';
import { BalanceService } from '../src/server/services/balanceService';
import { MiningService } from '../src/server/services/miningService';
import { DailyRewardService } from '../src/server/services/dailyRewardService';
import { ReferralService } from '../src/server/services/referralService';
import { WithdrawalService } from '../src/server/services/withdrawalService';
import { CommunityService } from '../src/server/services/communityService';
import { SupportService } from '../src/server/services/supportService';
import { NotificationService } from '../src/server/services/notificationService';
import { AdService } from '../src/server/services/adService';
import { AdminService } from '../src/server/services/adminService';
import { SecurityService } from '../src/server/services/securityService';

describe('SKX MINING Production Verification Test Suite', () => {
  beforeAll(async () => {
    process.env.ADMIN_DEFAULT_USERNAME = 'admin';
    process.env.ADMIN_DEFAULT_PASSWORD = 'admin12345';
    ConfigService.setDynamicOverride('DEMO_MODE', 'true');
    ConfigService.setDynamicOverride('REQUIRED_REFERRALS', '4');
    ConfigService.setDynamicOverride('MIN_WITHDRAWAL', '5');
    ConfigService.setDynamicOverride('MAX_WITHDRAWAL', '1000');
    ConfigService.setDynamicOverride('WITHDRAWAL_FEE_TYPE', 'FIXED');
    ConfigService.setDynamicOverride('WITHDRAWAL_FEE_VALUE', '0.5');
    ConfigService.setDynamicOverride('TAP_REWARD', '0.0001');
    ConfigService.setDynamicOverride('ENERGY_PER_TAP', '1');
    ConfigService.setDynamicOverride('MAX_ENERGY', '1000');
    ConfigService.setDynamicOverride('MINING_CYCLE_DURATION', '3600');
    ConfigService.setDynamicOverride('MINING_CYCLE_REWARD', '0.05');
    ConfigService.setDynamicOverride('REFERRAL_REWARD', '0.2');
    ConfigService.setDynamicOverride('ADS_ENABLED', 'true');
    ConfigService.setDynamicOverride('AD_REWARD', '0.001');
    ConfigService.setDynamicOverride('DAILY_AD_LIMIT', '20');
    ConfigService.setDynamicOverride('DAILY_AD_REWARD', '0.020');
    ConfigService.setDynamicOverride('TAP_AD_TRIGGER_ENABLED', 'true');
    ConfigService.setDynamicOverride('TAP_AD_THRESHOLD', '100');
    ConfigService.setDynamicOverride('COMMUNITY_REWARD_ENABLED', 'true');
    ConfigService.setDynamicOverride('COMMUNITY_REWARD', '0.1');
    await AdminService.ensureAdminUser();
  });

  beforeEach(async () => {
    db.clearMemory();
    await AdminService.ensureAdminUser();
  });

  // 1. Telegram authentication
  it('1. Validates Telegram authentication correctly', () => {
    const demoPayload = TelegramAuthService.validateInitData('demo_user_123456');
    expect(demoPayload.user.id).toBe(123456);
    expect(demoPayload.user.first_name).toContain('DemoMiner');

    // Missing data check
    expect(() => TelegramAuthService.validateInitData('')).toThrow();
  });

  // 2. New user creation
  it('2. Creates new user record properly', async () => {
    const { user, isNew } = await UserService.getOrCreateUser({
      id: 777001,
      first_name: 'Alex',
      username: 'alex_miner',
    });

    expect(isNew).toBe(true);
    expect(user.telegram_id).toBe('777001');
    expect(user.first_name).toBe('Alex');
  });

  // 3. New user starts at 0 SKX
  it('3. Real new Telegram user starts with exactly 0 SKX balance and 0 referrals', async () => {
    const { user, balance } = await UserService.getOrCreateUser({
      id: 777002,
      first_name: 'PristineUser',
    });

    expect(balance.available_balance).toBe('0.00000000');
    expect(balance.reserved_balance).toBe('0.00000000');
    expect(balance.total_earned).toBe('0.00000000');

    const validRefs = await db.getValidReferralsCount(user.id);
    expect(validRefs).toBe(0);
  });

  // 4. Tap reward
  it('4. Tap reward is calculated server-authoritatively (0.0001 per tap)', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 777003, first_name: 'Tapper' });
    const result = await MiningService.processTaps(user.id, 5);

    expect(result.success).toBe(true);
    expect(result.tapsCredited).toBe(5);
    expect(result.rewardGranted).toBe('0.00050000');
    expect(result.balance.available_balance).toBe('0.00050000');
  });

  // 5. Energy deduction
  it('5. Energy is deducted according to ENERGY_PER_TAP (1 per tap)', async () => {
    const { user, energy } = await UserService.getOrCreateUser({ id: 777004, first_name: 'EnergyUser' });
    expect(energy.current_energy).toBe(1000);

    const result = await MiningService.processTaps(user.id, 20);
    expect(result.newEnergy).toBe(980);
  });

  // 6. Energy regeneration
  it('6. Energy regenerates over time based on elapsed seconds', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 777005, first_name: 'RegenUser' });
    await db.saveEnergy({
      user_id: user.id,
      current_energy: 500,
      max_energy: 1000,
      last_regen_at: Date.now() - 50 * 1000, // 50 seconds ago
    });

    const currentEnergy = await db.getEnergy(user.id);
    const regenerated = MiningService.calculateRegeneratedEnergy(currentEnergy!);
    expect(regenerated.current_energy).toBe(550);
  });

  // 7. Maximum energy
  it('7. Energy cannot exceed MAX_ENERGY (1000)', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 777006, first_name: 'MaxEnergyUser' });
    await db.saveEnergy({
      user_id: user.id,
      current_energy: 990,
      max_energy: 1000,
      last_regen_at: Date.now() - 60 * 1000, // 60 seconds
    });

    const currentEnergy = await db.getEnergy(user.id);
    const regenerated = MiningService.calculateRegeneratedEnergy(currentEnergy!);
    expect(regenerated.current_energy).toBe(1000);
  });

  // 8. Mining cycle
  it('8. Hourly mining cycle cannot be claimed before completion, and awards 0.05 SKX upon completion', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 777007, first_name: 'Cycler' });

    // Try claiming immediately -> should throw
    await expect(MiningService.claimCycle(user.id)).rejects.toThrow(/still active/);

    // Fast-forward cycle started 3601 seconds ago
    await db.saveMiningCycle({
      user_id: user.id,
      cycle_started_at: Date.now() - 3601 * 1000,
      cycle_duration_seconds: 3600,
      reward_claimed: false,
    });

    const claimResult = await MiningService.claimCycle(user.id);
    expect(claimResult.rewardAmount).toBe('0.05');
    expect(claimResult.balance.available_balance).toBe('0.05000000');
  });

  // 9. Daily reward
  it('9. Daily reward can only be claimed once per 24-hour day key', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 777008, first_name: 'DailyUser' });

    const first = await DailyRewardService.claimDailyReward(user.id);
    expect(first.rewardAmount).toBe('0.01');

    // Duplicate claim on same day must fail
    await expect(DailyRewardService.claimDailyReward(user.id)).rejects.toThrow(/already claimed/);
  });

  // 10. Referral creation
  it('10. Referral relationship is created from start deep link', async () => {
    const { user: referrer } = await UserService.getOrCreateUser({ id: 800001, first_name: 'Boss' });
    const { user: referred } = await UserService.getOrCreateUser(
      { id: 800002, first_name: 'Worker' },
      `ref_${referrer.telegram_id}`
    );

    expect(referred.referrer_id).toBe(referrer.id);
    const ref = await db.getReferralByReferredUserId(referred.id);
    expect(ref).not.toBeNull();
    expect(ref?.referrer_id).toBe(referrer.id);
  });

  // 11. Referral reward
  it('11. Referral reward (+0.2 SKX) is credited when referral becomes valid', async () => {
    const { user: referrer } = await UserService.getOrCreateUser({ id: 800003, first_name: 'Leader' });
    const { user: referred } = await UserService.getOrCreateUser(
      { id: 800004, first_name: 'Cadet' },
      `ref_${referrer.telegram_id}`
    );

    const validated = await ReferralService.validateReferral(referred.id);
    expect(validated).toBe(true);

    const refBalance = await db.getBalance(referrer.id);
    expect(refBalance?.available_balance).toBe('0.20000000');
  });

  // 12. Self-referral prevention
  it('12. Prevents self-referral attempts', async () => {
    const { user } = await UserService.getOrCreateUser(
      { id: 800005, first_name: 'Cheater' },
      `ref_800005` // trying to refer self
    );

    expect(user.referrer_id).toBeUndefined();
    const ref = await db.getReferralByReferredUserId(user.id);
    expect(ref).toBeNull();
  });

  // 13. Minimum withdrawal
  it('13. Blocks withdrawal when balance is below minimum (5 SKX)', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 800006, first_name: 'PoorMiner' });
    // Balance is 0 SKX
    const eligibility = await WithdrawalService.checkEligibility(user.id);
    expect(eligibility.canWithdraw).toBe(false);
    expect(eligibility.balanceEligible).toBe(false);

    await expect(
      WithdrawalService.submitWithdrawal({
        userId: user.id,
        method: 'bKash',
        accountNumber: '01711223344',
        amountStr: '4',
      })
    ).rejects.toThrow(/Minimum withdrawal/);
  });

  // 14. Required referral withdrawal rule
  it('14. Mandatory rule: Withdrawal is locked if valid referrals < 4 even with high balance', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 800007, first_name: 'RichNoRefs' });
    // Give 100 SKX
    await BalanceService.credit(user.id, '100', 'ADMIN_ADJUSTMENT');

    const eligibility = await WithdrawalService.checkEligibility(user.id);
    expect(eligibility.balanceEligible).toBe(true);
    expect(eligibility.referralsEligible).toBe(false);
    expect(eligibility.canWithdraw).toBe(false);

    await expect(
      WithdrawalService.submitWithdrawal({
        userId: user.id,
        method: 'bKash',
        accountNumber: '01711223344',
        amountStr: '10',
      })
    ).rejects.toThrow(/valid referrals/);
  });

  // 15. Withdrawal double-submit prevention & balance reservation
  it('15. Reserves balance atomically and prevents double withdrawal', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 800008, first_name: 'WithdrawGuy' });
    await BalanceService.credit(user.id, '20', 'ADMIN_ADJUSTMENT');

    // Create 4 valid referrals to unlock
    for (let i = 1; i <= 4; i++) {
      const { user: refUser } = await UserService.getOrCreateUser(
        { id: 900000 + i, first_name: `Ref${i}` },
        `ref_${user.telegram_id}`
      );
      await ReferralService.validateReferral(refUser.id);
    }

    const eligibility = await WithdrawalService.checkEligibility(user.id);
    expect(eligibility.canWithdraw).toBe(true);

    // Submit withdrawal of 15 SKX
    const withdrawal = await WithdrawalService.submitWithdrawal({
      userId: user.id,
      method: 'Nagad',
      accountNumber: '01811223344',
      amountStr: '15',
    });

    expect(withdrawal.status).toBe('PENDING');

    const balanceAfter = await db.getBalance(user.id);
    // Initial 20 + (4 valid referrals * 0.2 = 0.8) - 15 withdrawn = 5.8 remaining available, 15 reserved
    expect(balanceAfter?.available_balance).toBe('5.80000000');
    expect(balanceAfter?.reserved_balance).toBe('15.00000000');

    // Attempt second withdrawal of 10 SKX -> must fail because available is only 5
    await expect(
      WithdrawalService.submitWithdrawal({
        userId: user.id,
        method: 'Nagad',
        accountNumber: '01811223344',
        amountStr: '10',
      })
    ).rejects.toThrow(/Insufficient available balance/);
  });

  // 16. Withdrawal completion requires real TrxID
  it('16. Withdrawal completion fails without a real provider TrxID', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 800009, first_name: 'TrxGuy' });
    await BalanceService.credit(user.id, '20', 'ADMIN_ADJUSTMENT');
    for (let i = 1; i <= 4; i++) {
      const { user: refUser } = await UserService.getOrCreateUser(
        { id: 910000 + i, first_name: `Ref${i}` },
        `ref_${user.telegram_id}`
      );
      await ReferralService.validateReferral(refUser.id);
    }

    const withdrawal = await WithdrawalService.submitWithdrawal({
      userId: user.id,
      method: 'Rocket',
      accountNumber: '01911223344',
      amountStr: '10',
    });

    // Attempt completion with empty TrxID
    await expect(
      WithdrawalService.updateWithdrawalStatus({
        withdrawalId: withdrawal.id,
        status: 'COMPLETED',
        adminId: 'admin1',
        adminUsername: 'admin',
        providerTrxId: '', // Invalid
      })
    ).rejects.toThrow(/real provider transaction ID/);

    // Complete with real TrxID
    const completed = await WithdrawalService.updateWithdrawalStatus({
      withdrawalId: withdrawal.id,
      status: 'COMPLETED',
      adminId: 'admin1',
      adminUsername: 'admin',
      providerTrxId: 'BKX987654321',
    });

    expect(completed.status).toBe('COMPLETED');
    expect(completed.provider_trx_id).toBe('BKX987654321');

    const balFinal = await db.getBalance(user.id);
    expect(balFinal?.reserved_balance).toBe('0.00000000');
  });

  // 17. Community reward verification
  it('17. Community reward verification works', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 800010, first_name: 'CommunityMember' });
    const result = await CommunityService.verifyAndClaim(user.id);

    expect(result.success).toBe(true);
    expect(result.rewardAmount).toBe('0.1');
    expect(result.balance.available_balance).toBe('0.10000000');
  });

  // 18. Community reward one-time claim
  it('18. Community reward cannot be claimed more than once per account', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 800011, first_name: 'OneTimer' });
    await CommunityService.verifyAndClaim(user.id);

    await expect(CommunityService.verifyAndClaim(user.id)).rejects.toThrow(/already been claimed/);
  });

  // 19. Support ticket creation
  it('19. Support ticket is created with initial message', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 800012, first_name: 'HelpSeeker' });
    const { ticket, initialMessage } = await SupportService.createTicket({
      userId: user.id,
      category: 'WITHDRAWAL',
      subject: 'Delay in bKash payment',
      message: 'When will my withdrawal arrive?',
    });

    expect(ticket.status).toBe('OPEN');
    expect(ticket.category).toBe('WITHDRAWAL');
    expect(initialMessage.message).toBe('When will my withdrawal arrive?');
  });

  // 20. Support reply
  it('20. Support replies update thread and notifications', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 800013, first_name: 'Chatter' });
    const { ticket } = await SupportService.createTicket({
      userId: user.id,
      category: 'MINING',
      subject: 'Energy question',
      message: 'Does energy regenerate offline?',
    });

    const reply = await SupportService.replyToTicket({
      ticketId: ticket.id,
      senderType: 'ADMIN',
      senderId: 'support_admin',
      message: 'Yes! It regenerates 1 unit every second even while offline.',
    });

    expect(reply.sender_type).toBe('ADMIN');
    const { ticket: updatedTicket, messages } = await SupportService.getTicketDetails(ticket.id, user.id);
    expect(updatedTicket.status).toBe('IN_PROGRESS');
    expect(messages.length).toBe(2);
  });

  // 21. Notification creation
  it('21. Creates in-app notifications and tracks read status', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 800014, first_name: 'NotifUser' });
    const notif = await NotificationService.createNotification({
      userId: user.id,
      title: 'Special Event',
      message: 'Mining speed boosted!',
      type: 'SYSTEM_ANNOUNCEMENT',
    });

    expect(notif.is_read).toBe(false);

    await NotificationService.markAsRead(notif.id, user.id);
    const { notifications, unreadCount } = await NotificationService.getUserNotifications(user.id);
    expect(unreadCount).toBe(0);
    expect(notifications[0].is_read).toBe(true);
  });

  // 22. Ad daily limit
  it('22. Enforces daily ad limit (max 20 ads per day)', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 800015, first_name: 'AdWatcher' });

    // Manually set ads_watched to 20
    const dayKey = AdService.getTodayKey();
    await db.saveAdDailyTracking({
      id: crypto.randomUUID(),
      user_id: user.id,
      day_key: dayKey,
      ads_watched: 20,
      ad_earnings: '0.02000000',
      updated_at: new Date().toISOString(),
    });

    await expect(AdService.requestAdOpportunity(user.id)).rejects.toThrow(/Daily ad limit reached/);
  });

  // 23. Ad daily reward cap
  it('23. Enforces daily ad reward cap (0.020 SKX)', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 800016, first_name: 'CapWatcher' });
    const dayKey = AdService.getTodayKey();
    await db.saveAdDailyTracking({
      id: crypto.randomUUID(),
      user_id: user.id,
      day_key: dayKey,
      ads_watched: 10,
      ad_earnings: '0.02000000', // Cap reached
      updated_at: new Date().toISOString(),
    });

    await expect(AdService.requestAdOpportunity(user.id)).rejects.toThrow(/Daily ad reward cap reached/);
  });

  // 24. Ad duplicate verification prevention
  it('24. Replay attacks on ad verification are blocked', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 800017, first_name: 'ReplayAttacker' });
    const opp = await AdService.requestAdOpportunity(user.id);

    // First verification succeeds
    const firstVerify = await AdService.verifyAndGrantReward(user.id, opp.opportunityId, opp.token);
    expect(firstVerify.rewardAmount).toBe('0.00100000');

    // Second verification with same token must fail
    await expect(
      AdService.verifyAndGrantReward(user.id, opp.opportunityId, opp.token)
    ).rejects.toThrow(/already been consumed|Invalid or expired/);
  });

  // 25. 100-tap trigger
  it('25. 100 valid taps triggers ad opportunity flag', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 800018, first_name: 'CenturyTapper' });
    // Process two batches of 50 taps = 100 taps
    await MiningService.processTaps(user.id, 50);
    const result2 = await MiningService.processTaps(user.id, 50);

    expect(result2.adOpportunityAvailable).toBe(true);

    const tapState = await db.getTapState(user.id);
    expect(tapState?.valid_taps_count).toBe(100);
    expect(tapState?.pending_ad_opportunity).toBe(true);
  });

  // 26. Invalid tap exclusion
  it('26. Invalid taps (< 1 or > 100 batch or non-integers) are rejected', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 800019, first_name: 'BadTapper' });

    await expect(MiningService.processTaps(user.id, 0)).rejects.toThrow(/Invalid taps count/);
    await expect(MiningService.processTaps(user.id, -5)).rejects.toThrow(/Invalid taps count/);
    await expect(MiningService.processTaps(user.id, 150)).rejects.toThrow(/Batch tap limit exceeded/);
  });

  // 27. Balance atomicity
  it('27. Balance engine preserves exact decimal precision without floating point drift', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 800020, first_name: 'PrecisionMiner' });

    // 10 credits of 0.0001 SKX = exactly 0.00100000 SKX
    for (let i = 0; i < 10; i++) {
      await BalanceService.credit(user.id, '0.0001', 'TAP_REWARD');
    }

    const bal = await db.getBalance(user.id);
    expect(bal?.available_balance).toBe('0.00100000');
  });

  // 28. Admin authentication
  it('28. Admin authentication succeeds with valid credentials and fails on invalid', async () => {
    const login = await AdminService.login('admin', 'admin12345');
    expect(login.token).toBeDefined();
    expect(login.admin.username).toBe('admin');

    await expect(AdminService.login('admin', 'wrongpass')).rejects.toThrow(/Invalid credentials/);
  });

  // 29. Admin audit log
  it('29. Balance adjustment generates audit log and transaction ledger record', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 800021, first_name: 'AuditUser' });

    await AdminService.adjustBalance({
      userId: user.id,
      amountStr: '15.5',
      direction: 'CREDIT',
      reason: 'Compensation for verified network outage',
      adminId: 'admin_1',
      adminUsername: 'admin',
    });

    const txs = await db.getTransactionsByUserId(user.id);
    const adjTx = txs.find((t) => t.type === 'ADMIN_ADJUSTMENT');
    expect(adjTx).toBeDefined();
    expect(adjTx?.amount).toBe('15.50000000');

    const logs = await db.getAuditLogs();
    const adjLog = logs.find((l) => l.action === 'BALANCE_ADJUSTMENT_CREDIT');
    expect(adjLog).toBeDefined();
    expect(adjLog?.target_id).toBe(user.id);
  });

  // 30. Suspicious activity detection
  it('30. Suspicious events are logged to security table', async () => {
    const { user } = await UserService.getOrCreateUser({ id: 800022, first_name: 'SuspiciousUser' });

    await SecurityService.recordEvent({
      userId: user.id,
      eventType: 'SUSPICIOUS_TAP_SPEED',
      severity: 'HIGH',
      details: { tapsCount: 80, timeSinceLastTapMs: 10 },
    });

    const events = await db.getSecurityEvents();
    const ev = events.find((e) => e.user_id === user.id && e.event_type === 'SUSPICIOUS_TAP_SPEED');
    expect(ev).toBeDefined();
    expect(ev?.severity).toBe('HIGH');
  });
});
