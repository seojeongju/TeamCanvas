-- Organization outbound webhooks (Slack, Kakao Work, generic)
-- Migration: 0017_org_webhooks

CREATE TABLE IF NOT EXISTS org_webhooks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'generic',
  events_json TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_org_webhooks_org ON org_webhooks(organization_id, enabled);
