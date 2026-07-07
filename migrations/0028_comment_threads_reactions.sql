-- Comment threads, edit/delete metadata, reactions
ALTER TABLE task_comments ADD COLUMN parent_id TEXT REFERENCES task_comments(id) ON DELETE CASCADE;
ALTER TABLE task_comments ADD COLUMN edited_at INTEGER;
ALTER TABLE task_comments ADD COLUMN deleted_at INTEGER;

ALTER TABLE project_comments ADD COLUMN parent_id TEXT REFERENCES project_comments(id) ON DELETE CASCADE;
ALTER TABLE project_comments ADD COLUMN edited_at INTEGER;
ALTER TABLE project_comments ADD COLUMN deleted_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_task_comments_parent ON task_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_parent ON project_comments(parent_id);

CREATE TABLE IF NOT EXISTS comment_reactions (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('task', 'project')),
  comment_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(entity_type, comment_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_lookup ON comment_reactions(entity_type, comment_id);
