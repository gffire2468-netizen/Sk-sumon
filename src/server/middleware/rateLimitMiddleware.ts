import { Request, Response, NextFunction } from 'express';
import { SecurityService } from '../services/securityService';

export function createRateLimiter(limit: number, windowMs: number, keyPrefix: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;

    const { allowed, remaining, resetInMs } = SecurityService.checkRateLimit(key, limit, windowMs);
    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetInMs / 1000).toString());

    if (!allowed) {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please slow down.',
      });
      return;
    }

    next();
  };
}
