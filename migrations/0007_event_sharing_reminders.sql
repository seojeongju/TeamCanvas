-- Event sharing and reminder enhancements
-- Migration: 0007_event_sharing_reminders

CREATE TABLE IF NOT EXISTS event_reminders (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_minutes INTEGER NOT NULL,
  remind_at INTEGER NOT NULL,
  delivered_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_reminders_user_time
  ON event_reminders(user_id, remind_at, delivered_at);

CREATE INDEX IF NOT EXISTS idx_event_attendees_user_event
  ON event_attendees(user_id, event_id);
