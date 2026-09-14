import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { RefreshCw, Sparkles } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { applyPwaUpdate, bindPwaUpdate } from "../../lib/pwaUpdate";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";

const STUCK_FALLBACK_MS = 8_000;
const DISMISS_KEY = "tc_pwa_update_dismissed_at";
const DISMISS_COOLDOWN_MS = 30 * 60 * 1000; // 30분

type Phase = "idle" | "available" | "applying";

function hasBottomNav(pathname: string): boolean {
  if (/^\/(login|forgot-password|reset-password|verify-email|onboarding)(\/|$)/.test(pathname)) {
    return false;
  }
  if (pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/invite/")) return false;
  return true;
}

function isDismissedRecently(): boolean {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * PWA 업데이트 안내.
 * 새 버전이 준비되면 자동 새로고침하지 않고, 방법을 안내한 뒤 버튼으로 적용한다.
 */
export function PwaUpdateBanner() {
  const location = useLocation();
  const cleanupRef = useRef<(() => void) | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  useRegisterSW({
    immediate: true,
    onNeedReload() {
      if (isDismissedRecently()) return;
      setPhase((prev) => (prev === "applying" ? prev : "available"));
    },
    onRegisteredSW(swUrl, registration) {
      cleanupRef.current?.();
      cleanupRef.current = bindPwaUpdate(swUrl, registration, {
        onApplyStart: () => setPhase("applying"),
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

  // 적용 중인데 리로드가 안 되면 강제 새로고침
  useEffect(() => {
    if (phase !== "applying") return;
    const timer = window.setTimeout(() => {
      window.location.reload();
    }, STUCK_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "idle") return null;

  const applying = phase === "applying";

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[50] px-4",
        hasBottomNav(location.pathname) ? "bottom-24" : "bottom-4 safe-bottom",
      )}
      role="alertdialog"
      aria-labelledby="pwa-update-title"
      aria-describedby="pwa-update-desc"
    >
      <div
        className={cn(
          "pointer-events-auto mx-auto max-w-lg overflow-hidden rounded-2xl border shadow-lg",
          "border-primary-300/80 bg-white/98 text-navy-900 backdrop-blur-sm",
          "ring-2 ring-primary-400/30 animate-in slide-in-from-bottom-4 duration-300",
        )}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-primary-400 via-sky-400 to-primary-500" />
        <div className="flex gap-3 p-4">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              applying ? "bg-primary-400/15" : "bg-primary-400 text-white shadow-glow",
            )}
          >
            {applying ? (
              <RefreshCw className="h-5 w-5 animate-spin text-primary-600" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p id="pwa-update-title" className="text-base font-bold text-navy-900">
              {applying ? "새 버전을 적용하는 중..." : "새 버전이 준비되었습니다"}
            </p>
            <div id="pwa-update-desc" className="mt-1 space-y-1 text-xs leading-relaxed text-navy-600">
              {applying ? (
                <p>잠시만 기다려 주세요. 화면이 자동으로 새로고침됩니다.</p>
              ) : (
                <>
                  <p>최신 기능·수정 사항을 쓰려면 앱을 한 번 새로고침해야 합니다.</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-navy-700">
                    <li>
                      아래 <strong>지금 새로고침</strong> 버튼을 누르거나
                    </li>
                    <li>
                      앱을 <strong>완전히 종료한 뒤 다시 실행</strong>하세요
                    </li>
                  </ol>
                  <p className="pt-1 text-[11px] text-navy-500">
                    더보기 → 앱 설정 → 앱 새로고침으로도 적용할 수 있습니다.
                  </p>
                </>
              )}
            </div>

            {!applying && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  className="!min-h-10 !px-4 !py-2 text-sm"
                  onClick={() => {
                    setPhase("applying");
                    void applyPwaUpdate();
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  지금 새로고침
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    markDismissed();
                    setPhase("idle");
                  }}
                  className="rounded-xl px-3 py-2 text-xs font-medium text-navy-500 transition hover:bg-sky-50 hover:text-navy-700"
                >
                  나중에
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
