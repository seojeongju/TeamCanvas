import type { Context } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import type { Env, AuthUser } from "../types";
import { signJwt, verifyJwt } from "./jwt";
import { hashToken, newId, now } from "./helpers";

const ACCESS_MAX_AGE = 60 * 60 * 24;
const REFRESH_MAX_AGE = 60 * 60 * 24;

export async function setAuthCookies(
  c: Context<{ Bindings: Env }>,
  userId: string,
  email: string | null,
): Promise<void> {
  const secret = c.env.JWT_SECRET;
  const accessToken = await signJwt({ sub: userId, email, type: "access" }, secret, ACCESS_MAX_AGE);
  const refreshToken = await signJwt({ sub: userId, email, type: "refresh" }, secret, REFRESH_MAX_AGE);
  const refreshHash = await hashToken(refreshToken);

  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, ip_address, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newId(),
      userId,
      refreshHash,
      c.req.header("user-agent") ?? null,
      c.req.header("cf-connecting-ip") ?? null,
      now() + REFRESH_MAX_AGE * 1000,
      now(),
    )
    .run();

  const secure = new URL(c.req.url).protocol === "https:";
  setAuthTokenCookies(c, accessToken, refreshToken, secure);
}

export async function clearAuthCookies(c: Context<{ Bindings: Env }>): Promise<void> {
  const refresh = getCookie(c, "refresh_token");
  if (refresh) {
    const hash = await hashToken(refresh);
    await c.env.DB.prepare("DELETE FROM sessions WHERE refresh_token_hash = ?").bind(hash).run();
  }
  deleteCookie(c, "access_token", { path: "/" });
  deleteCookie(c, "refresh_token", { path: "/" });
}

export async function getAuthUser(c: Context<{ Bindings: Env }>): Promise<AuthUser | null> {
  let token = getCookie(c, "access_token");
  if (!token) return null;

  let payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload || payload.type !== "access") {
    const refresh = getCookie(c, "refresh_token");
    if (!refresh) return null;
    const refreshPayload = await verifyJwt(refresh, c.env.JWT_SECRET);
    if (!refreshPayload || refreshPayload.type !== "refresh") return null;

    const hash = await hashToken(refresh);
    const session = await c.env.DB.prepare(
      "SELECT id FROM sessions WHERE refresh_token_hash = ? AND expires_at > ?",
    )
      .bind(hash, now())
      .first<{ id: string }>();
    if (!session) return null;

    token = await signJwt(
      { sub: refreshPayload.sub, email: refreshPayload.email, type: "access" },
      c.env.JWT_SECRET,
      ACCESS_MAX_AGE,
    );
    const secure = new URL(c.req.url).protocol === "https:";
    setCookie(c, "access_token", token, { httpOnly: true, secure, sameSite: "Lax", path: "/", maxAge: ACCESS_MAX_AGE });
    payload = await verifyJwt(token, c.env.JWT_SECRET);
    if (!payload) return null;
  }

  const user = await c.env.DB.prepare(
    "SELECT id, email, name, avatar_url, email_verified FROM users WHERE id = ?",
  )
    .bind(payload.sub)
    .first<{
      id: string;
      email: string | null;
      name: string;
      avatar_url: string | null;
      email_verified: number;
    }>();

  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url,
    emailVerified: Boolean(user.email_verified),
  };
}

export async function refreshAuthSession(
  c: Context<{ Bindings: Env }>,
): Promise<{ userId: string; email: string | null; sessionExpiresAt: number } | null> {
  const refresh = getCookie(c, "refresh_token");
  if (!refresh) return null;

  const refreshPayload = await verifyJwt(refresh, c.env.JWT_SECRET);
  if (!refreshPayload || refreshPayload.type !== "refresh") return null;

  const oldHash = await hashToken(refresh);
  const session = await c.env.DB.prepare(
    "SELECT id FROM sessions WHERE refresh_token_hash = ? AND expires_at > ?",
  )
    .bind(oldHash, now())
    .first<{ id: string }>();
  if (!session) return null;

  await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(session.id).run();

  const accessToken = await signJwt(
    { sub: refreshPayload.sub, email: refreshPayload.email, type: "access" },
    c.env.JWT_SECRET,
    ACCESS_MAX_AGE,
  );
  const newRefreshToken = await signJwt(
    { sub: refreshPayload.sub, email: refreshPayload.email, type: "refresh" },
    c.env.JWT_SECRET,
    REFRESH_MAX_AGE,
  );

  const secure = new URL(c.req.url).protocol === "https:";
  setAuthTokenCookies(c, accessToken, newRefreshToken, secure);

  const newHash = await hashToken(newRefreshToken);
  const expiry = now() + REFRESH_MAX_AGE * 1000;
  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, ip_address, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newId(),
      refreshPayload.sub,
      newHash,
      c.req.header("user-agent") ?? null,
      c.req.header("cf-connecting-ip") ?? null,
      expiry,
      now(),
    )
    .run();

  return {
    userId: refreshPayload.sub,
    email: refreshPayload.email ?? null,
    sessionExpiresAt: expiry,
  };
}

function setAuthTokenCookies(
  c: Context<{ Bindings: Env }>,
  accessToken: string,
  refreshToken: string,
  secure: boolean,
): void {
  const cookieOpts = { httpOnly: true, secure, sameSite: "Lax" as const, path: "/" };
  setCookie(c, "access_token", accessToken, { ...cookieOpts, maxAge: ACCESS_MAX_AGE });
  setCookie(c, "refresh_token", refreshToken, { ...cookieOpts, maxAge: REFRESH_MAX_AGE });
}

export async function getSessionExpiry(c: Context<{ Bindings: Env }>): Promise<number | null> {
  const refresh = getCookie(c, "refresh_token");
  if (!refresh) return null;
  const payload = await verifyJwt(refresh, c.env.JWT_SECRET);
  if (!payload || payload.type !== "refresh") return null;
  return payload.exp * 1000;
}

export async function requireAuth(c: Context<{ Bindings: Env }>): Promise<AuthUser | Response> {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return user;
}

export async function requireOrgMember(
  c: Context<{ Bindings: Env }>,
  userId: string,
  orgId: string,
): Promise<{ role: string } | Response> {
  const membership = await c.env.DB.prepare(
    "SELECT role FROM memberships WHERE organization_id = ? AND user_id = ? AND status = 'active'",
  )
    .bind(orgId, userId)
    .first<{ role: string }>();

  if (!membership) return c.json({ error: "Forbidden" }, 403);
  return membership;
}
