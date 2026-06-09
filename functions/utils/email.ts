import type { Env } from "../types";
import { appUrl } from "./helpers";

export function frontendUrl(request: Request, env: Env): string {
  if (env.FRONTEND_URL) return env.FRONTEND_URL.replace(/\/$/, "");
  const origin = request.headers.get("Origin");
  if (origin) return origin.replace(/\/$/, "");
  return appUrl(request, env).replace(":8788", ":5173");
}

function emailShell(title: string, body: string, actionLabel: string, actionUrl: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#F0F7FF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 8px 32px rgba(30,58,95,0.08);">
        <tr><td style="text-align:center;padding-bottom:16px;">
          <div style="display:inline-block;width:48px;height:48px;background:#4A9FE8;border-radius:12px;line-height:48px;color:#fff;font-weight:bold;">TC</div>
        </td></tr>
        <tr><td style="font-size:20px;font-weight:700;color:#1E3A5F;padding-bottom:8px;text-align:center;">${title}</td></tr>
        <tr><td style="font-size:15px;color:#2D4A6F;line-height:1.6;padding-bottom:24px;text-align:center;">${body}</td></tr>
        <tr><td align="center" style="padding-bottom:16px;">
          <a href="${actionUrl}" style="display:inline-block;background:#4A9FE8;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;">${actionLabel}</a>
        </td></tr>
        <tr><td style="font-size:12px;color:#8899AA;text-align:center;word-break:break-all;">${actionUrl}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendEmail(
  env: Env,
  to: string,
  subject: string,
  html: string,
): Promise<{ sent: boolean; devLink?: string }> {
  const from = env.EMAIL_FROM ?? "TeamCanvas <onboarding@resend.dev>";

  if (!env.RESEND_API_KEY) {
    if (env.ALLOW_DEV_AUTH === "true") {
      const match = html.match(/href="([^"]+)"/);
      return { sent: false, devLink: match?.[1] };
    }
    return { sent: false };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", err);
    return { sent: false };
  }

  return { sent: true };
}

export async function sendVerificationEmail(
  env: Env,
  request: Request,
  to: string,
  name: string,
  token: string,
): Promise<{ sent: boolean; devLink?: string }> {
  const url = `${frontendUrl(request, env)}/verify-email?token=${encodeURIComponent(token)}`;
  const html = emailShell(
    "이메일 인증",
    `${name}님, TeamCanvas 가입을 환영합니다.<br>아래 버튼을 눌러 이메일을 인증해주세요.`,
    "이메일 인증하기",
    url,
  );
  return sendEmail(env, to, "[TeamCanvas] 이메일 인증을 완료해주세요", html);
}

export async function sendPasswordResetEmail(
  env: Env,
  request: Request,
  to: string,
  name: string,
  token: string,
): Promise<{ sent: boolean; devLink?: string }> {
  const url = `${frontendUrl(request, env)}/reset-password?token=${encodeURIComponent(token)}`;
  const html = emailShell(
    "비밀번호 재설정",
    `${name}님, 비밀번호 재설정 요청을 받았습니다.<br>1시간 내에 아래 버튼을 눌러 새 비밀번호를 설정하세요.`,
    "비밀번호 재설정",
    url,
  );
  return sendEmail(env, to, "[TeamCanvas] 비밀번호 재설정", html);
}

export async function sendNotificationEmail(
  env: Env,
  to: string,
  title: string,
  body: string,
  link?: string | null,
): Promise<{ sent: boolean }> {
  const base = env.FRONTEND_URL?.replace(/\/$/, "") ?? "https://teamcanvas.pages.dev";
  const actionUrl = link ? `${base}${link.startsWith("/") ? link : `/${link}`}` : base;
  const html = emailShell(
    title,
    body.replace(/\n/g, "<br>"),
    "TeamCanvas에서 보기",
    actionUrl,
  );
  const result = await sendEmail(env, to, `[TeamCanvas] ${title}`, html);
  return { sent: result.sent };
}

export async function sendOrgInviteEmail(
  env: Env,
  request: Request,
  to: string,
  orgName: string,
  inviteUrl: string,
): Promise<{ sent: boolean; devLink?: string }> {
  const html = emailShell(
    "조직 초대",
    `<strong>${orgName}</strong> 조직에 초대되었습니다.<br>아래 버튼을 눌러 참여하세요.`,
    "초대 수락하기",
    inviteUrl,
  );
  const result = await sendEmail(env, to, `[TeamCanvas] ${orgName} 조직 초대`, html);
  if (!result.sent && !env.RESEND_API_KEY) {
    return { sent: false, devLink: inviteUrl };
  }
  return result;
}
