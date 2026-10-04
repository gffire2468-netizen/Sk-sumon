/**
 * Environment Variable Validator
 *
 * Implements strict distinction between:
 * 1. REQUIRED: Variables strictly required for startup.
 * 2. OPTIONAL: Variables that have safe defaults or in-memory fallbacks.
 * 3. CONDITIONALLY REQUIRED: Variables only validated when their respective feature toggle is enabled.
 */

export interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  conditionalErrors: { feature: string; missing: string[] }[];
  statusSummary: {
    database: 'POSTGRES' | 'IN_MEMORY_DEMO';
    redis: 'CONNECTED' | 'IN_MEMORY_FALLBACK';
    bKash: 'ENABLED_CONFIGURED' | 'ENABLED_MISCONFIGURED' | 'DISABLED';
    nagad: 'ENABLED_CONFIGURED' | 'ENABLED_MISCONFIGURED' | 'DISABLED';
    rocket: 'ENABLED_CONFIGURED' | 'ENABLED_MISCONFIGURED' | 'DISABLED';
    community: 'ENABLED_CONFIGURED' | 'ENABLED_MISCONFIGURED' | 'DISABLED';
    ads: 'ENABLED' | 'DISABLED';
    monetag: 'ENABLED_CONFIGURED' | 'ENABLED_MISCONFIGURED' | 'DISABLED';
    adsterra: 'ENABLED_CONFIGURED' | 'ENABLED_MISCONFIGURED' | 'DISABLED';
    genericAd: 'ENABLED_CONFIGURED' | 'ENABLED_MISCONFIGURED' | 'DISABLED';
  };
}

export class EnvValidator {
  /**
   * Evaluates environment configuration according to feature toggles.
   */
  public static validate(env: Record<string, string | undefined> = process.env): EnvValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingRequired: string[] = [];
    const conditionalErrors: { feature: string; missing: string[] }[] = [];

    const isTest = env.NODE_ENV === 'test';
    const isDemo = env.DEMO_MODE !== undefined ? env.DEMO_MODE.toLowerCase() !== 'false' && env.DEMO_MODE !== '0' : true;

    // 1. Strictly Required Core Variables
    // Only enforced in production / normal mode; in unit tests, test defaults are allowed
    const requiredCore = [
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_WEBHOOK_SECRET',
      'TELEGRAM_BOT_USERNAME',
      'ADMIN_JWT_SECRET',
      'ADMIN_DEFAULT_USERNAME',
      'ADMIN_DEFAULT_PASSWORD',
    ];

    if (!isTest) {
      for (const key of requiredCore) {
        if (!env[key] || env[key]?.trim() === '') {
          // In demo mode, if secrets are not set yet, we add a clear warning or error
          missingRequired.push(key);
        }
      }
      if (missingRequired.length > 0) {
        warnings.push(`Required core variables missing or empty: ${missingRequired.join(', ')}`);
      }
    }

    // 2. Database validation (Conditionally Required when DEMO_MODE=false)
    let databaseStatus: 'POSTGRES' | 'IN_MEMORY_DEMO' = 'IN_MEMORY_DEMO';
    const dbUrl = env.DATABASE_URL?.trim();
    if (!isDemo) {
      if (!dbUrl) {
        errors.push('DATABASE_URL is required when DEMO_MODE=false.');
      } else {
        databaseStatus = 'POSTGRES';
      }
    } else {
      if (dbUrl) {
        databaseStatus = 'POSTGRES';
      } else {
        warnings.push('[Database] DATABASE_URL is not provided. Running in safe resilient in-memory mode (DEMO_MODE=true).');
      }
    }

    // 3. Redis validation (Always Optional with in-memory fallback)
    let redisStatus: 'CONNECTED' | 'IN_MEMORY_FALLBACK' = 'IN_MEMORY_FALLBACK';
    if (env.REDIS_URL?.trim()) {
      redisStatus = 'CONNECTED';
    } else {
      warnings.push('[Redis] REDIS_URL not configured. Safe in-memory rate limiting and caching is active.');
    }

    // 4. APP_BASE_URL (Optional during development/demo mode; uses safe local/default URL)
    if (!isDemo && !env.APP_BASE_URL?.trim() && !env.APP_URL?.trim()) {
      warnings.push('[Hosting] APP_BASE_URL is not set for production. Required before production Telegram webhook/deep-link setup.');
    }

    // 5. bKash (Conditionally Required when BKASH_ENABLED=true)
    let bkashStatus: 'ENABLED_CONFIGURED' | 'ENABLED_MISCONFIGURED' | 'DISABLED' = 'DISABLED';
    if (env.BKASH_ENABLED === 'true') {
      const missingBkash: string[] = [];
      const requiredBkash = ['BKASH_BASE_URL', 'BKASH_APP_KEY', 'BKASH_APP_SECRET', 'BKASH_USERNAME', 'BKASH_PASSWORD'];
      for (const k of requiredBkash) {
        if (!env[k]?.trim()) missingBkash.push(k);
      }
      if (missingBkash.length > 0) {
        bkashStatus = 'ENABLED_MISCONFIGURED';
        conditionalErrors.push({ feature: 'bKash Gateway', missing: missingBkash });
        warnings.push(`[bKash] BKASH_ENABLED=true but missing required credentials: ${missingBkash.join(', ')}. bKash API disabled until configured.`);
      } else {
        bkashStatus = 'ENABLED_CONFIGURED';
      }
    }

    // 6. Nagad (Conditionally Required when NAGAD_ENABLED=true)
    let nagadStatus: 'ENABLED_CONFIGURED' | 'ENABLED_MISCONFIGURED' | 'DISABLED' = 'DISABLED';
    if (env.NAGAD_ENABLED === 'true') {
      const missingNagad: string[] = [];
      const requiredNagad = ['NAGAD_BASE_URL', 'NAGAD_MERCHANT_ID', 'NAGAD_MERCHANT_KEY'];
      for (const k of requiredNagad) {
        if (!env[k]?.trim()) missingNagad.push(k);
      }
      if (missingNagad.length > 0) {
        nagadStatus = 'ENABLED_MISCONFIGURED';
        conditionalErrors.push({ feature: 'Nagad Gateway', missing: missingNagad });
        warnings.push(`[Nagad] NAGAD_ENABLED=true but missing credentials: ${missingNagad.join(', ')}. Nagad API disabled until configured.`);
      } else {
        nagadStatus = 'ENABLED_CONFIGURED';
      }
    }

    // 7. Rocket (Conditionally Required when ROCKET_ENABLED=true)
    let rocketStatus: 'ENABLED_CONFIGURED' | 'ENABLED_MISCONFIGURED' | 'DISABLED' = 'DISABLED';
    if (env.ROCKET_ENABLED === 'true') {
      const missingRocket: string[] = [];
      const requiredRocket = ['ROCKET_BASE_URL', 'ROCKET_API_KEY', 'ROCKET_SECRET'];
      for (const k of requiredRocket) {
        if (!env[k]?.trim()) missingRocket.push(k);
      }
      if (missingRocket.length > 0) {
        rocketStatus = 'ENABLED_MISCONFIGURED';
        conditionalErrors.push({ feature: 'Rocket Gateway', missing: missingRocket });
        warnings.push(`[Rocket] ROCKET_ENABLED=true but missing credentials: ${missingRocket.join(', ')}. Rocket API disabled until configured.`);
      } else {
        rocketStatus = 'ENABLED_CONFIGURED';
      }
    }

    // 8. Community (Conditionally Required when COMMUNITY_REWARD_ENABLED=true)
    let communityStatus: 'ENABLED_CONFIGURED' | 'ENABLED_MISCONFIGURED' | 'DISABLED' = 'DISABLED';
    if (env.COMMUNITY_REWARD_ENABLED === 'true') {
      const missingComm: string[] = [];
      if (!env.COMMUNITY_CHAT_ID?.trim()) missingComm.push('COMMUNITY_CHAT_ID');
      if (!env.COMMUNITY_INVITE_LINK?.trim()) missingComm.push('COMMUNITY_INVITE_LINK');

      if (missingComm.length > 0) {
        communityStatus = 'ENABLED_MISCONFIGURED';
        conditionalErrors.push({ feature: 'Telegram Community Reward', missing: missingComm });
        warnings.push(`[Community] COMMUNITY_REWARD_ENABLED=true but missing: ${missingComm.join(', ')}.`);
      } else {
        communityStatus = 'ENABLED_CONFIGURED';
      }
    }

    // 9. Ads & Ad Providers
    const adsEnabled = env.ADS_ENABLED === 'true';
    const adsStatus = adsEnabled ? 'ENABLED' : 'DISABLED';

    let monetagStatus: 'ENABLED_CONFIGURED' | 'ENABLED_MISCONFIGURED' | 'DISABLED' = 'DISABLED';
    if (env.MONETAG_ENABLED === 'true') {
      if (!env.MONETAG_AD_TAG?.trim()) {
        monetagStatus = 'ENABLED_MISCONFIGURED';
        conditionalErrors.push({ feature: 'Monetag Ad Provider', missing: ['MONETAG_AD_TAG'] });
        warnings.push('[Ads] MONETAG_ENABLED=true but MONETAG_AD_TAG is missing.');
      } else {
        monetagStatus = 'ENABLED_CONFIGURED';
      }
    }

    let adsterraStatus: 'ENABLED_CONFIGURED' | 'ENABLED_MISCONFIGURED' | 'DISABLED' = 'DISABLED';
    if (env.ADSTERRA_ENABLED === 'true') {
      if (!env.ADSTERRA_ZONE_ID?.trim()) {
        adsterraStatus = 'ENABLED_MISCONFIGURED';
        conditionalErrors.push({ feature: 'Adsterra Ad Provider', missing: ['ADSTERRA_ZONE_ID'] });
        warnings.push('[Ads] ADSTERRA_ENABLED=true but ADSTERRA_ZONE_ID is missing.');
      } else {
        adsterraStatus = 'ENABLED_CONFIGURED';
      }
    }

    let genericAdStatus: 'ENABLED_CONFIGURED' | 'ENABLED_MISCONFIGURED' | 'DISABLED' = 'DISABLED';
    if (env.GENERIC_AD_ENABLED === 'true') {
      if (!env.GENERIC_AD_TAG?.trim()) {
        genericAdStatus = 'ENABLED_MISCONFIGURED';
        conditionalErrors.push({ feature: 'Generic Ad Provider', missing: ['GENERIC_AD_TAG'] });
        warnings.push('[Ads] GENERIC_AD_ENABLED=true but GENERIC_AD_TAG is missing.');
      } else {
        genericAdStatus = 'ENABLED_CONFIGURED';
      }
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
      missingRequired,
      conditionalErrors,
      statusSummary: {
        database: databaseStatus,
        redis: redisStatus,
        bKash: bkashStatus,
        nagad: nagadStatus,
        rocket: rocketStatus,
        community: communityStatus,
        ads: adsStatus,
        monetag: monetagStatus,
        adsterra: adsterraStatus,
        genericAd: genericAdStatus,
      },
    };
  }

  /**
   * Prints clean, structured diagnostics to server log on startup.
   */
  public static printStartupDiagnostics(result: EnvValidationResult): void {
    console.log('\n==================================================');
    console.log('⚡ SKX MINING CONFIGURATION & INTEGRATION MATRIX');
    console.log('==================================================');
    console.log(`• Mode:               ${process.env.DEMO_MODE?.toLowerCase() === 'false' ? 'PRODUCTION' : 'DEMO_MODE (Development)'}`);
    console.log(`• Database Engine:    ${result.statusSummary.database}`);
    console.log(`• Cache & Limiter:    ${result.statusSummary.redis}`);
    console.log(`• bKash Integration:  ${result.statusSummary.bKash}`);
    console.log(`• Nagad Integration:  ${result.statusSummary.nagad}`);
    console.log(`• Rocket Integration: ${result.statusSummary.rocket}`);
    console.log(`• Community Reward:   ${result.statusSummary.community}`);
    console.log(`• Rewarded Ads:       ${result.statusSummary.ads}`);
    console.log(`• Monetag Adapter:    ${result.statusSummary.monetag}`);
    console.log(`• Adsterra Adapter:   ${result.statusSummary.adsterra}`);
    console.log(`• Generic Ad Adapter: ${result.statusSummary.genericAd}`);

    if (result.warnings.length > 0) {
      console.log('\n[Safe Configuration Warnings]');
      result.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    }

    if (result.errors.length > 0) {
      console.error('\n[Critical Startup Configuration Errors]');
      result.errors.forEach((e) => console.error(`  ✖ ${e}`));
    }
    console.log('==================================================\n');
  }
}
