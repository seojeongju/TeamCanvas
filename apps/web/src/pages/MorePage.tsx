import { Building2, Users, Settings, LogOut, Shield, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { useAuthStore } from "../stores/authStore";
import { useOrgDetail } from "../hooks/useData";
import { useLogout } from "../hooks/useAuth";
import { DeveloperCredit } from "../components/layout/DeveloperCredit";

export function MorePage() {
  const user = useAuthStore((s) => s.user);
  const org = useAuthStore((s) => s.organizations[0]);
  const { data: orgData } = useOrgDetail();
  const logout = useLogout();
  const navigate = useNavigate();

  const stats = orgData?.stats;

  const menuItems = [
    { icon: Building2, label: "조직 설정", desc: org?.name ?? "—" },
    { icon: Users, label: "멤버 관리", desc: `${stats?.members ?? 1}명` },
    { icon: Shield, label: "권한 및 보안", desc: org?.role ?? "member" },
    { icon: Settings, label: "앱 설정", desc: "알림, PWA" },
  ];

  const handleLogout = async () => {
    await logout.mutateAsync();
    navigate("/login");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="더보기" />

      <GlassCard className="flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-400 text-xl font-bold text-white shadow-glow">
          {user?.name?.[0] ?? "T"}
        </div>
        <div>
          <p className="font-semibold text-navy-900">{user?.name ?? "게스트"}</p>
          <p className="text-sm text-navy-600">{user?.email ?? ""}</p>
        </div>
      </GlassCard>

      <div className="space-y-2">
        {menuItems.map(({ icon: Icon, label, desc }) => (
          <GlassCard key={label} className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-400/10">
              <Icon className="h-5 w-5 text-primary-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-navy-900">{label}</p>
              <p className="text-xs text-navy-600">{desc}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-navy-600/40" />
          </GlassCard>
        ))}
      </div>

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
