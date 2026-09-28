-- Google sign-in: link a user row to its Google account ("sub" claim).
-- Google-only users get a placeholder password_hash that verifyPassword()
-- always rejects, so they can't be signed into with a password.
ALTER TABLE users
ADD COLUMN google_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id
ON users(google_id);
