import Decimal from 'decimal.js';
import crypto from 'crypto';
import { db } from '../db/database';
import { ConfigService } from '../config/configService';
import { BalanceService } from './balanceService';
import { NotificationService } from './notificationService';
import { SecurityService } from './securityService';
import { MiningCycle, TapState, UserBalance, UserEnergy } from '../types';

export class MiningService {
  /**
   * Calculates realtime energy by applying time-based regeneration.
   */
  public static calculateRegeneratedEnergy(energy: UserEnergy): UserEnergy {
    const maxEnergy = ConfigService.get('MAX_ENERGY');
    const regenRate = ConfigService.get('ENERGY_REGEN_RATE');
    const now = Date.now();

    if (energy.current_energy >= maxEnergy) {
      return {
        ...energy,
        max_energy: maxEnergy,
        current_energy: maxEnergy,
        last_regen_at: now,
      };
    }

    const elapsedSeconds = Math.max(0, Math.floor((now - energy.last_regen_at) / 1000));
    if (elapsedSeconds <= 0) {
      return { ...energy, max_energy: maxEnergy };
    }

    const regeneratedUnits = Math.floor(elapsedSeconds * regenRate);
    const newEnergy = Math.min(maxEnergy, energy.current_energy + regeneratedUnits);

    return {
      user_id: energy.user_id,
      current_energy: newEnergy,
      max_energy: maxEnergy,
      last_regen_at: now,
    };
  }

  /**
   * Processes tap requests with server-authoritative validation, energy deduction, and credit.
   */
  public static async processTaps(
    userId: string,
    tapsCount: number,
    clientTimestamp?: number
  ): Promise<{
    success: boolean;
    tapsCredited: number;
    rewardGranted: string;
    newEnergy: number;
    maxEnergy: number;
    balance: UserBalance;
    adOpportunityAvailable: boolean;
  }> {
    if (!Number.isInteger(tapsCount) || tapsCount <= 0) {
      throw new Error('Invalid taps count');
    }

    // Safety limit on batch size to prevent artificial burst exploits
    if (tapsCount > 100) {
      throw new Error('Batch tap limit exceeded (max 100 taps per request)');
    }

    return await db.withUserLock(userId, async () => {
      let rawEnergy = await db.getEnergy(userId);
      const maxEnergy = ConfigService.get('MAX_ENERGY');
      const energyPerTap = ConfigService.get('ENERGY_PER_TAP');
      const tapReward = ConfigService.get('TAP_REWARD');
      const tapAdTriggerEnabled = ConfigService.get('TAP_AD_TRIGGER_ENABLED');
      const tapAdThreshold = ConfigService.get('TAP_AD_THRESHOLD');

      if (!rawEnergy) {
        rawEnergy = {
          user_id: userId,
          current_energy: maxEnergy,
          max_energy: maxEnergy,
          last_regen_at: Date.now(),
        };
      }

      // Regenerate energy based on elapsed time
      const energy = this.calculateRegeneratedEnergy(rawEnergy);

      // Check anti-cheat tap frequency
      let tapState = await db.getTapState(userId);
      if (!tapState) {
        tapState = {
          user_id: userId,
          valid_taps_count: 0,
          taps_since_last_ad: 0,
          pending_ad_opportunity: false,
          last_tap_at: 0,
        };
      }

      const now = Date.now();
      const timeSinceLastTapMs = now - tapState.last_tap_at;

      // If user is sending high taps in an impossible timeframe (< 40ms per tap)
      if (tapState.last_tap_at > 0 && timeSinceLastTapMs < tapsCount * 30) {
        await SecurityService.recordEvent({
          userId,
          eventType: 'SUSPICIOUS_TAP_SPEED',
          severity: 'MEDIUM',
          details: { tapsCount, timeSinceLastTapMs },
        });
      }

      const energyRequired = tapsCount * energyPerTap;
      if (energy.current_energy < energyRequired) {
        throw new Error(`Insufficient energy. Required: ${energyRequired}, Available: ${energy.current_energy}`);
      }

      // Deduct energy
      energy.current_energy -= energyRequired;
      energy.last_regen_at = now;
      await db.saveEnergy(energy);

      // Calculate authoritative reward
      const totalReward = new Decimal(tapReward).times(tapsCount).toFixed(8);

      // Atomically credit balance through balance engine
      const { balance } = await BalanceService.credit(
        userId,
        totalReward,
        'TAP_REWARD',
        `tap_${Date.now()}`,
        { tapsCount, tapReward }
      );

      // Update tap state & check 100-tap ad opportunity trigger
      tapState.valid_taps_count += tapsCount;
      tapState.taps_since_last_ad += tapsCount;
      tapState.last_tap_at = now;

      let adOpportunityAvailable = tapState.pending_ad_opportunity;

      if (tapAdTriggerEnabled && tapState.taps_since_last_ad >= tapAdThreshold) {
        tapState.pending_ad_opportunity = true;
        adOpportunityAvailable = true;
        tapState.taps_since_last_ad = tapState.taps_since_last_ad % tapAdThreshold;
      }

      await db.saveTapState(tapState);

      return {
        success: true,
        tapsCredited: tapsCount,
        rewardGranted: totalReward,
        newEnergy: energy.current_energy,
        maxEnergy: energy.max_energy,
        balance,
        adOpportunityAvailable,
      };
    });
  }

  /**
   * Returns status of the hourly mining cycle.
   */
  public static async getCycleStatus(userId: string): Promise<{
    cycleStartedAt: number;
    durationSeconds: number;
    endsAt: number;
    remainingSeconds: number;
    isClaimable: boolean;
    rewardAmount: string;
  }> {
    let cycle = await db.getMiningCycle(userId);
    const duration = ConfigService.get('MINING_CYCLE_DURATION');
    const reward = ConfigService.get('MINING_CYCLE_REWARD');
    const now = Date.now();

    if (!cycle) {
      cycle = {
        user_id: userId,
        cycle_started_at: now,
        cycle_duration_seconds: duration,
        reward_claimed: false,
      };
      await db.saveMiningCycle(cycle);
    }

    const endsAt = cycle.cycle_started_at + cycle.cycle_duration_seconds * 1000;
    const remainingSeconds = Math.max(0, Math.ceil((endsAt - now) / 1000));
    const isClaimable = remainingSeconds === 0 && !cycle.reward_claimed;

    return {
      cycleStartedAt: cycle.cycle_started_at,
      durationSeconds: cycle.cycle_duration_seconds,
      endsAt,
      remainingSeconds,
      isClaimable,
      rewardAmount: reward,
    };
  }

  /**
   * Claims hourly mining reward safely.
   */
  public static async claimCycle(userId: string): Promise<{
    rewardAmount: string;
    balance: UserBalance;
    nextCycleStartedAt: number;
  }> {
    return await db.withUserLock(userId, async () => {
      let cycle = await db.getMiningCycle(userId);
      const duration = ConfigService.get('MINING_CYCLE_DURATION');
      const reward = ConfigService.get('MINING_CYCLE_REWARD');
      const now = Date.now();

      if (!cycle) {
        cycle = {
          user_id: userId,
          cycle_started_at: now,
          cycle_duration_seconds: duration,
          reward_claimed: false,
        };
        await db.saveMiningCycle(cycle);
      }

      const endsAt = cycle.cycle_started_at + cycle.cycle_duration_seconds * 1000;
      if (now < endsAt) {
        const remaining = Math.ceil((endsAt - now) / 1000);
        throw new Error(`Mining cycle is still active. Please wait ${remaining} seconds.`);
      }

      if (cycle.reward_claimed) {
        throw new Error('Reward has already been claimed for this cycle.');
      }

      // Credit balance
      const { balance } = await BalanceService.credit(
        userId,
        reward,
        'MINING_REWARD',
        `cycle_${cycle.cycle_started_at}`,
        { cycleDuration: cycle.cycle_duration_seconds }
      );

      // Start next cycle immediately
      cycle.reward_claimed = false;
      cycle.cycle_started_at = now;
      cycle.last_claimed_at = now;
      cycle.cycle_duration_seconds = duration;
      await db.saveMiningCycle(cycle);

      // Send notification
      await NotificationService.createNotification({
        userId,
        title: 'Mining Cycle Completed',
        message: `You claimed ${reward} SKX from your hourly mining cycle! Next cycle has started.`,
        type: 'MINING_REWARD',
      });

      return {
        rewardAmount: reward,
        balance,
        nextCycleStartedAt: now,
      };
    });
  }
}
