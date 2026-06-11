import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { useAdminPlans } from "../../hooks/useAdmin";
import { FEATURE_LABELS, formatStorage, formatWon } from "../../lib/adminLabels";

export function AdminPlansPage() {
  const { data, isLoading } = useAdminPlans();

  return (
    <div className="space-y-6">
      <PageHeader title="구독 플랜" subtitle="판매 플랜 및 기능 한도 (조회)" />

      <GlassCard className="p-4 text-xs text-navy-600">
        플랜 가격·한도 변경은 데이터베이스 시드/마이그레이션으로 관리됩니다. 고객 조직에 플랜을
        적용하려면 <strong className="text-navy-800">조직 관리 → 조직 상세</strong>에서 설정하세요.
      </GlassCard>

      {isLoading ? (
        <p className="text-sm text-navy-600">불러오는 중…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(data?.plans ?? []).map((plan) => (
            <GlassCard key={plan.id} className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-navy-900">{plan.name}</h3>
                  <p className="text-xs text-navy-600">{plan.code}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-primary-600">{formatWon(plan.priceMonthly)}/월</p>
                  {plan.priceYearly > 0 && (
                    <p className="text-xs text-navy-600">{formatWon(plan.priceYearly)}/년</p>
                  )}
                </div>
              </div>
              <p className="text-sm text-navy-600">{plan.description}</p>
              <ul className="space-y-1 text-xs text-navy-700">
                <li>멤버 최대 {plan.maxMembers}명</li>
                <li>팀 최대 {plan.maxTeams}개</li>
                <li>저장공간 {formatStorage(plan.maxStorageMb)}</li>
              </ul>
              <div className="flex flex-wrap gap-1">
                {plan.features.map((f) => (
                  <span
                    key={f}
                    className="rounded-full bg-primary-400/10 px-2 py-0.5 text-[10px] text-primary-600"
                  >
                    {FEATURE_LABELS[f] ?? f}
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
