import Decimal from 'decimal.js';
import { db } from '../db/database';
import { ConfigService } from '../config/configService';
import { BalanceService } from './balanceService';
import { NotificationService } from './notificationService';
import { Referral, User } from '../types';

export class ReferralService {
  /**
   * Generates referral links for the user.
   */
  public static getReferralLinks(user: User): {
    botLink: string;
    webLink: string;
    referralCode: string;
  } {
    const botUsername = ConfigService.getTelegramBotUsername();
    const appBaseUrl = ConfigService.getAppBaseUrl();
    const referralCode = `ref_${user.telegram_id}`;

    return {
      botLink: `https://t.me/${botUsername}?start=${referralCode}`,
      webLink: `${appBaseUrl}?startapp=${referralCode}`,
      referralCode,
    };
  }

  /**
   * Validates a pending referral and issues the reward to the referrer.
   * Can be triggered once the referred user proves activity (e.g. performs their first valid tap).
   */
  public static async validateReferral(referredUserId: string): Promise<boolean> {
    const referral = await db.getReferralByReferredUserId(referredUserId);
    if (!referral) return false;

    if (referral.status === 'VALID' && referral.reward_paid) {
      return true;
    }

    return await db.withUserLock(referral.referrer_id, async () => {
      // Re-fetch to prevent race conditions
      const currentRef = await db.getReferralByReferredUserId(referredUserId);
      if (!currentRef || currentRef.reward_paid) return false;

      currentRef.status = 'VALID';
      currentRef.validated_at = new Date().toISOString();

      const rewardAmount = ConfigService.get('REFERRAL_REWARD');
      currentRef.reward_amount = rewardAmount;

      // Credit referrer
      await BalanceService.credit(
        referral.referrer_id,
        rewardAmount,
        'REFERRAL_REWARD',
        `ref_${referredUserId}`,
        { referredUserId }
      );

      currentRef.reward_paid = true;
      await db.saveReferral(currentRef);

      const referrer = await db.getUserById(referral.referrer_id);
      const referred = await db.getUserById(referredUserId);

      if (referrer) {
        await NotificationService.createNotification({
          userId: referrer.id,
          title: 'New Valid Referral!',
          message: `Your referral ${referred?.first_name || 'miner'} is now active. You earned ${rewardAmount} SKX!`,
          type: 'REFERRAL_REWARD',
        });
      }

      return true;
    });
  }

  /**
   * Returns referral summary for a user.
   */
  public static async getReferralSummary(userId: string) {
    const user = await db.getUserById(userId);
    if (!user) throw new Error('User not found');

    const referrals = await db.getReferralsByReferrerId(userId);
    const validCount = referrals.filter((r) => r.status === 'VALID').length;
    const requiredReferrals = ConfigService.get('REQUIRED_REFERRALS');
    const referralReward = ConfigService.get('REFERRAL_REWARD');

    let totalEarned = new Decimal(0);
    const enrichedList = await Promise.all(
      referrals.map(async (r) => {
        if (r.reward_paid) {
          totalEarned = totalEarned.plus(new Decimal(r.reward_amount || '0'));
        }
        const refUser = await db.getUserById(r.referred_user_id);
        return {
          id: r.id,
          referredName: refUser?.first_name || 'Anonymous',
          referredUsername: refUser?.username,
          status: r.status,
          rewardPaid: r.reward_paid,
          rewardAmount: r.reward_amount,
          createdAt: r.created_at,
          validatedAt: r.validated_at,
        };
      })
    );

    const links = this.getReferralLinks(user);

    return {
      referralCode: links.referralCode,
      botLink: links.botLink,
      webLink: links.webLink,
      totalReferrals: referrals.length,
      validReferrals: validCount,
      requiredReferrals,
      rewardPerReferral: referralReward,
      totalEarnedSKX: totalEarned.toFixed(8),
      isWithdrawalRequirementMet: validCount >= requiredReferrals,
      referralsList: enrichedList,
    };
  }
}
