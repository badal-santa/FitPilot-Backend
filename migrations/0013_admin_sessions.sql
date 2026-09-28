CREATE TABLE admin_sessions (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id)
        REFERENCES admin_users(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_admin_sessions_token_hash
ON admin_sessions(token_hash);

CREATE INDEX idx_admin_sessions_admin_id
ON admin_sessions(admin_id);

CREATE INDEX idx_admin_sessions_expires_at
ON admin_sessions(expires_at);