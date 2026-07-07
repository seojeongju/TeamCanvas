import { newId, now } from "./helpers";

export type AutomationPresetKey =
  | "notify_task_assigned"
  | "notify_task_comment"
  | "notify_task_mention"
  | "notify_task_overdue_daily"
  | "notify_task_status_change"
  | "webhook_task_assigned"
  | "webhook_task_completed"
  | "webhook_event_created"
  | "webhook_high_priority_task"
  | "webhook_project_comment";

export type AutomationPresetMeta = {
  key: AutomationPresetKey;
  name: string;
  description: string;
  category: "notification" | "webhook";
  defaultEnabled: boolean;
};

export const AUTOMATION_PRESET_CATALOG: AutomationPresetMeta[] = [
  {
    key: "notify_task_assigned",
    name: "업무 배정 알림",
    description: "담당자에게 인앱·푸시 알림을 보냅니다.",
    category: "notification",
    defaultEnabled: true,
  },
  {
    key: "notify_task_comment",
    name: "업무 댓글 알림",
    description: "댓글 시 담당자·작성자에게 알림을 보냅니다.",
    category: "notification",
    defaultEnabled: true,
  },
  {
    key: "notify_task_mention",
    name: "멘션 알림",
    description: "댓글 @멘션 시 해당 사용자에게 알림을 보냅니다.",
    category: "notification",
    defaultEnabled: true,
  },
  {
    key: "notify_task_overdue_daily",
    name: "지연 업무 일일 알림",
    description: "매일 오전 지연 업무가 있는 담당자에게 알림을 보냅니다.",
    category: "notification",
    defaultEnabled: false,
  },
  {
    key: "notify_task_status_change",
    name: "업무 상태 변경 알림",
    description: "완료·보류 등 상태 변경 시 담당자에게 알림을 보냅니다.",
    category: "notification",
    defaultEnabled: false,
  },
  {
    key: "webhook_task_assigned",
    name: "업무 배정 웹훅",
    description: "Slack·카카오워크 등 연동 채널로 배정 알림을 보냅니다.",
    category: "webhook",
    defaultEnabled: true,
  },
  {
    key: "webhook_task_completed",
    name: "업무 완료 웹훅",
    description: "업무 완료 시 외부 채널로 알림을 보냅니다.",
    category: "webhook",
    defaultEnabled: true,
  },
  {
    key: "webhook_event_created",
    name: "일정 생성 웹훅",
    description: "새 일정 생성 시 외부 채널로 알림을 보냅니다.",
    category: "webhook",
    defaultEnabled: true,
  },
  {
    key: "webhook_high_priority_task",
    name: "긴급 업무 웹훅",
    description: "높음 우선순위 업무 생성 시 외부 채널로 알림을 보냅니다.",
    category: "webhook",
    defaultEnabled: false,
  },
  {
    key: "webhook_project_comment",
    name: "프로젝트 논의 웹훅",
    description: "프로젝트 댓글 시 외부 채널로 알림을 보냅니다.",
    category: "webhook",
    defaultEnabled: false,
  },
];

const CATALOG_BY_KEY = Object.fromEntries(
  AUTOMATION_PRESET_CATALOG.map((p) => [p.key, p]),
) as Record<AutomationPresetKey, AutomationPresetMeta>;

export function getPresetDefaultEnabled(key: string): boolean {
  return CATALOG_BY_KEY[key as AutomationPresetKey]?.defaultEnabled ?? false;
}

export async function isAutomationPresetEnabled(
  db: D1Database,
  orgId: string,
  key: AutomationPresetKey,
): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT enabled FROM org_automation_presets WHERE organization_id = ? AND preset_key = ?",
    )
    .bind(orgId, key)
    .first<{ enabled: number }>();

  if (!row) return getPresetDefaultEnabled(key);
  return Boolean(row.enabled);
}

export async function listAutomationPresetsForOrg(
  db: D1Database,
  orgId: string,
): Promise<Array<AutomationPresetMeta & { enabled: boolean }>> {
  const { results } = await db
    .prepare("SELECT preset_key, enabled FROM org_automation_presets WHERE organization_id = ?")
    .bind(orgId)
    .all();

  const enabledMap = new Map<string, boolean>();
  for (const row of results ?? []) {
    const r = row as { preset_key: string; enabled: number };
    enabledMap.set(r.preset_key, Boolean(r.enabled));
  }

  return AUTOMATION_PRESET_CATALOG.map((preset) => ({
    ...preset,
    enabled: enabledMap.has(preset.key)
      ? (enabledMap.get(preset.key) as boolean)
      : preset.defaultEnabled,
  }));
}

export async function setAutomationPresetEnabled(
  db: D1Database,
  orgId: string,
  key: AutomationPresetKey,
  enabled: boolean,
): Promise<void> {
  if (!CATALOG_BY_KEY[key]) throw new Error("Invalid preset key");

  const existing = await db
    .prepare(
      "SELECT id FROM org_automation_presets WHERE organization_id = ? AND preset_key = ?",
    )
    .bind(orgId, key)
    .first<{ id: string }>();

  const ts = now();
  if (existing) {
    await db
      .prepare(
        "UPDATE org_automation_presets SET enabled = ?, updated_at = ? WHERE id = ?",
      )
      .bind(enabled ? 1 : 0, ts, existing.id)
      .run();
    return;
  }

  await db
    .prepare(
      `INSERT INTO org_automation_presets (id, organization_id, preset_key, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(newId(), orgId, key, enabled ? 1 : 0, ts, ts)
    .run();
}
