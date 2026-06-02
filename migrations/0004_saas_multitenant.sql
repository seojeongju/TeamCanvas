-- TeamCanvas SaaS: subscription plans, org subscriptions, platform admins
-- Migration: 0004_saas_multitenant

ALTER TABLE organizations ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

CREATE TABLE subscription_plans (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly INTEGER NOT NULL DEFAULT 0,
  price_yearly INTEGER NOT NULL DEFAULT 0,
  max_members INTEGER NOT NULL DEFAULT 5,
  max_teams INTEGER NOT NULL DEFAULT 1,
  max_storage_mb INTEGER NOT NULL DEFAULT 100,
  features_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE organization_subscriptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  current_period_start INTEGER NOT NULL,
  current_period_end INTEGER NOT NULL,
  trial_ends_at INTEGER,
  canceled_at INTEGER,
  external_customer_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_org_subscriptions_status ON organization_subscriptions(status);
CREATE INDEX idx_org_subscriptions_plan ON organization_subscriptions(plan_id);

CREATE TABLE platform_admins (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'super_admin',
  granted_at INTEGER NOT NULL,
  granted_by TEXT REFERENCES users(id)
);

-- Seed subscription plans
INSERT INTO subscription_plans (
  id, code, name, description, price_monthly, price_yearly,
  max_members, max_teams, max_storage_mb, features_json, sort_order, created_at, updated_at
) VALUES
  (
    'plan_free', 'free', 'Free', '소규모 팀을 위한 무료 플랜',
    0, 0, 5, 1, 100,
    '["calendar","tasks"]',
    0, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'plan_starter', 'starter', 'Starter', '성장하는 팀을 위한 스타터',
    9900, 99000, 20, 5, 1024,
    '["calendar","tasks","teams"]',
    1, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'plan_pro', 'pro', 'Pro', '협업 기능이 풍부한 프로',
    29900, 299000, 100, 20, 10240,
    '["calendar","tasks","teams","file_storage","web_push"]',
    2, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'plan_enterprise', 'enterprise', 'Enterprise', '대규모 조직·커스텀',
    99900, 999000, 999, 999, 102400,
    '["calendar","tasks","teams","file_storage","web_push","audit_logs","api_access","custom_branding"]',
    3, unixepoch() * 1000, unixepoch() * 1000
  );

-- Backfill subscriptions for existing organizations (14-day Pro trial)
INSERT INTO organization_subscriptions (
  id, organization_id, plan_id, status, billing_cycle,
  current_period_start, current_period_end, trial_ends_at, created_at, updated_at
)
SELECT
  lower(hex(randomblob(16))),
  o.id,
  'plan_pro',
  'trialing',
  'monthly',
  unixepoch() * 1000,
  unixepoch() * 1000 + 2592000000,
  unixepoch() * 1000 + 1209600000,
  unixepoch() * 1000,
  unixepoch() * 1000
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM organization_subscriptions s WHERE s.organization_id = o.id
);
