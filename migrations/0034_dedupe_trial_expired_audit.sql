-- 동시 요청으로 중복 생성된 체험 만료 감사 로그 정리
DELETE FROM audit_logs
WHERE action = 'billing.trial_expired'
  AND rowid NOT IN (
    SELECT MIN(rowid)
    FROM audit_logs
    WHERE action = 'billing.trial_expired'
    GROUP BY organization_id, entity_id, metadata_json
  );

-- 동일 체험 기간의 만료 이벤트가 다시 기록되지 않도록 최종 방어
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_trial_expired_once
  ON audit_logs(organization_id, action, entity_id, metadata_json)
  WHERE action = 'billing.trial_expired';
