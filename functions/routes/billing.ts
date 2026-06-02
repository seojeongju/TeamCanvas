import { Hono } from "hono";
import type { Env } from "../types";
import { requireAuth } from "../utils/auth";
import { requireOrgPermission } from "../utils/permissions";
import { requireOrgFeature, getOrgSubscription, assignOrgPlan, writeAuditLog } from "../utils/subscriptions";
import { frontendUrl } from "../utils/email";
import { now } from "../utils/helpers";

export const billingRoutes = new Hono<{ Bindings: Env }>();

billingRoutes.post("/organizations/:orgId/billing/checkout", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "billing:manage");
  if (access instanceof Response) return access;

  const secret = c.env.STRIPE_SECRET_KEY;
  if (!secret) return c.json({ error: "Stripe not configured", code: "STRIPE_NOT_CONFIGURED" }, 503);

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
  const priceId =
    cycle === "yearly" ? plan.stripe_price_yearly_id : plan.stripe_price_monthly_id;
  if (!priceId) {
    return c.json({ error: "Stripe price not configured for this plan", code: "NO_STRIPE_PRICE" }, 400);
  }

  const base = frontendUrl(c.req.raw, c.env);
  const params = new URLSearchParams({
    mode: "subscription",
    success_url: `${base}/settings/billing?success=1`,
    cancel_url: `${base}/settings/billing?canceled=1`,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    "metadata[organization_id]": orgId,
    "metadata[plan_id]": plan.id,
    "metadata[user_id]": user.id,
    customer_email: user.email ?? "",
  });

  const sub = await getOrgSubscription(c.env.DB, orgId);
  if (sub?.stripeCustomerId) {
    params.delete("customer_email");
    params.set("customer", sub.stripeCustomerId);
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!res.ok) {
    const err = await res.text();
    return c.json({ error: "Stripe checkout failed", detail: err }, 502);
  }

  const session = (await res.json()) as { url?: string; id: string };
  await writeAuditLog(c.env.DB, orgId, user.id, "billing.checkout_started", "plan", plan.id, {
    sessionId: session.id,
    cycle,
  });

  return c.json({ url: session.url, sessionId: session.id });
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

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const subId = sub.id as string;
    const row = await c.env.DB.prepare(
      "SELECT organization_id FROM organization_subscriptions WHERE stripe_subscription_id = ?",
    )
      .bind(subId)
      .first<{ organization_id: string }>();
    if (row) {
      await assignOrgPlan(c.env.DB, row.organization_id, "plan_free", "canceled");
      await writeAuditLog(c.env.DB, row.organization_id, null, "billing.subscription_canceled", "subscription", subId);
    }
  }

  return c.json({ received: true });
});

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    }),
  ) as { t?: string; v1?: string };

  if (!parts.t || !parts.v1) return false;

  const signed = await crypto.subtle.sign(
    "HMAC",
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    ),
    new TextEncoder().encode(`${parts.t}.${payload}`),
  );

  const expected = [...new Uint8Array(signed)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === parts.v1;
}
