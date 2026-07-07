import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useCurrentOrgId } from "../stores/orgStore";

const POLL_MS = 3000;

export function useOrgSync() {
  const orgId = useCurrentOrgId();
  const queryClient = useQueryClient();
  const versionRef = useRef(0);

  useEffect(() => {
    if (!orgId) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled || document.hidden) return;
      try {
        const { version } = await api.getOrgSync(orgId);
        if (versionRef.current > 0 && version > versionRef.current) {
          await queryClient.invalidateQueries({ queryKey: ["tasks", orgId] });
          await queryClient.invalidateQueries({ queryKey: ["projects", orgId] });
          await queryClient.invalidateQueries({ queryKey: ["events", orgId] });
          await queryClient.invalidateQueries({ queryKey: ["notifications"] });
          await queryClient.invalidateQueries({ queryKey: ["org-activity", orgId] });
          await queryClient.invalidateQueries({ queryKey: ["dashboard-insights", orgId] });
        }
        versionRef.current = version;
      } catch {
        /* sync table may not exist before migration */
      }
    };

    void poll();
    const interval = window.setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [orgId, queryClient]);
}
