-- 일정 알림(in-app) 중복 발송 방지
ALTER TABLE event_reminders ADD COLUMN notified_at INTEGER;
