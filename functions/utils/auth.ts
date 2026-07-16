import type { Context } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import type { Env, AuthUser } from "../types";
import { signJwt, verifyJwt } from "./jwt";
import { hashToken, newId, now } from "./helpers";

const ACCESS_MAX_AGE = 60 * 60;
const REFRESH_IDLE_MAX_AGE = 60 * 60 * 24 * 7;
const SESSION_ABSOLUTE_MAX_AGE = 60 * 60 * 24 * 30;

type SessionRow = {
  id: string;
  user_id: string;
  expires_at: number;
  created_at: number;
  last_used_at: number | null;
  absolute_expires_at: number | null;
};

function sessionAbsoluteExpiry(session: SessionRow): number {
  return session.absolute_expires_at ?? session.created_at + SESSION_ABSOLUTE_MAX_AGE * 1000;
}

function refreshMaxAgeSeconds(expiresAt: number): number {
  return Math.max(1, Math.floor((expiresAt - now()) / 1000));
}

export async function setAuthCookies(
  c: Context<{ Bindings: Env }>,
  userId: string,
  email: string | null,
): Promise<{
  sessionExpiresAt: number;
  absoluteExpiresAt: number;
  accessToken: string;
  refreshToken: string;
}> {
  const secret = c.env.JWT_SECRET;
  const issuedAt = now();
  const sessionExpiresAt = issuedAt + REFRESH_IDLE_MAX_AGE * 1000;
  const absoluteExpiresAt = issuedAt + SESSION_ABSOLUTE_MAX_AGE * 1000;
  const accessToken = await signJwt({ sub: userId, email, type: "access" }, secret, ACCESS_MAX_AGE);
  const refreshToken = await signJwt(
    { sub: userId, email, type: "refresh" },
    secret,
    REFRESH_IDLE_MAX_AGE,
  );
  const refreshHash = await hashToken(refreshToken);

  await c.env.DB.prepare(
    `INSERT INTO sessions (
       id, user_id, refresh_token_hash, user_agent, ip_address,
       expires_at, created_at, last_used_at, absolute_expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newId(),
      userId,
      refreshHash,
      c.req.header("user-agent") ?? null,
      c.req.header("cf-connecting-ip") ?? null,
      sessionExpiresAt,
      issuedAt,
      issuedAt,
      absoluteExpiresAt,
    )
    .run();

  const secure = new URL(c.req.url).protocol === "https:";
  setAuthTokenCookies(c, accessToken, refreshToken, secure, REFRESH_IDLE_MAX_AGE);
  return { sessionExpiresAt, absoluteExpiresAt, accessToken, refreshToken };
}

/** OAuth 콜백에서 Set-Cookie가 유실된 경우, 동일 출처 POST로 쿠키를 재설정한다. */
export async function establishSessionFromTokens(
  c: Context<{ Bindings: Env }>,
  accessToken: string,
  refreshToken: string,
): Promise<{ sessionExpiresAt: number; userId: string; email: string | null } | null> {
  const accessPayload = await verifyJwt(accessToken, c.env.JWT_SECRET);
  const refreshPayload = await verifyJwt(refreshToken, c.env.JWT_SECRET);
  if (!accessPayload || accessPayload.type !== "access") return null;
  if (!refreshPayload || refreshPayload.type !== "refresh") return null;
  if (accessPayload.sub !== refreshPayload.sub) return null;

  const hash = await hashToken(refreshToken);
  const issuedAt = now();
  let session = await c.env.DB.prepare(
    `SELECT id, expires_at, created_at, absolute_expires_at
     FROM sessions
     WHERE refresh_token_hash = ? AND user_id = ? AND expires_at > ?`,
  )
    .bind(hash, refreshPayload.sub, issuedAt)
    .first<Pick<SessionRow, "id" | "expires_at" | "created_at" | "absolute_expires_at">>();

  // D1 읽기 지연으로 방금 INSERT한 세션이 안 보일 수 있다.
  // JWT 서명이 유효하면 쿠키를 설정하고, 없으면 세션 행을 보장한다.
  if (!session) {
    const sessionExpiresAt = Math.min(
      refreshPayload.exp * 1000,
      issuedAt + REFRESH_IDLE_MAX_AGE * 1000,
    );
    const absoluteExpiresAt = issuedAt + SESSION_ABSOLUTE_MAX_AGE * 1000;
    await c.env.DB.prepare(
      `INSERT INTO sessions (
         id, user_id, refresh_token_hash, user_agent, ip_address,
         expires_at, created_at, last_used_at, absolute_expires_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        newId(),
        refreshPayload.sub,
        hash,
        c.req.header("user-agent") ?? null,
        c.req.header("cf-connecting-ip") ?? null,
        sessionExpiresAt,
        issuedAt,
        issuedAt,
        absoluteExpiresAt,
      )
      .run();
    session = {
      id: "handoff",
      expires_at: sessionExpiresAt,
      created_at: issuedAt,
      absolute_expires_at: absoluteExpiresAt,
    };
  }

  const absoluteExpiresAt = sessionAbsoluteExpiry({
    id: session.id,
    user_id: refreshPayload.sub,
    expires_at: session.expires_at,
    created_at: session.created_at,
    last_used_at: null,
    absolute_expires_at: session.absolute_expires_at,
  });
  if (absoluteExpiresAt <= issuedAt) return null;

  const sessionExpiresAt = Math.min(session.expires_at, absoluteExpiresAt, refreshPayload.exp * 1000);
  const refreshMaxAge = refreshMaxAgeSeconds(sessionExpiresAt);
  const secure = new URL(c.req.url).protocol === "https:";
  setAuthTokenCookies(c, accessToken, refreshToken, secure, refreshMaxAge);
  return {
    userId: refreshPayload.sub,
    email: refreshPayload.email ?? null,
    sessionExpiresAt,
  };
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
  let payload = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!payload || payload.type !== "access") {
    const refresh = getCookie(c, "refresh_token");
    if (!refresh) return null;
    const refreshPayload = await verifyJwt(refresh, c.env.JWT_SECRET);
    if (!refreshPayload || refreshPayload.type !== "refresh") return null;

    const hash = await hashToken(refresh);
    const session = await c.env.DB.prepare(
      `SELECT id, user_id, expires_at, created_at, last_used_at, absolute_expires_at
       FROM sessions
       WHERE refresh_token_hash = ? AND user_id = ? AND expires_at > ?
         AND COALESCE(absolute_expires_at, created_at + ?) > ?`,
    )
      .bind(hash, refreshPayload.sub, now(), SESSION_ABSOLUTE_MAX_AGE * 1000, now())
      .first<SessionRow>();
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
): Promise<{
  userId: string;
  email: string | null;
  sessionExpiresAt: number;
  absoluteExpiresAt: number;
} | null> {
  const refresh = getCookie(c, "refresh_token");
  if (!refresh) return null;

  const refreshPayload = await verifyJwt(refresh, c.env.JWT_SECRET);
  if (!refreshPayload || refreshPayload.type !== "refresh") return null;

  const oldHash = await hashToken(refresh);
  const session = await c.env.DB.prepare(
    `SELECT id, user_id, expires_at, created_at, last_used_at, absolute_expires_at
     FROM sessions
     WHERE refresh_token_hash = ? AND user_id = ? AND expires_at > ?
       AND COALESCE(absolute_expires_at, created_at + ?) > ?`,
  )
    .bind(oldHash, refreshPayload.sub, now(), SESSION_ABSOLUTE_MAX_AGE * 1000, now())
    .first<SessionRow>();
  if (!session) return null;

  const refreshedAt = now();
  const absoluteExpiresAt = sessionAbsoluteExpiry(session);
  const expiry = Math.min(
    refreshedAt + REFRESH_IDLE_MAX_AGE * 1000,
    absoluteExpiresAt,
  );
  if (expiry <= refreshedAt) return null;
  const refreshMaxAge = refreshMaxAgeSeconds(expiry);

  const accessToken = await signJwt(
    { sub: refreshPayload.sub, email: refreshPayload.email, type: "access" },
    c.env.JWT_SECRET,
    ACCESS_MAX_AGE,
  );
  const newRefreshToken = await signJwt(
    { sub: refreshPayload.sub, email: refreshPayload.email, type: "refresh" },
    c.env.JWT_SECRET,
    refreshMaxAge,
  );

  const newHash = await hashToken(newRefreshToken);
  const update = await c.env.DB.prepare(
    `UPDATE sessions
     SET refresh_token_hash = ?, expires_at = ?, last_used_at = ?,
         absolute_expires_at = COALESCE(absolute_expires_at, ?),
         user_agent = ?, ip_address = ?
     WHERE id = ? AND refresh_token_hash = ?`,
  )
    .bind(
      newHash,
      expiry,
      refreshedAt,
      absoluteExpiresAt,
      c.req.header("user-agent") ?? null,
      c.req.header("cf-connecting-ip") ?? null,
      session.id,
      oldHash,
    )
    .run();
  if (!update.meta.changes) return null;

  const secure = new URL(c.req.url).protocol === "https:";
  setAuthTokenCookies(c, accessToken, newRefreshToken, secure, refreshMaxAge);

  return {
    userId: refreshPayload.sub,
    email: refreshPayload.email ?? null,
    sessionExpiresAt: expiry,
    absoluteExpiresAt,
  };
}

function setAuthTokenCookies(
  c: Context<{ Bindings: Env }>,
  accessToken: string,
  refreshToken: string,
  secure: boolean,
  refreshMaxAge: number,
): void {
  const cookieOpts = { httpOnly: true, secure, sameSite: "Lax" as const, path: "/" };
  setCookie(c, "access_token", accessToken, { ...cookieOpts, maxAge: ACCESS_MAX_AGE });
  setCookie(c, "refresh_token", refreshToken, { ...cookieOpts, maxAge: refreshMaxAge });
}

export async function getSessionExpiry(c: Context<{ Bindings: Env }>): Promise<number | null> {
  const refresh = getCookie(c, "refresh_token");
  if (!refresh) return null;
  const payload = await verifyJwt(refresh, c.env.JWT_SECRET);
  if (!payload || payload.type !== "refresh") return null;
  const hash = await hashToken(refresh);
  const session = await c.env.DB.prepare(
    `SELECT expires_at, created_at, absolute_expires_at
     FROM sessions WHERE refresh_token_hash = ? AND user_id = ? AND expires_at > ?`,
  )
    .bind(hash, payload.sub, now())
    .first<Pick<SessionRow, "expires_at" | "created_at" | "absolute_expires_at">>();
  if (!session) return null;
  const absoluteExpiresAt =
    session.absolute_expires_at ??
    session.created_at + SESSION_ABSOLUTE_MAX_AGE * 1000;
  if (absoluteExpiresAt <= now()) return null;
  return Math.min(session.expires_at, absoluteExpiresAt, payload.exp * 1000);
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
