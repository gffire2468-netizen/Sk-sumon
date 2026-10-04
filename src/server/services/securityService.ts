import crypto from 'crypto';
import { db } from '../db/database';
import { AuditLog, SecurityEvent } from '../types';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class SecurityService {
  private static rateLimits: Map<string, RateLimitEntry> = new Map();

  /**
   * Safe in-memory rate limiter with sliding window.
   */
  public static checkRateLimit(
    key: string,
    limit: number,
    windowMs: number
  ): { allowed: boolean; remaining: number; resetInMs: number } {
    const now = Date.now();
    const entry = this.rateLimits.get(key);

    if (!entry || now > entry.resetAt) {
      this.rateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, resetInMs: windowMs };
    }

    if (entry.count >= limit) {
      return { allowed: false, remaining: 0, resetInMs: Math.max(0, entry.resetAt - now) };
    }

    entry.count++;
    return { allowed: true, remaining: limit - entry.count, resetInMs: Math.max(0, entry.resetAt - now) };
  }

  /**
   * Records a security event.
   */
  public static async recordEvent(params: {
    userId?: string;
    eventType: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    details: Record<string, any>;
    ip?: string;
  }): Promise<SecurityEvent> {
    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      user_id: params.userId,
      event_type: params.eventType,
      severity: params.severity,
      details: params.details,
      ip: params.ip,
      created_at: new Date().toISOString(),
    };

    return await db.createSecurityEvent(event);
  }

  /**
   * Records an administrative action to the immutable audit log.
   */
  public static async recordAuditLog(params: {
    adminId: string;
    adminUsername: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, any>;
  }): Promise<AuditLog> {
    const log: AuditLog = {
      id: crypto.randomUUID(),
      admin_id: params.adminId,
      admin_username: params.adminUsername,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      metadata: params.metadata,
      created_at: new Date().toISOString(),
    };

    return await db.createAuditLog(log);
  }
}
