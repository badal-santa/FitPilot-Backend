-- Normalize muscle_group to the lowercase-hyphen values the app filters by
-- (e.g. "Full Body" → "full-body"). New writes are normalized in
-- routes/admin-exercises.ts.
UPDATE exercises
SET muscle_group = LOWER(REPLACE(REPLACE(TRIM(muscle_group), ' ', '-'), '_', '-'))
WHERE muscle_group != LOWER(REPLACE(REPLACE(TRIM(muscle_group), ' ', '-'), '_', '-'));
