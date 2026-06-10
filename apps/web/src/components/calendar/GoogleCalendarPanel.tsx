import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, Mail, RefreshCw, Unlink } from "lucide-react";
import { Button } from "../ui/Button";
import { GlassCard } from "../ui/GlassCard";
import {
  useDisconnectGoogleCalendar,
  useGoogleCalendarStatus,
  useSyncGoogleCalendar,
} from "../../hooks/useData";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";
import { useAuthStore } from "../../stores/authStore";
import { useCurrentOrgId } from "../../stores/orgStore";

const STALE_MS = 60 * 60 * 1000;

function AdminSetupNotice({ isOrgAdmin }: { isOrgAdmin: boolean }) {
  return (
    <div className="rounded-xl border border-amber-200/90 bg-amber-50/80 p-3">
      <p className="flex items-start gap-2 text-xs font-medium text-amber-950">
        <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
        Google 캘린더 연동을 사용하려면 관리자가 Google Cloud Console에{" "}
        <span className="font-semibold">사용할 Google 계정 이메일</span>을 등록해야 합니다.
      </p>
      {isOrgAdmin ? (
        <p className="mt-2 text-xs leading-relaxed text-amber-900/90">
          조직 관리자이신 경우 OAuth 동의 화면의 <strong>Test users</strong>에 팀원 Google
          이메일을 추가한 뒤 연결할 수 있습니다.
          <a
            href="https://github.com/seojeongju/TeamCanvas/blob/main/docs/OAUTH_SETUP.md"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 font-medium text-primary-700 hover:underline"
          >
            설정 가이드 보기
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-amber-900/90">
          이용을 원하시면 <strong>관리자에게 문의</strong>해 사용할 Google 이메일 등록을 요청해
          주세요. 등록이 완료되면 아래에서 연결할 수 있습니다.
        </p>
      )}
      <p className="mt-2 border-t border-amber-200/60 pt-2 text-xs text-amber-900/90">
        <span className="font-medium text-amber-950">관리자 문의</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <a href="tel:0231443137" className="font-medium text-primary-700 hover:underline">
            02-3144-3137
          </a>
          <span className="text-amber-700/60" aria-hidden>
            ·
          </span>
          <a
            href="mailto:wow3d16@naver.com"
            className="font-medium text-primary-700 hover:underline"
          >
            wow3d16@naver.com
          </a>
        </span>
      </p>
    </div>
  );
}

export function GoogleCalendarPanel() {
  const orgId = useCurrentOrgId();
  const organizations = useAuthStore((s) => s.organizations);
  const orgRole = organizations.find((o) => o.id === orgId)?.role;
  const isOrgAdmin = orgRole === "owner" || orgRole === "admin";

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

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    autoSyncedRef.current = false;
  }, [orgId]);

  useEffect(() => {
    if (connected) setExpanded(true);
  }, [connected]);

  useEffect(() => {
    if (sync.isError) setExpanded(true);
  }, [sync.isError]);

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

  const collapsedSummary = connected
    ? "연동됨 · 내 Google 일정만 표시"
    : "내 Google 일정 가져오기 · 사용 전 관리자 설정 필요";

  return (
    <GlassCard className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-3 p-4 text-left transition hover:bg-sky-50/40"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy-900">Google 캘린더</p>
          <p className="mt-0.5 text-xs text-navy-600">
            {expanded
              ? connected
                ? "내 Google 일정만 표시됩니다 (읽기 전용, 팀원 비공개)"
                : "primary 캘린더 일정을 가져옵니다. 팀원에게는 노출되지 않습니다"
              : collapsedSummary}
          </p>
          {!expanded && connected && status?.updatedAt && (
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
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0 text-navy-500 transition-transform duration-200",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-sky-100/80 px-4 pb-4 pt-3">
          {!googleConfigured ? (
            <>
              <p className="text-xs text-navy-600">
                서버에 Google OAuth가 설정되지 않았습니다. 플랫폼 관리자가 Cloudflare Pages Secret과
                Google Cloud Console 설정을 완료해야 연동할 수 있습니다.
              </p>
              {isOrgAdmin && (
                <a
                  href="https://github.com/seojeongju/TeamCanvas/blob/main/docs/OAUTH_SETUP.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                >
                  설정 가이드 보기
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </>
          ) : (
            <>
              {!connected && <AdminSetupNotice isOrgAdmin={isOrgAdmin} />}

              {connected && status?.updatedAt && (
                <p className="text-[10px] text-navy-500">
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
                <p className="text-[10px] text-primary-600">{sync.data.imported}개 일정 반영됨</p>
              )}
              {sync.isError && (
                <p className="text-[10px] text-red-600">
                  동기화 실패:{" "}
                  {sync.error instanceof Error ? sync.error.message : "알 수 없는 오류"}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
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
            </>
          )}
        </div>
      )}
    </GlassCard>
  );
}
