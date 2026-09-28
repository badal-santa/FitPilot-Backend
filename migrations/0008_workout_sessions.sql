CREATE TABLE workout_sessions (
    id TEXT PRIMARY KEY,

    user_id TEXT NOT NULL,
    workout_plan_day_id TEXT,

    started_at TEXT NOT NULL,
    completed_at TEXT,

    status TEXT NOT NULL DEFAULT 'started',

    duration_seconds INTEGER,
    calories_burned REAL,

    notes TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (workout_plan_day_id)
        REFERENCES workout_plan_days(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_workout_sessions_user_id
ON workout_sessions(user_id);

CREATE INDEX idx_workout_sessions_started_at
ON workout_sessions(started_at);

CREATE INDEX idx_workout_sessions_status
ON workout_sessions(status);
