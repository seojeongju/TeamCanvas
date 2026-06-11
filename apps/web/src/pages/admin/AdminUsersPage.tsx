import { useEffect, useState } from "react";
import { Search, Shield } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ToastMessage } from "../../components/ui/ToastMessage";
import { useAdminSetPlatformAdmin, useAdminUsers } from "../../hooks/useAdmin";
import { useAuthStore } from "../../stores/authStore";
import { PLATFORM_ROLE_LABELS } from "../../lib/adminLabels";

export function AdminUsersPage() {
  const platformRole = useAuthStore((s) => s.platformRole);
  const isSuperAdmin = platformRole === "super_admin";
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);
  const { data, isLoading } = useAdminUsers(search);
  const setPlatformAdmin = useAdminSetPlatformAdmin();

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="space-y-6">
      <PageHeader title="사용자 관리" subtitle="전체 계정 및 플랫폼 관리자" />

      {!isSuperAdmin && (
        <GlassCard className="border border-amber-200/60 bg-amber-50/80 p-4 text-sm text-amber-900">
          플랫폼 관리자 지정·해제는 슈퍼 관리자만 할 수 있습니다.
        </GlassCard>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-600/40" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름·이메일 검색"
            className="pl-9"
          />
        </div>
        <Button type="submit">검색</Button>
      </form>

      {isLoading ? (
        <p className="text-sm text-navy-600">불러오는 중…</p>
      ) : (
        <div className="space-y-2">
          {(data?.users ?? []).map((user) => {
            const isAdmin = Boolean(user.is_platform_admin);
            const role = user.platform_role;
            return (
              <GlassCard key={user.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-navy-900">{user.name}</p>
                  <p className="truncate text-xs text-navy-600">{user.email ?? "—"}</p>
                  <p className="mt-1 text-[11px] text-navy-500">
                    가입 {new Date(user.created_at).toLocaleDateString("ko-KR")} · 활성 조직{" "}
                    {user.org_count}개
                    {user.email_verified ? " · 이메일 인증됨" : ""}
                  </p>
                </div>
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-400/15 px-2.5 py-1 text-xs font-semibold text-primary-700">
                    <Shield className="h-3 w-3" />
                    {PLATFORM_ROLE_LABELS[role ?? ""] ?? role}
                  </span>
                ) : (
                  <span className="text-xs text-navy-500">일반 사용자</span>
                )}
                {isSuperAdmin && (
                  <div className="flex flex-wrap gap-2">
                    {!isAdmin ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-xs"
                          disabled={setPlatformAdmin.isPending}
                          onClick={async () => {
                            try {
                              await setPlatformAdmin.mutateAsync({
                                userId: user.id,
                                grant: true,
                                role: "support",
                              });
                              setToast({ tone: "info", message: "지원 관리자로 등록했습니다." });
                            } catch (err) {
                              setToast({
                                tone: "error",
                                message: err instanceof Error ? err.message : "등록 실패",
                              });
                            }
                          }}
                        >
                          지원 관리자
                        </Button>
                        <Button
                          type="button"
                          className="text-xs"
                          disabled={setPlatformAdmin.isPending}
                          onClick={async () => {
                            if (!confirm(`${user.name} 님을 슈퍼 관리자로 지정할까요?`)) return;
                            try {
                              await setPlatformAdmin.mutateAsync({
                                userId: user.id,
                                grant: true,
                                role: "super_admin",
                              });
                              setToast({ tone: "info", message: "슈퍼 관리자로 등록했습니다." });
                            } catch (err) {
                              setToast({
                                tone: "error",
                                message: err instanceof Error ? err.message : "등록 실패",
                              });
                            }
                          }}
                        >
                          슈퍼 관리자
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs text-red-600"
                        disabled={setPlatformAdmin.isPending}
                        onClick={async () => {
                          if (!confirm(`${user.name} 님의 관리자 권한을 해제할까요?`)) return;
                          try {
                            await setPlatformAdmin.mutateAsync({ userId: user.id, grant: false });
                            setToast({ tone: "info", message: "관리자 권한을 해제했습니다." });
                          } catch (err) {
                            setToast({
                              tone: "error",
                              message: err instanceof Error ? err.message : "해제 실패",
                            });
                          }
                        }}
                      >
                        권한 해제
                      </Button>
                    )}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {toast && (
        <ToastMessage message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
