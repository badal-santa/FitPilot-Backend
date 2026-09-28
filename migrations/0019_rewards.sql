CREATE TABLE reward_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_key TEXT NOT NULL,
    event_type TEXT NOT NULL,
    xp INTEGER NOT NULL CHECK (xp > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    UNIQUE (user_id, event_key)
);

CREATE INDEX idx_reward_events_user_id
ON reward_events(user_id);
