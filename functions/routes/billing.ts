import { Hono } from "hono";
import type { Env } from "../types";
import { requireAuth } from "../utils/auth";
import { requireOrgPermission } from "../utils/permissions";
import {
  requireOrgFeature,
  getOrgSubscription,
  assignOrgPlan,
  writeAuditLog,
  type SubscriptionStatus,
} from "../utils/subscriptions";
import { frontendUrl } from "../utils/email";
import { now } from "../utils/helpers";
import { createCheckoutSession, resolveBillingProvider, verifyStripeSignature } from "../utils/payments";

export const billingRoutes = new Hono<{ Bindings: Env }>();

billingRoutes.post("/organizations/:orgId/billing/checkout", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "billing:manage");
  if (access instanceof Response) return access;

  const body = await c.req.json<{ planId: string; billingCycle?: "monthly" | "yearly" }>();
  if (!body.planId) return c.json({ error: "planId required" }, 400);

  const plan = await c.env.DB.prepare(
    "SELECT id, code, name, stripe_price_monthly_id, stripe_price_yearly_id FROM subscription_plans WHERE id = ? AND is_active = 1",
  )
    .bind(body.planId)
    .first<{
      id: string;
      code: string;
      name: string;
      stripe_price_monthly_id: string | null;
      stripe_price_yearly_id: string | null;
    }>();

  if (!plan) return c.json({ error: "Invalid plan" }, 400);

  const cycle = body.billingCycle ?? "monthly";
  const provider = resolveBillingProvider(c.env);
  const priceId = cycle === "yearly" ? plan.stripe_price_yearly_id : plan.stripe_price_monthly_id;

  const base = frontendUrl(c.req.raw, c.env);
  const sub = await getOrgSubscription(c.env.DB, orgId);
  try {
    const session = await createCheckoutSession({
      provider,
      stripeSecretKey: c.env.STRIPE_SECRET_KEY,
      stripeCustomerId: sub?.stripeCustomerId ?? null,
      planId: plan.id,
      planCode: plan.code,
      priceId,
      orgId,
      userId: user.id,
      userEmail: user.email,
      successUrl: `${base}/settings/billing?success=1`,
      cancelUrl: `${base}/settings/billing?canceled=1`,
      billingCycle: cycle,
    });

    await writeAuditLog(c.env.DB, orgId, user.id, "billing.checkout_started", "plan", plan.id, {
      sessionId: session.sessionId,
      cycle,
      provider,
    });

    return c.json({ url: session.url, sessionId: session.sessionId, provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown billing error";
    if (message === "STRIPE_NOT_CONFIGURED") {
      return c.json({ error: "Stripe not configured", code: "STRIPE_NOT_CONFIGURED" }, 503);
    }
    if (message === "NO_STRIPE_PRICE") {
      return c.json({ error: "Stripe price not configured for this plan", code: "NO_STRIPE_PRICE" }, 400);
    }
    if (message.startsWith("STRIPE_CHECKOUT_FAILED:")) {
      return c.json(
        { error: "Stripe checkout failed", detail: message.replace("STRIPE_CHECKOUT_FAILED:", "") },
        502,
      );
    }
    return c.json({ error: "Checkout failed", detail: message }, 500);
  }
});

billingRoutes.post("/webhooks/stripe", async (c) => {
  const secret = c.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: "Webhook not configured" }, 503);

  const payload = await c.req.text();
  const sig = c.req.header("stripe-signature");
  if (!sig || !(await verifyStripeSignature(payload, sig, secret))) {
    return c.json({ error: "Invalid signature" }, 400);
  }

  const event = JSON.parse(payload) as {
    type: string;
    data: { object: Record<string, unknown> };
  };

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const metadata = session.metadata as Record<string, string> | undefined;
    const org = metadata?.organization_id;
    const planId = metadata?.plan_id;

    if (org && planId) {
      await assignOrgPlan(c.env.DB, org, planId, "active");
      const customerId = session.customer as string | undefined;
      const subscriptionId = session.subscription as string | undefined;
      if (customerId || subscriptionId) {
        await c.env.DB.prepare(
          `UPDATE organization_subscriptions
           SET stripe_customer_id = COALESCE(?, stripe_customer_id),
               stripe_subscription_id = COALESCE(?, stripe_subscription_id),
               updated_at = ?
           WHERE organization_id = ?`,
        )
          .bind(customerId ?? null, subscriptionId ?? null, now(), org)
          .run();
      }
      await writeAuditLog(c.env.DB, org, null, "billing.subscription_activated", "plan", planId, {
        stripeSessionId: session.id,
      });
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted" ||
    event.type === "invoice.payment_failed"
  ) {
    const sub = event.data.object;
    const subId = String(sub.id ?? "");
    if (subId) {
      const orgId = await findOrgIdByStripeSubscription(c.env.DB, subId);
      if (orgId) {
        const nextStatus =
          event.type === "invoice.payment_failed"
            ? "past_due"
            : mapStripeStatus((sub.status as string | undefined) ?? "active");

        await syncStripeSubscriptionSnapshot(c.env.DB, orgId, sub, nextStatus);

        if (event.type === "customer.subscription.deleted") {
          await assignOrgPlan(c.env.DB, orgId, "plan_free", "canceled");
          await writeAuditLog(c.env.DB, orgId, null, "billing.subscription_canceled", "subscription", subId, {
            status: nextStatus,
          });
        } else if (event.type === "invoice.payment_failed") {
          await writeAuditLog(c.env.DB, orgId, null, "billing.payment_failed", "subscription", subId, {
            status: nextStatus,
          });
        } else {
          await writeAuditLog(c.env.DB, orgId, null, "billing.subscription_updated", "subscription", subId, {
            status: nextStatus,
          });
        }
      }
    }
  }

  return c.json({ received: true });
});

billingRoutes.post("/organizations/:orgId/billing/mock/complete", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "billing:manage");
  if (access instanceof Response) return access;

  const provider = resolveBillingProvider(c.env);
  if (provider !== "mock") {
    return c.json({ error: "Mock completion is only available when PAYMENT_PROVIDER=mock" }, 403);
  }

  const body = await c.req.json<{ planId: string }>();
  if (!body.planId) return c.json({ error: "planId required" }, 400);

  await assignOrgPlan(c.env.DB, orgId, body.planId, "active");
  await writeAuditLog(c.env.DB, orgId, user.id, "billing.subscription_activated", "plan", body.planId, {
    provider: "mock",
    completedAt: now(),
  });

  return c.json({ ok: true, provider: "mock", status: "active", planId: body.planId });
});

function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      return "active";
  }
}

async function findOrgIdByStripeSubscription(db: D1Database, stripeSubscriptionId: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT organization_id FROM organization_subscriptions WHERE stripe_subscription_id = ?")
    .bind(stripeSubscriptionId)
    .first<{ organization_id: string }>();
  return row?.organization_id ?? null;
}

async function syncStripeSubscriptionSnapshot(
  db: D1Database,
  orgId: string,
  subscription: Record<string, unknown>,
  status: SubscriptionStatus,
): Promise<void> {
  const stripeSubId = String(subscription.id ?? "");
  const stripeCustomerId = (subscription.customer as string | undefined) ?? null;
  const periodStartSec = Number(subscription.current_period_start ?? 0);
  const periodEndSec = Number(subscription.current_period_end ?? 0);
  const canceledAtSec = Number(subscription.canceled_at ?? 0);
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
  const items = subscription.items as { data?: Array<Record<string, unknown>> } | undefined;
  const firstItem = items?.data?.[0];
  const recurringInterval = (firstItem?.price as { recurring?: { interval?: string } } | undefined)?.recurring
    ?.interval;
  const billingCycle = recurringInterval === "year" ? "yearly" : "monthly";
  const ts = now();

  await db
    .prepare(
      `UPDATE organization_subscriptions
       SET status = ?,
           billing_cycle = ?,
           current_period_start = CASE WHEN ? > 0 THEN ? ELSE current_period_start END,
           current_period_end = CASE WHEN ? > 0 THEN ? ELSE current_period_end END,
           canceled_at = CASE WHEN ? > 0 OR ? THEN ? ELSE NULL END,
           stripe_subscription_id = COALESCE(?, stripe_subscription_id),
           stripe_customer_id = COALESCE(?, stripe_customer_id),
           updated_at = ?
       WHERE organization_id = ?`,
    )
    .bind(
      status,
      billingCycle,
      periodStartSec,
      periodStartSec > 0 ? periodStartSec * 1000 : null,
      periodEndSec,
      periodEndSec > 0 ? periodEndSec * 1000 : null,
      canceledAtSec,
      cancelAtPeriodEnd ? 1 : 0,
      canceledAtSec > 0 ? canceledAtSec * 1000 : ts,
      stripeSubId || null,
      stripeCustomerId,
      ts,
      orgId,
    )
    .run();
}
