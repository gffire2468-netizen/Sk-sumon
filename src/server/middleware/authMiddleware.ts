import { Request, Response, NextFunction } from 'express';
import { TelegramAuthService } from '../services/telegramAuthService';
import { UserService } from '../services/userService';
import { User } from '../types';

export interface AuthenticatedRequest extends Request {
  dbUser?: User;
  tgPayload?: any;
}

export async function telegramAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const initData = (req.headers['x-telegram-init-data'] as string) || '';
    if (!initData) {
      res.status(401).json({
        success: false,
        error: 'Missing x-telegram-init-data header',
      });
      return;
    }

    const validated = TelegramAuthService.validateInitData(initData);
    const { user } = await UserService.getOrCreateUser(validated.user, validated.start_param);

    if (user.is_suspended) {
      res.status(403).json({
        success: false,
        error: `Account suspended. Reason: ${user.suspension_reason || 'Terms violation'}`,
      });
      return;
    }

    req.dbUser = user;
    req.tgPayload = validated;
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: err.message || 'Telegram authentication failed',
    });
  }
}
