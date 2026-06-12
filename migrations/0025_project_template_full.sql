-- Full project templates: default tasks and recommended member roles
ALTER TABLE project_templates ADD COLUMN tasks_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE project_templates ADD COLUMN member_slots_json TEXT NOT NULL DEFAULT '[]';
