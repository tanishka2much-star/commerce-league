PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,cl_id TEXT NOT NULL UNIQUE,name TEXT NOT NULL,grade TEXT NOT NULL,password_hash TEXT NOT NULL,recovery_hash TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 5),total INTEGER NOT NULL CHECK(total=5),practice_group TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS attempts_student_time ON attempts(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS rate_limits(rate_key TEXT PRIMARY KEY,hits INTEGER NOT NULL,day TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS rate_limits_day ON rate_limits(day);
