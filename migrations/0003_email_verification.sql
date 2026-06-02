-- Email verification & password reset tokens
-- Migration: 0003_email_verification

ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

CREATE TABLE auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_auth_tokens_user_type ON auth_tokens(user_id, type);
CREATE INDEX idx_auth_tokens_expires ON auth_tokens(expires_at);

-- OAuth / dev users: treat as verified
UPDATE users SET email_verified = 1
WHERE id IN (SELECT user_id FROM oauth_accounts);

UPDATE users SET email_verified = 1
WHERE password_hash IS NULL AND email IS NOT NULL;
