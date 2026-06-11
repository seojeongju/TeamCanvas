import { Building2, Users, CreditCard, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { StatCard } from "../../components/ui/StatCard";
import { Button } from "../../components/ui/Button";
import { useAdminDashboard } from "../../hooks/useAdmin";
import { SUBSCRIPTION_STATUS_LABELS } from "../../lib/adminLabels";

export function AdminDashboardPage() {
  const { data, isLoading } = useAdminDashboard();
  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <PageHeader title="플랫폼 대시보드" subtitle="TeamCanvas 운영 현황" />

      {isLoading ? (
        <p className="text-sm text-navy-600">불러오는 중…</p>
      ) : (
        <>
          <GlassCard className="space-y-2 p-4">
            <p className="text-xs font-semibold text-primary-600">운영 정책</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-primary-400/10 px-2 py-1 text-primary-600">
                신규 가입 시 무료 플랜
              </span>
              <span className="rounded-full bg-primary-400/10 px-2 py-1 text-primary-600">
                유료 플랜은 관리자 문의 후 적용
              </span>
              <span className="rounded-full bg-primary-400/10 px-2 py-1 text-primary-600">
                사용자 1인 1조직
              </span>
              <span className="rounded-full bg-primary-400/10 px-2 py-1 text-primary-600">
                무료: 멤버 최대 5명
              </span>
            </div>
          </GlassCard>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              icon={<Building2 className="h-5 w-5" />}
              label="활성 조직"
              value={String(stats?.activeOrganizations ?? 0)}
            />
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="전체 사용자"
              value={String(stats?.totalUsers ?? 0)}
            />
          </div>

          <GlassCard className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary-500" />
              <h2 className="font-semibold text-navy-900">플랜별 구독</h2>
            </div>
            <div className="space-y-2">
              {(stats?.subscriptionsByPlan ?? []).length === 0 ? (
                <p className="text-sm text-navy-600">데이터 없음</p>
              ) : (
                (stats?.subscriptionsByPlan ?? []).map((row) => (
                  <div key={row.code} className="flex items-center justify-between text-sm">
                    <span className="text-navy-800">{row.name}</span>
                    <span className="font-medium text-primary-600">{row.c}개</span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary-500" />
              <h2 className="font-semibold text-navy-900">구독 상태</h2>
            </div>
            <div className="space-y-2">
              {(stats?.subscriptionsByStatus ?? []).length === 0 ? (
                <p className="text-sm text-navy-600">데이터 없음</p>
              ) : (
                (stats?.subscriptionsByStatus ?? []).map((row) => (
                  <div key={row.status} className="flex items-center justify-between text-sm">
                    <span className="text-navy-800">
                      {SUBSCRIPTION_STATUS_LABELS[row.status] ?? row.status}
                    </span>
                    <span className="font-medium">{row.c}개</span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          <div className="grid gap-2 sm:grid-cols-2">
            <Link to="/admin/organizations">
              <Button type="button" fullWidth>
                조직 관리
              </Button>
            </Link>
            <Link to="/admin/users">
              <Button type="button" variant="secondary" fullWidth>
                사용자 관리
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
