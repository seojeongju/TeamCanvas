import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { bindPwaUpdate } from "../../lib/pwaUpdate";
import { cn } from "../../lib/cn";

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
 * autoUpdate 모드에서는 새 버전이 활성화되면 자동으로 새로고침된다.
 * 드물게 waiting 상태만 남는 경우를 위해 배너도 제공한다.
 */
export function PwaUpdateBanner() {
  const location = useLocation();
  const cleanupRef = useRef<(() => void) | null>(null);
  const [updating, setUpdating] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      cleanupRef.current?.();
      cleanupRef.current = bindPwaUpdate(swUrl, registration, async (reload) => {
        setUpdating(true);
        await updateServiceWorker(reload);
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

  // autoUpdate가 리로드하기 직전에 잠깐 안내
  useEffect(() => {
    if (!needRefresh) return;
    setUpdating(true);
    void updateServiceWorker(true);
  }, [needRefresh, updateServiceWorker]);

  if (!updating && !needRefresh) return null;

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
