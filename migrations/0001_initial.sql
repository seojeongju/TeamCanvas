-- TeamCanvas initial schema
-- Migration: 0001_initial

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  locale TEXT DEFAULT 'ko',
  timezone TEXT DEFAULT 'Asia/Seoul',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  access_token_enc TEXT,
  refresh_token_enc TEXT,
  expires_at INTEGER,
  UNIQUE(provider, provider_user_id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_r2_key TEXT,
  timezone TEXT DEFAULT 'Asia/Seoul',
  settings_json TEXT DEFAULT '{}',
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  invited_by TEXT REFERENCES users(id),
  joined_at INTEGER,
  UNIQUE(organization_id, user_id)
);

CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES departments(id),
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id TEXT REFERENCES departments(id),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#4A9FE8',
  created_at INTEGER NOT NULL
);

CREATE TABLE team_members (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id),
  creator_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  all_day INTEGER DEFAULT 0,
  visibility TEXT DEFAULT 'team',
  recurrence_rule TEXT,
  color TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_events_org_time ON events(organization_id, start_at, end_at);

CREATE TABLE event_attendees (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rsvp TEXT DEFAULT 'pending',
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id),
  creator_id TEXT NOT NULL REFERENCES users(id),
  assignee_id TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  due_at INTEGER,
  sort_order INTEGER DEFAULT 0,
  event_id TEXT REFERENCES events(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_tasks_org_status ON tasks(organization_id, status);

CREATE TABLE task_comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE files (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploader_id TEXT NOT NULL REFERENCES users(id),
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_audit_org_time ON audit_logs(organization_id, created_at DESC);
