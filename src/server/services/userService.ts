import crypto from 'crypto';
import Decimal from 'decimal.js';
import { db } from '../db/database';
import { ConfigService } from '../config/configService';
import { TelegramUserData } from './telegramAuthService';
import { User, UserBalance, UserEnergy, MiningCycle, TapState } from '../types';

export class UserService {
  /**
   * Finds existing user or provisions new user with initial pristine state.
   */
  public static async getOrCreateUser(
    tgUser: TelegramUserData,
    startParam?: string
  ): Promise<{
    user: User;
    balance: UserBalance;
    energy: UserEnergy;
    miningCycle: MiningCycle;
    tapState: TapState;
    isNew: boolean;
  }> {
    const telegramIdStr = tgUser.id.toString();
    let user = await db.getUserByTelegramId(telegramIdStr);
    let isNew = false;

    if (!user) {
      isNew = true;
      const newUserId = crypto.randomUUID();
      const now = new Date().toISOString();

      let referrerUserId: string | undefined = undefined;

      // Handle referral deep link (e.g. ref_12345 or ref_UUID)
      if (startParam && startParam.startsWith('ref_')) {
        const refCandidate = startParam.replace('ref_', '').trim();
        // Prevent self referral
        if (refCandidate !== telegramIdStr && refCandidate !== newUserId) {
          // Check if refCandidate is a telegram_id or a user UUID
          const referrerByTg = await db.getUserByTelegramId(refCandidate);
          const referrerById = referrerByTg || (await db.getUserById(refCandidate));
          if (referrerById && !referrerById.is_suspended) {
            referrerUserId = referrerById.id;
          }
        }
      }

      user = {
        id: newUserId,
        telegram_id: telegramIdStr,
        username: tgUser.username,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name,
        language_code: tgUser.language_code,
        is_suspended: false,
        referrer_id: referrerUserId,
        created_at: now,
        last_active_at: now,
      };

      await db.createUser(user);

      // Requirement 7: A real new Telegram user starts with Balance = 0 SKX
      const balance: UserBalance = {
        user_id: user.id,
        available_balance: '0.00000000',
        reserved_balance: '0.00000000',
        total_earned: '0.00000000',
        updated_at: now,
      };
      await db.saveBalance(balance);

      const maxEnergy = ConfigService.get('MAX_ENERGY');
      const energy: UserEnergy = {
        user_id: user.id,
        current_energy: maxEnergy,
        max_energy: maxEnergy,
        last_regen_at: Date.now(),
      };
      await db.saveEnergy(energy);

      const miningDuration = ConfigService.get('MINING_CYCLE_DURATION');
      const cycle: MiningCycle = {
        user_id: user.id,
        cycle_started_at: Date.now(),
        cycle_duration_seconds: miningDuration,
        reward_claimed: false,
      };
      await db.saveMiningCycle(cycle);

      const tapState: TapState = {
        user_id: user.id,
        valid_taps_count: 0,
        taps_since_last_ad: 0,
        pending_ad_opportunity: false,
        last_tap_at: 0,
      };
      await db.saveTapState(tapState);

      // Create Referral entry if referrer exists
      if (referrerUserId) {
        const referralReward = ConfigService.get('REFERRAL_REWARD');
        await db.saveReferral({
          id: crypto.randomUUID(),
          referrer_id: referrerUserId,
          referred_user_id: user.id,
          status: 'PENDING', // Becomes 'VALID' after qualification or immediately for active TG user
          reward_paid: false,
          reward_amount: referralReward,
          created_at: now,
        });
      }
    } else {
      // Update last active
      user.last_active_at = new Date().toISOString();
      if (tgUser.username && user.username !== tgUser.username) {
        user.username = tgUser.username;
      }
      if (tgUser.first_name && user.first_name !== tgUser.first_name) {
        user.first_name = tgUser.first_name;
      }
      await db.updateUser(user);
    }

    let [balance, energy, miningCycle, tapState] = await Promise.all([
      db.getBalance(user.id),
      db.getEnergy(user.id),
      db.getMiningCycle(user.id),
      db.getTapState(user.id),
    ]);

    if (!balance) {
      balance = await db.saveBalance({
        user_id: user.id,
        available_balance: '0.00000000',
        reserved_balance: '0.00000000',
        total_earned: '0.00000000',
        updated_at: new Date().toISOString(),
      });
    }

    if (!energy) {
      const maxEnergy = ConfigService.get('MAX_ENERGY');
      energy = await db.saveEnergy({
        user_id: user.id,
        current_energy: maxEnergy,
        max_energy: maxEnergy,
        last_regen_at: Date.now(),
      });
    }

    if (!miningCycle) {
      miningCycle = await db.saveMiningCycle({
        user_id: user.id,
        cycle_started_at: Date.now(),
        cycle_duration_seconds: ConfigService.get('MINING_CYCLE_DURATION'),
        reward_claimed: false,
      });
    }

    if (!tapState) {
      tapState = await db.saveTapState({
        user_id: user.id,
        valid_taps_count: 0,
        taps_since_last_ad: 0,
        pending_ad_opportunity: false,
        last_tap_at: 0,
      });
    }

    return { user, balance, energy, miningCycle, tapState, isNew };
  }

  /**
   * Returns comprehensive user profile with calculated metrics.
   */
  public static async getProfile(userId: string) {
    const user = await db.getUserById(userId);
    if (!user) throw new Error('User not found');

    const [balance, energy, miningCycle, tapState, referrals, validReferralsCount] = await Promise.all([
      db.getBalance(userId),
      db.getEnergy(userId),
      db.getMiningCycle(userId),
      db.getTapState(userId),
      db.getReferralsByReferrerId(userId),
      db.getValidReferralsCount(userId),
    ]);

    const minWithdrawal = ConfigService.get('MIN_WITHDRAWAL');
    const requiredReferrals = ConfigService.get('REQUIRED_REFERRALS');

    const availableBal = new Decimal(balance?.available_balance || '0');
    const minBal = new Decimal(minWithdrawal);

    const isBalanceEligible = availableBal.greaterThanOrEqualTo(minBal);
    const isReferralEligible = validReferralsCount >= requiredReferrals;
    const canWithdraw = isBalanceEligible && isReferralEligible;

    return {
      user,
      balance: balance || {
        available_balance: '0.00000000',
        reserved_balance: '0.00000000',
        total_earned: '0.00000000',
      },
      energy,
      miningCycle,
      tapState,
      referralsCount: referrals.length,
      validReferralsCount,
      withdrawalEligibility: {
        canWithdraw,
        isBalanceEligible,
        isReferralEligible,
        requiredBalance: minWithdrawal,
        requiredReferrals,
        currentBalance: availableBal.toFixed(8),
        currentValidReferrals: validReferralsCount,
      },
    };
  }
}
