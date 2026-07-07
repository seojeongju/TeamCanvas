-- Notification type category preferences
-- Migration: 0031_notification_type_prefs

ALTER TABLE notification_preferences ADD COLUMN type_prefs_json TEXT;
