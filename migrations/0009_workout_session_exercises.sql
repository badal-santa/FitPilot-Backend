CREATE TABLE workout_session_exercises (
    id TEXT PRIMARY KEY,

    workout_session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,

    exercise_order INTEGER NOT NULL,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (workout_session_id)
        REFERENCES workout_sessions(id)
        ON DELETE CASCADE,

    FOREIGN KEY (exercise_id)
        REFERENCES exercises(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_session_exercises_session_id
ON workout_session_exercises(workout_session_id);

CREATE INDEX idx_session_exercises_exercise_id
ON workout_session_exercises(exercise_id);
