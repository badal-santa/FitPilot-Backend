CREATE TABLE exercises (
    id TEXT PRIMARY KEY,

    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,

    description TEXT,

    category TEXT NOT NULL,
    muscle_group TEXT NOT NULL,

    equipment TEXT,
    difficulty TEXT NOT NULL,

    instructions TEXT,

    image_url TEXT,
    video_url TEXT,

    is_active INTEGER NOT NULL DEFAULT 1,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exercises_category
ON exercises(category);

CREATE INDEX idx_exercises_muscle_group
ON exercises(muscle_group);

CREATE INDEX idx_exercises_difficulty
ON exercises(difficulty);

CREATE INDEX idx_exercises_active
ON exercises(is_active);