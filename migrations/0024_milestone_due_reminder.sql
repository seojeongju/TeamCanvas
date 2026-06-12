-- 마일스톤 마감 1일 전 인앱 알림 발송 여부
ALTER TABLE project_milestones ADD COLUMN due_reminder_sent_at INTEGER;
