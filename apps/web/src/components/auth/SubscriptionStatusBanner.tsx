import { AlertTriangle } from "lucide-react";
import { useOrgPermissions } from "../../hooks/usePermissions";

export function SubscriptionStatusBanner() {
  const { data } = useOrgPermissions();
  const status = data?.subscription?.status;

  if (!status || (status !== "past_due" && status !== "canceled" && status !== "suspended")) {
    return null;
  }

  const messageByStatus: Record<string, string> = {
    past_due: "결제가 지연되었습니다. 결제 상태를 확인해 주세요.",
    canceled: "구독이 해지되어 일부 기능이 제한될 수 있습니다.",
    suspended: "구독이 중지되어 기능이 제한됩니다. 관리자 문의가 필요합니다.",
  };

  return (
    <div className="mb-4 rounded-2xl border border-amber-300/60 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">결제 상태 안내</p>
          <p className="mt-0.5 text-xs text-amber-800">{messageByStatus[status] ?? "결제 상태를 확인해 주세요."}</p>
          <p className="mt-2 text-xs text-amber-700">문의: (주)와우쓰리디 02-3144-3137 / 054-464-3137</p>
        </div>
      </div>
    </div>
  );
}
