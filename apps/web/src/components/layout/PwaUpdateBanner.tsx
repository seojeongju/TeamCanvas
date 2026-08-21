import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { bindPwaUpdate } from "../../lib/pwaUpdate";
import { cn } from "../../lib/cn";

const RELOAD_UI_MS = 400;
const STUCK_FALLBACK_MS = 5_000;

function hasBottomNav(pathname: string): boolean {
  if (/^\/(login|forgot-password|reset-password|verify-email|onboarding)(\/|$)/.test(pathname)) {
    return false;
  }
  if (pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/invite/")) return false;
  return true;
}

/**
 * PWA 서비스 워커 등록 + 주기적 업데이트 검사.
 * autoUpdate: 새 SW 활성화 시 onNeedReload → 안내 배너 후 새로고침.
 * 수동 "앱 새로고침"도 동일 배너를 잠깐 보여 준 뒤 반드시 reload 한다.
 */
export function PwaUpdateBanner() {
  const location = useLocation();
  const cleanupRef = useRef<(() => void) | null>(null);
  const [updating, setUpdating] = useState(false);
  const reloadScheduled = useRef(false);

  const scheduleReload = () => {
    if (reloadScheduled.current) return;
    reloadScheduled.current = true;
    setUpdating(true);
    window.setTimeout(() => {
      window.location.reload();
    }, RELOAD_UI_MS);
  };

  useRegisterSW({
    immediate: true,
    // autoUpdate 모드에서 제공하면 기본 reload 대신 이 콜백이 호출된다.
    onNeedReload() {
      scheduleReload();
    },
    onRegisteredSW(swUrl, registration) {
      cleanupRef.current?.();
      cleanupRef.current = bindPwaUpdate(swUrl, registration, {
        onApplyStart: () => setUpdating(true),
      });
    },
    onRegisterError() {
      // 등록 실패 시에도 앱은 계속 사용 가능
    },
  });

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  // 배너가 떠 있는데 리로드가 안 되면 강제 새로고침
  useEffect(() => {
    if (!updating) return;
    const timer = window.setTimeout(() => {
      window.location.reload();
    }, STUCK_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [updating]);

  if (!updating) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[46] px-4",
        hasBottomNav(location.pathname) ? "bottom-24" : "bottom-4 safe-bottom",
      )}
    >
      <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-3 rounded-2xl bg-navy-900 px-4 py-3 text-white shadow-lg ring-1 ring-white/10">
        <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-primary-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">새 버전을 적용하는 중...</p>
          <p className="text-xs text-white/70">잠시 후 앱이 새로고침됩니다.</p>
        </div>
      </div>
    </div>
  );
}
