import crypto from 'crypto';
import { db } from '../db/database';
import { ConfigService } from '../config/configService';
import { BalanceService } from './balanceService';
import { NotificationService } from './notificationService';
import { DailyRewardClaim, UserBalance } from '../types';

export class DailyRewardService {
  public static getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  public static async getDailyRewardStatus(userId: string): Promise<{
    todayClaimed: boolean;
    dayKey: string;
    mode: 'DAILY_BONUS' | 'ADS' | 'BOTH';
    rewardAmount: string;
    lastClaim?: DailyRewardClaim;
  }> {
    const dayKey = this.getTodayKey();
    const claim = await db.getDailyRewardClaim(userId, dayKey);
    const mode = ConfigService.get('DAILY_REWARD_MODE');
    const rewardAmount = ConfigService.get('DAILY_REWARD_BASE');

    return {
      todayClaimed: !!claim,
      dayKey,
      mode,
      rewardAmount,
      lastClaim: claim || undefined,
    };
  }

  public static async claimDailyReward(userId: string): Promise<{
    rewardAmount: string;
    balance: UserBalance;
    claim: DailyRewardClaim;
  }> {
    const dayKey = this.getTodayKey();

    return await db.withUserLock(userId, async () => {
      const existing = await db.getDailyRewardClaim(userId, dayKey);
      if (existing) {
        throw new Error('Daily reward already claimed for today');
      }

      const rewardAmount = ConfigService.get('DAILY_REWARD_BASE');

      const claim: DailyRewardClaim = {
        id: crypto.randomUUID(),
        user_id: userId,
        day_key: dayKey,
        reward_amount: rewardAmount,
        claimed_at: new Date().toISOString(),
      };

      await db.saveDailyRewardClaim(claim);

      const { balance } = await BalanceService.credit(
        userId,
        rewardAmount,
        'DAILY_REWARD',
        `daily_${dayKey}`,
        { dayKey }
      );

      await NotificationService.createNotification({
        userId,
        title: 'Daily Reward Claimed',
        message: `You received ${rewardAmount} SKX daily bonus! Come back tomorrow for more.`,
        type: 'DAILY_REWARD',
      });

      return { rewardAmount, balance, claim };
    });
  }
}
