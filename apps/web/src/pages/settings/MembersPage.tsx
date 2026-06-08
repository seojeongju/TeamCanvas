import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Shield, CreditCard, Link2, Copy, ScrollText, X } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ToastMessage } from "../../components/ui/ToastMessage";
import {
  useOrgMembers,
  useInviteOrgMember,
  useCreateInviteLink,
  useOrgInvites,
  useRevokeOrgInvite,
  useBillingHistory,
  useOrgSubscriptionDetail,
  useStartCheckout,
  useCompleteMockCheckout,
} from "../../hooks/useAdmin";
import { useHasPermission } from "../../hooks/usePermissions";
import { useAuthStore } from "../../stores/authStore";
import type { OrgInvite } from "../../lib/types";
import { cn } from "../../lib/cn";
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
  const revokeInvite = useRevokeOrgInvite();
  const [email, setEmail] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkDomain, setLinkDomain] = useState("");
  const [inviteType, setInviteType] = useState<"multi" | "single">("multi");
  const [maxUses, setMaxUses] = useState<"unlimited" | "limited">("unlimited");
  const [maxUsesLimit, setMaxUsesLimit] = useState("50");
  const [expiryDays, setExpiryDays] = useState("7");
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await invite.mutateAsync({ email: email.trim(), role: "member" });
      setEmail("");
      setToast({ tone: "info", message: "멤버 초대를 완료했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "초대 실패" });
    }
  };

  const handleCreateLink = async () => {
    try {
      const payload: Parameters<typeof createLink.mutateAsync>[0] = {
        inviteType,
        expiryDays: Number(expiryDays) || 7,
        label: linkLabel.trim() || undefined,
      };
      if (linkEmail.trim()) payload.email = linkEmail.trim();
      if (linkDomain.trim()) payload.emailDomain = linkDomain.trim();
      if (inviteType === "multi") {
        payload.maxUses =
          maxUses === "unlimited" ? null : Math.max(1, Number(maxUsesLimit) || 50);
      }
      const res = await createLink.mutateAsync(payload);
      setLastLink(res.inviteUrl);
      if (res.email?.devLink) setLastLink(res.email.devLink);
      setToast({ tone: "info", message: "팀 초대 링크를 생성했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "링크 생성 실패" });
    }
  };

  const copyLink = () => {
    if (!lastLink) return;
    navigator.clipboard.writeText(lastLink);
    setToast({ tone: "info", message: "초대 링크를 복사했습니다." });
  };

  const formatRemaining = (expiresAt: number) => {
    const diff = Math.max(0, expiresAt - Date.now());
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (days > 0) return `${days}일 ${hours}시간 남음`;
    const minutes = Math.max(1, Math.floor(diff / (60 * 1000)));
    return `${minutes}분 남음`;
  };

  const formatUsage = (inv: OrgInvite) => {
    const max = inv.max_uses;
    if (inv.invite_type === "single" || max === 1) {
      return inv.use_count > 0 ? "사용됨" : "1회용 · 미사용";
    }
    if (max === null) return `${inv.use_count}명 / 무제한`;
    return `${inv.use_count}명 / ${max}명`;
  };

  const inviteRestrictionLabel = (inv: OrgInvite) => {
    if (inv.email) return inv.email;
    if (inv.email_domain) return `${inv.email_domain} 도메인`;
    return "제한 없음";
  };

  const handleRevoke = async (inviteId: string) => {
    try {
      await revokeInvite.mutateAsync(inviteId);
      setToast({ tone: "info", message: "초대 링크를 비활성화했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "비활성화 실패" });
    }
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

          <GlassCard className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary-500" />
              <label className="text-sm font-medium text-navy-800">팀 초대 링크</label>
            </div>

            <Input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="링크 이름 (예: 2025 신규입사)"
            />

            <div className="flex gap-2">
              {(["multi", "single"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setInviteType(type)}
                  className={cn(
                    "flex-1 rounded-xl py-2 text-xs font-medium transition",
                    inviteType === type
                      ? "bg-primary-400 text-white"
                      : "bg-sky-100/60 text-navy-700",
                  )}
                >
                  {type === "multi" ? "다회용 (팀)" : "1회용 (개인)"}
                </button>
              ))}
            </div>

            {inviteType === "multi" && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-navy-700">사용 횟수</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMaxUses("unlimited")}
                    className={cn(
                      "flex-1 rounded-xl py-2 text-xs font-medium",
                      maxUses === "unlimited" ? "bg-primary-400/15 text-primary-700" : "bg-navy-800/5",
                    )}
                  >
                    무제한
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaxUses("limited")}
                    className={cn(
                      "flex-1 rounded-xl py-2 text-xs font-medium",
                      maxUses === "limited" ? "bg-primary-400/15 text-primary-700" : "bg-navy-800/5",
                    )}
                  >
                    최대 인원
                  </button>
                </div>
                {maxUses === "limited" && (
                  <Input
                    type="number"
                    min={1}
                    value={maxUsesLimit}
                    onChange={(e) => setMaxUsesLimit(e.target.value)}
                    placeholder="최대 인원"
                  />
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {["7", "30", "14"].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setExpiryDays(days)}
                  className={cn(
                    "rounded-xl py-2 text-xs font-medium",
                    expiryDays === days ? "bg-primary-400 text-white" : "bg-navy-800/5 text-navy-700",
                  )}
                >
                  {days}일
                </button>
              ))}
            </div>

            <Input
              type="email"
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
              placeholder="이메일 제한 (선택)"
            />
            <Input
              value={linkDomain}
              onChange={(e) => setLinkDomain(e.target.value)}
              placeholder="도메인 제한 (선택, 예: wow-campus.com)"
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
          <p className="mb-2 text-sm font-medium text-navy-800">활성 초대 링크</p>
          <ul className="space-y-2 text-xs text-navy-600">
            {invitesData!.invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-navy-800/5 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-800">
                    {inv.label || inviteRestrictionLabel(inv)}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-navy-600">
                    {inv.invite_type === "multi" ? "다회용" : "1회용"} · {roleLabels[inv.role] ?? inv.role} ·{" "}
                    {formatUsage(inv)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-navy-500">
                    {inviteRestrictionLabel(inv)} · {formatRemaining(inv.expires_at)}
                  </p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    className="shrink-0 rounded-md p-1.5 text-red-500 hover:bg-red-50"
                    aria-label="링크 비활성화"
                    onClick={() => handleRevoke(inv.id)}
                    disabled={revokeInvite.isPending}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
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

      {toast && (
        <ToastMessage
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export function BillingPage() {
  const orgId = useCurrentOrgId();
  const org = useAuthStore((s) => s.organizations.find((o) => o.id === orgId));
  const sub = org?.subscription;
  const canManage = useHasPermission("billing:manage");
  const { data } = useOrgSubscriptionDetail();
  const { data: billingHistory } = useBillingHistory();
  const checkout = useStartCheckout();
  const completeMock = useCompleteMockCheckout();
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
  const billingProvider = data?.billingProvider ?? "stripe";
  const isMockBilling = billingProvider === "mock";
  const subscriptionStatus = String(sub?.status ?? "active");
  const statusMeta: Record<string, { label: string; className: string; description: string }> = {
    active: {
      label: "정상",
      className: "bg-emerald-500/15 text-emerald-700",
      description: "모든 유료 기능을 정상적으로 사용할 수 있습니다.",
    },
    trialing: {
      label: "체험중",
      className: "bg-sky-500/15 text-sky-700",
      description: "체험 기간이 끝나면 결제 상태에 따라 기능이 제한될 수 있습니다.",
    },
    past_due: {
      label: "결제 필요",
      className: "bg-amber-500/15 text-amber-700",
      description: "결제가 지연되었습니다. 결제 상태를 확인하거나 문의해 주세요.",
    },
    canceled: {
      label: "해지됨",
      className: "bg-red-500/15 text-red-700",
      description: "구독이 해지되어 일부 기능이 제한될 수 있습니다.",
    },
    suspended: {
      label: "중지됨",
      className: "bg-red-500/15 text-red-700",
      description: "구독이 중지되어 기능이 제한됩니다. 관리자 문의가 필요합니다.",
    },
  };
  const currentStatus = statusMeta[subscriptionStatus] ?? statusMeta.active;
  const eventLabelMap: Record<string, string> = {
    "billing.checkout_started": "결제 시작",
    "billing.subscription_activated": "구독 활성화",
    "billing.subscription_updated": "구독 갱신/변경",
    "billing.subscription_canceled": "구독 해지",
    "billing.payment_failed": "결제 실패",
  };

  const handleUpgrade = async (planId: string) => {
    if (!orgId) return;
    setToast({
      tone: "info",
      message: "결제 및 프로그램 사용문의: (주)와우쓰리디 02-3144-3137 / 054-464-3137",
    });
    try {
      const { url } = await checkout.mutateAsync({ orgId, planId, billingCycle: "monthly" });
      window.location.href = url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "결제 시작 실패";
      setToast({
        tone: "error",
        message: msg.includes("STRIPE")
          ? "Stripe가 아직 설정되지 않았습니다. 결제/사용 문의: (주)와우쓰리디 02-3144-3137 / 054-464-3137"
          : msg,
      });
    }
  };

  const handleMockComplete = async (planId: string) => {
    if (!orgId) return;
    try {
      await completeMock.mutateAsync({ orgId, planId });
      setToast({
        tone: "info",
        message: "테스트 결제가 완료되었습니다. 현재 플랜/권한을 새로고침해 확인하세요.",
      });
    } catch (err) {
      setToast({
        tone: "error",
        message: err instanceof Error ? err.message : "테스트 결제 완료 처리 실패",
      });
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
        <div className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${currentStatus.className}`}>
          {currentStatus.label}
        </div>
        <p className="text-xs text-navy-600">{currentStatus.description}</p>
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
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    disabled={checkout.isPending || (!isMockBilling && !plan.stripe_price_monthly_id)}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    선택
                  </Button>
                  {isMockBilling && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={completeMock.isPending}
                      onClick={() => handleMockComplete(plan.id)}
                    >
                      테스트 결제 완료
                    </Button>
                  )}
                </div>
              )}
            </GlassCard>
          ))}
          <p className="text-xs text-navy-600">
            {isMockBilling
              ? "현재 MOCK 결제 모드입니다. 테스트 결제 완료 버튼으로 상태 전이를 검증할 수 있습니다."
              : "Stripe Price ID가 설정된 플랜만 결제할 수 있습니다."}
          </p>
        </div>
      )}

      <GlassCard className="space-y-3 p-4">
        <h3 className="text-sm font-semibold text-navy-800">최근 결제 이벤트</h3>
        {(billingHistory?.events ?? []).length === 0 ? (
          <p className="text-xs text-navy-600">아직 결제 이벤트가 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {(billingHistory?.events ?? []).slice(0, 8).map((event) => (
              <li key={event.id} className="rounded-xl bg-navy-800/5 px-3 py-2">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setExpandedEventId((prev) => (prev === event.id ? null : event.id))}
                >
                  <p className="text-xs font-medium text-navy-800">
                    {eventLabelMap[event.action] ?? event.action}
                  </p>
                </button>
                <p className="text-[11px] text-navy-600">
                  {new Date(event.createdAt).toLocaleString("ko-KR")}
                </p>
                {expandedEventId === event.id && (
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-white/70 p-2 text-[10px] text-navy-700">
                    {JSON.stringify(event.metadata ?? {}, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {toast && (
        <ToastMessage
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
