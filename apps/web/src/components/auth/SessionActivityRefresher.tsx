import { useEffect, useRef } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";

const REFRESH_THROTTLE_MS = 60 * 60 * 1000;

export function SessionActivityRefresher() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setSessionExpiresAt = useAuthStore((s) => s.setSessionExpiresAt);
  const lastRefreshedAtRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshIfNeeded = async () => {
      const now = Date.now();
      if (refreshingRef.current) return;
      if (now - lastRefreshedAtRef.current < REFRESH_THROTTLE_MS) return;

      refreshingRef.current = true;
      try {
        const result = await api.refreshSession();
        setSessionExpiresAt(result.sessionExpiresAt);
        lastRefreshedAtRef.current = Date.now();
      } catch {
        // Ignore transient errors; auth guard will handle truly expired sessions.
      } finally {
        refreshingRef.current = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshIfNeeded();
    };

    const events: Array<keyof WindowEventMap> = ["click", "keydown", "touchstart", "mousemove"];
    for (const eventName of events) {
      window.addEventListener(eventName, refreshIfNeeded, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, refreshIfNeeded);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isAuthenticated, setSessionExpiresAt]);

  return null;
}
