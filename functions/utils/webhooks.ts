import { appUrl } from "./helpers";

export type WebhookEventType =
  | "event.created"
  | "task.assigned"
  | "task.completed"
  | "task.created"
  | "task.comment"
  | "project.comment";

export type WebhookPayload = {
  type: WebhookEventType;
  organizationId: string;
  title: string;
  body?: string;
  link?: string;
  actorName?: string;
  timestamp: number;
};

type WebhookRow = {
  id: string;
  url: string;
  provider: string;
  events_json: string;
};

function parseEvents(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((e) => typeof e === "string") : [];
  } catch {
    return [];
  }
}

function formatPlainLines(payload: WebhookPayload): string {
  return [
    payload.title,
    payload.body,
    payload.actorName ? `by ${payload.actorName}` : null,
    payload.link,
  ]
    .filter(Boolean)
    .join("\n");
}

function slackBody(payload: WebhookPayload): Record<string, unknown> {
  const lines = [
    payload.title,
    payload.body,
    payload.actorName ? `by ${payload.actorName}` : null,
    payload.link ? `<${payload.link}|열기>` : null,
  ].filter(Boolean);
  return { text: lines.join("\n") };
}

/** 카카오워크 Incoming Webhook — text 필드 */
function kakaoworkBody(payload: WebhookPayload): Record<string, unknown> {
  return { text: formatPlainLines(payload) };
}

function genericBody(payload: WebhookPayload): Record<string, unknown> {
  return {
    type: payload.type,
    organizationId: payload.organizationId,
    title: payload.title,
    body: payload.body ?? null,
    link: payload.link ?? null,
    actorName: payload.actorName ?? null,
    timestamp: payload.timestamp,
  };
}

async function postWebhook(url: string, provider: string, payload: WebhookPayload): Promise<void> {
  const body =
    provider === "slack"
      ? slackBody(payload)
      : provider === "kakaowork"
        ? kakaoworkBody(payload)
        : genericBody(payload);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Webhook ${res.status}`);
  }
}

/** 조직 웹훅으로 이벤트 발송 (실패는 무시) */
export async function dispatchOrgWebhooks(
  db: D1Database,
  organizationId: string,
  eventType: WebhookEventType,
  payload: Omit<WebhookPayload, "type" | "organizationId" | "timestamp">,
  requestUrl?: string,
  env?: { APP_URL?: string },
): Promise<void> {
  const { results } = await db
    .prepare(
      `SELECT id, url, provider, events_json FROM org_webhooks
       WHERE organization_id = ? AND enabled = 1`,
    )
    .bind(organizationId)
    .all<WebhookRow>();

  const base = requestUrl && env ? appUrl({ url: requestUrl } as Request, env) : "";
  const link = payload.link && base ? `${base}${payload.link}` : payload.link;

  const full: WebhookPayload = {
    type: eventType,
    organizationId,
    title: payload.title,
    body: payload.body,
    link,
    actorName: payload.actorName,
    timestamp: Date.now(),
  };

  for (const row of results ?? []) {
    const events = parseEvents(row.events_json);
    if (!events.includes(eventType)) continue;
    try {
      await postWebhook(row.url, row.provider, full);
    } catch {
      /* 개별 웹훅 실패 무시 */
    }
  }
}
