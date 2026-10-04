import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Decimal from 'decimal.js';
import { db } from '../db/database';
import { ConfigService } from '../config/configService';
import { BalanceService } from './balanceService';
import { SecurityService } from './securityService';
import { AdminUser, SystemSetting } from '../types';

export class AdminService {
  private static cachedHash: string | null = null;

  /**
   * Initializes default admin if none exists.
   */
  public static async ensureAdminUser(): Promise<void> {
    const defaultUsername = process.env.ADMIN_DEFAULT_USERNAME?.trim() || 'admin';
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD?.trim() || 'admin12345';

    const existing = await db.getAdminByUsername(defaultUsername);
    if (!existing) {
      if (!this.cachedHash) {
        const rounds = process.env.NODE_ENV === 'test' ? 4 : 10;
        this.cachedHash = await bcrypt.hash(defaultPassword, rounds);
      }
      const admin: AdminUser = {
        id: crypto.randomUUID(),
        username: defaultUsername,
        password_hash: this.cachedHash,
        role: 'SUPER_ADMIN',
        created_at: new Date().toISOString(),
      };
      await db.saveAdminUser(admin);
    }
  }

  /**
   * Admin authentication.
   */
  public static async login(username: string, password: string): Promise<{ token: string; admin: { id: string; username: string; role: string } }> {
    if (!username || !password) {
      throw new Error('Invalid credentials');
    }

    await this.ensureAdminUser();

    const admin = await db.getAdminByUsername(username.trim());
    if (!admin) {
      throw new Error('Invalid credentials');
    }

    const matches = await bcrypt.compare(password, admin.password_hash);
    if (!matches) {
      await SecurityService.recordEvent({
        eventType: 'ADMIN_LOGIN_FAILURE',
        severity: 'MEDIUM',
        details: { username },
      });
      throw new Error('Invalid credentials');
    }

    admin.last_login_at = new Date().toISOString();
    await db.saveAdminUser(admin);

    const token = jwt.sign(
      { sub: admin.id, username: admin.username, role: admin.role },
      ConfigService.getJwtSecret(),
      { expiresIn: '24h' }
    );

    await SecurityService.recordAuditLog({
      adminId: admin.id,
      adminUsername: admin.username,
      action: 'ADMIN_LOGIN',
      targetType: 'SYSTEM',
      targetId: 'admin_session',
    });

    return {
      token,
      admin: { id: admin.id, username: admin.username, role: admin.role },
    };
  }

  /**
   * Adjusts a user's balance manually with mandatory reason and ledger tracking.
   */
  public static async adjustBalance(params: {
    userId: string;
    amountStr: string;
    direction: 'CREDIT' | 'DEBIT';
    reason: string;
    adminId: string;
    adminUsername: string;
  }) {
    const { userId, amountStr, direction, reason, adminId, adminUsername } = params;

    if (!reason || reason.trim().length < 4) {
      throw new Error('A detailed reason is required for balance adjustments');
    }

    const amount = new Decimal(amountStr);
    if (amount.lessThanOrEqualTo(0)) {
      throw new Error('Adjustment amount must be positive');
    }

    let result;
    if (direction === 'CREDIT') {
      result = await BalanceService.credit(
        userId,
        amount.toFixed(8),
        'ADMIN_ADJUSTMENT',
        `adj_${Date.now()}`,
        { reason, adminUsername }
      );
    } else {
      result = await BalanceService.debit(
        userId,
        amount.toFixed(8),
        'ADMIN_ADJUSTMENT',
        `adj_${Date.now()}`,
        { reason, adminUsername }
      );
    }

    await SecurityService.recordAuditLog({
      adminId,
      adminUsername,
      action: `BALANCE_ADJUSTMENT_${direction}`,
      targetType: 'USER',
      targetId: userId,
      metadata: { amount: amount.toFixed(8), reason, direction },
    });

    return result;
  }

  /**
   * Suspends or unsuspends a user.
   */
  public static async toggleUserSuspension(params: {
    userId: string;
    suspended: boolean;
    reason: string;
    adminId: string;
    adminUsername: string;
  }) {
    const { userId, suspended, reason, adminId, adminUsername } = params;
    const user = await db.getUserById(userId);
    if (!user) throw new Error('User not found');

    user.is_suspended = suspended;
    user.suspension_reason = suspended ? reason : undefined;
    await db.updateUser(user);

    await SecurityService.recordAuditLog({
      adminId,
      adminUsername,
      action: suspended ? 'USER_SUSPENDED' : 'USER_UNSUSPENDED',
      targetType: 'USER',
      targetId: userId,
      metadata: { reason },
    });

    return user;
  }

  /**
   * Updates system settings with audit log.
   */
  public static async updateSetting(
    key: string,
    value: string,
    adminId: string,
    adminUsername: string,
    description?: string
  ) {
    const setting: SystemSetting = {
      key,
      value,
      description,
      updated_at: new Date().toISOString(),
      updated_by: adminUsername,
    };

    await db.setSystemSetting(setting);
    ConfigService.setDynamicOverride(key, value);

    await SecurityService.recordAuditLog({
      adminId,
      adminUsername,
      action: 'SETTING_UPDATED',
      targetType: 'SETTING',
      targetId: key,
      metadata: { value, description },
    });

    return setting;
  }
}
