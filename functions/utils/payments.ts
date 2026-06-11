import type { Env } from "../types";

export type BillingProvider = "stripe" | "mock";

export type CreateCheckoutInput = {
  provider: BillingProvider;
  stripeSecretKey?: string;
  stripeCustomerId?: string | null;
  planId: string;
  planCode: string;
  priceId: string | null;
  orgId: string;
  userId: string;
  userEmail: string | null;
  successUrl: string;
  cancelUrl: string;
  billingCycle: "monthly" | "yearly";
};

export type CheckoutSessionResult = {
  provider: BillingProvider;
  sessionId: string;
  url: string;
};

export function resolveBillingProvider(env: Env): BillingProvider {
  const raw = env.PAYMENT_PROVIDER?.toLowerCase();
  if (raw === "mock") return "mock";
  if (raw === "stripe") return "stripe";
  return env.STRIPE_SECRET_KEY ? "stripe" : "mock";
}

export async function createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSessionResult> {
  if (input.provider === "mock") {
    const sessionId = `mock_cs_${crypto.randomUUID().replace(/-/g, "")}`;
    const url = `${input.successUrl}&mock=1&plan_id=${encodeURIComponent(input.planId)}&session_id=${encodeURIComponent(sessionId)}`;
    return { provider: "mock", sessionId, url };
  }

  if (!input.stripeSecretKey) {
    throw new Error("STRIPE_NOT_CONFIGURED");
  }
  if (!input.priceId) {
    throw new Error("NO_STRIPE_PRICE");
  }

  const params = new URLSearchParams({
    mode: "subscription",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "line_items[0][price]": input.priceId,
    "line_items[0][quantity]": "1",
    "metadata[organization_id]": input.orgId,
    "metadata[plan_id]": input.planId,
    "metadata[user_id]": input.userId,
    "metadata[provider]": "stripe",
    customer_email: input.userEmail ?? "",
  });

  if (input.stripeCustomerId) {
    params.delete("customer_email");
    params.set("customer", input.stripeCustomerId);
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`STRIPE_CHECKOUT_FAILED:${detail}`);
  }

  const session = (await res.json()) as { id: string; url?: string };
  if (!session.url) throw new Error("STRIPE_CHECKOUT_URL_MISSING");
  return { provider: "stripe", sessionId: session.id, url: session.url };
}

export async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
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
