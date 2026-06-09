import { RefreshCw, Unlink } from "lucide-react";
import { Button } from "../ui/Button";
import { GlassCard } from "../ui/GlassCard";
import {
  useDisconnectGoogleCalendar,
  useGoogleCalendarStatus,
  useSyncGoogleCalendar,
} from "../../hooks/useData";
import { api } from "../../lib/api";
import { useCurrentOrgId } from "../../stores/orgStore";

export function GoogleCalendarPanel() {
  const orgId = useCurrentOrgId();
  const { data: status } = useGoogleCalendarStatus();
  const sync = useSyncGoogleCalendar();
  const disconnect = useDisconnectGoogleCalendar();

  if (!orgId) return null;

  const connected = status?.connected ?? false;

  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-900">Google 캘린더</p>
          <p className="mt-0.5 text-xs text-navy-600">
            {connected
              ? "연동됨 · 캘린더에 Google 일정이 표시됩니다 (읽기 전용)"
              : "Google 계정을 연결하면 일정을 가져올 수 있습니다"}
          </p>
          {status?.updatedAt && (
            <p className="mt-1 text-[10px] text-navy-500">
              마지막 연동:{" "}
              {new Date(status.updatedAt).toLocaleString("ko-KR", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
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
              <RefreshCw className="h-4 w-4" />
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
