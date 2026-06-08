-- Phase 3: org deactivation grace, team creation requests, holidays

ALTER TABLE organizations ADD COLUMN deactivated_at INTEGER;
ALTER TABLE organizations ADD COLUMN delete_scheduled_at INTEGER;

CREATE TABLE team_creation_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#4A9FE8',
  department_id TEXT REFERENCES departments(id),
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at INTEGER,
  reject_reason TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_team_requests_org_status ON team_creation_requests(organization_id, status);

CREATE TABLE org_holidays (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  yearly INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_org_holidays_org ON org_holidays(organization_id);
