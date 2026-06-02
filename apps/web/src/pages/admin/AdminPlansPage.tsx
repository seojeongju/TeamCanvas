import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { useAdminPlans } from "../../hooks/useAdmin";

function formatPrice(won: number) {
  if (won === 0) return "무료";
  return `₩${won.toLocaleString("ko-KR")}/월`;
}

export function AdminPlansPage() {
  const { data, isLoading } = useAdminPlans();

  return (
    <div className="space-y-6">
      <PageHeader title="구독 플랜" subtitle="판매 플랜 및 기능 한도" />

      {isLoading ? (
        <p className="text-sm text-navy-600">로딩 중...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(data?.plans ?? []).map((plan) => (
            <GlassCard key={plan.id} className="space-y-3 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-navy-900">{plan.name}</h3>
                  <p className="text-xs text-navy-600">{plan.code}</p>
                </div>
                <span className="text-sm font-semibold text-primary-600">
                  {formatPrice(plan.priceMonthly)}
                </span>
              </div>
              <p className="text-sm text-navy-600">{plan.description}</p>
              <div className="text-xs text-navy-600">
                멤버 {plan.maxMembers} · 팀 {plan.maxTeams} · 저장 {plan.maxStorageMb}MB
              </div>
              <div className="flex flex-wrap gap-1">
                {plan.features.map((f) => (
                  <span
                    key={f}
                    className="rounded-full bg-primary-400/10 px-2 py-0.5 text-[10px] text-primary-600"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
