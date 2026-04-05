-- Minimal sessions table for single login tracking (cheap & lightweight)
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  login_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Single index for efficient deletion by user
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

-- Add currentSessionId to users table for O(1) validation
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_session_id VARCHAR(255);
