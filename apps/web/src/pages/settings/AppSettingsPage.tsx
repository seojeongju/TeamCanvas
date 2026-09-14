import { useEffect, useState } from "react";
import { Bell, Monitor, RefreshCw, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/layout/PageHeader";
import { PwaInstallPanel } from "../../components/layout/PwaInstallPanel";
import { DesktopDownloadCard } from "../../components/dashboard/DesktopDownloadCard";
import { GlassCard } from "../../components/ui/GlassCard";
import { ToastMessage } from "../../components/ui/ToastMessage";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import { clearInstallBannerDismiss } from "../../lib/pwaInstall";
import { applyPwaUpdate, checkForPwaUpdate } from "../../lib/pwaUpdate";
import { isDesktopShell } from "../../lib/desktopDownload";

export function AppSettingsPage() {
  const navigate = useNavigate();
  const { platform, canNativeInstall, installed, install, refreshDismissed } = usePwaInstall();
  const [pending, setPending] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

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

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const result = await checkForPwaUpdate();
      if (result === "unavailable") {
        setToast({
          tone: "error",
          message: "업데이트를 확인할 수 없습니다. 네트워크 상태를 확인해 주세요.",
        });
        return;
      }
      setToast({
        tone: "info",
        message:
          "업데이트 확인을 완료했습니다. 새 버전이 있으면 하단에 안내가 표시됩니다. 안내에 따라 새로고침해 주세요.",
      });
    } finally {
      setCheckingUpdate(false);
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

      {!isDesktopShell() && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-800">
            <Monitor className="h-4 w-4 text-primary-500" />
            Windows 데스크톱
          </h2>
          <DesktopDownloadCard compact />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-800">
          <RefreshCw className="h-4 w-4 text-primary-500" />
          앱 업데이트
        </h2>
        <GlassCard className="space-y-3 p-4">
          <p className="text-sm text-navy-600">
            새 버전이 배포되면 하단에 <strong>업데이트 안내</strong>가 표시됩니다. 안내에 따라
            새로고침하면 최신 앱이 적용됩니다.
          </p>
          <div className="rounded-xl bg-sky-50/80 px-3 py-2.5 text-xs leading-relaxed text-navy-700">
            <p className="font-semibold text-navy-800">새로고침 방법</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4">
              <li>하단 안내의 <strong>지금 새로고침</strong> 버튼 누르기</li>
              <li>아래 <strong>앱 새로고침</strong> 버튼 누르기</li>
              <li>앱을 완전히 종료했다가 다시 실행하기</li>
            </ol>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCheckUpdate()}
              disabled={checkingUpdate}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary-400 px-4 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${checkingUpdate ? "animate-spin" : ""}`} />
              {checkingUpdate ? "확인 중..." : "업데이트 확인"}
            </button>
            <button
              type="button"
              onClick={() => void applyPwaUpdate()}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/80 px-4 text-sm font-medium text-navy-700 ring-1 ring-sky-100/90 hover:bg-white"
            >
              앱 새로고침
            </button>
          </div>
        </GlassCard>
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

      {toast && (
        <ToastMessage message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
