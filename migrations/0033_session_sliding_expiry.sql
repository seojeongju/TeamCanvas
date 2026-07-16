-- 로그인 세션: 7일 유휴 만료 + 최초 로그인 기준 30일 절대 만료
ALTER TABLE sessions ADD COLUMN last_used_at INTEGER;
ALTER TABLE sessions ADD COLUMN absolute_expires_at INTEGER;

UPDATE sessions
SET last_used_at = created_at,
    absolute_expires_at = created_at + (30 * 24 * 60 * 60 * 1000)
WHERE last_used_at IS NULL OR absolute_expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_expiry
  ON sessions(user_id, expires_at, absolute_expires_at);
