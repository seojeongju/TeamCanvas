-- Project discussion comments
CREATE TABLE IF NOT EXISTS project_comments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_comments_project ON project_comments(project_id, created_at);

-- Link milestones to calendar events when synced
ALTER TABLE project_milestones ADD COLUMN calendar_event_id TEXT REFERENCES events(id) ON DELETE SET NULL;
