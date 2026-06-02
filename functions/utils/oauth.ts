import type { Context } from "hono";
import type { Env } from "../types";
import { frontendUrl } from "./email";
import { setAuthCookies } from "./auth";
import { getUserOrganizations } from "./db";

export function oauthRedirectUri(c: Context<{ Bindings: Env }>, provider: "google" | "kakao"): string {
  const base = c.env.APP_URL?.replace(/\/$/, "") ?? new URL(c.req.url).origin;
  return `${base}/auth/callback/${provider}`;
}

export function loginRedirect(c: Context<{ Bindings: Env }>, error: string): Response {
  const url = `${frontendUrl(c.req.raw, c.env)}/login?error=${encodeURIComponent(error)}`;
  return c.redirect(url);
}

export async function completeOAuthLogin(
  c: Context<{ Bindings: Env }>,
  userId: string,
  email: string | null,
): Promise<Response> {
  await setAuthCookies(c, userId, email);
  const organizations = await getUserOrganizations(c.env.DB, userId);
  const path = organizations.length > 0 ? "/" : "/onboarding";
  return c.redirect(`${frontendUrl(c.req.raw, c.env)}${path}`);
}

export const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_callback: "로그인이 취소되었거나 잘못된 요청입니다.",
  invalid_state: "보안 검증에 실패했습니다. 다시 시도해주세요.",
  token_exchange_failed: "인증 서버 연동에 실패했습니다. Redirect URI 설정을 확인해주세요.",
  profile_failed: "프로필 정보를 가져오지 못했습니다.",
  access_denied: "로그인이 취소되었습니다.",
};
