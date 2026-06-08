-- Multi-use team invite links + redemption audit
-- Migration: 0009_multi_use_invites

ALTER TABLE org_invites ADD COLUMN max_uses INTEGER;
ALTER TABLE org_invites ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE org_invites ADD COLUMN invite_type TEXT NOT NULL DEFAULT 'multi';
ALTER TABLE org_invites ADD COLUMN email_domain TEXT;
ALTER TABLE org_invites ADD COLUMN revoked_at INTEGER;
ALTER TABLE org_invites ADD COLUMN label TEXT;

-- 기존 대기 중 링크는 1회용으로 유지 (하위 호환)
UPDATE org_invites
SET invite_type = 'single', max_uses = 1
WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE TABLE org_invite_redemptions (
  id TEXT PRIMARY KEY,
  invite_id TEXT NOT NULL REFERENCES org_invites(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at INTEGER NOT NULL,
  UNIQUE(invite_id, user_id)
);

CREATE INDEX idx_invite_redemptions_invite ON org_invite_redemptions(invite_id);
