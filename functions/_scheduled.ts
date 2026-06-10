import type { Env } from "./types";
import { processDueReminders } from "./utils/reminders";

type ScheduledContext = {
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
};

/** Cloudflare Pages Cron — 5분마다 일정 리마인더 발송 */
export async function onSchedule(context: ScheduledContext): Promise<Response> {
  const { env } = context;
  context.waitUntil(
    processDueReminders(env.DB, env).catch(() => {
      /* 로그만 — Cron 응답은 성공 유지 */
    }),
  );
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
