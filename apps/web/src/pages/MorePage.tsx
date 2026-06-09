import { Building2, Users, Users2, Settings, LogOut, Shield, ChevronRight, CreditCard, Bell, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { useAuthStore } from "../stores/authStore";
import { useOrgDetail } from "../hooks/useData";
import { useLogout } from "../hooks/useAuth";
import { useHasPermission } from "../hooks/usePermissions";
import { useCurrentOrgId } from "../stores/orgStore";
import { DeveloperCredit } from "../components/layout/DeveloperCredit";
import { useAdminBootstrap } from "../hooks/useAdmin";
import { api } from "../lib/api";

export function MorePage() {
  const user = useAuthStore((s) => s.user);
  const orgId = useCurrentOrgId();
  const org = useAuthStore((s) => s.organizations.find((o) => o.id === orgId));
  const isPlatformAdmin = useAuthStore((s) => s.isPlatformAdmin);
  const { data: orgData } = useOrgDetail();
  const logout = useLogout();
  const navigate = useNavigate();
  const canManageMembers = useHasPermission("members:read");
  const canViewBilling = useHasPermission("billing:read");
  const bootstrap = useAdminBootstrap();

  const stats = orgData?.stats;

  const menuItems = [
    {
      icon: Search,
      label: "검색",
      desc: "일정 · 업무 · 멤버",
      onClick: () => navigate("/search"),
      show: true,
    },
    {
      icon: Building2,
      label: "조직 설정",
      desc: org?.name ?? "—",
      onClick: () => navigate("/settings/org"),
      show: true,
    },
    {
      icon: Users2,
      label: "팀 관리",
      desc: `${stats?.teams ?? 0}개 팀`,
      onClick: () => navigate("/settings/teams"),
      show: true,
    },
    {
      icon: Users,
      label: "멤버 관리",
      desc: `${stats?.members ?? 1}명 · ${org?.role ?? "member"}`,
      onClick: () => navigate("/settings/members"),
      show: canManageMembers,
    },
    {
      icon: CreditCard,
      label: "구독 · 플랜",
      desc: org?.subscription?.planName ?? "Free",
      onClick: () => navigate("/settings/billing"),
      show: canViewBilling,
    },
    {
      icon: Shield,
      label: "권한 및 보안",
      desc: org?.role ?? "member",
      onClick: () => navigate("/settings/permissions"),
      show: true,
    },
    {
      icon: Bell,
      label: "알림 설정",
      desc: "인앱/푸시/이메일",
      onClick: () => navigate("/settings/notifications"),
      show: true,
    },
    {
      icon: Settings,
      label: "앱 설정",
      desc: "알림, PWA",
      onClick: () => {},
      show: true,
    },
  ].filter((item) => item.show);

  const handleLogout = async () => {
    await logout.mutateAsync();
    navigate("/login");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="더보기"
        action={
          <button
            onClick={handleLogout}
            disabled={logout.isPending}
            className="glass flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-red-500 hover:bg-red-50/60 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {logout.isPending ? "..." : "로그아웃"}
          </button>
        }
      />

      <GlassCard className="flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-primary-400 text-xl font-bold text-white shadow-glow">
          {orgData?.organization.hasLogo && orgId ? (
            <img
              src={api.orgLogoUrl(orgId)}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            user?.name?.[0] ?? "T"
          )}
        </div>
        <div>
          <p className="font-semibold text-navy-900">{user?.name ?? "게스트"}</p>
          <p className="text-sm text-navy-600">{user?.email ?? ""}</p>
        </div>
      </GlassCard>

      <div className="space-y-2">
        {menuItems.map(({ icon: Icon, label, desc, onClick }) => (
          <button key={label} type="button" onClick={onClick} className="w-full text-left">
            <GlassCard className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-400/10">
                <Icon className="h-5 w-5 text-primary-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-navy-900">{label}</p>
                <p className="text-xs text-navy-600">{desc}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-navy-600/40" />
            </GlassCard>
          </button>
        ))}
      </div>

      {isPlatformAdmin ? (
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="glass flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-medium text-primary-600"
        >
          <Shield className="h-5 w-5" />
          플랫폼 관리자
        </button>
      ) : (
        <button
          type="button"
          onClick={() => bootstrap.mutate()}
          disabled={bootstrap.isPending}
          className="w-full text-center text-xs text-navy-600/60 underline"
        >
          {bootstrap.isPending ? "처리 중..." : "최초 관리자 등록 (1회)"}
        </button>
      )}

      <button
        onClick={handleLogout}
        disabled={logout.isPending}
        className="glass flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-medium text-red-500 transition hover:bg-red-50/50"
      >
        <LogOut className="h-5 w-5" />
        {logout.isPending ? "로그아웃 중..." : "로그아웃"}
      </button>

      <DeveloperCredit className="pt-2 pb-4" />
    </div>
  );
}
