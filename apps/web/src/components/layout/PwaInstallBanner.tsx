import { useState } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import { PwaInstallPanel } from "./PwaInstallPanel";
import { cn } from "../../lib/cn";

function hasBottomNav(pathname: string): boolean {
  if (/^\/(login|forgot-password|reset-password|verify-email|onboarding)(\/|$)/.test(pathname)) {
    return false;
  }
  if (pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/invite/")) return false;
  return true;
}

export function PwaInstallBanner() {
  const location = useLocation();
  const { platform, canNativeInstall, installed, shouldShowBanner, install, dismiss } =
    usePwaInstall();
  const [pending, setPending] = useState(false);

  if (!shouldShowBanner) return null;

  const handleInstall = async () => {
    setPending(true);
    try {
      await install();
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[45] px-4",
        hasBottomNav(location.pathname) ? "bottom-24" : "bottom-4 safe-bottom",
      )}
    >
      <div className="pointer-events-auto relative mx-auto max-w-lg">
        <button
          type="button"
          onClick={dismiss}
          className="absolute -right-1 -top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-navy-800/80 text-white shadow-sm transition hover:bg-navy-900"
          aria-label="설치 안내 닫기"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <PwaInstallPanel
          variant="banner"
          platform={platform}
          canNativeInstall={canNativeInstall}
          installed={installed}
          onInstall={handleInstall}
          onDismiss={dismiss}
          installPending={pending}
        />
      </div>
    </div>
  );
}
