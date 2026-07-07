CREATE TABLE IF NOT EXISTS org_sync_state (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

ALTER TABLE files ADD COLUMN comment_id TEXT;

CREATE INDEX IF NOT EXISTS idx_files_comment ON files(comment_id);
CREATE INDEX IF NOT EXISTS idx_files_entity_comment ON files(entity_type, entity_id, comment_id);
