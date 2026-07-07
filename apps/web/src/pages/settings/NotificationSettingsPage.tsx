import { useEffect, useState, type ReactNode } from "react";
import { Bell, Briefcase, CalendarDays, Mail, MessageCircle, Smartphone } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Button } from "../../components/ui/Button";
import { ToastMessage } from "../../components/ui/ToastMessage";
import { useNotificationPreferences, useUpdateNotificationPreferences } from "../../hooks/useData";
import { subscribeToPush, unsubscribeFromPush } from "../../lib/pushClient";
import type { NotificationTypeCategory } from "../../lib/types";

const TYPE_CATEGORY_META: Record<
  NotificationTypeCategory,
  { title: string; desc: string; icon: ReactNode }
> = {
  tasks: {
    title: "업무 알림",
    desc: "배정, 마감, 상태 변경, 지연 알림",
    icon: <Briefcase className="h-4 w-4 text-primary-500" />,
  },
  events: {
    title: "일정 알림",
    desc: "초대, 리마인더, 일정 댓글",
    icon: <CalendarDays className="h-4 w-4 text-primary-500" />,
  },
  projects: {
    title: "프로젝트 알림",
    desc: "프로젝트·마일스톤 관련 알림",
    icon: <Bell className="h-4 w-4 text-primary-500" />,
  },
  mentions: {
    title: "멘션",
    desc: "댓글에서 나를 태그한 알림",
    icon: <MessageCircle className="h-4 w-4 text-primary-500" />,
  },
};

export function NotificationSettingsPage() {
  const { data, isLoading } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);
  const [prefs, setPrefs] = useState({
    inAppEnabled: true,
    pushEnabled: false,
    emailEnabled: false,
    typePrefs: {
      tasks: true,
      events: true,
      projects: true,
      mentions: true,
    },
  });

  useEffect(() => {
    if (data?.preferences) {
      setPrefs({
        inAppEnabled: data.preferences.inAppEnabled,
        pushEnabled: data.preferences.pushEnabled,
        emailEnabled: data.preferences.emailEnabled,
        typePrefs: {
          tasks: data.preferences.typePrefs?.tasks ?? true,
          events: data.preferences.typePrefs?.events ?? true,
          projects: data.preferences.typePrefs?.projects ?? true,
          mentions: data.preferences.typePrefs?.mentions ?? true,
        },
      });
    }
  }, [data]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const save = async () => {
    try {
      const prevPush = data?.preferences?.pushEnabled ?? false;
      if (prefs.pushEnabled && !prevPush) {
        await subscribeToPush();
      } else if (!prefs.pushEnabled && prevPush) {
        await unsubscribeFromPush();
      }
      await update.mutateAsync(prefs);
      setToast({ tone: "info", message: "알림 설정을 저장했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "저장 실패" });
    }
  };

  const toggleChannel = (key: "inAppEnabled" | "pushEnabled" | "emailEnabled") => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleType = (key: NotificationTypeCategory) => {
    setPrefs((prev) => ({
      ...prev,
      typePrefs: { ...prev.typePrefs, [key]: !prev.typePrefs[key] },
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="알림 설정" subtitle="채널 및 유형별 알림 관리" />

      {isLoading ? (
        <GlassCard className="p-4 text-sm text-navy-600">설정을 불러오는 중...</GlassCard>
      ) : (
        <>
          <GlassCard className="space-y-3 p-4">
            <p className="text-xs font-semibold text-navy-700">알림 채널</p>
            <ToggleRow
              icon={<Bell className="h-4 w-4 text-primary-500" />}
              title="인앱 알림"
              desc="앱 내 알림함에서 이벤트와 업데이트를 확인합니다."
              checked={prefs.inAppEnabled}
              onToggle={() => toggleChannel("inAppEnabled")}
            />
            <ToggleRow
              icon={<Smartphone className="h-4 w-4 text-primary-500" />}
              title="푸시 알림"
              desc="브라우저 푸시로 일정 리마인더를 받습니다."
              checked={prefs.pushEnabled}
              onToggle={() => toggleChannel("pushEnabled")}
            />
            <ToggleRow
              icon={<Mail className="h-4 w-4 text-primary-500" />}
              title="이메일 알림"
              desc="이메일로 일정/초대 알림을 받습니다."
              checked={prefs.emailEnabled}
              onToggle={() => toggleChannel("emailEnabled")}
            />
          </GlassCard>

          <GlassCard className="space-y-3 p-4">
            <p className="text-xs font-semibold text-navy-700">알림 유형</p>
            {(Object.keys(TYPE_CATEGORY_META) as NotificationTypeCategory[]).map((key) => {
              const meta = TYPE_CATEGORY_META[key];
              return (
                <ToggleRow
                  key={key}
                  icon={meta.icon}
                  title={meta.title}
                  desc={meta.desc}
                  checked={prefs.typePrefs[key]}
                  onToggle={() => toggleType(key)}
                />
              );
            })}
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
