import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import type { Context } from "hono";
import type { Env } from "../types";
import { appUrl } from "../utils/helpers";
import { frontendUrl } from "../utils/email";
import { signOAuthState, verifyOAuthState } from "../utils/jwt";
import { setAuthCookies, clearAuthCookies, getAuthUser } from "../utils/auth";
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

const app = new Hono<{ Bindings: Env }>().basePath("/auth");

app.get("/google", async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  if (!clientId) return c.json({ error: "Google OAuth not configured" }, 503);

  const state = await signOAuthState({ provider: "google" }, c.env.JWT_SECRET);
  const redirectUri = `${appUrl(c.req.raw, c.env)}/auth/callback/google`;
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
  const redirectUri = `${appUrl(c.req.raw, c.env)}/auth/callback/kakao`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  return c.redirect(`https://kauth.kakao.com/oauth/authorize?${params}`);
});

async function handleGoogleCallback(c: Context<{ Bindings: Env }>) {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");
  if (error) return c.redirect(`/login?error=${encodeURIComponent(error)}`);
  if (!code || !state) return c.redirect("/login?error=invalid_callback");

  const stateData = await verifyOAuthState(state, c.env.JWT_SECRET);
  if (!stateData) return c.redirect("/login?error=invalid_state");

  const redirectUri = `${appUrl(c.req.raw, c.env)}/auth/callback/google`;
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

  if (!tokenRes.ok) return c.redirect("/login?error=token_exchange_failed");
  const tokens = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) return c.redirect("/login?error=profile_failed");
  const profile = (await profileRes.json()) as {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };

  const user = await upsertOAuthUser(c.env.DB, "google", profile.id, {
    name: profile.name,
    email: profile.email,
    avatarUrl: profile.picture,
  });
  await setAuthCookies(c, user.id, user.email);
  return c.redirect("/");
}

async function handleKakaoCallback(c: Context<{ Bindings: Env }>) {
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state) return c.redirect("/login?error=invalid_callback");

  const stateData = await verifyOAuthState(state, c.env.JWT_SECRET);
  if (!stateData) return c.redirect("/login?error=invalid_state");

  const redirectUri = `${appUrl(c.req.raw, c.env)}/auth/callback/kakao`;
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
  if (!tokenRes.ok) return c.redirect("/login?error=token_exchange_failed");
  const tokens = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) return c.redirect("/login?error=profile_failed");
  const profile = (await profileRes.json()) as {
    id: number;
    kakao_account?: { email?: string; profile?: { nickname?: string; profile_image_url?: string } };
  };

  const user = await upsertOAuthUser(c.env.DB, "kakao", String(profile.id), {
    name: profile.kakao_account?.profile?.nickname ?? "카카오 사용자",
    email: profile.kakao_account?.email ?? null,
    avatarUrl: profile.kakao_account?.profile?.profile_image_url,
  });
  await setAuthCookies(c, user.id, user.email);
  return c.redirect("/");
}

app.get("/callback/google", handleGoogleCallback);
app.get("/callback/kakao", handleKakaoCallback);

app.post("/register", async (c) => {
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

  await setAuthCookies(c, result.id, result.email);

  const verifyToken = await createAuthToken(c.env.DB, result.id, "email_verify");
  const mail = await sendVerificationEmail(c.env, c.req.raw, result.email!, result.name, verifyToken);

  const organizations = await getUserOrganizations(c.env.DB, result.id);
  return c.json({
    user: result,
    organizations,
    emailVerification: {
      sent: mail.sent,
      devLink: mail.devLink,
    },
  }, 201);
});

app.post("/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();

  const emailErr = validateEmail(body.email ?? "");
  if (emailErr) return c.json({ error: emailErr }, 400);

  const pwErr = validatePassword(body.password ?? "");
  if (pwErr) return c.json({ error: pwErr }, 400);

  const user = await loginEmailUser(c.env.DB, body.email!, body.password!);
  if (!user) return c.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, 401);

  await setAuthCookies(c, user.id, user.email);
  const organizations = await getUserOrganizations(c.env.DB, user.id);
  return c.json({ user, organizations });
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

  return c.json({ ok: true, message: "비밀번호가 변경되었습니다." });
});

app.post("/dev", async (c) => {
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
  await setAuthCookies(c, user.id, user.email);
  const organizations = await getUserOrganizations(c.env.DB, user.id);
  return c.json({ user, organizations });
});

app.get("/me", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const organizations = await getUserOrganizations(c.env.DB, user.id);
  const platform = await extendAuthMe(c.env.DB, user.id);
  return c.json({ user, organizations, ...platform });
});

app.post("/logout", async (c) => {
  await clearAuthCookies(c);
  return c.json({ ok: true });
});

export const onRequest = handle(app);
