-- Project activity log
CREATE TABLE IF NOT EXISTS project_activities (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  field TEXT,
  summary TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_activities_project ON project_activities(project_id, created_at DESC);

-- Organization custom project templates
CREATE TABLE IF NOT EXISTS project_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  milestones_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_templates_org ON project_templates(organization_id, updated_at DESC);
