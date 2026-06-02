-- Policy update:
-- 1) Free plan invites up to 3 users (owner + 3 = max_members 4)
-- 2) One user can belong to one active organization (enforced at API layer)
-- Migration: 0006_policy_one_org_free_invite_limit

UPDATE subscription_plans
SET max_members = 4,
    updated_at = unixepoch() * 1000
WHERE code = 'free';
