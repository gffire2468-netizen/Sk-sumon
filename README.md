# SKX MINING — Telegram Bot + Telegram Mini App

Futuristic Telegram-based Reward and Mining Mini App powered by Node.js, Express, React, Vite, TypeScript, and PostgreSQL.

---

## ⚡ Architecture Overview

SKX MINING delivers an authoritative, tamper-proof reward engine designed for high concurrency in Telegram WebApp environments.

- **Authoritative Balance Engine**: All balance changes use atomic transactions and exact 8-decimal precision (`decimal.js`). Floating-point drift is strictly prevented.
- **Server-Authoritative Energy & Tap Validation**: Energy regenerates dynamically per second up to `MAX_ENERGY = 1000`. Batch taps are server-validated with rate limiting and anti-cheat velocity checks.
- **Hourly Mining Reactor**: 3,600-second cycle awards `0.05 SKX` with double-claim prevention.
- **Referral Engine**: Mandatory dual withdrawal unlock requiring both `Balance >= 5 SKX` AND `Valid Referrals >= 4`.
- **Withdrawal System**: Manual and automated review workflow for bKash, Nagad, and Rocket with balance reservation and mandatory real provider `TrxID` completion.
- **Community Join Reward**: Telegram Bot API `getChatMember` verification for one-time channel join rewards (+0.1 SKX).
- **Rewarded Advertisements**: Bengali-localized ("📺 এড দেখে ইনকাম"), provider-adapter architecture (Monetag, Adsterra, Generic), daily limits, and 100-tap opportunity triggers.
- **Comprehensive Admin Console**: Dashboard stats, user management, manual ledger adjustments, withdrawal processing, support ticket desk, and audit logs.

---

## 🚀 Quick Start & Local Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Key environment settings:
```env
PORT=3000
NODE_ENV=development
APP_BASE_URL=https://your-domain.com

# PostgreSQL (optional in DEMO_MODE; in-memory relational store fallback used if unset)
DATABASE_URL=postgres://user:password@localhost:5432/skx_mining

# Telegram Bot
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
TELEGRAM_WEBHOOK_SECRET=your_super_secret_webhook_token
TELEGRAM_BOT_USERNAME=SKXMiningBot

# Admin Authentication
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=admin12345
ADMIN_JWT_SECRET=super_secret_jwt_key_at_least_32_characters

# Core Business Rules
TAP_REWARD=0.0001
ENERGY_PER_TAP=1
MAX_ENERGY=1000
ENERGY_REGEN_RATE=1
MINING_CYCLE_DURATION=3600
MINING_CYCLE_REWARD=0.05
REQUIRED_REFERRALS=4
REFERRAL_REWARD=0.2
MIN_WITHDRAWAL=5
MAX_WITHDRAWAL=1000
DAILY_AD_LIMIT=20
DAILY_AD_REWARD=0.020
TAP_AD_THRESHOLD=100
```

### 3. Run Development Server
```bash
npm run dev
```
Launches the full-stack server at `http://localhost:3000`.

---

## 🤖 Telegram Bot & Webhook Setup

### 1. Create Bot via @BotFather
1. Message `@BotFather` on Telegram and send `/newbot`.
2. Name your bot `SKX MINING` and set username `SKXMiningBot`.
3. Copy the HTTP API token into `TELEGRAM_BOT_TOKEN`.

### 2. Configure Mini App
1. In `@BotFather`, run `/newapp`.
2. Select your `@SKXMiningBot`.
3. Provide title `SKX MINING`, description, and upload icon.
4. Set WebApp URL to `https://your-domain.com`.
5. Set short name (e.g. `app`). Your launch link will be `https://t.me/SKXMiningBot/app`.

### 3. Register Webhook
You can register your webhook with the built-in endpoint:
```bash
curl -X POST http://localhost:3000/api/bot/webhook/setup \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://your-domain.com/api/bot/webhook", "secretToken": "your_super_secret_webhook_token"}'
```
Or verify health at:
```bash
curl http://localhost:3000/api/bot/webhook/health
```

---

## 🗄️ Database Migrations

Production PostgreSQL migrations are located in `migrations/001_init_schema.sql`.

When `DATABASE_URL` is set, the server automatically executes the migration on boot. You can also run it manually via `psql`:
```bash
psql $DATABASE_URL -f migrations/001_init_schema.sql
```

When running in `DEMO_MODE=true` without PostgreSQL, the system initializes an in-memory relational engine with strict mutex transaction locks to prevent concurrency race conditions.

---

## 🧪 Testing & Verification

Run the comprehensive 30-point business logic test suite:
```bash
npm run test
```

Build production bundle:
```bash
npm run build
```

Validate TypeScript types:
```bash
npm run lint
```

---

## 🛡️ Security & Anti-Cheat Features

1. **HMAC-SHA256 InitData Validation**: Validates cryptographic signature using Telegram Bot token. Expiration checked after 24 hours.
2. **Authoritative Balance Ledger**: Balances cannot be manipulated from client requests.
3. **Atomic Mutex Locks**: Serializes concurrent requests per user (`withUserLock`) to eliminate race conditions on withdrawals and rewards.
4. **Rate Limiting**: Sliding-window rate limiters on taps, claims, authentication, and admin endpoints.
5. **Withdrawal Unlock Rule**: Strictly enforces BOTH `balance >= 5 SKX` AND `valid referrals >= 4`.
6. **Real TrxID Requirement**: Payouts cannot be finalized without a valid merchant transaction ID.
