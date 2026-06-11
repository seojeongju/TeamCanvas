-- Store invite token for re-copying active invite links (admin-only API)
-- Migration: 0019_invite_token

ALTER TABLE org_invites ADD COLUMN token TEXT;
