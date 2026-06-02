-- Org invite links + Stripe price IDs on plans
-- Migration: 0005_invites_billing

CREATE TABLE org_invites (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  token_hash TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  accepted_at INTEGER,
  accepted_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_org_invites_org ON org_invites(organization_id);
CREATE INDEX idx_org_invites_email ON org_invites(email);

ALTER TABLE subscription_plans ADD COLUMN stripe_price_monthly_id TEXT;
ALTER TABLE subscription_plans ADD COLUMN stripe_price_yearly_id TEXT;

ALTER TABLE organization_subscriptions ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE organization_subscriptions ADD COLUMN stripe_customer_id TEXT;
