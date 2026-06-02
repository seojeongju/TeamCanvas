import type { Context } from "hono";
import type { Env } from "../types";
import { newId, now } from "./helpers";

export type PlanFeature =
  | "calendar"
  | "tasks"
  | "teams"
  | "file_storage"
  | "web_push"
  | "audit_logs"
  | "api_access"
  | "custom_branding";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "suspended";

export type OrgSubscription = {
  id: string;
  organizationId: string;
  planId: string;
  planCode: string;
  planName: string;
  status: SubscriptionStatus;
  billingCycle: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  trialEndsAt: number | null;
  maxMembers: number;
  maxTeams: number;
  maxStorageMb: number;
  features: PlanFeature[];
  priceMonthly: number;
  priceYearly: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  maxMembers: number;
  maxTeams: number;
  maxStorageMb: number;
  features: PlanFeature[];
  isActive: boolean;
  sortOrder: number;
};

function parseFeatures(json: string): PlanFeature[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? (parsed as PlanFeature[]) : [];
  } catch {
    return [];
  }
}

function mapSubscriptionRow(row: Record<string, unknown>): OrgSubscription {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    planId: row.plan_id as string,
    planCode: row.plan_code as string,
    planName: row.plan_name as string,
    status: row.status as SubscriptionStatus,
    billingCycle: row.billing_cycle as string,
    currentPeriodStart: row.current_period_start as number,
    currentPeriodEnd: row.current_period_end as number,
    trialEndsAt: (row.trial_ends_at as number | null) ?? null,
    maxMembers: row.max_members as number,
    maxTeams: row.max_teams as number,
    maxStorageMb: row.max_storage_mb as number,
    features: parseFeatures(row.features_json as string),
    priceMonthly: row.price_monthly as number,
    priceYearly: row.price_yearly as number,
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    stripeSubscriptionId: (row.stripe_subscription_id as string | null) ?? null,
  };
}

const SUBSCRIPTION_SELECT = `
  SELECT s.*,
         p.code as plan_code, p.name as plan_name,
         p.max_members, p.max_teams, p.max_storage_mb, p.features_json,
         p.price_monthly, p.price_yearly
  FROM organization_subscriptions s
  JOIN subscription_plans p ON p.id = s.plan_id
`;

export async function getOrgSubscription(db: D1Database, orgId: string): Promise<OrgSubscription | null> {
  const row = await db
    .prepare(`${SUBSCRIPTION_SELECT} WHERE s.organization_id = ?`)
    .bind(orgId)
    .first<Record<string, unknown>>();
  return row ? mapSubscriptionRow(row) : null;
}

export async function orgHasFeature(
  db: D1Database,
  orgId: string,
  feature: PlanFeature,
): Promise<boolean> {
  const sub = await getOrgSubscription(db, orgId);
  if (!sub) return false;
  if (sub.status === "canceled" || sub.status === "suspended") return false;
  return sub.features.includes(feature);
}

export async function requireOrgFeature(
  c: Context<{ Bindings: Env }>,
  orgId: string,
  feature: PlanFeature,
): Promise<OrgSubscription | Response> {
  const sub = await getOrgSubscription(c.env.DB, orgId);
  if (!sub) return c.json({ error: "Subscription not found", code: "NO_SUBSCRIPTION" }, 402);
  if (sub.status === "canceled" || sub.status === "suspended") {
    return c.json({ error: "Subscription inactive", code: "SUBSCRIPTION_INACTIVE" }, 402);
  }
  if (!sub.features.includes(feature)) {
    return c.json({ error: "Feature not available on current plan", code: "FEATURE_LOCKED", feature }, 402);
  }
  return sub;
}

export async function checkMemberLimit(db: D1Database, orgId: string): Promise<{ ok: boolean; limit: number; current: number }> {
  const sub = await getOrgSubscription(db, orgId);
  const limit = sub?.maxMembers ?? 5;
  const row = await db
    .prepare("SELECT COUNT(*) as c FROM memberships WHERE organization_id = ? AND status = 'active'")
    .bind(orgId)
    .first<{ c: number }>();
  const current = row?.c ?? 0;
  return { ok: current < limit, limit, current };
}

export async function createOrgSubscription(
  db: D1Database,
  orgId: string,
  planId = "plan_free",
  options?: { trialDays?: number; status?: SubscriptionStatus },
): Promise<void> {
  const ts = now();
  const trialDays = options?.trialDays ?? 0;
  const status = options?.status ?? (trialDays > 0 ? "trialing" : "active");
  const periodEnd = ts + 30 * 86400000;
  const trialEndsAt = trialDays > 0 ? ts + trialDays * 86400000 : null;

  await db
    .prepare(
      `INSERT INTO organization_subscriptions (
        id, organization_id, plan_id, status, billing_cycle,
        current_period_start, current_period_end, trial_ends_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'monthly', ?, ?, ?, ?, ?)`,
    )
    .bind(newId(), orgId, planId, status, ts, periodEnd, trialEndsAt, ts, ts)
    .run();
}

export async function assignOrgPlan(
  db: D1Database,
  orgId: string,
  planId: string,
  status: SubscriptionStatus = "active",
): Promise<void> {
  const ts = now();
  const existing = await db
    .prepare("SELECT id FROM organization_subscriptions WHERE organization_id = ?")
    .bind(orgId)
    .first();

  if (existing) {
    await db
      .prepare(
        `UPDATE organization_subscriptions
         SET plan_id = ?, status = ?, updated_at = ?, canceled_at = NULL,
             current_period_start = ?, current_period_end = ?
         WHERE organization_id = ?`,
      )
      .bind(planId, status, ts, ts, ts + 30 * 86400000, orgId)
      .run();
    return;
  }

  await createOrgSubscription(db, orgId, planId, { status });
}

export async function listPlans(db: D1Database, activeOnly = true): Promise<SubscriptionPlan[]> {
  const query = activeOnly
    ? "SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order"
    : "SELECT * FROM subscription_plans ORDER BY sort_order";
  const { results } = await db.prepare(query).all<Record<string, unknown>>();
  return (results ?? []).map((row) => ({
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    priceMonthly: row.price_monthly as number,
    priceYearly: row.price_yearly as number,
    maxMembers: row.max_members as number,
    maxTeams: row.max_teams as number,
    maxStorageMb: row.max_storage_mb as number,
    features: parseFeatures(row.features_json as string),
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order as number,
  }));
}

export async function writeAuditLog(
  db: D1Database,
  orgId: string,
  actorId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_logs (id, organization_id, actor_id, action, entity_type, entity_id, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      newId(),
      orgId,
      actorId,
      action,
      entityType ?? null,
      entityId ?? null,
      metadata ? JSON.stringify(metadata) : null,
      now(),
    )
    .run();
}
