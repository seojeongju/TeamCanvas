import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useOrgPermissions } from "../../hooks/usePermissions";

function daysUntil(ts: number): number {
  return Math.max(0, Math.ceil((ts - Date.now()) / 86_400_000));
}

export function SubscriptionStatusBanner() {
  const { data } = useOrgPermissions();
  const sub = data?.subscription;
  const status = sub?.status;

  if (!status) return null;

  const showBanner =
    status === "past_due" ||
    status === "canceled" ||
    status === "suspended" ||
    status === "trialing";

  if (!showBanner) return null;

  const messageByStatus: Record<string, string> = {
    past_due: "결제가 지연되었습니다. 캘린더·업무 외 기능이 제한됩니다.",
    canceled: "구독이 해지되어 일부 기능이 제한될 수 있습니다.",
    suspended: "구독이 중지되어 기능이 제한됩니다.",
    trialing:
      sub?.trialEndsAt != null
        ? `체험 기간이 D-${daysUntil(sub.trialEndsAt)} 남았습니다.`
        : "체험 기간 중입니다.",
  };

  const tone =
    status === "trialing"
      ? "border-sky-300/60 bg-sky-50"
      : "border-amber-300/60 bg-amber-50";

  return (
    <div className={`mb-4 rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            status === "trialing" ? "bg-sky-100" : "bg-amber-100"
          }`}
        >
          <AlertTriangle
            className={`h-4 w-4 ${status === "trialing" ? "text-sky-700" : "text-amber-700"}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-semibold ${
              status === "trialing" ? "text-sky-900" : "text-amber-900"
            }`}
          >
            {status === "trialing" ? "체험 기간 안내" : "결제 상태 안내"}
          </p>
          <p
            className={`mt-0.5 text-xs ${
              status === "trialing" ? "text-sky-800" : "text-amber-800"
            }`}
          >
            {messageByStatus[status] ?? "결제 상태를 확인해 주세요."}
          </p>
          <Link
            to="/settings/billing"
            className={`mt-2 inline-block text-xs font-medium underline ${
              status === "trialing" ? "text-sky-700" : "text-amber-700"
            }`}
          >
            구독 · 플랜 관리
          </Link>
        </div>
      </div>
    </div>
  );
}
