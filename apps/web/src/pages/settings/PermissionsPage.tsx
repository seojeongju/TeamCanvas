import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, ScrollText, Shield, X } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { useOrgPermissions, useHasPermission, usePermissionMatrix } from "../../hooks/usePermissions";
import type { OrgRole, Permission } from "../../lib/types";

const ROLE_LABELS: Record<string, string> = {
  owner: "소유자",
  admin: "관리자",
  member: "멤버",
  guest: "게스트",
};

const PERMISSION_LABELS: Record<Permission, string> = {
  "org:read": "조직 조회",
  "org:settings": "조직 설정",
  "members:read": "멤버 목록 조회",
  "members:manage": "멤버 관리",
  "teams:read": "팀 조회",
  "teams:manage": "팀 생성·수정·삭제",
  "teams:members": "팀 멤버 관리",
  "events:read": "일정 조회",
  "events:write": "일정 작성",
  "events:delete": "일정 삭제",
  "tasks:read": "업무 조회",
  "tasks:write": "업무 작성",
  "tasks:delete": "업무 삭제",
  "projects:read": "프로젝트 조회",
  "projects:write": "프로젝트 작성",
  "projects:delete": "프로젝트 삭제",
  "billing:read": "구독 조회",
  "billing:manage": "구독 관리",
};

export function PermissionsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useOrgPermissions();
  const { data: matrixData } = usePermissionMatrix();
  const canViewAudit = useHasPermission("org:settings");

  return (
    <div className="space-y-6">
      <PageHeader title="권한 및 보안" subtitle="내 역할과 조직 권한" />

      {isLoading ? (
        <GlassCard className="p-4 text-sm text-navy-600">불러오는 중...</GlassCard>
      ) : (
        <>
          <GlassCard className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-400/10">
              <Shield className="h-6 w-6 text-primary-500" />
            </div>
            <div>
              <p className="text-sm text-navy-600">현재 역할</p>
              <p className="text-lg font-semibold text-navy-900">
                {ROLE_LABELS[data?.role ?? ""] ?? data?.role ?? "—"}
              </p>
              {data?.subscription && (
                <p className="text-xs text-navy-500">
                  {data.subscription.planName} · {data.subscription.status}
                </p>
              )}
            </div>
          </GlassCard>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-navy-800">보유 권한</h2>
            <GlassCard className="divide-y divide-sky-100/80 p-0">
              {(data?.permissions ?? []).map((perm) => (
                <div key={perm} className="px-4 py-3 text-sm text-navy-800">
                  {PERMISSION_LABELS[perm] ?? perm}
                </div>
              ))}
            </GlassCard>
          </section>

          {matrixData && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-navy-800">역할별 권한 매트릭스</h2>
              <GlassCard className="overflow-x-auto p-0">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-sky-100/80 bg-white/50">
                      <th className="px-3 py-2.5 font-medium text-navy-600">권한</th>
                      {matrixData.roles.map((role) => (
                        <th key={role} className="px-3 py-2.5 text-center font-medium text-navy-700">
                          {ROLE_LABELS[role] ?? role}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.permissions.map((perm) => (
                      <tr key={perm} className="border-b border-sky-50/80 last:border-0">
                        <td className="px-3 py-2 text-navy-800">{PERMISSION_LABELS[perm] ?? perm}</td>
                        {matrixData.roles.map((role) => {
                          const has = matrixData.matrix[role as OrgRole]?.includes(perm);
                          return (
                            <td key={role} className="px-3 py-2 text-center">
                              {has ? (
                                <Check className="mx-auto h-4 w-4 text-emerald-500" />
                              ) : (
                                <X className="mx-auto h-4 w-4 text-navy-300" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </GlassCard>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold text-navy-800">역할 안내</h2>
            <GlassCard className="space-y-2 p-4 text-xs text-navy-600">
              <p>
                <strong className="text-navy-800">소유자·관리자</strong> — 조직·팀·멤버 설정 가능
              </p>
              <p>
                <strong className="text-navy-800">멤버·게스트</strong> — 참여 중인 프로젝트만 조회 (소유자·관리자는
                전체)
              </p>
              <p>
                <strong className="text-navy-800">멤버</strong> — 일정·업무·프로젝트 작성, 본인이 만든 항목 삭제
              </p>
              <p>
                <strong className="text-navy-800">게스트</strong> — 초대받은 일정·업무만 조회
              </p>
              <p className="pt-1">팀 리드는 소속 팀의 멤버 추가·제거가 가능합니다.</p>
              <p className="pt-1">캘린더 정책(소속 팀만 / 전체 팀)은 조직 설정에서 변경할 수 있습니다.</p>
            </GlassCard>
          </section>

          {canViewAudit && (
            <button type="button" onClick={() => navigate("/settings/audit")} className="w-full text-left">
              <GlassCard className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-400/10">
                  <ScrollText className="h-5 w-5 text-primary-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-navy-900">감사 로그</p>
                  <p className="text-xs text-navy-600">멤버·팀·조직 변경 이력</p>
                </div>
                <ChevronRight className="h-5 w-5 text-navy-600/40" />
              </GlassCard>
            </button>
          )}
        </>
      )}
    </div>
  );
}
