ALTER TABLE sessions
ADD COLUMN refresh_token_hash TEXT;

ALTER TABLE sessions
ADD COLUMN refresh_expires_at TEXT;

CREATE UNIQUE INDEX idx_sessions_refresh_token_hash
ON sessions(refresh_token_hash);

CREATE INDEX idx_sessions_refresh_expires_at
ON sessions(refresh_expires_at);