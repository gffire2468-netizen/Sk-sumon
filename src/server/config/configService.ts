import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

export interface SystemConfig {
  TAP_REWARD: string;
  ENERGY_PER_TAP: number;
  MAX_ENERGY: number;
  ENERGY_REGEN_RATE: number; // units per second
  MINING_CYCLE_DURATION: number; // in seconds
  MINING_CYCLE_REWARD: string;
  REQUIRED_REFERRALS: number;
  REFERRAL_REWARD: string;
  MIN_WITHDRAWAL: string;
  MAX_WITHDRAWAL: string;
  WITHDRAWAL_FEE_TYPE: 'FIXED' | 'PERCENTAGE';
  WITHDRAWAL_FEE_VALUE: string;
  DAILY_WITHDRAWAL_LIMIT: string;
  COMMUNITY_REWARD_ENABLED: boolean;
  COMMUNITY_CHAT_ID: string;
  COMMUNITY_INVITE_LINK: string;
  COMMUNITY_REWARD: string;
  SUPPORT_ENABLED: boolean;
  ADS_ENABLED: boolean;
  AD_REWARD: string;
  DAILY_AD_LIMIT: number;
  DAILY_AD_REWARD: string;
  TAP_AD_TRIGGER_ENABLED: boolean;
  TAP_AD_THRESHOLD: number;
  DAILY_REWARD_MODE: 'DAILY_BONUS' | 'ADS' | 'BOTH';
  DAILY_REWARD_BASE: string;
  DAILY_REWARD_BASE_REWARD: string;
  BKASH_ENABLED: boolean;
  BKASH_BASE_URL: string;
  BKASH_APP_KEY: string;
  BKASH_APP_SECRET: string;
  BKASH_USERNAME: string;
  BKASH_PASSWORD: string;
  NAGAD_ENABLED: boolean;
  NAGAD_BASE_URL: string;
  NAGAD_MERCHANT_ID: string;
  NAGAD_MERCHANT_KEY: string;
  ROCKET_ENABLED: boolean;
  ROCKET_BASE_URL: string;
  ROCKET_API_KEY: string;
  ROCKET_SECRET: string;
  MONETAG_ENABLED: boolean;
  MONETAG_AD_TAG: string;
  ADSTERRA_ENABLED: boolean;
  ADSTERRA_ZONE_ID: string;
  GENERIC_AD_ENABLED: boolean;
  GENERIC_AD_TAG: string;
  DEMO_MODE: boolean;
  SKX_USD_RATE: string;
  SKX_BDT_RATE: string;
}

// Generate an in-memory fallback secret if ADMIN_JWT_SECRET is missing
const fallbackJwtSecret = crypto.randomBytes(32).toString('hex');

class ConfigServiceImpl {
  private dynamicOverrides: Map<string, string> = new Map();

  public getJwtSecret(): string {
    return process.env.ADMIN_JWT_SECRET?.trim() || fallbackJwtSecret;
  }

  public getTelegramBotToken(): string {
    return process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
  }

  public getTelegramWebhookSecret(): string {
    return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || '';
  }

  public getTelegramBotUsername(): string {
    return process.env.TELEGRAM_BOT_USERNAME?.trim() || 'SKXMiningBot';
  }

  public getAppBaseUrl(): string {
    return process.env.APP_BASE_URL?.trim() || process.env.APP_URL?.trim() || 'http://localhost:3000';
  }

  public getDatabaseUrl(): string {
    return process.env.DATABASE_URL?.trim() || '';
  }

  public getRedisUrl(): string {
    return process.env.REDIS_URL?.trim() || '';
  }

  public setDynamicOverride(key: string, value: string): void {
    this.dynamicOverrides.set(key, value);
  }

  public get<K extends keyof SystemConfig>(key: K): SystemConfig[K] {
    const raw = this.dynamicOverrides.get(key) ?? process.env[key];

    switch (key) {
      case 'TAP_REWARD':
        return (raw ?? '0.0001') as SystemConfig[K];
      case 'ENERGY_PER_TAP':
        return (raw !== undefined ? parseInt(raw, 10) : 1) as SystemConfig[K];
      case 'MAX_ENERGY':
        return (raw !== undefined ? parseInt(raw, 10) : 1000) as SystemConfig[K];
      case 'ENERGY_REGEN_RATE':
        return (raw !== undefined ? parseFloat(raw) : 1) as SystemConfig[K];
      case 'MINING_CYCLE_DURATION':
        return (raw !== undefined ? parseInt(raw, 10) : 3600) as SystemConfig[K];
      case 'MINING_CYCLE_REWARD':
        return (raw ?? '0.05') as SystemConfig[K];
      case 'REQUIRED_REFERRALS':
        return (raw !== undefined ? parseInt(raw, 10) : 4) as SystemConfig[K];
      case 'REFERRAL_REWARD':
        return (raw ?? '0.2') as SystemConfig[K];
      case 'MIN_WITHDRAWAL':
        return (raw ?? '5') as SystemConfig[K];
      case 'MAX_WITHDRAWAL':
        return (raw ?? '1000') as SystemConfig[K];
      case 'WITHDRAWAL_FEE_TYPE':
        return ((raw === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED')) as SystemConfig[K];
      case 'WITHDRAWAL_FEE_VALUE':
        return (raw ?? '10') as SystemConfig[K];
      case 'DAILY_WITHDRAWAL_LIMIT':
        return (raw ?? '5000') as SystemConfig[K];
      case 'COMMUNITY_REWARD_ENABLED':
        return (raw === 'true') as SystemConfig[K];
      case 'COMMUNITY_CHAT_ID':
        return (raw ?? '') as SystemConfig[K];
      case 'COMMUNITY_INVITE_LINK':
        return (raw ?? 'https://t.me/SKXMiningCommunity') as SystemConfig[K];
      case 'COMMUNITY_REWARD':
        return (raw ?? '0.1') as SystemConfig[K];
      case 'SUPPORT_ENABLED':
        return (raw !== undefined ? raw === 'true' : true) as SystemConfig[K];
      case 'ADS_ENABLED':
        return (raw === 'true') as SystemConfig[K];
      case 'AD_REWARD':
        return (raw ?? '0.001') as SystemConfig[K];
      case 'DAILY_AD_LIMIT':
        return (raw !== undefined ? parseInt(raw, 10) : 20) as SystemConfig[K];
      case 'DAILY_AD_REWARD':
        return (raw ?? '0.020') as SystemConfig[K];
      case 'TAP_AD_TRIGGER_ENABLED':
        return (raw === 'true') as SystemConfig[K];
      case 'TAP_AD_THRESHOLD':
        return (raw !== undefined ? parseInt(raw, 10) : 100) as SystemConfig[K];
      case 'DAILY_REWARD_MODE':
        return ((raw === 'ADS' || raw === 'BOTH' ? raw : 'DAILY_BONUS')) as SystemConfig[K];
      case 'DAILY_REWARD_BASE':
      case 'DAILY_REWARD_BASE_REWARD': {
        const val =
          this.dynamicOverrides.get('DAILY_REWARD_BASE_REWARD') ??
          this.dynamicOverrides.get('DAILY_REWARD_BASE') ??
          process.env.DAILY_REWARD_BASE_REWARD ??
          process.env.DAILY_REWARD_BASE ??
          '0.01';
        return val as SystemConfig[K];
      }
      case 'BKASH_ENABLED':
        return (raw === 'true') as SystemConfig[K];
      case 'BKASH_BASE_URL':
        return (raw ?? '') as SystemConfig[K];
      case 'BKASH_APP_KEY':
        return (raw ?? '') as SystemConfig[K];
      case 'BKASH_APP_SECRET':
        return (raw ?? '') as SystemConfig[K];
      case 'BKASH_USERNAME':
        return (raw ?? '') as SystemConfig[K];
      case 'BKASH_PASSWORD':
        return (raw ?? '') as SystemConfig[K];
      case 'NAGAD_ENABLED':
        return (raw === 'true') as SystemConfig[K];
      case 'NAGAD_BASE_URL':
        return (raw ?? '') as SystemConfig[K];
      case 'NAGAD_MERCHANT_ID':
        return (raw ?? '') as SystemConfig[K];
      case 'NAGAD_MERCHANT_KEY':
        return (raw ?? '') as SystemConfig[K];
      case 'ROCKET_ENABLED':
        return (raw === 'true') as SystemConfig[K];
      case 'ROCKET_BASE_URL':
        return (raw ?? '') as SystemConfig[K];
      case 'ROCKET_API_KEY':
        return (raw ?? '') as SystemConfig[K];
      case 'ROCKET_SECRET':
        return (raw ?? '') as SystemConfig[K];
      case 'MONETAG_ENABLED':
        return (raw === 'true') as SystemConfig[K];
      case 'MONETAG_AD_TAG':
        return (raw ?? '') as SystemConfig[K];
      case 'ADSTERRA_ENABLED':
        return (raw === 'true') as SystemConfig[K];
      case 'ADSTERRA_ZONE_ID':
        return (raw ?? '') as SystemConfig[K];
      case 'GENERIC_AD_ENABLED':
        return (raw === 'true') as SystemConfig[K];
      case 'GENERIC_AD_TAG':
        return (raw ?? '') as SystemConfig[K];
      case 'DEMO_MODE':
        return (raw !== undefined ? raw.toLowerCase() !== 'false' && raw !== '0' : true) as SystemConfig[K];
      case 'SKX_USD_RATE':
        return (raw ?? '1') as SystemConfig[K];
      case 'SKX_BDT_RATE':
        return (raw ?? '100') as SystemConfig[K];
      default:
        return raw as SystemConfig[K];
    }
  }

  public getAll(): SystemConfig {
    return {
      TAP_REWARD: this.get('TAP_REWARD'),
      ENERGY_PER_TAP: this.get('ENERGY_PER_TAP'),
      MAX_ENERGY: this.get('MAX_ENERGY'),
      ENERGY_REGEN_RATE: this.get('ENERGY_REGEN_RATE'),
      MINING_CYCLE_DURATION: this.get('MINING_CYCLE_DURATION'),
      MINING_CYCLE_REWARD: this.get('MINING_CYCLE_REWARD'),
      REQUIRED_REFERRALS: this.get('REQUIRED_REFERRALS'),
      REFERRAL_REWARD: this.get('REFERRAL_REWARD'),
      MIN_WITHDRAWAL: this.get('MIN_WITHDRAWAL'),
      MAX_WITHDRAWAL: this.get('MAX_WITHDRAWAL'),
      WITHDRAWAL_FEE_TYPE: this.get('WITHDRAWAL_FEE_TYPE'),
      WITHDRAWAL_FEE_VALUE: this.get('WITHDRAWAL_FEE_VALUE'),
      DAILY_WITHDRAWAL_LIMIT: this.get('DAILY_WITHDRAWAL_LIMIT'),
      COMMUNITY_REWARD_ENABLED: this.get('COMMUNITY_REWARD_ENABLED'),
      COMMUNITY_CHAT_ID: this.get('COMMUNITY_CHAT_ID'),
      COMMUNITY_INVITE_LINK: this.get('COMMUNITY_INVITE_LINK'),
      COMMUNITY_REWARD: this.get('COMMUNITY_REWARD'),
      SUPPORT_ENABLED: this.get('SUPPORT_ENABLED'),
      ADS_ENABLED: this.get('ADS_ENABLED'),
      AD_REWARD: this.get('AD_REWARD'),
      DAILY_AD_LIMIT: this.get('DAILY_AD_LIMIT'),
      DAILY_AD_REWARD: this.get('DAILY_AD_REWARD'),
      TAP_AD_TRIGGER_ENABLED: this.get('TAP_AD_TRIGGER_ENABLED'),
      TAP_AD_THRESHOLD: this.get('TAP_AD_THRESHOLD'),
      DAILY_REWARD_MODE: this.get('DAILY_REWARD_MODE'),
      DAILY_REWARD_BASE: this.get('DAILY_REWARD_BASE'),
      DAILY_REWARD_BASE_REWARD: this.get('DAILY_REWARD_BASE_REWARD'),
      BKASH_ENABLED: this.get('BKASH_ENABLED'),
      BKASH_BASE_URL: this.get('BKASH_BASE_URL'),
      BKASH_APP_KEY: this.get('BKASH_APP_KEY'),
      BKASH_APP_SECRET: this.get('BKASH_APP_SECRET'),
      BKASH_USERNAME: this.get('BKASH_USERNAME'),
      BKASH_PASSWORD: this.get('BKASH_PASSWORD'),
      NAGAD_ENABLED: this.get('NAGAD_ENABLED'),
      NAGAD_BASE_URL: this.get('NAGAD_BASE_URL'),
      NAGAD_MERCHANT_ID: this.get('NAGAD_MERCHANT_ID'),
      NAGAD_MERCHANT_KEY: this.get('NAGAD_MERCHANT_KEY'),
      ROCKET_ENABLED: this.get('ROCKET_ENABLED'),
      ROCKET_BASE_URL: this.get('ROCKET_BASE_URL'),
      ROCKET_API_KEY: this.get('ROCKET_API_KEY'),
      ROCKET_SECRET: this.get('ROCKET_SECRET'),
      MONETAG_ENABLED: this.get('MONETAG_ENABLED'),
      MONETAG_AD_TAG: this.get('MONETAG_AD_TAG'),
      ADSTERRA_ENABLED: this.get('ADSTERRA_ENABLED'),
      ADSTERRA_ZONE_ID: this.get('ADSTERRA_ZONE_ID'),
      GENERIC_AD_ENABLED: this.get('GENERIC_AD_ENABLED'),
      GENERIC_AD_TAG: this.get('GENERIC_AD_TAG'),
      DEMO_MODE: this.get('DEMO_MODE'),
      SKX_USD_RATE: this.get('SKX_USD_RATE'),
      SKX_BDT_RATE: this.get('SKX_BDT_RATE'),
    };
  }
}

export const ConfigService = new ConfigServiceImpl();
