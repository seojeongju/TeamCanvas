const AUDIT_LABELS: Record<string, string> = {
  "org.updated": "조직 정보를 수정했습니다",
  "org.settings_updated": "조직 설정을 변경했습니다",
  "member.invited": "새 멤버를 초대했습니다",
  "member.updated": "멤버 역할을 변경했습니다",
  "member.removed": "멤버를 제거했습니다",
  "team.created": "팀을 만들었습니다",
  "team.updated": "팀 정보를 수정했습니다",
  "team.deleted": "팀을 삭제했습니다",
  "team.member_added": "팀에 멤버를 추가했습니다",
  "invite.link_created": "초대 링크를 생성했습니다",
  "billing.checkout_started": "구독 결제를 시작했습니다",
  "billing.subscription_activated": "구독이 활성화되었습니다",
};

function activityLink(entityType: string | null, entityId: string | null): string | null {
  if (!entityId) return null;
  if (entityType === "task") return `/tasks?task=${encodeURIComponent(entityId)}`;
  if (entityType === "event") return `/calendar?event=${encodeURIComponent(entityId)}`;
  if (entityType === "team") return `/settings/teams`;
  return null;
}

function formatAuditSummary(action: string, metadataJson: string | null): string {
  if (AUDIT_LABELS[action]) return AUDIT_LABELS[action];
  if (metadataJson) {
    try {
      const meta = JSON.parse(metadataJson) as Record<string, unknown>;
      if (typeof meta.name === "string") return `${action}: ${meta.name}`;
    } catch {
      /* ignore */
    }
  }
  return action.replace(/\./g, " · ");
}

export type OrgActivityRow = {
  kind: string;
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata_json: string | null;
  summary: string | null;
  created_at: number;
};

export async function fetchOrgActivity(
  db: D1Database,
  orgId: string,
  limit = 20,
): Promise<
  {
    id: string;
    kind: "audit" | "task";
    actorName: string;
    summary: string;
    link: string | null;
    createdAt: number;
  }[]
> {
  const capped = Math.min(Math.max(limit, 1), 50);
  const { results } = await db
    .prepare(
      `SELECT * FROM (
         SELECT
           'audit' AS kind,
           a.id,
           a.actor_id,
           u.name AS actor_name,
           a.action,
           a.entity_type,
           a.entity_id,
           a.metadata_json,
           NULL AS summary,
           a.created_at
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_id
         WHERE a.organization_id = ?
         UNION ALL
         SELECT
           'task' AS kind,
           t.id,
           t.actor_id,
           u.name AS actor_name,
           t.action,
           'task' AS entity_type,
           t.task_id AS entity_id,
           NULL AS metadata_json,
           t.summary,
           t.created_at
         FROM task_activities t
         LEFT JOIN users u ON u.id = t.actor_id
         WHERE t.organization_id = ?
       )
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(orgId, orgId, capped)
    .all<OrgActivityRow>();

  return (results ?? []).map((row) => {
    const actorName = row.actor_name ?? "시스템";
    const summary =
      row.kind === "task" && row.summary
        ? row.summary
        : formatAuditSummary(row.action, row.metadata_json);
    return {
      id: `${row.kind}:${row.id}`,
      kind: row.kind as "audit" | "task",
      actorName,
      summary,
      link: activityLink(row.entity_type, row.entity_id),
      createdAt: row.created_at,
    };
  });
}
