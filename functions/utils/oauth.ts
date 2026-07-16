import type { Context } from "hono";
import type { Env } from "../types";
import { frontendUrl } from "./email";
import { setAuthCookies } from "./auth";
import { getUserOrganizations } from "./db";

export function oauthRedirectUri(c: Context<{ Bindings: Env }>, provider: "google" | "kakao"): string {
  const base = c.env.APP_URL?.replace(/\/$/, "") ?? new URL(c.req.url).origin;
  return `${base}/auth/callback/${provider}`;
}

function appendContextCookies(headers: Headers, c: Context<{ Bindings: Env }>): void {
  const from = c.res.headers;
  if (typeof from.getSetCookie === "function") {
    for (const cookie of from.getSetCookie()) {
      headers.append("Set-Cookie", cookie);
    }
    return;
  }
  from.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      headers.append("Set-Cookie", value);
    }
  });
}

export function htmlRedirect(c: Context<{ Bindings: Env }>, url: string, title = "이동 중…"): Response {
  const safeUrl = JSON.stringify(url);
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, viewport-fit=cover">
  <title>${title}</title>
  <style>
    body { margin: 0; min-height: 100dvh; display: flex; align-items: center; justify-content: center;
      font-family: system-ui, sans-serif; background: #f0f7ff; color: #1e3a5f; }
  </style>
</head>
<body>
  <p>${title}</p>
  <script>location.replace(${safeUrl})</script>
</body>
</html>`;
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  appendContextCookies(headers, c);
  return new Response(html, { status: 200, headers });
}

export function loginRedirect(c: Context<{ Bindings: Env }>, error: string): Response {
  const url = `${frontendUrl(c.req.raw, c.env)}/login?error=${encodeURIComponent(error)}`;
  return htmlRedirect(c, url, "로그인 페이지로 이동 중…");
}

export async function completeOAuthLogin(
  c: Context<{ Bindings: Env }>,
  userId: string,
  email: string | null,
): Promise<Response> {
  await setAuthCookies(c, userId, email);
  const organizations = await getUserOrganizations(c.env.DB, userId);
  const path = organizations.length > 0 ? "/" : "/onboarding";
  const frontend = frontendUrl(c.req.raw, c.env);
  const destination = `${frontend}${path}`;
  const loginUrl = `${frontend}/login?error=session_cookie_failed`;
  c.header("Cache-Control", "no-store");
  c.header("Content-Type", "text/html; charset=utf-8");

  // 브라우저가 콜백 응답의 쿠키를 저장한 다음 /auth/me로 실제 인증 상태를
  // 검증한다. 성공 후 새 문서로 이동하므로 BFCache/PWA의 비로그인 상태를
  // 재사용하지 않는다.
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TeamCanvas 로그인 중</title>
  <style>
    body { margin: 0; min-height: 100dvh; display: grid; place-items: center;
      font-family: system-ui, sans-serif; background: #f0f7ff; color: #1e3a5f; }
    main { text-align: center; }
    .spinner { width: 36px; height: 36px; margin: 0 auto 14px; border: 3px solid #cfe8ff;
      border-top-color: #4a9fe8; border-radius: 999px; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <main><div class="spinner"></div><p>로그인을 완료하는 중입니다…</p></main>
  <script>
    (async () => {
      try {
        const response = await fetch("/auth/me?oauth_check=${Date.now()}", {
          credentials: "include",
          cache: "no-store"
        });
        if (!response.ok) {
          location.replace(${JSON.stringify(loginUrl)});
          return;
        }

        const data = await response.json();
        if (!data.user || !Array.isArray(data.organizations)) {
          location.replace(${JSON.stringify(loginUrl)});
          return;
        }

        // OAuth 직전 앱에 남아 있던 비로그인 상태보다 서버 검증 결과가 우선이다.
        // Zustand persist 형식으로 저장해 PWA의 이전 JS가 로드되어도 즉시 로그인
        // 상태로 복원되게 한다. 앱의 useAuthInit이 이후 서버 상태를 다시 확인한다.
        localStorage.setItem("teamcanvas-auth", JSON.stringify({
          state: {
            user: data.user,
            organizations: data.organizations,
            isPlatformAdmin: data.isPlatformAdmin === true,
            platformRole: data.platformRole ?? null,
            sessionExpiresAt: data.sessionExpiresAt ?? null,
            isAuthenticated: true
          },
          version: 0
        }));
        if (data.organizations[0]) {
          localStorage.setItem("teamcanvas-org", JSON.stringify({
            state: { currentOrgId: data.organizations[0].id },
            version: 0
          }));
        }
        location.replace(${JSON.stringify(destination)});
      } catch {
        location.replace(${JSON.stringify(loginUrl)});
      }
    })();
  </script>
</body>
</html>`;
  return c.body(html);
}

export const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_callback: "로그인이 취소되었거나 잘못된 요청입니다.",
  invalid_state: "보안 검증에 실패했습니다. 다시 시도해주세요.",
  token_exchange_failed: "인증 서버 연동에 실패했습니다. Redirect URI 설정을 확인해주세요.",
  profile_failed: "프로필 정보를 가져오지 못했습니다.",
  oauth_failed: "소셜 로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요.",
  session_cookie_failed: "인증은 완료됐지만 로그인 세션을 확인하지 못했습니다. 다시 시도해주세요.",
  access_denied: "로그인이 취소되었습니다.",
};
