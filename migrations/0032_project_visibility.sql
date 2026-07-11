-- 프로젝트 가시성: members(초대 멤버만) | organization(조직 전체 공유)
ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'members';

CREATE INDEX IF NOT EXISTS idx_projects_visibility ON projects(organization_id, visibility);
