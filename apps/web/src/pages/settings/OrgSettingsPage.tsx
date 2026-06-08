import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ToastMessage } from "../../components/ui/ToastMessage";
import { useOrgDetail } from "../../hooks/useData";
import { useUpdateOrganization } from "../../hooks/useOrgSettings";
import { useHasPermission } from "../../hooks/usePermissions";
import { useAuthStore } from "../../stores/authStore";
import { useCurrentOrgId } from "../../stores/orgStore";

const TIMEZONES = [
  { value: "Asia/Seoul", label: "서울 (Asia/Seoul)" },
  { value: "Asia/Tokyo", label: "도쿄 (Asia/Tokyo)" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "뉴욕 (America/New_York)" },
  { value: "Europe/London", label: "런던 (Europe/London)" },
];

export function OrgSettingsPage() {
  const navigate = useNavigate();
  const orgId = useCurrentOrgId();
  const org = useAuthStore((s) => s.organizations.find((o) => o.id === orgId));
  const canEdit = useHasPermission("org:settings");
  const { data, isLoading } = useOrgDetail();
  const update = useUpdateOrganization();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Seoul");
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);

  useEffect(() => {
    if (data?.organization) {
      setName(data.organization.name);
      setTimezone((data.organization as { timezone?: string }).timezone ?? "Asia/Seoul");
    }
  }, [data]);

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
      setToast({ tone: "info", message: "조직 설정을 저장했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "저장 실패" });
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

            <div className="rounded-xl bg-sky-50/60 px-3 py-2 text-xs text-navy-600">
              <p>조직 URL: {data?.organization.slug ?? "—"}</p>
              <p className="mt-1">
                멤버 {data?.stats.members ?? 0}명 · 팀 {data?.stats.teams ?? 0}개
              </p>
            </div>

            {canEdit ? (
              <Button type="submit" disabled={update.isPending} className="w-full">
                {update.isPending ? "저장 중..." : "저장"}
              </Button>
            ) : (
              <p className="text-center text-xs text-navy-500">조직 설정 변경 권한이 없습니다.</p>
            )}
          </form>
        </GlassCard>
      )}

      {toast && <ToastMessage message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}
