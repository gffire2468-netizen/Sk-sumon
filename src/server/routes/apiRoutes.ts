import { Router, Request, Response, NextFunction } from 'express';
import { telegramAuthMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import { adminAuthMiddleware, AdminRequest } from '../middleware/adminMiddleware';
import { createRateLimiter } from '../middleware/rateLimitMiddleware';
import { TelegramAuthService } from '../services/telegramAuthService';
import { UserService } from '../services/userService';
import { MiningService } from '../services/miningService';
import { DailyRewardService } from '../services/dailyRewardService';
import { ReferralService } from '../services/referralService';
import { WithdrawalService } from '../services/withdrawalService';
import { CommunityService } from '../services/communityService';
import { SupportService } from '../services/supportService';
import { NotificationService } from '../services/notificationService';
import { AdService } from '../services/adService';
import { TelegramBotService } from '../services/telegramBotService';
import { AdminService } from '../services/adminService';
import { ConfigService } from '../config/configService';
import { db } from '../db/database';

export const apiRouter = Router();

// Rate limiters
const tapLimiter = createRateLimiter(60, 60000, 'taps'); // 60 tap batches per min
const claimLimiter = createRateLimiter(30, 60000, 'claims');
const authLimiter = createRateLimiter(20, 60000, 'auth');
const adminLoginLimiter = createRateLimiter(10, 60000, 'admin_login');

// ==================== AUTH ====================
apiRouter.post('/auth/verify', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const initData = (req.headers['x-telegram-init-data'] as string) || req.body?.initData || '';
    if (!initData) {
      res.status(400).json({ success: false, error: 'Missing Telegram initData' });
      return;
    }

    const validated = TelegramAuthService.validateInitData(initData);
    const profile = await UserService.getOrCreateUser(validated.user, validated.start_param);

    res.json({
      success: true,
      data: profile,
    });
  } catch (err: any) {
    next(err);
  }
});

// ==================== PUBLIC SETTINGS ====================
apiRouter.get('/settings/public', (_req: Request, res: Response) => {
  const config = ConfigService.getAll();
  res.json({
    success: true,
    data: {
      tapReward: config.TAP_REWARD,
      energyPerTap: config.ENERGY_PER_TAP,
      maxEnergy: config.MAX_ENERGY,
      energyRegenRate: config.ENERGY_REGEN_RATE,
      miningCycleDuration: config.MINING_CYCLE_DURATION,
      miningCycleReward: config.MINING_CYCLE_REWARD,
      requiredReferrals: config.REQUIRED_REFERRALS,
      referralReward: config.REFERRAL_REWARD,
      minWithdrawal: config.MIN_WITHDRAWAL,
      maxWithdrawal: config.MAX_WITHDRAWAL,
      withdrawalFeeType: config.WITHDRAWAL_FEE_TYPE,
      withdrawalFeeValue: config.WITHDRAWAL_FEE_VALUE,
      communityRewardEnabled: config.COMMUNITY_REWARD_ENABLED,
      communityInviteLink: config.COMMUNITY_INVITE_LINK,
      communityReward: config.COMMUNITY_REWARD,
      supportEnabled: config.SUPPORT_ENABLED,
      adsEnabled: config.ADS_ENABLED,
      adReward: config.AD_REWARD,
      dailyAdLimit: config.DAILY_AD_LIMIT,
      dailyAdReward: config.DAILY_AD_REWARD,
      tapAdTriggerEnabled: config.TAP_AD_TRIGGER_ENABLED,
      tapAdThreshold: config.TAP_AD_THRESHOLD,
      dailyRewardMode: config.DAILY_REWARD_MODE,
      dailyRewardBase: config.DAILY_REWARD_BASE,
      skxUsdRate: config.SKX_USD_RATE,
      skxBdtRate: config.SKX_BDT_RATE,
      demoMode: config.DEMO_MODE,
      paymentMethods: {
        bKash: config.BKASH_ENABLED,
        nagad: config.NAGAD_ENABLED,
        rocket: config.ROCKET_ENABLED,
      },
    },
  });
});

// ==================== BOT & WEBHOOK ====================
apiRouter.get('/bot/webhook/health', (_req: Request, res: Response) => {
  const health = TelegramBotService.getWebhookHealth();
  res.json({ success: true, data: health });
});

apiRouter.post('/bot/webhook/setup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { webhookUrl, secretToken } = req.body;
    if (!webhookUrl) {
      res.status(400).json({ success: false, error: 'webhookUrl is required' });
      return;
    }
    const result = await TelegramBotService.setupWebhook(webhookUrl, secretToken);
    res.json({ success: true, data: result });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.post('/bot/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secretHeader = (req.headers['x-telegram-bot-api-secret-token'] as string) || '';
    await TelegramBotService.handleWebhookUpdate(req.body, secretHeader);
    res.json({ ok: true });
  } catch (err: any) {
    next(err);
  }
});

// ==================== AUTHENTICATED USER ROUTES ====================
apiRouter.use('/user', telegramAuthMiddleware);
apiRouter.use('/taps', telegramAuthMiddleware);
apiRouter.use('/mining', telegramAuthMiddleware);
apiRouter.use('/rewards', telegramAuthMiddleware);
apiRouter.use('/referrals', telegramAuthMiddleware);
apiRouter.use('/withdrawals', telegramAuthMiddleware);
apiRouter.use('/community', telegramAuthMiddleware);
apiRouter.use('/support', telegramAuthMiddleware);
apiRouter.use('/notifications', telegramAuthMiddleware);
apiRouter.use('/ads', telegramAuthMiddleware);
apiRouter.use('/transactions', telegramAuthMiddleware);

// --- User Profile ---
apiRouter.get('/user/me', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await UserService.getProfile(req.dbUser!.id);
    res.json({ success: true, data: profile });
  } catch (err: any) {
    next(err);
  }
});

// --- Tap-to-Mine ---
apiRouter.post('/taps/submit', tapLimiter, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { tapsCount, timestamp } = req.body;
    const result = await MiningService.processTaps(req.dbUser!.id, Number(tapsCount) || 1, timestamp);

    // If referral exists and is still pending, validate upon activity
    ReferralService.validateReferral(req.dbUser!.id).catch(() => {});

    res.json({ success: true, data: result });
  } catch (err: any) {
    next(err);
  }
});

// --- Hourly Mining Cycle ---
apiRouter.get('/mining/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const status = await MiningService.getCycleStatus(req.dbUser!.id);
    res.json({ success: true, data: status });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.post('/mining/claim', claimLimiter, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await MiningService.claimCycle(req.dbUser!.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    next(err);
  }
});

// --- Daily Rewards ---
apiRouter.get('/rewards/daily/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const status = await DailyRewardService.getDailyRewardStatus(req.dbUser!.id);
    res.json({ success: true, data: status });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.post('/rewards/daily/claim', claimLimiter, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await DailyRewardService.claimDailyReward(req.dbUser!.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    next(err);
  }
});

// --- Referrals ---
apiRouter.get('/referrals/summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const summary = await ReferralService.getReferralSummary(req.dbUser!.id);
    res.json({ success: true, data: summary });
  } catch (err: any) {
    next(err);
  }
});

// --- Leaderboard ---
apiRouter.get('/leaderboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await db.getLeaderboard(50);
    res.json({ success: true, data: list });
  } catch (err: any) {
    next(err);
  }
});

// --- Transactions Ledger ---
apiRouter.get('/transactions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const list = await db.getTransactionsByUserId(req.dbUser!.id, 50);
    res.json({ success: true, data: list });
  } catch (err: any) {
    next(err);
  }
});

// --- Withdrawals ---
apiRouter.get('/withdrawals/eligibility', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const eligibility = await WithdrawalService.checkEligibility(req.dbUser!.id);
    res.json({ success: true, data: eligibility });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.get('/withdrawals', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const list = await db.getWithdrawalsByUserId(req.dbUser!.id);
    res.json({ success: true, data: list });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.post('/withdrawals', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { method, accountNumber, amount } = req.body;
    if (!method || !accountNumber || !amount) {
      res.status(400).json({ success: false, error: 'Method, account number, and amount are required' });
      return;
    }
    const withdrawal = await WithdrawalService.submitWithdrawal({
      userId: req.dbUser!.id,
      method,
      accountNumber,
      amountStr: amount.toString(),
    });
    res.json({ success: true, data: withdrawal });
  } catch (err: any) {
    next(err);
  }
});

// --- Community Reward ---
apiRouter.get('/community/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const status = await CommunityService.getStatus(req.dbUser!.id);
    res.json({ success: true, data: status });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.post('/community/verify', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await CommunityService.verifyAndClaim(req.dbUser!.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    next(err);
  }
});

// --- Support System ---
apiRouter.get('/support/tickets', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tickets = await SupportService.getUserTickets(req.dbUser!.id);
    res.json({ success: true, data: tickets });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.post('/support/tickets', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { category, subject, message } = req.body;
    const ticket = await SupportService.createTicket({
      userId: req.dbUser!.id,
      category: category || 'OTHER',
      subject,
      message,
    });
    res.json({ success: true, data: ticket });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.get('/support/tickets/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const details = await SupportService.getTicketDetails(req.params.id, req.dbUser!.id, false);
    res.json({ success: true, data: details });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.post('/support/tickets/:id/reply', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    const msg = await SupportService.replyToTicket({
      ticketId: req.params.id,
      senderType: 'USER',
      senderId: req.dbUser!.id,
      message,
    });
    res.json({ success: true, data: msg });
  } catch (err: any) {
    next(err);
  }
});

// --- Notifications ---
apiRouter.get('/notifications', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await NotificationService.getUserNotifications(req.dbUser!.id);
    res.json({ success: true, data });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.post('/notifications/:id/read', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await NotificationService.markAsRead(req.params.id, req.dbUser!.id);
    res.json({ success: true });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.post('/notifications/read-all', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await NotificationService.markAllAsRead(req.dbUser!.id);
    res.json({ success: true });
  } catch (err: any) {
    next(err);
  }
});

// --- Rewarded Ads ---
apiRouter.get('/ads/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const status = await AdService.getUserDailyAdStatus(req.dbUser!.id);
    res.json({ success: true, data: status });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.post('/ads/opportunity', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const opp = await AdService.requestAdOpportunity(req.dbUser!.id);
    res.json({ success: true, data: opp });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.post('/ads/verify', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { opportunityId, token } = req.body;
    if (!opportunityId || !token) {
      res.status(400).json({ success: false, error: 'opportunityId and token are required' });
      return;
    }
    const result = await AdService.verifyAndGrantReward(req.dbUser!.id, opportunityId, token);
    res.json({ success: true, data: result });
  } catch (err: any) {
    next(err);
  }
});

// ==================== ADMIN PANEL ROUTES ====================
apiRouter.post('/admin/login', adminLoginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    const result = await AdminService.login(username, password);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(401).json({ success: false, error: err.message || 'Invalid credentials' });
  }
});

apiRouter.use('/admin', adminAuthMiddleware);

apiRouter.get('/admin/me', (req: AdminRequest, res: Response) => {
  res.json({ success: true, data: req.adminUser });
});

apiRouter.get('/admin/dashboard', async (_req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await db.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.get('/admin/users', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const search = (req.query.search as string) || '';
    const result = await db.getAllUsers(limit, offset, search);

    const enriched = await Promise.all(
      result.users.map(async (u) => {
        const bal = await db.getBalance(u.id);
        const validRefs = await db.getValidReferralsCount(u.id);
        return {
          ...u,
          balance: bal?.available_balance || '0.00000000',
          reservedBalance: bal?.reserved_balance || '0.00000000',
          totalEarned: bal?.total_earned || '0.00000000',
          validReferrals: validRefs,
        };
      })
    );

    res.json({ success: true, data: { users: enriched, total: result.total } });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.get('/admin/users/:id', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await UserService.getProfile(req.params.id);
    const transactions = await db.getTransactionsByUserId(req.params.id, 50);
    const withdrawals = await db.getWithdrawalsByUserId(req.params.id);
    res.json({ success: true, data: { ...profile, transactions, withdrawals } });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.post('/admin/users/:id/adjust-balance', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, direction, reason } = req.body;
    const result = await AdminService.adjustBalance({
      userId: req.params.id,
      amountStr: amount,
      direction,
      reason,
      adminId: req.adminUser!.id,
      adminUsername: req.adminUser!.username,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.post('/admin/users/:id/suspension', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const { suspended, reason } = req.body;
    const result = await AdminService.toggleUserSuspension({
      userId: req.params.id,
      suspended: Boolean(suspended),
      reason,
      adminId: req.adminUser!.id,
      adminUsername: req.adminUser!.username,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.get('/admin/withdrawals', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;
    const list = await db.getAllWithdrawals(status);
    res.json({ success: true, data: list });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.post('/admin/withdrawals/:id/status', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const { status, providerTrxId, adminNotes } = req.body;
    const result = await WithdrawalService.updateWithdrawalStatus({
      withdrawalId: req.params.id,
      status,
      adminId: req.adminUser!.id,
      adminUsername: req.adminUser!.username,
      providerTrxId,
      adminNotes,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.get('/admin/support', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;
    const list = await db.getAllSupportTickets(status);
    res.json({ success: true, data: list });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.get('/admin/support/:id', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const details = await SupportService.getTicketDetails(req.params.id, undefined, true);
    res.json({ success: true, data: details });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.post('/admin/support/:id/reply', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    const msg = await SupportService.replyToTicket({
      ticketId: req.params.id,
      senderType: 'ADMIN',
      senderId: req.adminUser!.username,
      message,
    });
    res.json({ success: true, data: msg });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.post('/admin/support/:id/status', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const { status, assignedTo, internalNotes } = req.body;
    const updated = await SupportService.updateTicketStatus({
      ticketId: req.params.id,
      status,
      assignedTo,
      internalNotes,
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.get('/admin/ads/status', (_req: AdminRequest, res: Response) => {
  const providers = AdService.getProvidersStatus();
  res.json({ success: true, data: providers });
});

apiRouter.get('/admin/transactions', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const result = await db.getAllTransactions(limit, offset);
    res.json({ success: true, data: result });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.get('/admin/settings', async (_req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const dbSettings = await db.getAllSystemSettings();
    const config = ConfigService.getAll();
    res.json({ success: true, data: { currentConfig: config, customOverrides: dbSettings } });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.post('/admin/settings', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const { key, value, description } = req.body;
    if (!key || value === undefined) {
      res.status(400).json({ success: false, error: 'Key and value are required' });
      return;
    }
    const updated = await AdminService.updateSetting(
      key,
      value.toString(),
      req.adminUser!.id,
      req.adminUser!.username,
      description
    );
    res.json({ success: true, data: updated });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.get('/admin/audit-logs', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const list = await db.getAuditLogs(limit);
    res.json({ success: true, data: list });
  } catch (err: any) {
    next(err);
  }
});

apiRouter.get('/admin/security-events', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const list = await db.getSecurityEvents(limit);
    res.json({ success: true, data: list });
  } catch (err: any) {
    next(err);
  }
});
