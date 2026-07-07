-- Organization automation presets (toggleable if-this-then-that rules)
CREATE TABLE IF NOT EXISTS org_automation_presets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  preset_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(organization_id, preset_key)
);

CREATE INDEX IF NOT EXISTS idx_org_automation_presets_org ON org_automation_presets(organization_id);

ALTER TABLE tasks ADD COLUMN overdue_notified_at INTEGER;
