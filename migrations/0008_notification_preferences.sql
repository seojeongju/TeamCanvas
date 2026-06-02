-- Notification channel preferences
-- Migration: 0008_notification_preferences

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  in_app_enabled INTEGER NOT NULL DEFAULT 1,
  push_enabled INTEGER NOT NULL DEFAULT 0,
  email_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
