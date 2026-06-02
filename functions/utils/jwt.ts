const encoder = new TextEncoder();

function b64url(input: string | ArrayBuffer): string {
  const bytes =
    typeof input === "string" ? encoder.encode(input) : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): string {
  const padded = input + "=".repeat((4 - (input.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export type JwtPayload = {
  sub: string;
  email?: string | null;
  type: "access" | "refresh";
  exp: number;
  iat: number;
};

export async function signJwt(
  payload: Omit<JwtPayload, "iat" | "exp"> & { exp?: number },
  secret: string,
  expiresInSec: number,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = payload.exp ?? iat + expiresInSec;
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ ...payload, iat, exp }));
  const data = `${header}.${body}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return `${data}.${b64url(sig)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const [headerB64, payloadB64, sigB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !sigB64) return null;
    const data = `${headerB64}.${payloadB64}`;
    const key = await hmacKey(secret);
    const sigBytes = Uint8Array.from(
      atob(sigB64.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(data));
    if (!valid) return null;
    const payload = JSON.parse(b64urlDecode(payloadB64)) as JwtPayload;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function signOAuthState(
  data: Record<string, string>,
  secret: string,
): Promise<string> {
  const payload = b64url(JSON.stringify({ ...data, ts: Date.now() }));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

export async function verifyOAuthState(
  state: string,
  secret: string,
): Promise<Record<string, string> | null> {
  try {
    const [payloadB64, sigB64] = state.split(".");
    if (!payloadB64 || !sigB64) return null;
    const key = await hmacKey(secret);
    const sigBytes = Uint8Array.from(
      atob(sigB64.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(payloadB64));
    if (!valid) return null;
    const data = JSON.parse(b64urlDecode(payloadB64)) as Record<string, string> & { ts: number };
    if (Date.now() - data.ts > 10 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}
