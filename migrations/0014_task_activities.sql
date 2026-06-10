-- 프로젝트 변경 이력 (팀 전체 조회)
CREATE TABLE task_activities (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  summary TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_task_activities_task_time ON task_activities(task_id, created_at DESC);
