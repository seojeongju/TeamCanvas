import { useEffect, useState } from "react";
import { Check, Mail, Phone, Shield, Sparkles } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Button } from "../../components/ui/Button";
import { ToastMessage } from "../../components/ui/ToastMessage";
import { useBillingHistory, useOrgSubscriptionDetail } from "../../hooks/useAdmin";
import { useHasPermission } from "../../hooks/usePermissions";
import type { PlanFeature } from "../../lib/types";
import { cn } from "../../lib/cn";

const BILLING_CONTACT = {
  company: "(주)와우쓰리디",
  phones: ["02-3144-3137", "054-464-3137"],
  email: "wow3d16@naver.com",
} as const;

const UPGRADE_INQUIRY_MESSAGE = `플랜 업그레이드 문의: ${BILLING_CONTACT.company} ${BILLING_CONTACT.phones.join(" / ")} / ${BILLING_CONTACT.email}`;

const FEATURE_LABELS: Record<PlanFeature, string> = {
  calendar: "캘린더",
  tasks: "업무",
  teams: "팀 관리",
  file_storage: "파일 저장",
  web_push: "웹 푸시",
  audit_logs: "감사 로그",
  api_access: "API",
  custom_branding: "커스텀 브랜딩",
};

const STATUS_META: Record<string, { label: string; className: string; description: string }> = {
  active: {
    label: "정상",
    className: "bg-emerald-500/15 text-emerald-700",
    description: "현재 플랜의 기능을 이용할 수 있습니다.",
  },
  trialing: {
    label: "체험중",
    className: "bg-sky-500/15 text-sky-700",
    description: "체험 기간이 끝나면 무료 플랜으로 전환되거나 결제가 필요합니다.",
  },
  past_due: {
    label: "결제 필요",
    className: "bg-amber-500/15 text-amber-700",
    description: "결제가 지연되어 캘린더·업무 외 기능이 제한됩니다.",
  },
  canceled: {
    label: "해지됨",
    className: "bg-red-500/15 text-red-700",
    description: "구독이 해지되어 일부 기능이 제한될 수 있습니다.",
  },
  suspended: {
    label: "중지됨",
    className: "bg-red-500/15 text-red-700",
    description: "구독이 중지되어 기능이 제한됩니다.",
  },
};

const EVENT_LABELS: Record<string, string> = {
  "billing.checkout_started": "결제 시작",
  "billing.subscription_activated": "구독 활성화",
  "billing.subscription_updated": "구독 갱신/변경",
  "billing.subscription_canceled": "구독 해지",
  "billing.payment_failed": "결제 실패",
  "billing.trial_expired": "체험 만료",
};

function parsePlanFeatures(json: string): PlanFeature[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? (parsed as PlanFeature[]) : [];
  } catch {
    return [];
  }
}

function formatStorage(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)}GB`;
  return `${mb}MB`;
}

function daysUntil(ts: number): number {
  return Math.max(0, Math.ceil((ts - Date.now()) / 86_400_000));
}

function BillingContactCard() {
  return (
    <GlassCard className="space-y-3 border border-primary-400/20 p-4">
      <p className="text-sm font-semibold text-navy-900">플랜 업그레이드 · 결제 문의</p>
      <p className="text-xs leading-relaxed text-navy-600">
        유료 플랜은 관리자 확인 후 적용됩니다. 아래 연락처로 조직명과 희망 플랜을 알려 주세요.
      </p>
      <div className="space-y-2 text-xs text-navy-800">
        <p className="font-medium text-navy-900">{BILLING_CONTACT.company}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Phone className="h-3.5 w-3.5 text-primary-500" aria-hidden />
          {BILLING_CONTACT.phones.map((phone, index) => (
            <span key={phone} className="inline-flex items-center gap-x-2">
              {index > 0 && <span className="text-navy-500/60" aria-hidden>·</span>}
              <a href={`tel:${phone.replace(/-/g, "")}`} className="font-medium text-primary-700 hover:underline">
                {phone}
              </a>
            </span>
          ))}
        </p>
        <p className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-primary-500" aria-hidden />
          <a href={`mailto:${BILLING_CONTACT.email}`} className="font-medium text-primary-700 hover:underline">
            {BILLING_CONTACT.email}
          </a>
        </p>
      </div>
    </GlassCard>
  );
}

export function BillingPage() {
  const canManage = useHasPermission("billing:manage");
  const { data } = useOrgSubscriptionDetail();
  const { data: billingHistory } = useBillingHistory();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const subscription = data?.subscription ?? null;
  const plans = data?.plans ?? [];
  const subscriptionStatus = String(subscription?.status ?? "active");
  const currentStatus = STATUS_META[subscriptionStatus] ?? STATUS_META.active;
  const isFreePlan = subscription?.planCode === "free";

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleUpgradeInquiry = (planName: string) => {
    setToast({
      tone: "info",
      message: `${planName} ${UPGRADE_INQUIRY_MESSAGE}`,
    });
  };

  const trialDaysLeft =
    subscription?.status === "trialing" && subscription.trialEndsAt
      ? daysUntil(subscription.trialEndsAt)
      : null;

  return (
    <div className="space-y-6">
      <PageHeader title="구독 · 플랜" subtitle="조직 요금제 및 기능" />

      <GlassCard className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-500" />
            <div>
              <h2 className="font-semibold text-navy-900">{subscription?.planName ?? "Free"}</h2>
              <p className="text-xs text-navy-600">
                {isFreePlan
                  ? "무료 플랜 · 신규 가입 시 기본 제공"
                  : subscription?.billingCycle === "yearly"
                    ? "연간 결제"
                    : "월간 결제"}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
              currentStatus.className,
            )}
          >
            {currentStatus.label}
          </span>
        </div>

        <p className="text-sm text-navy-600">
          {isFreePlan && subscriptionStatus === "active"
            ? "캘린더·업무 등 무료 플랜 기능을 이용할 수 있습니다. 추가 기능이 필요하면 플랜 업그레이드를 문의해 주세요."
            : currentStatus.description}
        </p>

        {trialDaysLeft != null && (
          <p className="rounded-xl bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-800">
            체험 종료까지 D-{trialDaysLeft}
            {subscription?.trialEndsAt
              ? ` (${new Date(subscription.trialEndsAt).toLocaleDateString("ko-KR")})`
              : ""}
          </p>
        )}

        {subscription?.currentPeriodEnd ? (
          <p className="text-xs text-navy-600">
            현재 이용 기간: {new Date(subscription.currentPeriodStart).toLocaleDateString("ko-KR")} ~{" "}
            {new Date(subscription.currentPeriodEnd).toLocaleDateString("ko-KR")}
          </p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-navy-800/5 px-3 py-2">
            <p className="text-[11px] text-navy-600">멤버</p>
            <p className="text-sm font-semibold text-navy-900">최대 {subscription?.maxMembers ?? 5}명</p>
          </div>
          <div className="rounded-xl bg-navy-800/5 px-3 py-2">
            <p className="text-[11px] text-navy-600">팀</p>
            <p className="text-sm font-semibold text-navy-900">최대 {subscription?.maxTeams ?? 1}개</p>
          </div>
          <div className="rounded-xl bg-navy-800/5 px-3 py-2">
            <p className="text-[11px] text-navy-600">저장공간</p>
            <p className="text-sm font-semibold text-navy-900">
              {formatStorage(subscription?.maxStorageMb ?? 100)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {(subscription?.features ?? ["calendar", "tasks"]).map((f) => (
            <span
              key={f}
              className="rounded-full bg-primary-400/10 px-2 py-1 text-xs text-primary-600"
            >
              {FEATURE_LABELS[f] ?? f}
            </span>
          ))}
        </div>
      </GlassCard>

      <BillingContactCard />

      {canManage && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-navy-800">플랜 비교</h3>
            <div className="inline-flex rounded-xl bg-navy-800/5 p-1">
              <button
                type="button"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  billingCycle === "monthly"
                    ? "bg-white text-navy-900 shadow-sm"
                    : "text-navy-600 hover:text-navy-900",
                )}
                onClick={() => setBillingCycle("monthly")}
              >
                월간
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  billingCycle === "yearly"
                    ? "bg-white text-navy-900 shadow-sm"
                    : "text-navy-600 hover:text-navy-900",
                )}
                onClick={() => setBillingCycle("yearly")}
              >
                연간
              </button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {plans.map((plan) => {
              const isCurrent = plan.code === subscription?.planCode;
              const features = parsePlanFeatures(plan.features_json);
              const price = billingCycle === "yearly" ? plan.price_yearly : plan.price_monthly;

              return (
                <GlassCard
                  key={plan.id}
                  className={cn(
                    "flex flex-col gap-3 p-4",
                    isCurrent && "ring-2 ring-primary-400/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-navy-900">{plan.name}</p>
                      {plan.description && (
                        <p className="mt-0.5 text-xs text-navy-600">{plan.description}</p>
                      )}
                    </div>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-400/15 px-2 py-0.5 text-[11px] font-semibold text-primary-700">
                        <Check className="h-3 w-3" />
                        현재
                      </span>
                    )}
                  </div>

                  <p className="text-lg font-bold text-navy-900">
                    {price === 0 ? (
                      "무료"
                    ) : (
                      <>
                        ₩{price.toLocaleString("ko-KR")}
                        <span className="text-sm font-normal text-navy-600">
                          /{billingCycle === "yearly" ? "년" : "월"}
                        </span>
                      </>
                    )}
                  </p>

                  <ul className="space-y-1 text-xs text-navy-700">
                    <li>멤버 최대 {plan.max_members}명</li>
                    <li>팀 최대 {plan.max_teams}개</li>
                    <li>저장공간 {formatStorage(plan.max_storage_mb)}</li>
                  </ul>

                  <div className="flex flex-wrap gap-1">
                    {features.map((f) => (
                      <span
                        key={f}
                        className="rounded-full bg-navy-800/5 px-2 py-0.5 text-[11px] text-navy-700"
                      >
                        {FEATURE_LABELS[f] ?? f}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto pt-1">
                    {isCurrent ? (
                      <Button type="button" variant="secondary" disabled className="w-full">
                        사용 중
                      </Button>
                    ) : plan.price_monthly === 0 ? (
                      <Button type="button" variant="secondary" disabled className="w-full">
                        기본 플랜
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        className="w-full"
                        onClick={() => handleUpgradeInquiry(plan.name)}
                      >
                        업그레이드 문의
                      </Button>
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </div>

          <p className="flex items-start gap-2 text-xs text-navy-600">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-500" />
            신규 가입 시 무료 플랜으로 시작합니다. 유료 플랜은 관리자 문의 후 적용됩니다.
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
                    {EVENT_LABELS[event.action] ?? event.action}
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
        <ToastMessage message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
