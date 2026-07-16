import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import type { Context } from "hono";
import type { Env } from "../types";
import { frontendUrl } from "../utils/email";
import {
  oauthRedirectUri,
  htmlRedirect,
  loginRedirect,
  completeOAuthLogin,
} from "../utils/oauth";
import { signOAuthState, verifyOAuthState } from "../utils/jwt";
import {
  setAuthCookies,
  clearAuthCookies,
  getAuthUser,
  getSessionExpiry,
  refreshAuthSession,
  establishSessionFromTokens,
  redirectWithAuthCookies,
} from "../utils/auth";
import { upsertOAuthUser, getUserOrganizations, registerEmailUser, loginEmailUser, resolveDisplayName } from "../utils/db";
import { extendAuthMe } from "../routes/admin";
import { validateEmail, validatePassword, validateName, normalizeEmail } from "../utils/validate";
import {
  createAuthToken,
  findValidToken,
  consumeAuthToken,
  canResendVerification,
  markEmailVerified,
  updateUserPassword,
  findUserByEmail,
} from "../utils/authTokens";
import { sendVerificationEmail, sendPasswordResetEmail } from "../utils/email";
import { hashPassword } from "../utils/password";
import { checkRateLimit, clientIp, rateLimitResponse } from "../utils/rateLimit";

const app = new Hono<{ Bindings: Env }>().basePath("/auth");

async function enforceAuthRateLimit(c: Context<{ Bindings: Env }>, action: string): Promise<Response | null> {
  const key = `${action}:${clientIp(c.req.raw)}`;
  const { allowed, retryAfterSec } = await checkRateLimit(c.env, key, 20, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterSec ?? 60);
  return null;
}

app.get("/providers", (c) => {
  return c.json({
    google: Boolean(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET),
    kakao: Boolean(c.env.KAKAO_CLIENT_ID),
  });
});

app.get("/google", async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  if (!clientId) return c.json({ error: "Google OAuth not configured" }, 503);

  const state = await signOAuthState({ provider: "google" }, c.env.JWT_SECRET);
  const redirectUri = oauthRedirectUri(c, "google");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get("/kakao", async (c) => {
  const clientId = c.env.KAKAO_CLIENT_ID;
  if (!clientId) return c.json({ error: "Kakao OAuth not configured" }, 503);

  const state = await signOAuthState({ provider: "kakao" }, c.env.JWT_SECRET);
  const redirectUri = oauthRedirectUri(c, "kakao");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    scope: "profile_nickname,account_email,profile_image",
  });
  return c.redirect(`https://kauth.kakao.com/oauth/authorize?${params}`);
});

async function handleGoogleCallback(c: Context<{ Bindings: Env }>) {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");
  if (error) return loginRedirect(c, error);
  if (!code || !state) return loginRedirect(c, "invalid_callback");

  const stateData = await verifyOAuthState(state, c.env.JWT_SECRET);
  if (!stateData || stateData.provider !== "google") return loginRedirect(c, "invalid_state");

  const redirectUri = oauthRedirectUri(c, "google");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID!,
      client_secret: c.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) return loginRedirect(c, "token_exchange_failed");
  const tokens = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) return loginRedirect(c, "profile_failed");
  const profile = (await profileRes.json()) as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
  };

  const user = await upsertOAuthUser(c.env.DB, "google", profile.sub, {
    name: profile.name ?? "Google 사용자",
    email: profile.email ?? null,
    avatarUrl: profile.picture,
  });
  return completeOAuthLogin(c, user.id, user.email);
}

async function handleKakaoCallback(c: Context<{ Bindings: Env }>) {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");
  if (error) return loginRedirect(c, error);
  if (!code || !state) return loginRedirect(c, "invalid_callback");

  const stateData = await verifyOAuthState(state, c.env.JWT_SECRET);
  if (!stateData || stateData.provider !== "kakao") return loginRedirect(c, "invalid_state");

  const redirectUri = oauthRedirectUri(c, "kakao");
  const tokenBody: Record<string, string> = {
    grant_type: "authorization_code",
    client_id: c.env.KAKAO_CLIENT_ID!,
    redirect_uri: redirectUri,
    code,
  };
  if (c.env.KAKAO_CLIENT_SECRET) tokenBody.client_secret = c.env.KAKAO_CLIENT_SECRET;

  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(tokenBody),
  });
  if (!tokenRes.ok) return loginRedirect(c, "token_exchange_failed");
  const tokens = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
  });
  if (!profileRes.ok) return loginRedirect(c, "profile_failed");
  const profile = (await profileRes.json()) as {
    id: number;
    kakao_account?: { email?: string; profile?: { nickname?: string; profile_image_url?: string } };
  };

  const user = await upsertOAuthUser(c.env.DB, "kakao", String(profile.id), {
    name: profile.kakao_account?.profile?.nickname ?? "카카오 사용자",
    email: profile.kakao_account?.email ?? null,
    avatarUrl: profile.kakao_account?.profile?.profile_image_url,
  });
  return completeOAuthLogin(c, user.id, user.email);
}

app.get("/callback/google", async (c) => {
  try {
    return await handleGoogleCallback(c);
  } catch (error) {
    console.error("Google OAuth callback failed", error);
    return loginRedirect(c, "oauth_failed");
  }
});

app.get("/callback/kakao", async (c) => {
  try {
    return await handleKakaoCallback(c);
  } catch (error) {
    console.error("Kakao OAuth callback failed", error);
    return loginRedirect(c, "oauth_failed");
  }
});

app.post("/register", async (c) => {
  const limited = await enforceAuthRateLimit(c, "register");
  if (limited) return limited;

  const body = await c.req.json<{ email?: string; password?: string; name?: string }>();

  const emailErr = validateEmail(body.email ?? "");
  if (emailErr) return c.json({ error: emailErr }, 400);

  const pwErr = validatePassword(body.password ?? "", true);
  if (pwErr) return c.json({ error: pwErr }, 400);

  const name = resolveDisplayName(body.name, body.email!);
  const nameErr = validateName(name);
  if (nameErr) return c.json({ error: nameErr }, 400);

  const result = await registerEmailUser(c.env.DB, body.email!, body.password!, name);
  if ("error" in result) return c.json({ error: result.error }, result.status as 409);

  const session = await setAuthCookies(c, result.id, result.email);

  const verifyToken = await createAuthToken(c.env.DB, result.id, "email_verify");
  const mail = await sendVerificationEmail(c.env, c.req.raw, result.email!, result.name, verifyToken);

  const organizations = await getUserOrganizations(c.env.DB, result.id);
  return c.json({
    user: result,
    organizations,
    sessionExpiresAt: session.sessionExpiresAt,
    emailVerification: {
      sent: mail.sent,
      devLink: mail.devLink,
    },
  }, 201);
});

app.post("/login", async (c) => {
  const limited = await enforceAuthRateLimit(c, "login");
  if (limited) return limited;

  const body = await c.req.json<{ email?: string; password?: string }>();

  const emailErr = validateEmail(body.email ?? "");
  if (emailErr) return c.json({ error: emailErr }, 400);

  const pwErr = validatePassword(body.password ?? "");
  if (pwErr) return c.json({ error: pwErr }, 400);

  const user = await loginEmailUser(c.env.DB, body.email!, body.password!);
  if (!user) return c.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, 401);

  const session = await setAuthCookies(c, user.id, user.email);
  const organizations = await getUserOrganizations(c.env.DB, user.id);
  return c.json({ user, organizations, sessionExpiresAt: session.sessionExpiresAt });
});

app.post("/verify-email", async (c) => {
  const body = await c.req.json<{ token?: string }>();
  if (!body.token?.trim()) return c.json({ error: "인증 토큰이 필요합니다." }, 400);

  const record = await findValidToken(c.env.DB, body.token.trim(), "email_verify");
  if (!record) return c.json({ error: "유효하지 않거나 만료된 인증 링크입니다." }, 400);

  await markEmailVerified(c.env.DB, record.userId);
  await consumeAuthToken(c.env.DB, record.id);

  return c.json({ ok: true, message: "이메일 인증이 완료되었습니다." });
});

app.get("/verify-email", async (c) => {
  const token = c.req.query("token");
  const base = `${frontendUrl(c.req.raw, c.env)}/verify-email`;
  if (!token) return c.redirect(`${base}?error=missing_token`);

  const record = await findValidToken(c.env.DB, token, "email_verify");
  if (!record) return c.redirect(`${base}?error=invalid_token`);

  await markEmailVerified(c.env.DB, record.userId);
  await consumeAuthToken(c.env.DB, record.id);
  return c.redirect(`${base}?status=success`);
});

app.post("/resend-verification", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (user.emailVerified) return c.json({ error: "이미 인증된 이메일입니다." }, 400);
  if (!user.email) return c.json({ error: "이메일이 등록되어 있지 않습니다." }, 400);

  const allowed = await canResendVerification(c.env.DB, user.id);
  if (!allowed) return c.json({ error: "1분 후에 다시 요청해주세요." }, 429);

  const token = await createAuthToken(c.env.DB, user.id, "email_verify");
  const mail = await sendVerificationEmail(c.env, c.req.raw, user.email, user.name, token);

  return c.json({
    message: "인증 메일을 발송했습니다.",
    sent: mail.sent,
    devLink: mail.devLink,
  });
});

app.post("/forgot-password", async (c) => {
  const limited = await enforceAuthRateLimit(c, "forgot-password");
  if (limited) return limited;

  const body = await c.req.json<{ email?: string }>();
  const emailErr = validateEmail(body.email ?? "");
  if (emailErr) return c.json({ error: emailErr }, 400);

  const normalized = normalizeEmail(body.email!);
  const user = await findUserByEmail(c.env.DB, normalized);

  const genericMessage = "등록된 이메일이면 비밀번호 재설정 링크를 보냈습니다.";

  if (user?.password_hash) {
    const token = await createAuthToken(c.env.DB, user.id, "password_reset");
    const mail = await sendPasswordResetEmail(c.env, c.req.raw, user.email, user.name, token);
    return c.json({
      message: genericMessage,
      sent: mail.sent,
      devLink: mail.devLink,
    });
  }

  return c.json({ message: genericMessage, sent: false });
});

app.get("/reset-token-status", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ valid: false }, 400);
  const record = await findValidToken(c.env.DB, token, "password_reset");
  return c.json({ valid: Boolean(record) });
});

app.post("/reset-password", async (c) => {
  const body = await c.req.json<{ token?: string; password?: string }>();
  if (!body.token?.trim()) return c.json({ error: "토큰이 필요합니다." }, 400);

  const pwErr = validatePassword(body.password ?? "", true);
  if (pwErr) return c.json({ error: pwErr }, 400);

  const record = await findValidToken(c.env.DB, body.token.trim(), "password_reset");
  if (!record) return c.json({ error: "유효하지 않거나 만료된 링크입니다." }, 400);

  const passwordHash = await hashPassword(body.password!);
  await updateUserPassword(c.env.DB, record.userId, passwordHash);
  await consumeAuthToken(c.env.DB, record.id);
  await markEmailVerified(c.env.DB, record.userId);
  await c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(record.userId).run();

  return c.json({ ok: true, message: "비밀번호가 변경되었습니다." });
});

app.post("/dev", async (c) => {
  const limited = await enforceAuthRateLimit(c, "dev");
  if (limited) return limited;

  const allowed =
    c.env.ALLOW_DEV_AUTH === "true" ||
    (!c.env.GOOGLE_CLIENT_ID && !c.env.KAKAO_CLIENT_ID);
  if (!allowed) return c.json({ error: "Dev auth disabled" }, 403);

  const body = await c.req.json<{ provider?: "google" | "kakao"; name?: string; email?: string }>();
  const provider = body.provider ?? "google";
  const devId = `dev-${provider}-${body.email ?? "user@teamcanvas.local"}`;

  const user = await upsertOAuthUser(c.env.DB, provider, devId, {
    name: body.name ?? (provider === "kakao" ? "김민지" : "Minji Kim"),
    email: body.email ?? "demo@teamcanvas.app",
  });
  const session = await setAuthCookies(c, user.id, user.email);
  const organizations = await getUserOrganizations(c.env.DB, user.id);
  return c.json({ user, organizations, sessionExpiresAt: session.sessionExpiresAt });
});

app.get("/me", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const organizations = await getUserOrganizations(c.env.DB, user.id);
  const platform = await extendAuthMe(c.env.DB, user.id);
  const sessionExpiresAt = await getSessionExpiry(c);
  return c.json({ user, organizations, ...platform, sessionExpiresAt });
});

function decodeFinalizePayload(raw: string | undefined | null) {
  if (!raw) return null;
  try {
    return JSON.parse(atob(raw)) as {
      accessToken?: string;
      refreshToken?: string;
      destination?: string;
      loginUrl?: string;
    };
  } catch {
    return null;
  }
}

async function finalizeOAuthSession(c: Context<{ Bindings: Env }>, payloadRaw: string | undefined | null) {
  const payload = decodeFinalizePayload(payloadRaw);
  if (!payload?.accessToken || !payload.refreshToken || !payload.destination || !payload.loginUrl) {
    return loginRedirect(c, "session_cookie_failed");
  }

  const established = await establishSessionFromTokens(c, payload.accessToken, payload.refreshToken);
  if (!established) {
    const url = new URL(payload.loginUrl);
    url.searchParams.set("status", "401");
    return htmlRedirect(c, url.toString(), "로그인 페이지로 이동 중…");
  }

  const secure = new URL(c.req.url).protocol === "https:";
  return redirectWithAuthCookies(
    payload.destination,
    payload.accessToken,
    payload.refreshToken,
    established.sessionExpiresAt,
    secure,
  );
}

/** OAuth 콜백에서 브라우저가 Set-Cookie를 저장하지 못한 경우의 동일 출처 핸드오프 */
app.post("/establish-session", async (c) => {
  const body = await c.req.json<{ accessToken?: string; refreshToken?: string }>().catch(() => ({}));
  if (!body.accessToken || !body.refreshToken) {
    return c.json({ error: "missing_tokens" }, 401);
  }
  const established = await establishSessionFromTokens(c, body.accessToken, body.refreshToken);
  if (!established) return c.json({ error: "invalid_tokens" }, 401);

  // setCookie는 응답 헤더에만 들어가므로, 같은 요청의 getAuthUser는 아직 쿠키를 못 본다.
  const user = await c.env.DB.prepare(
    "SELECT id, email, name, avatar_url, email_verified FROM users WHERE id = ?",
  )
    .bind(established.userId)
    .first<{
      id: string;
      email: string | null;
      name: string;
      avatar_url: string | null;
      email_verified: number;
    }>();
  if (!user) return c.json({ error: "user_not_found" }, 401);

  const organizations = await getUserOrganizations(c.env.DB, user.id);
  const platform = await extendAuthMe(c.env.DB, user.id);
  const payload = JSON.stringify({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
      emailVerified: Boolean(user.email_verified),
    },
    organizations,
    ...platform,
    sessionExpiresAt: established.sessionExpiresAt,
  });

  // Hono setCookie + c.json 조합에서 쿠키가 빠지는 경우를 피하기 위해
  // Set-Cookie를 명시적으로 복사한 raw Response를 반환한다.
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  const from = c.res.headers;
  if (typeof from.getSetCookie === "function") {
    for (const cookie of from.getSetCookie()) {
      headers.append("Set-Cookie", cookie);
    }
  } else {
    from.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") headers.append("Set-Cookie", value);
    });
  }

  // getSetCookie가 비어 있어도 토큰으로 직접 쿠키를 심는다.
  const existingCookies =
    typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  if (existingCookies.length === 0) {
    const secure = new URL(c.req.url).protocol === "https:";
    const base = `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
    const refreshMaxAge = Math.max(
      1,
      Math.floor((established.sessionExpiresAt - Date.now()) / 1000),
    );
    headers.append(
      "Set-Cookie",
      `access_token=${body.accessToken}; ${base}; Max-Age=3600`,
    );
    headers.append(
      "Set-Cookie",
      `refresh_token=${body.refreshToken}; ${base}; Max-Age=${refreshMaxAge}`,
    );
  }

  return new Response(payload, { status: 200, headers });
});

app.post("/finalize-session", async (c) => {
  const body = await c.req.parseBody().catch(() => ({}));
  const payload = typeof body.payload === "string" ? body.payload : null;
  return finalizeOAuthSession(c, payload);
});

app.get("/finalize-session", async (c) => {
  return finalizeOAuthSession(c, c.req.query("payload"));
});

app.patch("/me", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json<{ name?: string }>();
  const name = body.name?.trim();
  if (!name || name.length > 80) {
    return c.json({ error: "이름은 1~80자여야 합니다" }, 400);
  }
  const ts = Date.now();
  await c.env.DB.prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ?")
    .bind(name, ts, user.id)
    .run();
  return c.json({
    ok: true,
    user: { ...user, name, updated_at: ts },
  });
});

app.post("/refresh", async (c) => {
  const refreshed = await refreshAuthSession(c);
  if (!refreshed) return c.json({ error: "Unauthorized" }, 401);
  return c.json({
    ok: true,
    sessionExpiresAt: refreshed.sessionExpiresAt,
    absoluteExpiresAt: refreshed.absoluteExpiresAt,
  });
});

app.post("/logout", async (c) => {
  await clearAuthCookies(c);
  return c.json({ ok: true });
});

export const onRequest = handle(app);
