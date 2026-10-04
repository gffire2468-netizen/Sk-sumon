import { db } from '../db/database';
import { ConfigService } from '../config/configService';
import { BalanceService } from './balanceService';
import { NotificationService } from './notificationService';
import { CommunityMembership, UserBalance } from '../types';

export class CommunityService {
  /**
   * Fetches community status and settings for the user.
   */
  public static async getStatus(userId: string): Promise<{
    enabled: boolean;
    chatId: string;
    inviteLink: string;
    rewardAmount: string;
    isVerified: boolean;
    isRewardClaimed: boolean;
  }> {
    const enabled = ConfigService.get('COMMUNITY_REWARD_ENABLED');
    const chatId = ConfigService.get('COMMUNITY_CHAT_ID');
    const inviteLink = ConfigService.get('COMMUNITY_INVITE_LINK');
    const rewardAmount = ConfigService.get('COMMUNITY_REWARD');

    const membership = await db.getCommunityMembership(userId);

    return {
      enabled,
      chatId,
      inviteLink,
      rewardAmount,
      isVerified: membership?.verified || false,
      isRewardClaimed: membership?.reward_claimed || false,
    };
  }

  /**
   * Verifies membership and claims the one-time community reward.
   */
  public static async verifyAndClaim(userId: string): Promise<{
    success: boolean;
    rewardAmount: string;
    balance: UserBalance;
    membership: CommunityMembership;
  }> {
    const enabled = ConfigService.get('COMMUNITY_REWARD_ENABLED');
    const isDemo = ConfigService.get('DEMO_MODE');
    if (!enabled && !isDemo) {
      throw new Error('Community reward is currently disabled by administrator.');
    }

    const user = await db.getUserById(userId);
    if (!user) throw new Error('User not found');

    return await db.withUserLock(userId, async () => {
      let membership = await db.getCommunityMembership(userId);
      if (membership?.reward_claimed) {
        throw new Error('Community join reward has already been claimed for this account.');
      }

      const botToken = ConfigService.getTelegramBotToken();
      const chatId = ConfigService.get('COMMUNITY_CHAT_ID');

      let verified = false;

      // Real Telegram Bot API verification if botToken and chatId are configured
      if (botToken && chatId) {
        try {
          const res = await fetch(
            `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${user.telegram_id}`
          );
          const data = (await res.json()) as any;
          if (data.ok && data.result) {
            const status = data.result.status;
            // member, administrator, or creator
            if (['member', 'administrator', 'creator'].includes(status)) {
              verified = true;
            }
          }
        } catch (err) {
          console.error('[CommunityService] Bot API check failed:', err);
        }
      } else if (isDemo) {
        // In demo mode without Telegram credentials, allow simulation
        verified = true;
      }

      if (!verified) {
        throw new Error('Telegram membership verification failed. Please join the official community first.');
      }

      const rewardAmount = ConfigService.get('COMMUNITY_REWARD');
      const now = new Date().toISOString();

      membership = {
        user_id: userId,
        verified: true,
        reward_claimed: true,
        verified_at: now,
        claimed_at: now,
      };

      await db.saveCommunityMembership(membership);

      const { balance } = await BalanceService.credit(
        userId,
        rewardAmount,
        'COMMUNITY_REWARD',
        `comm_${userId}`,
        { chatId }
      );

      await NotificationService.createNotification({
        userId,
        title: 'Community Reward Unlocked!',
        message: `Welcome to the SKX Community! You have received ${rewardAmount} SKX.`,
        type: 'COMMUNITY_REWARD',
      });

      return {
        success: true,
        rewardAmount,
        balance,
        membership,
      };
    });
  }
}
