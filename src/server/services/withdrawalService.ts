import Decimal from 'decimal.js';
import crypto from 'crypto';
import { db } from '../db/database';
import { ConfigService } from '../config/configService';
import { BalanceService } from './balanceService';
import { NotificationService } from './notificationService';
import { SecurityService } from './securityService';
import { Withdrawal, WithdrawalStatus } from '../types';

export class WithdrawalService {
  /**
   * Evaluates whether a user satisfies BOTH mandatory unlock requirements.
   */
  public static async checkEligibility(userId: string): Promise<{
    canWithdraw: boolean;
    balanceEligible: boolean;
    referralsEligible: boolean;
    currentBalance: string;
    minWithdrawal: string;
    maxWithdrawal: string;
    currentValidReferrals: number;
    requiredReferrals: number;
    reason?: string;
  }> {
    const balance = await db.getBalance(userId);
    const validReferrals = await db.getValidReferralsCount(userId);

    const minWithdrawal = ConfigService.get('MIN_WITHDRAWAL');
    const maxWithdrawal = ConfigService.get('MAX_WITHDRAWAL');
    const requiredReferrals = ConfigService.get('REQUIRED_REFERRALS');

    const available = new Decimal(balance?.available_balance || '0');
    const minRequired = new Decimal(minWithdrawal);

    const balanceEligible = available.greaterThanOrEqualTo(minRequired);
    const referralsEligible = validReferrals >= requiredReferrals;
    const canWithdraw = balanceEligible && referralsEligible;

    let reason: string | undefined;
    if (!balanceEligible && !referralsEligible) {
      reason = `You need at least ${minWithdrawal} SKX and ${requiredReferrals} valid referrals to unlock withdrawals.`;
    } else if (!balanceEligible) {
      reason = `Minimum withdrawal amount is ${minWithdrawal} SKX. Your current available balance is ${available.toFixed(4)} SKX.`;
    } else if (!referralsEligible) {
      reason = `You need ${requiredReferrals} valid referrals to unlock withdrawals (current: ${validReferrals}/${requiredReferrals}).`;
    }

    return {
      canWithdraw,
      balanceEligible,
      referralsEligible,
      currentBalance: available.toFixed(8),
      minWithdrawal,
      maxWithdrawal,
      currentValidReferrals: validReferrals,
      requiredReferrals,
      reason,
    };
  }

  /**
   * Submits a withdrawal request with atomic balance reservation.
   */
  public static async submitWithdrawal(params: {
    userId: string;
    method: 'bKash' | 'Nagad' | 'Rocket';
    accountNumber: string;
    amountStr: string;
  }): Promise<Withdrawal> {
    const { userId, method, accountNumber, amountStr } = params;

    // Validate account number format (Bangladeshi mobile format 01XXXXXXXXX)
    const cleanAccount = accountNumber.trim().replace(/\s+/g, '');
    const phoneRegex = /^(?:\+?8801|01)[3-9]\d{8}$/;
    if (!phoneRegex.test(cleanAccount)) {
      throw new Error('Please enter a valid 11-digit mobile wallet number (e.g. 01712345678)');
    }

    const requestedAmount = new Decimal(amountStr);
    const minWithdrawal = new Decimal(ConfigService.get('MIN_WITHDRAWAL'));
    const maxWithdrawal = new Decimal(ConfigService.get('MAX_WITHDRAWAL'));

    if (requestedAmount.lessThan(minWithdrawal)) {
      throw new Error(`Minimum withdrawal is ${minWithdrawal.toFixed(2)} SKX`);
    }

    if (requestedAmount.greaterThan(maxWithdrawal)) {
      throw new Error(`Maximum withdrawal is ${maxWithdrawal.toFixed(2)} SKX`);
    }

    // Strict double-condition verification
    const eligibility = await this.checkEligibility(userId);
    if (!eligibility.canWithdraw) {
      throw new Error(eligibility.reason || 'You do not meet the withdrawal requirements.');
    }

    // Calculate fee
    const feeType = ConfigService.get('WITHDRAWAL_FEE_TYPE');
    const feeVal = new Decimal(ConfigService.get('WITHDRAWAL_FEE_VALUE'));
    let feeAmount = new Decimal(0);

    if (feeType === 'PERCENTAGE') {
      feeAmount = requestedAmount.times(feeVal.dividedBy(100));
    } else {
      feeAmount = feeVal; // Fixed fee
    }

    // Safety: ensure net amount is positive
    const netAmount = requestedAmount.minus(feeAmount);
    if (netAmount.lessThanOrEqualTo(0)) {
      throw new Error('Withdrawal amount after fee must be greater than zero');
    }

    const withdrawalId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Atomically reserve the requested balance from available balance
    await BalanceService.reserve(
      userId,
      requestedAmount.toFixed(8),
      withdrawalId,
      { method, accountNumber: cleanAccount, feeAmount: feeAmount.toFixed(8), netAmount: netAmount.toFixed(8) }
    );

    const withdrawal: Withdrawal = {
      id: withdrawalId,
      user_id: userId,
      method,
      account_number: cleanAccount,
      requested_amount: requestedAmount.toFixed(8),
      fee_amount: feeAmount.toFixed(8),
      net_amount: netAmount.toFixed(8),
      status: 'PENDING',
      created_at: now,
    };

    await db.createWithdrawal(withdrawal);

    await NotificationService.createNotification({
      userId,
      title: 'Withdrawal Submitted',
      message: `Your withdrawal of ${requestedAmount.toFixed(4)} SKX via ${method} has been received and queued for admin review.`,
      type: 'WITHDRAWAL_SUBMITTED',
    });

    return withdrawal;
  }

  /**
   * Admin reviews and transitions status: PENDING -> ADMIN_REVIEW -> APPROVED -> MANUAL_PAYMENT -> COMPLETED / REJECTED
   */
  public static async updateWithdrawalStatus(params: {
    withdrawalId: string;
    status: WithdrawalStatus;
    adminId: string;
    adminUsername: string;
    providerTrxId?: string;
    adminNotes?: string;
  }): Promise<Withdrawal> {
    const { withdrawalId, status, adminId, adminUsername, providerTrxId, adminNotes } = params;

    const withdrawal = await db.getWithdrawalById(withdrawalId);
    if (!withdrawal) {
      throw new Error('Withdrawal request not found');
    }

    if (withdrawal.status === 'COMPLETED' || withdrawal.status === 'REJECTED' || withdrawal.status === 'CANCELLED') {
      throw new Error(`Cannot update a withdrawal with final status ${withdrawal.status}`);
    }

    // Requirement 16: "A withdrawal can only become COMPLETED when the admin enters a REAL provider transaction ID. Do not generate fake TrxID."
    if (status === 'COMPLETED') {
      if (!providerTrxId || providerTrxId.trim().length < 6) {
        throw new Error('A valid real provider transaction ID (TrxID) is required to complete withdrawal.');
      }
    }

    const now = new Date().toISOString();
    withdrawal.status = status;
    withdrawal.admin_notes = adminNotes || withdrawal.admin_notes;
    withdrawal.reviewed_by = adminUsername;
    withdrawal.reviewed_at = now;

    if (status === 'COMPLETED') {
      withdrawal.provider_trx_id = providerTrxId?.trim();
      withdrawal.completed_at = now;

      // Finalize the deduction from reserved_balance
      await BalanceService.release(
        withdrawal.user_id,
        withdrawal.requested_amount,
        true,
        'WITHDRAWAL',
        withdrawal.id,
        { trxId: withdrawal.provider_trx_id, method: withdrawal.method }
      );

      await NotificationService.createNotification({
        userId: withdrawal.user_id,
        title: 'Withdrawal Completed',
        message: `Your withdrawal of ${withdrawal.net_amount} SKX (${withdrawal.method}) has been paid! TrxID: ${withdrawal.provider_trx_id}`,
        type: 'WITHDRAWAL_COMPLETED',
      });
    } else if (status === 'REJECTED' || status === 'CANCELLED') {
      // Return reserved amount back to available balance
      await BalanceService.release(
        withdrawal.user_id,
        withdrawal.requested_amount,
        false,
        'REVERSAL',
        withdrawal.id,
        { reason: adminNotes || 'Admin rejected withdrawal' }
      );

      await NotificationService.createNotification({
        userId: withdrawal.user_id,
        title: 'Withdrawal Rejected',
        message: `Your withdrawal of ${withdrawal.requested_amount} SKX was rejected. Funds have been refunded to your available balance. Note: ${adminNotes || 'None'}`,
        type: 'WITHDRAWAL_REJECTED',
      });
    } else if (status === 'APPROVED') {
      await NotificationService.createNotification({
        userId: withdrawal.user_id,
        title: 'Withdrawal Approved',
        message: `Your withdrawal request of ${withdrawal.requested_amount} SKX has been approved and is queued for payout.`,
        type: 'WITHDRAWAL_APPROVED',
      });
    }

    await db.updateWithdrawal(withdrawal);

    // Audit log
    await SecurityService.recordAuditLog({
      adminId,
      adminUsername,
      action: `WITHDRAWAL_${status}`,
      targetType: 'WITHDRAWAL',
      targetId: withdrawal.id,
      metadata: {
        userId: withdrawal.user_id,
        method: withdrawal.method,
        amount: withdrawal.requested_amount,
        providerTrxId: withdrawal.provider_trx_id,
        adminNotes,
      },
    });

    return withdrawal;
  }
}
