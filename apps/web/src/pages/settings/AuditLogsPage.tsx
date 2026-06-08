import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { useAuditLogs } from "../../hooks/useAdmin";
import { useHasFeature } from "../../hooks/usePermissions";

const actionLabels: Record<string, string> = {
  "member.invited": "멤버 초대",
  "member.updated": "멤버 변경",
  "member.removed": "멤버 제거",
  "invite.link_created": "초대 링크 생성",
  "invite.redeemed": "초대 링크 사용",
  "invite.accepted": "초대 수락",
  "invite.revoked": "초대 링크 비활성화",
  "billing.checkout_started": "결제 시작",
  "billing.subscription_activated": "구독 활성화",
  "billing.subscription_canceled": "구독 취소",
  "admin.org_updated": "관리자 조직 변경",
  "org.updated": "조직 설정 변경",
  "team.created": "팀 생성",
  "team.updated": "팀 수정",
  "team.deleted": "팀 삭제",
  "team.member_added": "팀 멤버 추가",
  "team.member_updated": "팀 멤버 역할 변경",
  "team.member_removed": "팀 멤버 제거",
  "org.settings_updated": "조직 근무 설정 변경",
  "org.logo_updated": "조직 로고 업로드",
  "org.logo_removed": "조직 로고 삭제",
  "department.created": "부서 생성",
  "department.updated": "부서 수정",
  "department.deleted": "부서 삭제",
  "org.deactivate_scheduled": "조직 삭제 예약",
  "org.reactivated": "조직 복구",
  "team.request_created": "팀 생성 요청",
  "team.request_approved": "팀 생성 요청 승인",
  "team.request_rejected": "팀 생성 요청 거절",
  "holiday.created": "휴일 추가",
  "holiday.deleted": "휴일 삭제",
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditLogsPage() {
  const hasFeature = useHasFeature("audit_logs");
  const { data, isLoading } = useAuditLogs();

  if (!hasFeature) {
    return (
      <div className="space-y-6">
        <PageHeader title="감사 로그" />
        <GlassCard className="p-5 text-sm text-navy-600">
          Enterprise 플랜 이상에서 이용할 수 있는 기능입니다.
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="감사 로그" subtitle="조직 활동 기록" />

      {isLoading ? (
        <p className="text-sm text-navy-600">로딩 중...</p>
      ) : (
        <div className="space-y-2">
          {(data?.logs ?? []).map((log) => (
            <GlassCard key={log.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-navy-900">
                    {actionLabels[log.action] ?? log.action}
                  </p>
                  <p className="text-xs text-navy-600">{log.actorName}</p>
                </div>
                <span className="shrink-0 text-xs text-navy-500">{formatTime(log.createdAt)}</span>
              </div>
            </GlassCard>
          ))}
          {(data?.logs ?? []).length === 0 && (
            <p className="text-center text-sm text-navy-600">기록이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}
