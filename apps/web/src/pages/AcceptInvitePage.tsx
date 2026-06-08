import { useParams, useNavigate, Link } from "react-router-dom";
import { Building2, CheckCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useOrgStore } from "../stores/orgStore";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";

export function AcceptInvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setCurrentOrgId = useOrgStore((s) => s.setCurrentOrgId);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => api.getInvite(token),
    enabled: !!token,
  });

  const accept = useMutation({
    mutationFn: () => api.acceptInvite(token),
    onSuccess: async (result) => {
      setCurrentOrgId(result.organizationId);
      const me = await api.me();
      setAuth(me.user, me.organizations, {
        isPlatformAdmin: me.isPlatformAdmin,
        platformRole: me.platformRole,
        sessionExpiresAt: me.sessionExpiresAt ?? null,
      });
      qc.invalidateQueries({ queryKey: ["auth"] });
      navigate("/", { replace: true });
    },
  });

  if (isLoading) {
    return (
      <div className="bg-mesh flex min-h-dvh items-center justify-center p-6">
        <p className="text-sm text-navy-600">초대 확인 중...</p>
      </div>
    );
  }

  if (isError || !data?.valid) {
    return (
      <div className="bg-mesh flex min-h-dvh items-center justify-center p-6">
        <GlassCard className="max-w-md space-y-4 p-6 text-center">
          <p className="font-semibold text-navy-900">유효하지 않은 초대</p>
          <p className="text-sm text-navy-600">만료되었거나 잘못된 초대 링크입니다.</p>
          <Link to="/login" className="text-sm text-primary-600 underline">
            로그인으로 이동
          </Link>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="bg-mesh flex min-h-dvh items-center justify-center p-6">
      <GlassCard className="max-w-md space-y-5 p-6">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-400/10">
            <Building2 className="h-7 w-7 text-primary-500" />
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-navy-900">{data.organizationName}</h1>
          <p className="mt-1 text-sm text-navy-600">
            {data.role === "admin" ? "관리자" : "멤버"}로 초대되었습니다
          </p>
          {data.email && (
            <p className="mt-2 text-xs text-navy-500">대상 이메일: {data.email}</p>
          )}
          {data.emailDomain && (
            <p className="mt-2 text-xs text-navy-500">허용 도메인: {data.emailDomain}</p>
          )}
          {data.inviteType === "multi" && (
            <p className="mt-1 text-xs text-primary-600">팀 초대 링크 — 로그인 후 참여할 수 있습니다</p>
          )}
        </div>

        {!isAuthenticated ? (
          <div className="space-y-2">
            <p className="text-center text-sm text-navy-600">참여하려면 먼저 로그인하세요.</p>
            <Link
              to={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
              className="block rounded-xl bg-primary-400 py-3 text-center text-sm font-medium text-white"
            >
              로그인 / 가입
            </Link>
          </div>
        ) : (
          <Button
            className="w-full"
            disabled={accept.isPending}
            onClick={() => accept.mutate()}
          >
            <CheckCircle className="mr-2 inline h-4 w-4" />
            {accept.isPending ? "처리 중..." : "초대 수락"}
          </Button>
        )}

        {accept.isError && (
          <p className="text-center text-sm text-red-500">
            {accept.error instanceof Error ? accept.error.message : "수락 실패"}
          </p>
        )}
      </GlassCard>
    </div>
  );
}
