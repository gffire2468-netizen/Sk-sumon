import { ConfigService } from '../config/configService';
import { db } from '../db/database';
import { UserService } from './userService';

// Idempotency cache for Telegram update IDs
const processedUpdateIds = new Set<number>();

export class TelegramBotService {
  /**
   * Health diagnostic check endpoint helper (Requirement 54).
   * Safe information only; NEVER exposes secrets.
   */
  public static getWebhookHealth() {
    const token = ConfigService.getTelegramBotToken();
    const webhookSecret = ConfigService.getTelegramWebhookSecret();
    const botUsername = ConfigService.getTelegramBotUsername();
    const appUrl = ConfigService.getAppBaseUrl();

    return {
      status: 'healthy',
      botConfigured: Boolean(token),
      botUsername,
      webhookSecretConfigured: Boolean(webhookSecret),
      appUrlConfigured: Boolean(appUrl),
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Sends a message via Telegram Bot API with an optional Mini App launch button.
   */
  public static async sendTelegramMessage(
    chatId: number | string,
    text: string,
    includeLaunchButton = true
  ): Promise<boolean> {
    const token = ConfigService.getTelegramBotToken();
    if (!token) {
      console.log(`[TelegramBot] (Demo Mode) Message to ${chatId}: ${text}`);
      return true;
    }

    const appUrl = ConfigService.getAppBaseUrl();
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    };

    if (includeLaunchButton && appUrl) {
      payload.reply_markup = {
        inline_keyboard: [
          [
            {
              text: '🚀 Open SKX Mining',
              web_app: { url: appUrl },
            },
          ],
          [
            {
              text: '👥 Join Community',
              url: ConfigService.get('COMMUNITY_INVITE_LINK'),
            },
          ],
        ],
      };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as any;
      return Boolean(data.ok);
    } catch (err) {
      console.error('[TelegramBot] Failed to send message:', err);
      return false;
    }
  }

  /**
   * Registers webhook with official Telegram Bot API.
   */
  public static async setupWebhook(webhookUrl: string, secretToken?: string): Promise<{ success: boolean; result?: any }> {
    const token = ConfigService.getTelegramBotToken();
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }

    const payload: Record<string, any> = {
      url: webhookUrl,
      drop_pending_updates: true,
      allowed_updates: ['message', 'callback_query'],
    };

    if (secretToken) {
      payload.secret_token = secretToken;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as any;
    return { success: Boolean(data.ok), result: data };
  }

  /**
   * Processes incoming Telegram webhook updates with idempotency and command parsing.
   */
  public static async handleWebhookUpdate(update: any, secretHeader?: string): Promise<boolean> {
    const expectedSecret = ConfigService.getTelegramWebhookSecret();
    if (expectedSecret && secretHeader !== expectedSecret) {
      throw new Error('Unauthorized webhook secret token');
    }

    if (!update || typeof update.update_id !== 'number') {
      return false;
    }

    // Idempotency: Prevent double processing
    if (processedUpdateIds.has(update.update_id)) {
      return true;
    }
    processedUpdateIds.add(update.update_id);
    if (processedUpdateIds.size > 10000) {
      const first = processedUpdateIds.values().next().value;
      if (first !== undefined) processedUpdateIds.delete(first);
    }

    const message = update.message;
    if (!message || !message.text) return true;

    const chatId = message.chat.id;
    const text: string = message.text.trim();
    const from = message.from;

    if (!from) return true;

    // Handle commands
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const startParam = parts.length > 1 ? parts[1] : undefined;

      await UserService.getOrCreateUser(from, startParam);

      const welcomeMsg = `⚡ <b>WELCOME TO SKX MINING</b> ⚡\n\n` +
        `⛏️ <i>Tap-to-Mine futuristic reward engine</i>\n` +
        `🔋 Energy regenerates automatically every second\n` +
        `⏱️ Hourly mining cycle gives +0.05 SKX\n` +
        `👥 Earn +0.2 SKX per active referral\n` +
        `💳 Withdraw via bKash, Nagad, or Rocket\n\n` +
        `Click below to launch the Mini App!`;

      await this.sendTelegramMessage(chatId, welcomeMsg, true);
    } else if (text.startsWith('/help')) {
      const helpMsg = `📖 <b>SKX MINING COMMANDS</b>\n\n` +
        `/start - Launch the Mining Mini App\n` +
        `/balance - View your current SKX balance\n` +
        `/reward - Check daily and hourly rewards\n` +
        `/referral - Get your unique invite link\n` +
        `/leaderboard - View top miners\n` +
        `/profile - View your miner status\n` +
        `/withdraw - Check withdrawal eligibility`;
      await this.sendTelegramMessage(chatId, helpMsg, true);
    } else if (text.startsWith('/balance')) {
      const user = await db.getUserByTelegramId(from.id.toString());
      if (user) {
        const bal = await db.getBalance(user.id);
        const msg = `💰 <b>YOUR SKX BALANCE</b>\n\n` +
          `Available: <b>${bal?.available_balance || '0.00000000'} SKX</b>\n` +
          `Reserved: ${bal?.reserved_balance || '0.00000000'} SKX\n` +
          `Total Earned: ${bal?.total_earned || '0.00000000'} SKX`;
        await this.sendTelegramMessage(chatId, msg, true);
      } else {
        await this.sendTelegramMessage(chatId, 'Please type /start to create your mining account first!', true);
      }
    } else if (text.startsWith('/referral')) {
      const user = await db.getUserByTelegramId(from.id.toString());
      if (user) {
        const validCount = await db.getValidReferralsCount(user.id);
        const botUsername = ConfigService.getTelegramBotUsername();
        const link = `https://t.me/${botUsername}?start=ref_${user.telegram_id}`;
        const msg = `👥 <b>REFERRAL PROGRAM</b>\n\n` +
          `Your Link: <code>${link}</code>\n` +
          `Valid Referrals: <b>${validCount} / 4</b> (4 required for withdrawal)\n` +
          `Reward per referral: <b>+0.2 SKX</b>`;
        await this.sendTelegramMessage(chatId, msg, true);
      } else {
        await this.sendTelegramMessage(chatId, 'Please type /start first!', true);
      }
    } else if (text.startsWith('/withdraw')) {
      const user = await db.getUserByTelegramId(from.id.toString());
      if (user) {
        const bal = await db.getBalance(user.id);
        const validCount = await db.getValidReferralsCount(user.id);
        const minW = ConfigService.get('MIN_WITHDRAWAL');
        const reqRef = ConfigService.get('REQUIRED_REFERRALS');

        const can = parseFloat(bal?.available_balance || '0') >= parseFloat(minW) && validCount >= reqRef;
        const msg = `💳 <b>WITHDRAWAL STATUS</b>\n\n` +
          `Available Balance: ${bal?.available_balance || '0.0000'} SKX (Min: ${minW} SKX)\n` +
          `Valid Referrals: ${validCount} / ${reqRef}\n` +
          `Status: <b>${can ? '✅ ELIGIBLE' : '❌ LOCKED'}</b>\n\n` +
          `Open the Mini App to withdraw via bKash / Nagad / Rocket.`;
        await this.sendTelegramMessage(chatId, msg, true);
      }
    } else {
      await this.sendTelegramMessage(chatId, 'Type /help to see all available commands, or launch SKX Mining below:', true);
    }

    return true;
  }
}
