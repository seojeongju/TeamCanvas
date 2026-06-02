import { useEffect, useState, type ReactNode } from "react";
import { Bell, Smartphone, Mail } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Button } from "../../components/ui/Button";
import { ToastMessage } from "../../components/ui/ToastMessage";
import { useNotificationPreferences, useUpdateNotificationPreferences } from "../../hooks/useData";

export function NotificationSettingsPage() {
  const { data, isLoading } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);
  const [prefs, setPrefs] = useState({
    inAppEnabled: true,
    pushEnabled: false,
    emailEnabled: false,
  });

  useEffect(() => {
    if (data?.preferences) setPrefs(data.preferences);
  }, [data]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const save = async () => {
    try {
      await update.mutateAsync(prefs);
      setToast({ tone: "info", message: "알림 설정을 저장했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "저장 실패" });
    }
  };

  const toggle = (key: keyof typeof prefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="알림 설정" subtitle="인앱/푸시/이메일 채널 관리" />

      {isLoading ? (
        <GlassCard className="p-4 text-sm text-navy-600">설정을 불러오는 중...</GlassCard>
      ) : (
        <>
          <GlassCard className="space-y-3 p-4">
            <ToggleRow
              icon={<Bell className="h-4 w-4 text-primary-500" />}
              title="인앱 알림"
              desc="앱 내 알림함에서 이벤트와 업데이트를 확인합니다."
              checked={prefs.inAppEnabled}
              onToggle={() => toggle("inAppEnabled")}
            />
            <ToggleRow
              icon={<Smartphone className="h-4 w-4 text-primary-500" />}
              title="푸시 알림"
              desc="브라우저 푸시로 일정 리마인더를 받습니다."
              checked={prefs.pushEnabled}
              onToggle={() => toggle("pushEnabled")}
            />
            <ToggleRow
              icon={<Mail className="h-4 w-4 text-primary-500" />}
              title="이메일 알림"
              desc="이메일로 일정/초대 알림을 받습니다."
              checked={prefs.emailEnabled}
              onToggle={() => toggle("emailEnabled")}
            />
          </GlassCard>

          <Button type="button" fullWidth onClick={save} disabled={update.isPending}>
            {update.isPending ? "저장 중..." : "설정 저장"}
          </Button>
        </>
      )}

      {toast && <ToastMessage message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}

function ToggleRow({
  icon,
  title,
  desc,
  checked,
  onToggle,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-navy-800/5 px-3 py-2.5">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium text-navy-900">
          {icon}
          {title}
        </p>
        <p className="mt-0.5 text-xs text-navy-600">{desc}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`h-6 w-11 rounded-full p-0.5 transition ${checked ? "bg-primary-400" : "bg-navy-300/50"}`}
        aria-label={`${title} 토글`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}
