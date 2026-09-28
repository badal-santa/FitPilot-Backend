CREATE TABLE workout_plans (
    id TEXT PRIMARY KEY,

    user_id TEXT NOT NULL,

    name TEXT NOT NULL,
    description TEXT,

    goal TEXT NOT NULL,
    days_per_week INTEGER NOT NULL,

    duration_weeks INTEGER,

    status TEXT NOT NULL DEFAULT 'active',

    started_at TEXT,
    ended_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_workout_plans_user_id
ON workout_plans(user_id);

CREATE INDEX idx_workout_plans_status
ON workout_plans(status);