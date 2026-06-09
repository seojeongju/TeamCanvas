CREATE TABLE task_labels (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4A9FE8',
  created_at INTEGER NOT NULL,
  UNIQUE (organization_id, name)
);

CREATE INDEX idx_task_labels_org ON task_labels(organization_id);

CREATE TABLE task_label_assignments (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES task_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

CREATE TABLE task_checklist_items (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_task_checklist_task ON task_checklist_items(task_id, sort_order);

CREATE TABLE google_calendar_tokens (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  expires_at INTEGER,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, organization_id)
);

CREATE TABLE google_calendar_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  google_event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  synced_at INTEGER NOT NULL,
  UNIQUE (user_id, organization_id, google_event_id)
);

CREATE INDEX idx_google_cal_events_range ON google_calendar_events(organization_id, user_id, start_at);
