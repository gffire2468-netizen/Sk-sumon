-- SKX MINING Database Schema Migration 001
-- PostgreSQL Production Schema

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    telegram_id VARCHAR(64) UNIQUE NOT NULL,
    username VARCHAR(128),
    first_name VARCHAR(256) NOT NULL,
    last_name VARCHAR(256),
    language_code VARCHAR(16),
    is_suspended BOOLEAN DEFAULT FALSE,
    suspension_reason TEXT,
    referrer_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id);

CREATE TABLE IF NOT EXISTS balances (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    available_balance NUMERIC(24, 8) DEFAULT 0.00000000 CHECK (available_balance >= 0),
    reserved_balance NUMERIC(24, 8) DEFAULT 0.00000000 CHECK (reserved_balance >= 0),
    total_earned NUMERIC(24, 8) DEFAULT 0.00000000 CHECK (total_earned >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS energies (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_energy INTEGER DEFAULT 1000 CHECK (current_energy >= 0),
    max_energy INTEGER DEFAULT 1000 CHECK (max_energy >= 0),
    last_regen_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS mining_cycles (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    cycle_started_at BIGINT NOT NULL,
    cycle_duration_seconds INTEGER DEFAULT 3600,
    reward_claimed BOOLEAN DEFAULT FALSE,
    last_claimed_at BIGINT
);

CREATE TABLE IF NOT EXISTS tap_states (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    valid_taps_count INTEGER DEFAULT 0,
    taps_since_last_ad INTEGER DEFAULT 0,
    pending_ad_opportunity BOOLEAN DEFAULT FALSE,
    last_tap_at BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_rewards (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_key VARCHAR(16) NOT NULL,
    reward_amount NUMERIC(24, 8) NOT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_daily_user_day UNIQUE(user_id, day_key)
);

CREATE INDEX IF NOT EXISTS idx_daily_user_day ON daily_rewards(user_id, day_key);

CREATE TABLE IF NOT EXISTS referrals (
    id VARCHAR(64) PRIMARY KEY,
    referrer_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(32) DEFAULT 'PENDING',
    reward_paid BOOLEAN DEFAULT FALSE,
    reward_amount NUMERIC(24, 8) DEFAULT 0.20000000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    validated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(referrer_id, status);

CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(48) NOT NULL,
    amount NUMERIC(24, 8) NOT NULL,
    balance_before NUMERIC(24, 8) NOT NULL,
    balance_after NUMERIC(24, 8) NOT NULL,
    status VARCHAR(32) DEFAULT 'COMPLETED',
    reference_id VARCHAR(128),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at DESC);

CREATE TABLE IF NOT EXISTS withdrawals (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method VARCHAR(32) NOT NULL,
    account_number VARCHAR(64) NOT NULL,
    requested_amount NUMERIC(24, 8) NOT NULL,
    fee_amount NUMERIC(24, 8) NOT NULL,
    net_amount NUMERIC(24, 8) NOT NULL,
    status VARCHAR(32) DEFAULT 'PENDING',
    provider_trx_id VARCHAR(128),
    admin_notes TEXT,
    reviewed_by VARCHAR(64),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

CREATE TABLE IF NOT EXISTS community_memberships (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    verified BOOLEAN DEFAULT FALSE,
    reward_claimed BOOLEAN DEFAULT FALSE,
    claimed_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS support_tickets (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(32) NOT NULL,
    subject VARCHAR(256) NOT NULL,
    status VARCHAR(32) DEFAULT 'OPEN',
    assigned_to VARCHAR(64),
    internal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_tickets(status);

CREATE TABLE IF NOT EXISTS support_messages (
    id VARCHAR(64) PRIMARY KEY,
    ticket_id VARCHAR(64) NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_type VARCHAR(16) NOT NULL,
    sender_id VARCHAR(64) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_msg_ticket ON support_messages(ticket_id);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(256) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(48) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS ad_daily_tracking (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_key VARCHAR(16) NOT NULL,
    ads_watched INTEGER DEFAULT 0,
    ad_earnings NUMERIC(24, 8) DEFAULT 0.00000000,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_ad_user_day UNIQUE(user_id, day_key)
);

CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    role VARCHAR(32) DEFAULT 'SUPER_ADMIN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    admin_id VARCHAR(64) NOT NULL,
    admin_username VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS security_events (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    event_type VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    details JSONB,
    ip VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(64)
);
