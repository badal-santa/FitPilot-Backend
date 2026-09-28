CREATE TABLE workout_plan_days (
    id TEXT PRIMARY KEY,

    workout_plan_id TEXT NOT NULL,

    day_number INTEGER NOT NULL,
    day_name TEXT NOT NULL,

    title TEXT,
    description TEXT,

    rest_day INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (workout_plan_id)
        REFERENCES workout_plans(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_workout_plan_days_plan_id
ON workout_plan_days(workout_plan_id);
