import crypto from 'crypto';
import { ConfigService } from '../config/configService';

export interface TelegramUserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface ValidatedInitData {
  user: TelegramUserData;
  auth_date: number;
  hash: string;
  start_param?: string;
  query_id?: string;
}

export class TelegramAuthService {
  /**
   * Validates Telegram WebApp initData query string using HMAC-SHA256.
   * Returns parsed user and payload if valid; throws if invalid.
   */
  public static validateInitData(initDataStr: string): ValidatedInitData {
    if (!initDataStr || typeof initDataStr !== 'string') {
      throw new Error('Missing x-telegram-init-data header');
    }

    const botToken = ConfigService.getTelegramBotToken();

    // Check if DEMO_MODE is allowed for simulated dev sessions
    if (initDataStr.startsWith('demo_user_')) {
      const isDemo = ConfigService.get('DEMO_MODE');
      if (!isDemo) {
        throw new Error('Demo mode is disabled in production environment');
      }
      const demoIdStr = initDataStr.replace('demo_user_', '');
      const parsedId = parseInt(demoIdStr, 10) || 9999001;
      return {
        user: {
          id: parsedId,
          first_name: `DemoMiner_${parsedId.toString().slice(-4)}`,
          username: `demo_miner_${parsedId}`,
          language_code: 'en',
        },
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'demo_simulated_hash',
      };
    }

    if (!botToken) {
      // In DEMO_MODE, if bot token is not configured yet, allow demo session
      if (ConfigService.get('DEMO_MODE')) {
        return {
          user: {
            id: 1001,
            first_name: 'SKX Pilot',
            username: 'skx_pilot',
            language_code: 'en',
          },
          auth_date: Math.floor(Date.now() / 1000),
          hash: 'demo_fallback_hash',
        };
      }
      throw new Error('TELEGRAM_BOT_TOKEN is not configured on the server');
    }

    const params = new URLSearchParams(initDataStr);
    const hash = params.get('hash');
    if (!hash) {
      throw new Error('Telegram initData missing hash');
    }

    // Sort key=value pairs alphabetically excluding 'hash'
    const dataCheckArr: string[] = [];
    params.forEach((val, key) => {
      if (key !== 'hash') {
        dataCheckArr.push(`${key}=${val}`);
      }
    });
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    // Telegram HMAC verification
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      throw new Error('Invalid Telegram initData signature');
    }

    const authDateStr = params.get('auth_date');
    const authDate = authDateStr ? parseInt(authDateStr, 10) : 0;
    const now = Math.floor(Date.now() / 1000);

    // Expire initData older than 24 hours (86400 seconds)
    if (now - authDate > 86400) {
      throw new Error('Telegram initData has expired');
    }

    const userRaw = params.get('user');
    if (!userRaw) {
      throw new Error('Telegram initData missing user payload');
    }

    let user: TelegramUserData;
    try {
      user = JSON.parse(userRaw);
    } catch {
      throw new Error('Invalid Telegram user JSON');
    }

    const startParam = params.get('start_param') || undefined;
    const queryId = params.get('query_id') || undefined;

    return {
      user,
      auth_date: authDate,
      hash,
      start_param: startParam,
      query_id: queryId,
    };
  }
}
