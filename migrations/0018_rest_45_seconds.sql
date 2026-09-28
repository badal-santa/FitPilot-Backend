-- Rest between sets: 90s → 45s. New plans and "add to workout" now use 45s
-- (routes/workouts.ts); this updates exercises already in saved plans.
UPDATE workout_plan_exercises
SET rest_seconds = 45
WHERE rest_seconds = 90;
