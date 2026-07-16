import type { Env } from "./types";

export async function onRequest(context: EventContext<Env, string, unknown>) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": url.origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Org-Id",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const response = await next();
  // OAuth 콜백에는 access/refresh 쿠키가 각각 Set-Cookie로 포함된다.
  // 응답을 다시 생성하면 일부 런타임에서 복수 쿠키 헤더가 합쳐질 수 있으므로
  // Hono가 만든 원본 응답을 그대로 브라우저에 전달한다.
  if (url.pathname.startsWith("/auth/callback/")) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/auth")) {
    headers.set("Access-Control-Allow-Origin", url.origin);
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
