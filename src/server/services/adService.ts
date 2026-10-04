import crypto from 'crypto';
import Decimal from 'decimal.js';
import { db } from '../db/database';
import { ConfigService } from '../config/configService';
import { BalanceService } from './balanceService';
import { NotificationService } from './notificationService';
import { SecurityService } from './securityService';
import { AdDailyTracking, UserBalance } from '../types';

export interface AdOpportunity {
  id: string;
  userId: string;
  provider: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  isConsumed: boolean;
}

export interface AdProviderAdapter {
  name: string;
  initialize(): Promise<void>;
  createAdOpportunity(userId: string): Promise<{ opportunityId: string; token: string; renderPayload?: Record<string, any> }>;
  verifyReward(userId: string, opportunityId: string, token?: string): Promise<boolean>;
  handlePostback(payload: any): Promise<{ success: boolean; userId?: string }>;
  getStatus(): { name: string; enabled: boolean; configured: boolean };
}

// In-memory active opportunity tokens to prevent replay attacks
const activeOpportunities = new Map<string, AdOpportunity>();

export class MonetagAdapter implements AdProviderAdapter {
  public name = 'Monetag';

  public async initialize(): Promise<void> {}

  public getStatus() {
    const enabled = ConfigService.get('MONETAG_ENABLED');
    const tag = ConfigService.get('MONETAG_AD_TAG');
    return { name: this.name, enabled, configured: !!tag };
  }

  public async createAdOpportunity(userId: string): Promise<{ opportunityId: string; token: string; renderPayload?: Record<string, any> }> {
    const status = this.getStatus();
    if (!status.enabled || !status.configured) {
      throw new Error('Ad provider is currently disabled or unconfigured');
    }
    const opportunityId = crypto.randomUUID();
    const token = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    activeOpportunities.set(opportunityId, {
      id: opportunityId,
      userId,
      provider: this.name,
      token,
      createdAt: now,
      expiresAt: now + 5 * 60 * 1000, // 5 min expiry
      isConsumed: false,
    });
    return { opportunityId, token, renderPayload: { tag: ConfigService.get('MONETAG_AD_TAG') } };
  }

  public async verifyReward(userId: string, opportunityId: string, token?: string): Promise<boolean> {
    const opp = activeOpportunities.get(opportunityId);
    if (!opp || opp.userId !== userId || opp.token !== token || opp.isConsumed) {
      return false;
    }
    if (Date.now() > opp.expiresAt) return false;
    opp.isConsumed = true;
    return true;
  }

  public async handlePostback(_payload: any) {
    return { success: false };
  }
}

export class AdsterraAdapter implements AdProviderAdapter {
  public name = 'Adsterra';

  public async initialize(): Promise<void> {}

  public getStatus() {
    const enabled = ConfigService.get('ADSTERRA_ENABLED');
    const zoneId = ConfigService.get('ADSTERRA_ZONE_ID');
    return { name: this.name, enabled, configured: !!zoneId };
  }

  public async createAdOpportunity(userId: string): Promise<{ opportunityId: string; token: string; renderPayload?: Record<string, any> }> {
    const status = this.getStatus();
    if (!status.enabled || !status.configured) {
      throw new Error('Ad provider is currently disabled or unconfigured');
    }
    const opportunityId = crypto.randomUUID();
    const token = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    activeOpportunities.set(opportunityId, {
      id: opportunityId,
      userId,
      provider: this.name,
      token,
      createdAt: now,
      expiresAt: now + 5 * 60 * 1000,
      isConsumed: false,
    });
    return { opportunityId, token, renderPayload: { zoneId: ConfigService.get('ADSTERRA_ZONE_ID') } };
  }

  public async verifyReward(userId: string, opportunityId: string, token?: string): Promise<boolean> {
    const opp = activeOpportunities.get(opportunityId);
    if (!opp || opp.userId !== userId || opp.token !== token || opp.isConsumed) {
      return false;
    }
    if (Date.now() > opp.expiresAt) return false;
    opp.isConsumed = true;
    return true;
  }

  public async handlePostback(_payload: any) {
    return { success: false };
  }
}

export class GenericAdAdapter implements AdProviderAdapter {
  public name = 'Generic';

  public async initialize(): Promise<void> {}

  public getStatus() {
    const enabled = ConfigService.get('GENERIC_AD_ENABLED');
    const tag = ConfigService.get('GENERIC_AD_TAG');
    return { name: this.name, enabled, configured: !!tag };
  }

  public async createAdOpportunity(userId: string): Promise<{ opportunityId: string; token: string; renderPayload?: Record<string, any> }> {
    const status = this.getStatus();
    if (!status.enabled || !status.configured) {
      throw new Error('Ad provider is currently disabled or unconfigured');
    }
    const opportunityId = crypto.randomUUID();
    const token = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    activeOpportunities.set(opportunityId, {
      id: opportunityId,
      userId,
      provider: this.name,
      token,
      createdAt: now,
      expiresAt: now + 5 * 60 * 1000,
      isConsumed: false,
    });
    return { opportunityId, token, renderPayload: { tag: ConfigService.get('GENERIC_AD_TAG') } };
  }

  public async verifyReward(userId: string, opportunityId: string, token?: string): Promise<boolean> {
    const opp = activeOpportunities.get(opportunityId);
    if (!opp || opp.userId !== userId || opp.token !== token || opp.isConsumed) {
      return false;
    }
    if (Date.now() > opp.expiresAt) return false;
    opp.isConsumed = true;
    return true;
  }

  public async handlePostback(_payload: any) {
    return { success: false };
  }
}

export class AdService {
  private static adapters: Map<string, AdProviderAdapter> = new Map([
    ['Monetag', new MonetagAdapter()],
    ['Adsterra', new AdsterraAdapter()],
    ['Generic', new GenericAdAdapter()],
  ]);

  public static getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  public static getProvidersStatus() {
    const results: ReturnType<AdProviderAdapter['getStatus']>[] = [];
    for (const adapter of this.adapters.values()) {
      results.push(adapter.getStatus());
    }
    return results;
  }

  public static getActiveProvider(): AdProviderAdapter | null {
    if (!ConfigService.get('ADS_ENABLED')) return null;
    for (const adapter of this.adapters.values()) {
      const status = adapter.getStatus();
      if (status.enabled && status.configured) {
        return adapter;
      }
    }
    // In DEMO_MODE, if ADS_ENABLED is true, allow Generic adapter for testing
    if (ConfigService.get('DEMO_MODE') && ConfigService.get('ADS_ENABLED')) {
      return this.adapters.get('Generic') || null;
    }
    return null;
  }

  /**
   * Returns daily ad watching status for the user.
   */
  public static async getUserDailyAdStatus(userId: string): Promise<{
    adsEnabled: boolean;
    adsWatchedToday: number;
    dailyLimit: number;
    todayEarnings: string;
    maxDailyEarnings: string;
    rewardPerAd: string;
    remainingAds: number;
    hasTapAdOpportunity: boolean;
  }> {
    const dayKey = this.getTodayKey();
    const tracking = await db.getAdDailyTracking(userId, dayKey);
    const tapState = await db.getTapState(userId);

    const adsEnabled = ConfigService.get('ADS_ENABLED');
    const dailyLimit = ConfigService.get('DAILY_AD_LIMIT');
    const maxDailyReward = ConfigService.get('DAILY_AD_REWARD');
    const adReward = ConfigService.get('AD_REWARD');

    const adsWatched = tracking ? tracking.ads_watched : 0;
    const todayEarnings = tracking ? tracking.ad_earnings : '0.00000000';
    const remaining = Math.max(0, dailyLimit - adsWatched);

    return {
      adsEnabled,
      adsWatchedToday: adsWatched,
      dailyLimit,
      todayEarnings,
      maxDailyEarnings: maxDailyReward,
      rewardPerAd: adReward,
      remainingAds: remaining,
      hasTapAdOpportunity: tapState?.pending_ad_opportunity || false,
    };
  }

  /**
   * Creates a verified ad viewing opportunity on the server.
   */
  public static async requestAdOpportunity(userId: string): Promise<{
    opportunityId: string;
    token: string;
    rewardAmount: string;
    renderPayload?: any;
  }> {
    const status = await this.getUserDailyAdStatus(userId);
    if (!status.adsEnabled) {
      throw new Error('Ad reward is currently unavailable.');
    }

    if (status.remainingAds <= 0) {
      throw new Error(`Daily ad limit reached (${status.dailyLimit}/${status.dailyLimit}). Come back tomorrow!`);
    }

    const currentEarnings = new Decimal(status.todayEarnings);
    const maxDailyEarnings = new Decimal(status.maxDailyEarnings);
    if (currentEarnings.greaterThanOrEqualTo(maxDailyEarnings)) {
      throw new Error('Daily ad reward cap reached for today.');
    }

    // In DEMO_MODE, create an active test opportunity even if real ad tags are empty
    const opportunityId = crypto.randomUUID();
    const token = crypto.randomBytes(24).toString('hex');
    const now = Date.now();

    activeOpportunities.set(opportunityId, {
      id: opportunityId,
      userId,
      provider: 'AdEngine',
      token,
      createdAt: now,
      expiresAt: now + 5 * 60 * 1000,
      isConsumed: false,
    });

    return {
      opportunityId,
      token,
      rewardAmount: status.rewardPerAd,
      renderPayload: { slot: 'interstitial_banner' },
    };
  }

  /**
   * Server-authoritative verification of ad completion.
   * Only grants reward if token & opportunity are valid, not expired, not reused, and daily limit is respected.
   */
  public static async verifyAndGrantReward(
    userId: string,
    opportunityId: string,
    token: string
  ): Promise<{
    rewardAmount: string;
    balance: UserBalance;
    adsWatchedToday: number;
    todayEarnings: string;
  }> {
    const opp = activeOpportunities.get(opportunityId);
    if (!opp) {
      throw new Error('Invalid or expired ad opportunity');
    }

    if (opp.userId !== userId || opp.token !== token) {
      await SecurityService.recordEvent({
        userId,
        eventType: 'SUSPICIOUS_AD_VERIFICATION_MISMATCH',
        severity: 'HIGH',
        details: { opportunityId, token },
      });
      throw new Error('Ad verification signature mismatch');
    }

    if (opp.isConsumed) {
      await SecurityService.recordEvent({
        userId,
        eventType: 'AD_VERIFICATION_REPLAY_ATTEMPT',
        severity: 'HIGH',
        details: { opportunityId },
      });
      throw new Error('This ad opportunity has already been consumed.');
    }

    if (Date.now() > opp.expiresAt) {
      throw new Error('Ad opportunity expired');
    }

    return await db.withUserLock(userId, async () => {
      // Re-check consumption inside lock
      if (opp.isConsumed) {
        throw new Error('This ad opportunity has already been consumed.');
      }
      opp.isConsumed = true;
      activeOpportunities.delete(opportunityId);

      const dayKey = this.getTodayKey();
      let tracking = await db.getAdDailyTracking(userId, dayKey);
      const dailyLimit = ConfigService.get('DAILY_AD_LIMIT');
      const maxDailyCap = new Decimal(ConfigService.get('DAILY_AD_REWARD'));
      const adRewardAmount = ConfigService.get('AD_REWARD');

      if (!tracking) {
        tracking = {
          id: crypto.randomUUID(),
          user_id: userId,
          day_key: dayKey,
          ads_watched: 0,
          ad_earnings: '0.00000000',
          updated_at: new Date().toISOString(),
        };
      }

      if (tracking.ads_watched >= dailyLimit) {
        throw new Error('Daily ad limit exceeded');
      }

      const earningsBefore = new Decimal(tracking.ad_earnings);
      if (earningsBefore.greaterThanOrEqualTo(maxDailyCap)) {
        throw new Error('Daily ad reward cap reached');
      }

      const rewardDec = new Decimal(adRewardAmount);
      const finalReward = Decimal.min(rewardDec, maxDailyCap.minus(earningsBefore)).toFixed(8);

      tracking.ads_watched += 1;
      tracking.ad_earnings = earningsBefore.plus(new Decimal(finalReward)).toFixed(8);
      tracking.updated_at = new Date().toISOString();
      await db.saveAdDailyTracking(tracking);

      // Consume pending tap-triggered opportunity if present
      const tapState = await db.getTapState(userId);
      if (tapState && tapState.pending_ad_opportunity) {
        tapState.pending_ad_opportunity = false;
        await db.saveTapState(tapState);
      }

      // Credit balance
      const { balance } = await BalanceService.credit(
        userId,
        finalReward,
        'AD_REWARD',
        `ad_${opportunityId}`,
        { dayKey, adsWatched: tracking.ads_watched }
      );

      await NotificationService.createNotification({
        userId,
        title: 'Ad Reward Claimed',
        message: `You earned ${finalReward} SKX by watching an ad. (${tracking.ads_watched}/${dailyLimit} today)`,
        type: 'AD_REWARD',
      });

      return {
        rewardAmount: finalReward,
        balance,
        adsWatchedToday: tracking.ads_watched,
        todayEarnings: tracking.ad_earnings,
      };
    });
  }
}
