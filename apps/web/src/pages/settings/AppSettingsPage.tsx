import { useState } from "react";
import { Bell, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/layout/PageHeader";
import { PwaInstallPanel } from "../../components/layout/PwaInstallPanel";
import { GlassCard } from "../../components/ui/GlassCard";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import { clearInstallBannerDismiss } from "../../lib/pwaInstall";

export function AppSettingsPage() {
  const navigate = useNavigate();
  const { platform, canNativeInstall, installed, install, refreshDismissed } = usePwaInstall();
  const [pending, setPending] = useState(false);

  const handleInstall = async () => {
    setPending(true);
    try {
      const ok = await install();
      if (ok) clearInstallBannerDismiss();
      refreshDismissed();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="앱 설정" subtitle="설치 · 알림 · PWA" />

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-800">
          <Smartphone className="h-4 w-4 text-primary-500" />
          앱 설치
        </h2>
        <PwaInstallPanel
          variant="card"
          platform={platform}
          canNativeInstall={canNativeInstall}
          installed={installed}
          onInstall={handleInstall}
          installPending={pending}
        />
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-800">
          <Bell className="h-4 w-4 text-primary-500" />
          알림
        </h2>
        <button
          type="button"
          onClick={() => navigate("/settings/notifications")}
          className="w-full text-left"
        >
          <GlassCard className="flex items-center justify-between p-4 transition hover:bg-sky-50/40">
            <div>
              <p className="font-medium text-navy-900">알림 설정</p>
              <p className="text-xs text-navy-600">인앱 · 푸시 · 이메일 채널 관리</p>
            </div>
            <span className="text-sm text-primary-600">열기 →</span>
          </GlassCard>
        </button>
      </section>
    </div>
  );
}
