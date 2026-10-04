import { describe, it, expect } from 'vitest';
import { EnvValidator } from '../src/server/config/envValidator';
import { db } from '../src/server/db/database';
import { ConfigService } from '../src/server/config/configService';

describe('Environment Variable Handling & Conditional Validation (Tests 1-13)', () => {
  const baseValidSecrets = {
    TELEGRAM_BOT_TOKEN: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ',
    TELEGRAM_WEBHOOK_SECRET: 'super_secret_webhook_token',
    TELEGRAM_BOT_USERNAME: 'SKXMiningBot',
    ADMIN_JWT_SECRET: 'jwt_secret_with_sufficient_length_32_chars',
    ADMIN_DEFAULT_USERNAME: 'admin',
    ADMIN_DEFAULT_PASSWORD: 'admin12345_password',
  };

  // TEST 1: DEMO_MODE=true & DATABASE_URL missing -> starts successfully
  it('TEST 1: DEMO_MODE=true and DATABASE_URL missing starts successfully with in-memory store', async () => {
    const env = {
      ...baseValidSecrets,
      DEMO_MODE: 'true',
      DATABASE_URL: '',
    };
    const result = EnvValidator.validate(env);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.statusSummary.database).toBe('IN_MEMORY_DEMO');
  });

  // TEST 2: REDIS_URL missing -> starts successfully
  it('TEST 2: REDIS_URL missing starts successfully with in-memory fallback', () => {
    const env = {
      ...baseValidSecrets,
      DEMO_MODE: 'true',
      REDIS_URL: '',
    };
    const result = EnvValidator.validate(env);
    expect(result.isValid).toBe(true);
    expect(result.statusSummary.redis).toBe('IN_MEMORY_FALLBACK');
  });

  // TEST 3: BKASH_ENABLED=false & bKash credentials missing -> starts successfully
  it('TEST 3: BKASH_ENABLED=false with missing bKash credentials starts successfully', () => {
    const env = {
      ...baseValidSecrets,
      BKASH_ENABLED: 'false',
      BKASH_BASE_URL: '',
      BKASH_APP_KEY: '',
      BKASH_APP_SECRET: '',
      BKASH_USERNAME: '',
      BKASH_PASSWORD: '',
    };
    const result = EnvValidator.validate(env);
    expect(result.isValid).toBe(true);
    expect(result.statusSummary.bKash).toBe('DISABLED');
  });

  // TEST 4: NAGAD_ENABLED=false & Nagad credentials missing -> starts successfully
  it('TEST 4: NAGAD_ENABLED=false with missing Nagad credentials starts successfully', () => {
    const env = {
      ...baseValidSecrets,
      NAGAD_ENABLED: 'false',
      NAGAD_BASE_URL: '',
      NAGAD_MERCHANT_ID: '',
      NAGAD_MERCHANT_KEY: '',
    };
    const result = EnvValidator.validate(env);
    expect(result.isValid).toBe(true);
    expect(result.statusSummary.nagad).toBe('DISABLED');
  });

  // TEST 5: ROCKET_ENABLED=false & Rocket credentials missing -> starts successfully
  it('TEST 5: ROCKET_ENABLED=false with missing Rocket credentials starts successfully', () => {
    const env = {
      ...baseValidSecrets,
      ROCKET_ENABLED: 'false',
      ROCKET_BASE_URL: '',
      ROCKET_API_KEY: '',
      ROCKET_SECRET: '',
    };
    const result = EnvValidator.validate(env);
    expect(result.isValid).toBe(true);
    expect(result.statusSummary.rocket).toBe('DISABLED');
  });

  // TEST 6: COMMUNITY_REWARD_ENABLED=false & Community credentials missing -> starts successfully
  it('TEST 6: COMMUNITY_REWARD_ENABLED=false with missing community credentials starts successfully', () => {
    const env = {
      ...baseValidSecrets,
      COMMUNITY_REWARD_ENABLED: 'false',
      COMMUNITY_CHAT_ID: '',
      COMMUNITY_INVITE_LINK: '',
    };
    const result = EnvValidator.validate(env);
    expect(result.isValid).toBe(true);
    expect(result.statusSummary.community).toBe('DISABLED');
  });

  // TEST 7: ADS_ENABLED=false & all ad credentials missing -> starts successfully
  it('TEST 7: ADS_ENABLED=false with all ad provider credentials missing starts successfully', () => {
    const env = {
      ...baseValidSecrets,
      ADS_ENABLED: 'false',
      MONETAG_AD_TAG: '',
      ADSTERRA_ZONE_ID: '',
      GENERIC_AD_TAG: '',
    };
    const result = EnvValidator.validate(env);
    expect(result.isValid).toBe(true);
    expect(result.statusSummary.ads).toBe('DISABLED');
  });

  // TEST 8: MONETAG_ENABLED=false & MONETAG_AD_TAG missing -> starts successfully
  it('TEST 8: MONETAG_ENABLED=false with missing MONETAG_AD_TAG starts successfully', () => {
    const env = {
      ...baseValidSecrets,
      MONETAG_ENABLED: 'false',
      MONETAG_AD_TAG: '',
    };
    const result = EnvValidator.validate(env);
    expect(result.isValid).toBe(true);
    expect(result.statusSummary.monetag).toBe('DISABLED');
  });

  // TEST 9: ADSTERRA_ENABLED=false & ADSTERRA_ZONE_ID missing -> starts successfully
  it('TEST 9: ADSTERRA_ENABLED=false with missing ADSTERRA_ZONE_ID starts successfully', () => {
    const env = {
      ...baseValidSecrets,
      ADSTERRA_ENABLED: 'false',
      ADSTERRA_ZONE_ID: '',
    };
    const result = EnvValidator.validate(env);
    expect(result.isValid).toBe(true);
    expect(result.statusSummary.adsterra).toBe('DISABLED');
  });

  // TEST 10: GENERIC_AD_ENABLED=false & GENERIC_AD_TAG missing -> starts successfully
  it('TEST 10: GENERIC_AD_ENABLED=false with missing GENERIC_AD_TAG starts successfully', () => {
    const env = {
      ...baseValidSecrets,
      GENERIC_AD_ENABLED: 'false',
      GENERIC_AD_TAG: '',
    };
    const result = EnvValidator.validate(env);
    expect(result.isValid).toBe(true);
    expect(result.statusSummary.genericAd).toBe('DISABLED');
  });

  // TEST 11: Required Telegram/admin secrets present -> starts successfully
  it('TEST 11: Required Telegram and admin secrets present starts successfully', () => {
    const result = EnvValidator.validate(baseValidSecrets);
    expect(result.isValid).toBe(true);
    expect(result.missingRequired.length).toBe(0);
  });

  // TEST 12: DEMO_MODE=false and DATABASE_URL missing -> clear error
  it('TEST 12: DEMO_MODE=false and DATABASE_URL missing yields clear error', async () => {
    const env = {
      ...baseValidSecrets,
      DEMO_MODE: 'false',
      DATABASE_URL: '',
    };
    const result = EnvValidator.validate(env);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('DATABASE_URL is required when DEMO_MODE=false.');

    // Also test db.initialize()
    ConfigService.setDynamicOverride('DEMO_MODE', 'false');
    ConfigService.setDynamicOverride('DATABASE_URL', '');
    await expect(db.initialize()).rejects.toThrow(/DATABASE_URL is required when DEMO_MODE=false/);
    ConfigService.setDynamicOverride('DEMO_MODE', 'true');
  });

  // TEST 13: BKASH_ENABLED=true but credentials missing -> clear error for bKash only, unrelated features continue safely
  it('TEST 13: BKASH_ENABLED=true with missing credentials flags bKash error without crashing unrelated features', () => {
    const env = {
      ...baseValidSecrets,
      BKASH_ENABLED: 'true',
      BKASH_BASE_URL: '',
      BKASH_APP_KEY: '',
      BKASH_APP_SECRET: '',
      BKASH_USERNAME: '',
      BKASH_PASSWORD: '',
    };
    const result = EnvValidator.validate(env);
    expect(result.statusSummary.bKash).toBe('ENABLED_MISCONFIGURED');
    expect(result.conditionalErrors.some((c) => c.feature === 'bKash Gateway')).toBe(true);
    // Unrelated features remain valid
    expect(result.statusSummary.database).toBe('IN_MEMORY_DEMO');
    expect(result.statusSummary.redis).toBe('IN_MEMORY_FALLBACK');
  });

  // TEST 14: APP_BASE_URL is optional during DEMO_MODE=true
  it('TEST 14: APP_BASE_URL is optional during DEMO_MODE=true and defaults safely', () => {
    const env = {
      ...baseValidSecrets,
      DEMO_MODE: 'true',
      APP_BASE_URL: '',
    };
    const result = EnvValidator.validate(env);
    expect(result.isValid).toBe(true);
    expect(ConfigService.getAppBaseUrl()).toBeDefined();
  });

  // TEST 15: DAILY_REWARD_MODE is optional and defaults to DAILY_BONUS
  it('TEST 15: DAILY_REWARD_MODE is optional and defaults to DAILY_BONUS', () => {
    delete process.env.DAILY_REWARD_MODE;
    expect(ConfigService.get('DAILY_REWARD_MODE')).toBe('DAILY_BONUS');

    ConfigService.setDynamicOverride('DAILY_REWARD_MODE', 'ADS');
    expect(ConfigService.get('DAILY_REWARD_MODE')).toBe('ADS');

    ConfigService.setDynamicOverride('DAILY_REWARD_MODE', 'BOTH');
    expect(ConfigService.get('DAILY_REWARD_MODE')).toBe('BOTH');

    ConfigService.setDynamicOverride('DAILY_REWARD_MODE', 'DAILY_BONUS');
  });

  // TEST 16: DAILY_REWARD_BASE_REWARD is optional and defaults to 0.01
  it('TEST 16: DAILY_REWARD_BASE_REWARD is optional and uses configured default', () => {
    delete process.env.DAILY_REWARD_BASE_REWARD;
    delete process.env.DAILY_REWARD_BASE;
    expect(ConfigService.get('DAILY_REWARD_BASE')).toBe('0.01');
    expect(ConfigService.get('DAILY_REWARD_BASE_REWARD')).toBe('0.01');
  });
});
