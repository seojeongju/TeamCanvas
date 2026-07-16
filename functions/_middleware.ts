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

  // /auth 응답은 Set-Cookie(access/refresh)를 포함하는 경우가 많다.
  // 응답을 다시 만들면 런타임에 따라 복수 Set-Cookie가 합쳐져 쿠키가 유실된다.
  if (url.pathname.startsWith("/auth")) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (url.pathname.startsWith("/api")) {
    headers.set("Access-Control-Allow-Origin", url.origin);
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
