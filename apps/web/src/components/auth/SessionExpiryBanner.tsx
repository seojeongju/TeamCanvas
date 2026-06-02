import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";

const WARNING_WINDOW_MS = 10 * 60 * 1000;

export function SessionExpiryBanner() {
  const sessionExpiresAt = useAuthStore((s) => s.sessionExpiresAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const remainingMs = useMemo(() => {
    if (!sessionExpiresAt) return null;
    return sessionExpiresAt - now;
  }, [sessionExpiresAt, now]);

  if (!remainingMs || remainingMs <= 0 || remainingMs > WARNING_WINDOW_MS) return null;

  const remainingMin = Math.max(1, Math.ceil(remainingMs / 60_000));
  return (
    <div className="mb-4 rounded-2xl border border-sky-300/60 bg-sky-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100">
          <Clock3 className="h-4 w-4 text-sky-700" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-sky-900">세션 만료 임박</p>
          <p className="mt-0.5 text-xs text-sky-800">
            로그인 세션이 약 {remainingMin}분 후 만료됩니다. 작업 중인 내용이 있다면 저장해 주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
