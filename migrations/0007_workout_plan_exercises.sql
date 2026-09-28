CREATE TABLE workout_plan_exercises (
    id TEXT PRIMARY KEY,

    workout_plan_day_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,

    exercise_order INTEGER NOT NULL,

    sets INTEGER,
    reps INTEGER,

    duration_seconds INTEGER,
    rest_seconds INTEGER,

    target_weight_kg REAL,

    notes TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (workout_plan_day_id)
        REFERENCES workout_plan_days(id)
        ON DELETE CASCADE,

    FOREIGN KEY (exercise_id)
        REFERENCES exercises(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_plan_exercises_day_id
ON workout_plan_exercises(workout_plan_day_id);

CREATE INDEX idx_plan_exercises_exercise_id
ON workout_plan_exercises(exercise_id);
