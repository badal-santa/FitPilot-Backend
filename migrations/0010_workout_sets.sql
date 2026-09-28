CREATE TABLE workout_sets (
    id TEXT PRIMARY KEY,

    workout_session_exercise_id TEXT NOT NULL,

    set_number INTEGER NOT NULL,

    reps INTEGER,
    weight_kg REAL,

    duration_seconds INTEGER,
    distance_meters REAL,

    completed INTEGER NOT NULL DEFAULT 1,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (workout_session_exercise_id)
        REFERENCES workout_session_exercises(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_workout_sets_session_exercise_id
ON workout_sets(workout_session_exercise_id);
