import { AlertTriangle } from "lucide-react";
import { useOrgDetail } from "../../hooks/useData";
import { useReactivateOrganization } from "../../hooks/useOrgSettings";
import { useCurrentOrgRole } from "../../hooks/usePermissions";
import { Button } from "../ui/Button";

export function OrgDeletionBanner() {
  const { data } = useOrgDetail();
  const role = useCurrentOrgRole();
  const reactivate = useReactivateOrganization();

  const org = data?.organization;
  if (org?.status !== "pending_deletion" || !org.deleteScheduledAt) return null;

  const deleteDate = new Date(org.deleteScheduledAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">조직 삭제 예정</p>
          <p className="mt-1 text-xs text-amber-800">
            {deleteDate}에 조직 데이터가 삭제됩니다. 현재는 조회만 가능합니다.
          </p>
          {role === "owner" && (
            <Button
              type="button"
              className="mt-3 h-9 px-3 text-xs"
              disabled={reactivate.isPending}
              onClick={() => reactivate.mutate()}
            >
              {reactivate.isPending ? "복구 중..." : "삭제 취소 · 조직 복구"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
