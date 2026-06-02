import { useParams } from "react-router-dom";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import {
  useAdminOrganization,
  useAdminPlans,
  useAdminRemoveOrganizationMember,
  useAdminTransferOrganizationOwner,
  useAdminUpdateOrganization,
  useAdminUpdateOrganizationMember,
} from "../../hooks/useAdmin";

export function AdminOrgDetailPage() {
  const { orgId = "" } = useParams();
  const { data, isLoading } = useAdminOrganization(orgId);
  const { data: plansData } = useAdminPlans();
  const updateOrg = useAdminUpdateOrganization();
  const updateMember = useAdminUpdateOrganizationMember();
  const removeMember = useAdminRemoveOrganizationMember();
  const transferOwner = useAdminTransferOrganizationOwner();

  const org = data?.organization as Record<string, unknown> | undefined;
  const subscription = data?.subscription as Record<string, unknown> | null;
  const members = (data?.members ?? []) as Record<string, unknown>[];

  if (isLoading) return <p className="text-sm text-navy-600">로딩 중...</p>;
  if (!org) return <p className="text-sm text-red-500">조직을 찾을 수 없습니다.</p>;

  return (
    <div className="space-y-6">
      <PageHeader title={String(org.name)} subtitle={String(org.slug)} />

      <GlassCard className="space-y-1 p-4 text-xs">
        <p className="font-semibold text-navy-900">조직 정책</p>
        <p className="text-navy-600">
          이 조직의 멤버는 다른 활성 조직에 중복 소속될 수 없습니다.
        </p>
        <p className="text-navy-600">
          무료 플랜일 경우 소유자 포함 최대 4명(초대 3명)까지 허용됩니다.
        </p>
      </GlassCard>

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
        <ul className="space-y-3">
          {members.map((m) => (
            <li key={String(m.user_id)} className="rounded-xl bg-navy-800/5 p-3 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium text-navy-900">{String(m.name)}</span>
                <span className="text-xs text-navy-600">{String(m.email)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  className="rounded-lg border border-sky-200 bg-white px-2 py-1 text-xs"
                  value={String(m.role)}
                  onChange={(e) =>
                    updateMember.mutate({ orgId, userId: String(m.user_id), role: e.target.value })
                  }
                >
                  <option value="owner">owner</option>
                  <option value="admin">admin</option>
                  <option value="member">member</option>
                  <option value="guest">guest</option>
                </select>
                <select
                  className="rounded-lg border border-sky-200 bg-white px-2 py-1 text-xs"
                  value={String(m.status)}
                  onChange={(e) =>
                    updateMember.mutate({ orgId, userId: String(m.user_id), status: e.target.value })
                  }
                >
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                </select>
                {String(m.role) !== "owner" && (
                  <button
                    type="button"
                    onClick={() => removeMember.mutate({ orgId, userId: String(m.user_id) })}
                    className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-500"
                  >
                    제거
                  </button>
                )}
                {String(m.role) !== "owner" && (
                  <button
                    type="button"
                    onClick={() => transferOwner.mutate({ orgId, newOwnerUserId: String(m.user_id) })}
                    className="rounded-lg bg-primary-400/10 px-2 py-1 text-xs text-primary-600"
                  >
                    소유자 이관
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}
