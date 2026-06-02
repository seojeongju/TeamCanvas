import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Shield, CreditCard, Link2, Copy, ScrollText } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import {
  useOrgMembers,
  useInviteOrgMember,
  useCreateInviteLink,
  useOrgInvites,
  useOrgSubscriptionDetail,
  useStartCheckout,
} from "../../hooks/useAdmin";
import { useHasPermission } from "../../hooks/usePermissions";
import { useAuthStore } from "../../stores/authStore";
import { useCurrentOrgId } from "../../stores/orgStore";

const roleLabels: Record<string, string> = {
  owner: "소유자",
  admin: "관리자",
  member: "멤버",
  guest: "게스트",
};

export function MembersPage() {
  const navigate = useNavigate();
  const canManage = useHasPermission("members:manage");
  const { data, isLoading } = useOrgMembers();
  const { data: invitesData } = useOrgInvites();
  const invite = useInviteOrgMember();
  const createLink = useCreateInviteLink();
  const [email, setEmail] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [lastLink, setLastLink] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await invite.mutateAsync({ email: email.trim(), role: "member" });
      setEmail("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "초대 실패");
    }
  };

  const handleCreateLink = async () => {
    try {
      const res = await createLink.mutateAsync(
        linkEmail.trim() ? { email: linkEmail.trim() } : undefined,
      );
      setLastLink(res.inviteUrl);
      if (res.email?.devLink) setLastLink(res.email.devLink);
    } catch (err) {
      alert(err instanceof Error ? err.message : "링크 생성 실패");
    }
  };

  const copyLink = () => {
    if (lastLink) navigator.clipboard.writeText(lastLink);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="멤버 관리"
        subtitle={data?.limits ? `${data.limits.current} / ${data.limits.limit}명` : undefined}
      />

      {canManage && (
        <>
          <GlassCard className="space-y-3 p-4">
            <form onSubmit={handleInvite} className="space-y-3">
              <label className="text-sm font-medium text-navy-800">가입된 사용자 초대</label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@company.com"
                />
                <Button type="submit" disabled={invite.isPending}>
                  초대
                </Button>
              </div>
            </form>
          </GlassCard>

          <GlassCard className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary-500" />
              <label className="text-sm font-medium text-navy-800">초대 링크 (7일 유효)</label>
            </div>
            <Input
              type="email"
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
              placeholder="이메일 제한 (선택)"
            />
            <Button type="button" onClick={handleCreateLink} disabled={createLink.isPending} className="w-full">
              링크 생성
            </Button>
            {lastLink && (
              <div className="flex gap-2">
                <Input value={lastLink} readOnly className="text-xs" />
                <button
                  type="button"
                  onClick={copyLink}
                  className="shrink-0 rounded-xl bg-navy-800/5 px-3"
                  aria-label="복사"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            )}
          </GlassCard>
        </>
      )}

      {(invitesData?.invites ?? []).length > 0 && (
        <GlassCard className="p-4">
          <p className="mb-2 text-sm font-medium text-navy-800">대기 중인 초대</p>
          <ul className="space-y-1 text-xs text-navy-600">
            {invitesData!.invites.map((inv) => (
              <li key={String(inv.id)}>
                {String(inv.email ?? "링크 초대")} · {roleLabels[String(inv.role)] ?? String(inv.role)}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {isLoading ? (
        <p className="text-sm text-navy-600">로딩 중...</p>
      ) : (
        <div className="space-y-2">
          {(data?.members ?? []).map((m) => (
            <GlassCard key={m.user_id} className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-400/10">
                <Users className="h-5 w-5 text-primary-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-navy-900">{m.name}</p>
                <p className="truncate text-xs text-navy-600">{m.email}</p>
              </div>
              <span className="rounded-full bg-navy-800/5 px-2 py-1 text-xs font-medium text-navy-700">
                {roleLabels[m.role] ?? m.role}
              </span>
            </GlassCard>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate("/settings/billing")}
        className="glass flex w-full items-center gap-3 rounded-2xl p-4 text-left"
      >
        <CreditCard className="h-5 w-5 text-primary-500" />
        <span className="text-sm font-medium text-navy-900">구독 · 플랜 보기</span>
      </button>

      <button
        type="button"
        onClick={() => navigate("/settings/audit")}
        className="glass flex w-full items-center gap-3 rounded-2xl p-4 text-left"
      >
        <ScrollText className="h-5 w-5 text-primary-500" />
        <span className="text-sm font-medium text-navy-900">감사 로그</span>
      </button>
    </div>
  );
}

export function BillingPage() {
  const orgId = useCurrentOrgId();
  const org = useAuthStore((s) => s.organizations.find((o) => o.id === orgId));
  const sub = org?.subscription;
  const canManage = useHasPermission("billing:manage");
  const { data } = useOrgSubscriptionDetail();
  const checkout = useStartCheckout();

  const plans = (data?.plans ?? []) as {
    id: string;
    code: string;
    name: string;
    description: string | null;
    price_monthly: number;
    price_yearly: number;
    stripe_price_monthly_id: string | null;
    stripe_price_yearly_id: string | null;
  }[];

  const handleUpgrade = async (planId: string) => {
    if (!orgId) return;
    try {
      const { url } = await checkout.mutateAsync({ orgId, planId, billingCycle: "monthly" });
      window.location.href = url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "결제 시작 실패";
      alert(msg.includes("STRIPE") ? "Stripe가 아직 설정되지 않았습니다. 관리자에게 문의하세요." : msg);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="구독 · 플랜" subtitle="조직 요금제 및 기능" />

      <GlassCard className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary-500" />
          <h2 className="font-semibold text-navy-900">{sub?.planName ?? "Free"}</h2>
        </div>
        <p className="text-sm text-navy-600">상태: {sub?.status ?? "active"}</p>
        <div className="flex flex-wrap gap-1">
          {(sub?.features ?? ["calendar", "tasks"]).map((f) => (
            <span
              key={f}
              className="rounded-full bg-primary-400/10 px-2 py-1 text-xs text-primary-600"
            >
              {f}
            </span>
          ))}
        </div>
      </GlassCard>

      {canManage && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-navy-800">플랜 업그레이드</h3>
          {plans.map((plan) => (
            <GlassCard key={plan.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-navy-900">{plan.name}</p>
                <p className="text-xs text-navy-600">
                  {plan.price_monthly === 0
                    ? "무료"
                    : `₩${plan.price_monthly.toLocaleString("ko-KR")}/월`}
                </p>
              </div>
              {plan.code !== sub?.planCode && plan.price_monthly > 0 && (
                <Button
                  type="button"
                  disabled={checkout.isPending || !plan.stripe_price_monthly_id}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  선택
                </Button>
              )}
            </GlassCard>
          ))}
          <p className="text-xs text-navy-600">
            Stripe Price ID가 설정된 플랜만 결제할 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
