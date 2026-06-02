import { useParams } from "react-router-dom";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { useAdminOrganization, useAdminPlans, useAdminUpdateOrganization } from "../../hooks/useAdmin";

export function AdminOrgDetailPage() {
  const { orgId = "" } = useParams();
  const { data, isLoading } = useAdminOrganization(orgId);
  const { data: plansData } = useAdminPlans();
  const updateOrg = useAdminUpdateOrganization();

  const org = data?.organization as Record<string, unknown> | undefined;
  const subscription = data?.subscription as Record<string, unknown> | null;
  const members = (data?.members ?? []) as Record<string, unknown>[];

  if (isLoading) return <p className="text-sm text-navy-600">로딩 중...</p>;
  if (!org) return <p className="text-sm text-red-500">조직을 찾을 수 없습니다.</p>;

  return (
    <div className="space-y-6">
      <PageHeader title={String(org.name)} subtitle={String(org.slug)} />

      <GlassCard className="space-y-4 p-5">
        <h2 className="font-semibold text-navy-900">구독 · 플랜</h2>
        <p className="text-sm text-navy-600">
          현재: {String(subscription?.planName ?? "—")} ({String(subscription?.status ?? "—")})
        </p>
        <div className="flex flex-wrap gap-2">
          {(plansData?.plans ?? []).map((plan) => (
            <button
              key={plan.id}
              type="button"
              disabled={updateOrg.isPending}
              onClick={() =>
                updateOrg.mutate({ orgId, planId: plan.id, subscriptionStatus: "active" })
              }
              className="rounded-xl border border-primary-400/30 px-3 py-2 text-sm hover:bg-primary-400/10 disabled:opacity-50"
            >
              {plan.name}
            </button>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="space-y-3 p-5">
        <h2 className="font-semibold text-navy-900">조직 상태</h2>
        <div className="flex gap-2">
          {(["active", "suspended"] as const).map((status) => (
            <button
              key={status}
              type="button"
              disabled={updateOrg.isPending || org.status === status}
              onClick={() => updateOrg.mutate({ orgId, status })}
              className="rounded-xl bg-navy-800/5 px-4 py-2 text-sm disabled:opacity-40"
            >
              {status === "active" ? "활성화" : "정지"}
            </button>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h2 className="mb-3 font-semibold text-navy-900">멤버 ({members.length})</h2>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={String(m.user_id)} className="flex justify-between text-sm">
              <span className="text-navy-900">{String(m.name)}</span>
              <span className="text-navy-600">
                {String(m.role)} · {String(m.email)}
              </span>
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}
