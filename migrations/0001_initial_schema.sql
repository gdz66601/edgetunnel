-- UUID 白名单表
CREATE TABLE IF NOT EXISTS users (
    uuid TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT 1,
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    remark TEXT
);

CREATE INDEX idx_users_enabled ON users(enabled);
CREATE INDEX idx_users_expires ON users(expires_at);

-- 订阅访问记录表
CREATE TABLE IF NOT EXISTS subscription_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    country TEXT,
    user_agent TEXT,
    timestamp INTEGER NOT NULL
);

CREATE INDEX idx_sub_logs_uuid ON subscription_logs(uuid);
CREATE INDEX idx_sub_logs_timestamp ON subscription_logs(timestamp);
CREATE INDEX idx_sub_logs_uuid_time ON subscription_logs(uuid, timestamp);
