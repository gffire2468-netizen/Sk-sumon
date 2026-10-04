import Decimal from 'decimal.js';
import crypto from 'crypto';
import { db } from '../db/database';
import { Transaction, TransactionType, UserBalance } from '../types';

export class BalanceService {
  /**
   * Authoritative balance credit operation.
   * Atomically locks the user, adds exact Decimal amount, updates ledger, and commits.
   */
  public static async credit(
    userId: string,
    amountStr: string | number,
    type: TransactionType,
    referenceId?: string,
    metadata?: Record<string, any>
  ): Promise<{ balance: UserBalance; transaction: Transaction }> {
    const amount = new Decimal(amountStr);
    if (amount.lessThanOrEqualTo(0)) {
      throw new Error('Credit amount must be greater than zero');
    }

    return await db.withUserLock(userId, async () => {
      let balance = await db.getBalance(userId);
      if (!balance) {
        balance = {
          user_id: userId,
          available_balance: '0.00000000',
          reserved_balance: '0.00000000',
          total_earned: '0.00000000',
          updated_at: new Date().toISOString(),
        };
      }

      const before = new Decimal(balance.available_balance);
      const totalEarnedBefore = new Decimal(balance.total_earned);
      const after = before.plus(amount);

      balance.available_balance = after.toFixed(8);
      balance.total_earned = totalEarnedBefore.plus(amount).toFixed(8);
      balance.updated_at = new Date().toISOString();

      const transaction: Transaction = {
        id: crypto.randomUUID(),
        user_id: userId,
        type,
        amount: amount.toFixed(8),
        balance_before: before.toFixed(8),
        balance_after: after.toFixed(8),
        status: 'COMPLETED',
        reference_id: referenceId,
        metadata,
        created_at: new Date().toISOString(),
      };

      await db.saveBalance(balance);
      await db.createTransaction(transaction);

      return { balance, transaction };
    });
  }

  /**
   * Authoritative balance debit operation.
   */
  public static async debit(
    userId: string,
    amountStr: string | number,
    type: TransactionType,
    referenceId?: string,
    metadata?: Record<string, any>
  ): Promise<{ balance: UserBalance; transaction: Transaction }> {
    const amount = new Decimal(amountStr);
    if (amount.lessThanOrEqualTo(0)) {
      throw new Error('Debit amount must be greater than zero');
    }

    return await db.withUserLock(userId, async () => {
      let balance = await db.getBalance(userId);
      if (!balance) {
        throw new Error('User balance record not found');
      }

      const before = new Decimal(balance.available_balance);
      if (before.lessThan(amount)) {
        throw new Error('Insufficient balance');
      }

      const after = before.minus(amount);
      balance.available_balance = after.toFixed(8);
      balance.updated_at = new Date().toISOString();

      const transaction: Transaction = {
        id: crypto.randomUUID(),
        user_id: userId,
        type,
        amount: amount.toFixed(8),
        balance_before: before.toFixed(8),
        balance_after: after.toFixed(8),
        status: 'COMPLETED',
        reference_id: referenceId,
        metadata,
        created_at: new Date().toISOString(),
      };

      await db.saveBalance(balance);
      await db.createTransaction(transaction);

      return { balance, transaction };
    });
  }

  /**
   * Reserves balance for a withdrawal request so the user cannot double-spend.
   * Moves amount from available_balance -> reserved_balance.
   */
  public static async reserve(
    userId: string,
    amountStr: string | number,
    referenceId?: string,
    metadata?: Record<string, any>
  ): Promise<{ balance: UserBalance; transaction: Transaction }> {
    const amount = new Decimal(amountStr);
    if (amount.lessThanOrEqualTo(0)) {
      throw new Error('Reservation amount must be greater than zero');
    }

    return await db.withUserLock(userId, async () => {
      const balance = await db.getBalance(userId);
      if (!balance) {
        throw new Error('User balance record not found');
      }

      const available = new Decimal(balance.available_balance);
      const reserved = new Decimal(balance.reserved_balance);

      if (available.lessThan(amount)) {
        throw new Error('Insufficient available balance to reserve');
      }

      const newAvailable = available.minus(amount);
      const newReserved = reserved.plus(amount);

      balance.available_balance = newAvailable.toFixed(8);
      balance.reserved_balance = newReserved.toFixed(8);
      balance.updated_at = new Date().toISOString();

      const transaction: Transaction = {
        id: crypto.randomUUID(),
        user_id: userId,
        type: 'WITHDRAWAL',
        amount: amount.toFixed(8),
        balance_before: available.toFixed(8),
        balance_after: newAvailable.toFixed(8),
        status: 'PENDING',
        reference_id: referenceId,
        metadata: { ...metadata, action: 'RESERVE_FOR_WITHDRAWAL' },
        created_at: new Date().toISOString(),
      };

      await db.saveBalance(balance);
      await db.createTransaction(transaction);

      return { balance, transaction };
    });
  }

  /**
   * Releases or finalizes a reserved balance.
   * If shouldDebit is true: deduction is finalized (completed withdrawal).
   * If shouldDebit is false: reservation is cancelled and returned to available_balance.
   */
  public static async release(
    userId: string,
    amountStr: string | number,
    shouldDebit: boolean,
    type: TransactionType = shouldDebit ? 'WITHDRAWAL' : 'REVERSAL',
    referenceId?: string,
    metadata?: Record<string, any>
  ): Promise<{ balance: UserBalance; transaction?: Transaction }> {
    const amount = new Decimal(amountStr);
    if (amount.lessThanOrEqualTo(0)) {
      throw new Error('Release amount must be greater than zero');
    }

    return await db.withUserLock(userId, async () => {
      const balance = await db.getBalance(userId);
      if (!balance) {
        throw new Error('User balance record not found');
      }

      const available = new Decimal(balance.available_balance);
      const reserved = new Decimal(balance.reserved_balance);

      if (reserved.lessThan(amount)) {
        throw new Error('Reserved balance is less than release amount');
      }

      let tx: Transaction | undefined;

      if (shouldDebit) {
        // Finalize deduction from reserved
        balance.reserved_balance = reserved.minus(amount).toFixed(8);
        balance.updated_at = new Date().toISOString();

        tx = {
          id: crypto.randomUUID(),
          user_id: userId,
          type,
          amount: amount.toFixed(8),
          balance_before: available.toFixed(8),
          balance_after: available.toFixed(8),
          status: 'COMPLETED',
          reference_id: referenceId,
          metadata: { ...metadata, action: 'WITHDRAWAL_FINALIZED' },
          created_at: new Date().toISOString(),
        };
      } else {
        // Return to available
        const newAvailable = available.plus(amount);
        balance.available_balance = newAvailable.toFixed(8);
        balance.reserved_balance = reserved.minus(amount).toFixed(8);
        balance.updated_at = new Date().toISOString();

        tx = {
          id: crypto.randomUUID(),
          user_id: userId,
          type: 'REVERSAL',
          amount: amount.toFixed(8),
          balance_before: available.toFixed(8),
          balance_after: newAvailable.toFixed(8),
          status: 'COMPLETED',
          reference_id: referenceId,
          metadata: { ...metadata, action: 'WITHDRAWAL_REFUNDED' },
          created_at: new Date().toISOString(),
        };
      }

      await db.saveBalance(balance);
      if (tx) {
        await db.createTransaction(tx);
      }

      return { balance, transaction: tx };
    });
  }
}
