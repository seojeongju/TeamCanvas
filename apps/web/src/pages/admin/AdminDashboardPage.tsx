import { Building2, Users, CreditCard, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { StatCard } from "../../components/ui/StatCard";
import { useAdminDashboard } from "../../hooks/useAdmin";

export function AdminDashboardPage() {
  const { data, isLoading } = useAdminDashboard();
  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <PageHeader title="플랫폼 대시보드" subtitle="TeamCanvas SaaS 운영 현황" />

      {isLoading ? (
        <p className="text-sm text-navy-600">로딩 중...</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              icon={<Building2 className="h-5 w-5" />}
              label="활성 조직"
              value={String(stats?.activeOrganizations ?? 0)}
            />
            <StatCard icon={<Users className="h-5 w-5" />} label="전체 사용자" value={String(stats?.totalUsers ?? 0)} />
          </div>

          <GlassCard className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary-500" />
              <h2 className="font-semibold text-navy-900">플랜별 구독</h2>
            </div>
            <div className="space-y-2">
              {(stats?.subscriptionsByPlan ?? []).map((row) => (
                <div key={row.code} className="flex items-center justify-between text-sm">
                  <span className="text-navy-800">{row.name}</span>
                  <span className="font-medium text-primary-600">{row.c}개</span>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary-500" />
              <h2 className="font-semibold text-navy-900">구독 상태</h2>
            </div>
            <div className="space-y-2">
              {(stats?.subscriptionsByStatus ?? []).map((row) => (
                <div key={row.status} className="flex items-center justify-between text-sm">
                  <span className="text-navy-800">{row.status}</span>
                  <span className="font-medium">{row.c}개</span>
                </div>
              ))}
            </div>
          </GlassCard>

          <Link
            to="/admin/organizations"
            className="block rounded-2xl bg-primary-400 px-4 py-3 text-center text-sm font-medium text-white shadow-glow"
          >
            조직 관리로 이동
          </Link>
        </>
      )}
    </div>
  );
}
