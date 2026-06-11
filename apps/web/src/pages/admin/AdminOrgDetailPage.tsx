import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Users } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ToastMessage } from "../../components/ui/ToastMessage";
import {
  useAdminOrganization,
  useAdminPlans,
  useAdminRemoveOrganizationMember,
  useAdminTransferOrganizationOwner,
  useAdminUpdateOrganization,
  useAdminUpdateOrganizationMember,
} from "../../hooks/useAdmin";
import type { OrgSubscriptionDetail, PlanFeature } from "../../lib/types";
import {
  ADMIN_TIMEZONES,
  FEATURE_LABELS,
  MEMBER_STATUS_LABELS,
  ORG_ROLE_LABELS,
  ORG_STATUS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  formatStorage,
  formatWon,
} from "../../lib/adminLabels";
import { cn } from "../../lib/cn";

type AdminMember = {
  user_id: string;
  role: string;
  status: string;
  name: string;
  email: string | null;
  joined_at: number | null;
};

const SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due", "canceled", "suspended"] as const;

export function AdminOrgDetailPage() {
  const { orgId = "" } = useParams();
  const { data, isLoading } = useAdminOrganization(orgId);
  const { data: plansData } = useAdminPlans();
  const updateOrg = useAdminUpdateOrganization();
  const updateMember = useAdminUpdateOrganizationMember();
  const removeMember = useAdminRemoveOrganizationMember();
  const transferOwner = useAdminTransferOrganizationOwner();

  const [orgName, setOrgName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Seoul");
  const [subscriptionStatus, setSubscriptionStatus] = useState("active");
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);

  const org = data?.organization as Record<string, unknown> | undefined;
  const subscription = data?.subscription as OrgSubscriptionDetail | null | undefined;
  const members = (data?.members ?? []) as AdminMember[];

  useEffect(() => {
    if (!org) return;
    setOrgName(String(org.name ?? ""));
    setTimezone(String(org.timezone ?? "Asia/Seoul"));
  }, [org]);

  useEffect(() => {
    if (subscription?.status) setSubscriptionStatus(subscription.status);
  }, [subscription?.status]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const m of members) next[m.user_id] = m.name;
    setMemberNames(next);
  }, [members]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (message: string, tone: "info" | "error" = "info") => setToast({ message, tone });

  if (isLoading) return <p className="text-sm text-navy-600">불러오는 중…</p>;
  if (!org) return <p className="text-sm text-red-500">조직을 찾을 수 없습니다.</p>;

  const handleSaveOrgInfo = async () => {
    try {
      await updateOrg.mutateAsync({ orgId, name: orgName.trim(), timezone });
      notify("조직 정보를 저장했습니다.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "저장 실패", "error");
    }
  };

  const handleApplyPlan = async (planId: string, planName: string) => {
    if (!confirm(`${planName} 플랜을 적용할까요?\n구독 상태: ${SUBSCRIPTION_STATUS_LABELS[subscriptionStatus] ?? subscriptionStatus}`)) {
      return;
    }
    try {
      await updateOrg.mutateAsync({
        orgId,
        planId,
        subscriptionStatus,
      });
      notify(`${planName} 플랜을 적용했습니다.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "플랜 적용 실패", "error");
    }
  };

  const handleSubscriptionStatusOnly = async () => {
    try {
      await updateOrg.mutateAsync({ orgId, subscriptionStatus });
      notify("구독 상태를 변경했습니다.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "상태 변경 실패", "error");
    }
  };

  const handleOrgStatus = async (status: string) => {
    const label = ORG_STATUS_LABELS[status] ?? status;
    if (!confirm(`조직 상태를 「${label}」(으)로 변경할까요?`)) return;
    try {
      await updateOrg.mutateAsync({ orgId, status });
      notify(`조직 상태를 ${label}(으)로 변경했습니다.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "상태 변경 실패", "error");
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/admin/organizations"
        className="inline-flex items-center gap-1 text-sm text-navy-600 hover:text-primary-600"
      >
        <ArrowLeft className="h-4 w-4" />
        조직 목록
      </Link>

      <PageHeader title={String(org.name)} subtitle={`슬러그: ${String(org.slug)}`} />

      <GlassCard className="space-y-4 p-5">
        <h2 className="font-semibold text-navy-900">조직 정보</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="조직 이름" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          <label className="block text-sm text-navy-700">
            타임존
            <select
              className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {ADMIN_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <dl className="grid gap-2 text-xs text-navy-600 sm:grid-cols-2">
          <div>
            <dt className="text-navy-500">소유자</dt>
            <dd className="font-medium text-navy-900">
              {String(org.owner_name ?? "—")} ({String(org.owner_email ?? "—")})
            </dd>
          </div>
          <div>
            <dt className="text-navy-500">조직 상태</dt>
            <dd className="font-medium text-navy-900">
              {ORG_STATUS_LABELS[String(org.status)] ?? String(org.status)}
            </dd>
          </div>
          <div>
            <dt className="text-navy-500">생성일</dt>
            <dd>{new Date(Number(org.created_at)).toLocaleString("ko-KR")}</dd>
          </div>
        </dl>
        <Button type="button" disabled={updateOrg.isPending} onClick={handleSaveOrgInfo}>
          {updateOrg.isPending ? "저장 중…" : "조직 정보 저장"}
        </Button>
      </GlassCard>

      <GlassCard className="space-y-4 p-5">
        <h2 className="font-semibold text-navy-900">구독 · 플랜</h2>
        <p className="text-sm text-navy-600">
          현재: <strong>{subscription?.planName ?? "—"}</strong> ·{" "}
          {SUBSCRIPTION_STATUS_LABELS[subscription?.status ?? ""] ?? subscription?.status ?? "—"}
        </p>
        {subscription && (
          <div className="flex flex-wrap gap-1 text-xs">
            <span className="rounded-full bg-navy-800/5 px-2 py-1">
              멤버 {subscription.maxMembers}명
            </span>
            <span className="rounded-full bg-navy-800/5 px-2 py-1">팀 {subscription.maxTeams}개</span>
            <span className="rounded-full bg-navy-800/5 px-2 py-1">
              저장 {formatStorage(subscription.maxStorageMb)}
            </span>
            {(subscription.features as PlanFeature[]).map((f) => (
              <span key={f} className="rounded-full bg-primary-400/10 px-2 py-1 text-primary-600">
                {FEATURE_LABELS[f] ?? f}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-navy-700">
            적용 시 구독 상태
            <select
              className="mt-1 block rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm"
              value={subscriptionStatus}
              onChange={(e) => setSubscriptionStatus(e.target.value)}
            >
              {SUBSCRIPTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {SUBSCRIPTION_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={updateOrg.isPending}
            onClick={handleSubscriptionStatusOnly}
          >
            상태만 변경
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {(plansData?.plans ?? []).map((plan) => {
            const isCurrent = subscription?.planCode === plan.code;
            return (
              <div
                key={plan.id}
                className={cn(
                  "rounded-xl border p-3",
                  isCurrent ? "border-primary-400/50 bg-primary-400/5" : "border-navy-800/10",
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium text-navy-900">{plan.name}</p>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600">
                      <Check className="h-3 w-3" />
                      현재
                    </span>
                  )}
                </div>
                <p className="text-xs text-navy-600">
                  {formatWon(plan.priceMonthly)}/월 · 멤버 {plan.maxMembers} · 팀 {plan.maxTeams}
                </p>
                <Button
                  type="button"
                  variant={isCurrent ? "secondary" : "primary"}
                  className="mt-3 w-full"
                  disabled={isCurrent || updateOrg.isPending}
                  onClick={() => handleApplyPlan(plan.id, plan.name)}
                >
                  {isCurrent ? "사용 중" : "플랜 적용"}
                </Button>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-navy-600">
          고객 문의 후 플랜을 적용할 때 사용합니다. 적용 내역은 감사 로그에 기록됩니다.
        </p>
      </GlassCard>

      <GlassCard className="space-y-3 p-5">
        <h2 className="font-semibold text-navy-900">조직 운영 상태</h2>
        <div className="flex flex-wrap gap-2">
          {(["active", "suspended"] as const).map((status) => (
            <Button
              key={status}
              type="button"
              variant={org.status === status ? "primary" : "secondary"}
              disabled={updateOrg.isPending || org.status === status}
              onClick={() => handleOrgStatus(status)}
            >
              {ORG_STATUS_LABELS[status]}
            </Button>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary-500" />
          <h2 className="font-semibold text-navy-900">멤버 ({members.length}명)</h2>
        </div>
        <ul className="space-y-3">
          {members.map((m) => (
            <li key={m.user_id} className="rounded-xl bg-navy-800/5 p-3 text-sm">
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                <Input
                  label="이름"
                  value={memberNames[m.user_id] ?? m.name}
                  onChange={(e) =>
                    setMemberNames((prev) => ({ ...prev, [m.user_id]: e.target.value }))
                  }
                  onBlur={async () => {
                    const next = memberNames[m.user_id]?.trim();
                    if (!next || next === m.name) return;
                    try {
                      await updateMember.mutateAsync({ orgId, userId: m.user_id, name: next });
                      notify("멤버 이름을 변경했습니다.");
                    } catch (err) {
                      notify(err instanceof Error ? err.message : "이름 변경 실패", "error");
                    }
                  }}
                />
                <div>
                  <p className="mb-1 text-xs text-navy-600">이메일</p>
                  <p className="rounded-xl bg-white/60 px-3 py-2 text-sm text-navy-800">
                    {m.email ?? "—"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-xs"
                  value={m.role}
                  onChange={async (e) => {
                    try {
                      await updateMember.mutateAsync({
                        orgId,
                        userId: m.user_id,
                        role: e.target.value,
                      });
                      notify("역할을 변경했습니다.");
                    } catch (err) {
                      notify(err instanceof Error ? err.message : "역할 변경 실패", "error");
                    }
                  }}
                >
                  {Object.entries(ORG_ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-xs"
                  value={m.status}
                  onChange={async (e) => {
                    try {
                      await updateMember.mutateAsync({
                        orgId,
                        userId: m.user_id,
                        status: e.target.value,
                      });
                      notify("멤버 상태를 변경했습니다.");
                    } catch (err) {
                      notify(err instanceof Error ? err.message : "상태 변경 실패", "error");
                    }
                  }}
                >
                  {Object.entries(MEMBER_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {m.role !== "owner" && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      className="!px-2 !py-1 text-xs"
                      disabled={transferOwner.isPending}
                      onClick={async () => {
                        if (!confirm(`${m.name} 님을 소유자로 이관할까요?`)) return;
                        try {
                          await transferOwner.mutateAsync({ orgId, newOwnerUserId: m.user_id });
                          notify("소유자를 이관했습니다.");
                        } catch (err) {
                          notify(err instanceof Error ? err.message : "이관 실패", "error");
                        }
                      }}
                    >
                      소유자 이관
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="!px-2 !py-1 text-xs text-red-600"
                      disabled={removeMember.isPending}
                      onClick={async () => {
                        if (!confirm(`${m.name} 님을 조직에서 제거할까요?`)) return;
                        try {
                          await removeMember.mutateAsync({ orgId, userId: m.user_id });
                          notify("멤버를 제거했습니다.");
                        } catch (err) {
                          notify(err instanceof Error ? err.message : "제거 실패", "error");
                        }
                      }}
                    >
                      제거
                    </Button>
                  </>
                )}
              </div>
              {m.joined_at != null && (
                <p className="mt-2 text-[11px] text-navy-500">
                  가입: {new Date(m.joined_at).toLocaleString("ko-KR")}
                </p>
              )}
            </li>
          ))}
        </ul>
      </GlassCard>

      {toast && (
        <ToastMessage message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
