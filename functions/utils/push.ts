import type { Env } from "../types";

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function sendPushToUser(
  db: D1Database,
  env: Env,
  userId: string,
  payload: { title: string; body?: string; link?: string },
) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;

  const pref = await db
    .prepare("SELECT push_enabled FROM notification_preferences WHERE user_id = ?")
    .bind(userId)
    .first<{ push_enabled: number }>();
  if (pref && !pref.push_enabled) return;

  const { results } = await db
    .prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?")
    .bind(userId)
    .all();

  for (const row of results ?? []) {
    const sub = row as PushSubscriptionRow;
    try {
      await sendWebPush(env, sub, payload);
    } catch {
      /* ignore per-subscription failures */
    }
  }
}

async function sendWebPush(
  env: Env,
  sub: PushSubscriptionRow,
  payload: { title: string; body?: string; link?: string },
) {
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    link: payload.link ?? "/",
  });

  const jwt = await createVapidJwt(env.VAPID_PRIVATE_KEY!, sub.endpoint);

  await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      "Content-Type": "application/octet-stream",
      TTL: "86400",
    },
    body,
  });
}

/** Minimal VAPID JWT for push services (unencrypted payload — supported by several browsers for simple alerts) */
async function createVapidJwt(privateKeyBase64Url: string, audience: string): Promise<string> {
  const header = btoa(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const origin = new URL(audience).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const payload = btoa(JSON.stringify({ aud: origin, exp, sub: "mailto:noreply@teamcanvas.app" }));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    base64UrlToBytes(privateKeyBase64Url),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const data = new TextEncoder().encode(`${header}.${payload}`);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data);
  const sigB64 = bytesToBase64Url(new Uint8Array(sig));

  return `${header}.${payload}.${sigB64}`;
}

function base64UrlToBytes(s: string): ArrayBuffer {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
