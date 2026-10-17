CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY,
  cl_id TEXT NOT NULL UNIQUE,
  student_name TEXT NOT NULL,
  grade TEXT NOT NULL,
  password_salt BYTEA NOT NULL,
  password_hash BYTEA NOT NULL,
  recovery_salt BYTEA NOT NULL,
  recovery_hash BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_sessions (
  token_hash BYTEA PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS student_sessions_student_id_idx
  ON student_sessions(student_id);

CREATE TABLE IF NOT EXISTS practice_attempts (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  quiz_code TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  total_questions INTEGER NOT NULL CHECK (total_questions > 0),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_official BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (score <= total_questions)
);

CREATE INDEX IF NOT EXISTS practice_attempts_student_date_idx
  ON practice_attempts(student_id, completed_at DESC);