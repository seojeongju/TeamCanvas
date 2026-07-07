import type { Env } from "../types";
import {
  type AutomationPresetKey,
  isAutomationPresetEnabled,
} from "./automationPresets";
import {
  dispatchOrgWebhooks,
  type WebhookEventType,
} from "./webhooks";

const WEBHOOK_PRESET_BY_EVENT: Partial<Record<WebhookEventType, AutomationPresetKey>> = {
  "task.assigned": "webhook_task_assigned",
  "task.completed": "webhook_task_completed",
  "event.created": "webhook_event_created",
  "task.created": "webhook_high_priority_task",
  "project.comment": "webhook_project_comment",
};

export async function dispatchAutomationWebhooks(
  db: D1Database,
  organizationId: string,
  eventType: WebhookEventType,
  payload: {
    title: string;
    body?: string;
    link?: string;
    actorName?: string;
  },
  requestUrl?: string,
  env?: Env,
  opts?: { presetKey?: AutomationPresetKey; skipPresetCheck?: boolean },
): Promise<void> {
  const presetKey = opts?.presetKey ?? WEBHOOK_PRESET_BY_EVENT[eventType];
  if (!opts?.skipPresetCheck && presetKey) {
    const enabled = await isAutomationPresetEnabled(db, organizationId, presetKey);
    if (!enabled) return;
  }

  await dispatchOrgWebhooks(db, organizationId, eventType, payload, requestUrl, env);
}
