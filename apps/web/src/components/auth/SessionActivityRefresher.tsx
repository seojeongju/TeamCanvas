import { useEffect, useRef } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";

const DAY_MS = 24 * 60 * 60 * 1000;
const RENEW_WINDOW_MS = 6 * DAY_MS;
const REFRESH_THROTTLE_MS = 12 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SHARED_REFRESH_KEY = "teamcanvas-session-refresh";

type SharedRefreshState = {
  refreshedAt: number;
  expiresAt: number;
};

function readSharedRefresh(): SharedRefreshState | null {
  try {
    const raw = window.localStorage.getItem(SHARED_REFRESH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SharedRefreshState>;
    if (typeof parsed.refreshedAt !== "number" || typeof parsed.expiresAt !== "number") {
      return null;
    }
    return { refreshedAt: parsed.refreshedAt, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function writeSharedRefresh(state: SharedRefreshState): void {
  try {
    window.localStorage.setItem(SHARED_REFRESH_KEY, JSON.stringify(state));
  } catch {
    // 쿠키 기반 세션 갱신은 계속 유효하므로 저장소 오류는 무시한다.
  }
}

export function SessionActivityRefresher() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sessionExpiresAt = useAuthStore((s) => s.sessionExpiresAt);
  const setSessionExpiresAt = useAuthStore((s) => s.setSessionExpiresAt);
  const lastRefreshedAtRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const performRefresh = async () => {
      const now = Date.now();
      if (refreshingRef.current) return;

      const shared = readSharedRefresh();
      if (shared?.expiresAt && shared.expiresAt > (useAuthStore.getState().sessionExpiresAt ?? 0)) {
        setSessionExpiresAt(shared.expiresAt);
      }

      const expiresAt = Math.max(
        useAuthStore.getState().sessionExpiresAt ?? 0,
        shared?.expiresAt ?? 0,
      );
      if (!expiresAt || expiresAt - now > RENEW_WINDOW_MS) return;

      const lastRefresh = Math.max(
        lastRefreshedAtRef.current,
        shared?.refreshedAt ?? 0,
      );
      if (now - lastRefresh < REFRESH_THROTTLE_MS) return;

      refreshingRef.current = true;
      try {
        const result = await api.refreshSession();
        setSessionExpiresAt(result.sessionExpiresAt);
        const refreshedAt = Date.now();
        lastRefreshedAtRef.current = refreshedAt;
        writeSharedRefresh({ refreshedAt, expiresAt: result.sessionExpiresAt });
      } catch {
        // Ignore transient errors; auth guard will handle truly expired sessions.
      } finally {
        refreshingRef.current = false;
      }
    };

    const refreshIfNeeded = async () => {
      if ("locks" in navigator) {
        await navigator.locks.request(
          "teamcanvas-session-refresh",
          { ifAvailable: true },
          async (lock) => {
            if (lock) await performRefresh();
          },
        );
        return;
      }
      await performRefresh();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshIfNeeded();
    };

    void refreshIfNeeded();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", refreshIfNeeded);
    const timer = window.setInterval(refreshIfNeeded, CHECK_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", refreshIfNeeded);
      window.clearInterval(timer);
    };
  }, [isAuthenticated, sessionExpiresAt, setSessionExpiresAt]);

  return null;
}
