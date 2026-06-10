import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, Unlink } from "lucide-react";
import { Button } from "../ui/Button";
import { GlassCard } from "../ui/GlassCard";
import {
  useDisconnectGoogleCalendar,
  useGoogleCalendarStatus,
  useSyncGoogleCalendar,
} from "../../hooks/useData";
import { api } from "../../lib/api";
import { useCurrentOrgId } from "../../stores/orgStore";

const STALE_MS = 60 * 60 * 1000;

export function GoogleCalendarPanel() {
  const orgId = useCurrentOrgId();
  const { data: status } = useGoogleCalendarStatus();
  const { data: providers } = useQuery({
    queryKey: ["auth-providers"],
    queryFn: () => api.authProviders(),
    staleTime: 5 * 60 * 1000,
  });
  const sync = useSyncGoogleCalendar();
  const disconnect = useDisconnectGoogleCalendar();
  const autoSyncedRef = useRef(false);

  const connected = status?.connected ?? false;
  const googleConfigured = providers?.google ?? false;

  useEffect(() => {
    autoSyncedRef.current = false;
  }, [orgId]);

  useEffect(() => {
    if (!orgId || !connected || autoSyncedRef.current) return;
    const updatedAt = status?.updatedAt;
    const stale = !updatedAt || Date.now() - updatedAt > STALE_MS;
    if (!stale) return;
    autoSyncedRef.current = true;
    sync.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot stale sync per org session
  }, [orgId, connected, status?.updatedAt]);

  if (!orgId) return null;

  if (!googleConfigured) {
    return (
      <GlassCard className="p-4">
        <p className="text-sm font-semibold text-navy-900">Google 캘린더</p>
        <p className="mt-1 text-xs text-navy-600">
          서버에 Google OAuth가 설정되지 않았습니다. 관리자가 Cloudflare Pages Secret과 Google
          Cloud Console 설정을 완료해야 연동할 수 있습니다.
        </p>
        <a
          href="https://github.com/seojeongju/TeamCanvas/blob/main/docs/OAUTH_SETUP.md"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
        >
          설정 가이드 보기
          <ExternalLink className="h-3 w-3" />
        </a>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-900">Google 캘린더</p>
          <p className="mt-0.5 text-xs text-navy-600">
            {connected
              ? "연동됨 · 내 Google 일정만 표시됩니다 (읽기 전용, 팀원 비공개)"
              : "Google 계정을 연결하면 primary 캘린더 일정을 가져옵니다. 팀원에게는 노출되지 않습니다"}
          </p>
          {status?.updatedAt && (
            <p className="mt-1 text-[10px] text-navy-500">
              마지막 동기화:{" "}
              {new Date(status.updatedAt).toLocaleString("ko-KR", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          {sync.isSuccess && sync.data?.imported != null && (
            <p className="mt-1 text-[10px] text-primary-600">
              {sync.data.imported}개 일정 반영됨
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {!connected ? (
          <Button type="button" onClick={() => api.connectGoogleCalendar(orgId)}>
            Google 연결
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
              {sync.isPending ? "동기화 중..." : "동기화"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-red-600"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              <Unlink className="h-4 w-4" />
              연결 해제
            </Button>
          </>
        )}
      </div>
    </GlassCard>
  );
}
