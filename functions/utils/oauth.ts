import type { Context } from "hono";
import type { Env } from "../types";
import { frontendUrl } from "./email";
import { appendAuthCookieHeaders, setAuthCookies } from "./auth";
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
  const session = await setAuthCookies(c, userId, email);
  const organizations = await getUserOrganizations(c.env.DB, userId);
  const path = organizations.length > 0 ? "/" : "/onboarding";
  const origin = new URL(c.req.url).origin;
  const destination = `${origin}${path}?oauth=complete&t=${Date.now()}`;
  const fallback = `${frontendUrl(c.req.raw, c.env)}/login?error=session_cookie_failed&step=me`;
  const safeDestination = JSON.stringify(destination);
  const safeFallback = JSON.stringify(fallback);
  const secure = new URL(c.req.url).protocol === "https:";

  // 일부 브라우저에서는 OAuth 리디렉션 직후 앱이 너무 빨리 부팅되면
  // 방금 발급한 쿠키가 /auth/me 요청에 즉시 반영되지 않을 수 있다.
  // 같은 출처 완료 페이지에서 /auth/me가 200이 된 뒤 앱으로 이동한다.
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, viewport-fit=cover">
  <meta http-equiv="Cache-Control" content="no-store">
  <title>TeamCanvas 로그인 중</title>
  <style>
    body { margin: 0; min-height: 100dvh; display: grid; place-items: center;
      font-family: system-ui, sans-serif; background: #f0f7ff; color: #1e3a5f; }
    main { text-align: center; padding: 24px; }
    .spinner { width: 36px; height: 36px; margin: 0 auto 14px; border: 3px solid #cfe8ff;
      border-top-color: #4a9fe8; border-radius: 999px; animation: spin .8s linear infinite; }
    p { margin: 0; font-size: 14px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <main>
    <div class="spinner"></div>
    <p>로그인을 완료하는 중입니다…</p>
  </main>
  <script>
    const destination = ${safeDestination};
    const fallback = ${safeFallback};
    const delays = [150, 300, 500, 800, 1200, 1600, 2200, 3000];

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    (async () => {
      for (const delay of delays) {
        try {
          const res = await fetch('/auth/me', {
            credentials: 'include',
            cache: 'no-store',
            headers: { 'Accept': 'application/json' },
          });
          if (res.ok) {
            try {
              const data = await res.json();
              if (data && data.user) {
                sessionStorage.setItem('teamcanvas-oauth-bootstrap', JSON.stringify(data));
              }
            } catch {}
            location.replace(destination);
            return;
          }
        } catch {}
        await sleep(delay);
      }
      location.replace(fallback);
    })();
  </script>
  <noscript>
    <p><a href="${destination}">계속하기</a></p>
  </noscript>
</body>
</html>`;
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  // Hono setCookie 복사에 의존하지 않고 쿠키를 명시적으로 심어 새로고침 후에도 세션이 유지되게 한다.
  appendAuthCookieHeaders(
    headers,
    session.accessToken,
    session.refreshToken,
    session.sessionExpiresAt,
    secure,
  );
  appendContextCookies(headers, c);
  return new Response(html, { status: 200, headers });
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
