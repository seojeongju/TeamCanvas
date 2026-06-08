import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Calendar, ChevronLeft, ChevronRight, ImagePlus, Trash2 } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ToastMessage } from "../../components/ui/ToastMessage";
import { useOrgDetail } from "../../hooks/useData";
import {
  useUpdateOrganization,
  useOrgSettingsDetail,
  useUpdateOrgWorkSettings,
  useUploadOrgLogo,
  useDeleteOrgLogo,
  useDeactivateOrganization,
  useReactivateOrganization,
} from "../../hooks/useOrgSettings";
import { useHasPermission, useCurrentOrgRole } from "../../hooks/usePermissions";
import type { CalendarPolicy } from "../../lib/types";
import { useAuthStore } from "../../stores/authStore";
import { useCurrentOrgId } from "../../stores/orgStore";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";

const TIMEZONES = [
  { value: "Asia/Seoul", label: "서울 (Asia/Seoul)" },
  { value: "Asia/Tokyo", label: "도쿄 (Asia/Tokyo)" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "뉴욕 (America/New_York)" },
  { value: "Europe/London", label: "런던 (Europe/London)" },
];

const WORK_DAYS = [
  { value: 0, label: "일" },
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
];

export function OrgSettingsPage() {
  const navigate = useNavigate();
  const orgId = useCurrentOrgId();
  const org = useAuthStore((s) => s.organizations.find((o) => o.id === orgId));
  const canEdit = useHasPermission("org:settings");
  const role = useCurrentOrgRole();
  const deactivate = useDeactivateOrganization();
  const reactivateOrg = useReactivateOrganization();
  const { data, isLoading } = useOrgDetail();
  const { data: settingsData } = useOrgSettingsDetail();
  const update = useUpdateOrganization();
  const updateWork = useUpdateOrgWorkSettings();
  const uploadLogo = useUploadOrgLogo();
  const deleteLogo = useDeleteOrgLogo();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Seoul");
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [calendarPolicy, setCalendarPolicy] = useState<CalendarPolicy>("own_teams");
  const [logoVersion, setLogoVersion] = useState(0);
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);

  const hasLogo = settingsData?.organization.hasLogo ?? data?.organization.hasLogo ?? false;

  useEffect(() => {
    if (data?.organization) {
      setName(data.organization.name);
      setTimezone(data.organization.timezone ?? "Asia/Seoul");
    }
  }, [data]);

  useEffect(() => {
    const s = settingsData?.organization.settings;
    if (s) {
      setWorkStart(s.workHours.start);
      setWorkEnd(s.workHours.end);
      setWorkDays(s.workDays);
      setCalendarPolicy(s.calendarPolicy ?? "own_teams");
    }
  }, [settingsData]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await update.mutateAsync({ name: name.trim(), timezone });
      await updateWork.mutateAsync({
        workHours: { start: workStart, end: workEnd },
        workDays,
        calendarPolicy,
      });
      setToast({ tone: "info", message: "조직 설정을 저장했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "저장 실패" });
    }
  };

  const toggleWorkDay = (day: number) => {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  const handleLogoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadLogo.mutateAsync(file);
      setLogoVersion((v) => v + 1);
      setToast({ tone: "info", message: "로고를 업로드했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "업로드 실패" });
    } finally {
      e.target.value = "";
    }
  };

  const handleLogoDelete = async () => {
    if (!confirm("조직 로고를 삭제할까요?")) return;
    try {
      await deleteLogo.mutateAsync();
      setLogoVersion((v) => v + 1);
      setToast({ tone: "info", message: "로고를 삭제했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "삭제 실패" });
    }
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate("/more")}
        className="flex items-center gap-1 text-sm text-navy-600 hover:text-navy-900"
      >
        <ChevronLeft className="h-4 w-4" />
        더보기
      </button>

      <PageHeader title="조직 설정" subtitle={org?.name ?? "조직"} />

      {isLoading ? (
        <GlassCard className="p-4 text-sm text-navy-600">불러오는 중...</GlassCard>
      ) : (
        <>
          <GlassCard className="p-5">
            <p className="mb-3 text-sm font-medium text-navy-800">조직 로고</p>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-primary-400/10">
                {hasLogo && orgId ? (
                  <img
                    src={`${api.orgLogoUrl(orgId)}?v=${logoVersion}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Building2 className="h-8 w-8 text-primary-500" />
                )}
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadLogo.isPending}
                    className="flex items-center gap-1.5 rounded-xl bg-sky-100/80 px-3 py-2 text-xs font-medium text-navy-800"
                  >
                    <ImagePlus className="h-4 w-4" />
                    {uploadLogo.isPending ? "업로드 중..." : "업로드"}
                  </button>
                  {hasLogo && (
                    <button
                      type="button"
                      onClick={handleLogoDelete}
                      disabled={deleteLogo.isPending}
                      className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      삭제
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoPick}
                  />
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-navy-500">PNG, JPEG, WebP · 최대 2MB</p>
          </GlassCard>

          <GlassCard className="p-5">
            <form onSubmit={handleSave} className="space-y-4">
              <Input
                label="조직 이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
                required
              />

              <label className="block text-sm text-navy-700">
                타임존
                <select
                  className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={!canEdit}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <p className="mb-2 text-sm font-medium text-navy-700">근무 시간</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-navy-600">
                    시작
                    <input
                      type="time"
                      className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
                      value={workStart}
                      onChange={(e) => setWorkStart(e.target.value)}
                      disabled={!canEdit}
                    />
                  </label>
                  <label className="text-xs text-navy-600">
                    종료
                    <input
                      type="time"
                      className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
                      value={workEnd}
                      onChange={(e) => setWorkEnd(e.target.value)}
                      disabled={!canEdit}
                    />
                  </label>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-navy-700">근무 요일</p>
                <div className="flex flex-wrap gap-2">
                  {WORK_DAYS.map((d) => {
                    const active = workDays.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => toggleWorkDay(d.value)}
                        className={cn(
                          "h-9 w-9 rounded-xl text-sm font-medium transition",
                          active
                            ? "bg-primary-400 text-white"
                            : "bg-sky-100/60 text-navy-600",
                          !canEdit && "opacity-60",
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-navy-700">캘린더 공유 정책</p>
                <div className="space-y-2">
                  {(
                    [
                      { value: "own_teams" as const, label: "소속 팀만", desc: "팀 공유 일정은 소속 멤버만 조회" },
                      { value: "all_teams" as const, label: "전체 팀", desc: "멤버는 모든 팀 공유 일정 조회" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setCalendarPolicy(opt.value)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2.5 text-left transition",
                        calendarPolicy === opt.value
                          ? "border-primary-400 bg-primary-400/10"
                          : "border-sky-200 bg-white",
                        !canEdit && "opacity-60",
                      )}
                    >
                      <span className="block text-sm font-medium text-navy-900">{opt.label}</span>
                      <span className="block text-xs text-navy-600">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-sky-50/60 px-3 py-2 text-xs text-navy-600">
                <p>조직 URL: {data?.organization.slug ?? "—"}</p>
                <p className="mt-1">
                  멤버 {data?.stats.members ?? 0}명 · 팀 {data?.stats.teams ?? 0}개
                </p>
              </div>

              {canEdit ? (
                <Button type="submit" disabled={update.isPending || updateWork.isPending} className="w-full">
                  {update.isPending || updateWork.isPending ? "저장 중..." : "저장"}
                </Button>
              ) : (
                <p className="text-center text-xs text-navy-500">조직 설정 변경 권한이 없습니다.</p>
              )}
            </form>
          </GlassCard>

          <button type="button" onClick={() => navigate("/settings/departments")} className="w-full text-left">
            <GlassCard className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-400/10">
                <Building2 className="h-5 w-5 text-primary-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-navy-900">부서 관리</p>
                <p className="text-xs text-navy-600">부서 생성 및 팀 배치</p>
              </div>
              <ChevronRight className="h-5 w-5 text-navy-600/40" />
            </GlassCard>
          </button>

          <button type="button" onClick={() => navigate("/settings/holidays")} className="w-full text-left">
            <GlassCard className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-400/10">
                <Calendar className="h-5 w-5 text-primary-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-navy-900">휴일 캘린더</p>
                <p className="text-xs text-navy-600">공휴일·기념일 관리</p>
              </div>
              <ChevronRight className="h-5 w-5 text-navy-600/40" />
            </GlassCard>
          </button>

          {role === "owner" && data?.organization.status !== "pending_deletion" && (
            <GlassCard className="border border-red-100 p-5">
              <p className="text-sm font-semibold text-red-600">위험 구역</p>
              <p className="mt-1 text-xs text-navy-600">
                조직을 비활성화하면 30일 후 데이터가 삭제됩니다. 그동안 조회만 가능합니다.
              </p>
              <Button
                type="button"
                className="mt-3 w-full bg-red-500 hover:bg-red-600"
                disabled={deactivate.isPending}
                onClick={async () => {
                  if (!confirm("정말 조직 삭제를 예약할까요? 30일 내 복구할 수 있습니다.")) return;
                  try {
                    await deactivate.mutateAsync();
                    setToast({ tone: "info", message: "조직 삭제가 예약되었습니다." });
                  } catch (err) {
                    setToast({
                      tone: "error",
                      message: err instanceof Error ? err.message : "처리 실패",
                    });
                  }
                }}
              >
                {deactivate.isPending ? "처리 중..." : "조직 삭제 예약"}
              </Button>
            </GlassCard>
          )}

          {role === "owner" && data?.organization.status === "pending_deletion" && (
            <GlassCard className="border border-amber-200 p-5">
              <p className="text-sm font-medium text-amber-900">삭제 예정 조직</p>
              <p className="mt-1 text-xs text-amber-800">
                {data.organization.deleteScheduledAt
                  ? new Date(data.organization.deleteScheduledAt).toLocaleDateString("ko-KR")
                  : "—"}
                에 삭제됩니다.
              </p>
              <Button
                type="button"
                className="mt-3 w-full"
                disabled={reactivateOrg.isPending}
                onClick={() => reactivateOrg.mutate()}
              >
                {reactivateOrg.isPending ? "복구 중..." : "삭제 취소 · 조직 복구"}
              </Button>
            </GlassCard>
          )}
        </>
      )}

      {toast && <ToastMessage message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}
