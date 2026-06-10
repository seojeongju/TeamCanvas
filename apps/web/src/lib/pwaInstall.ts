const DISMISS_KEY = "pwa-install-dismissed-at";
/** 배너 "나중에" 숨김 기간 (3일) */
const DISMISS_MS = 3 * 24 * 60 * 60 * 1000;

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type PwaInstallPlatform = "chromium" | "ios" | "other";

export function isPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  return false;
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isAndroidDevice(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

export function getInstallPlatform(): PwaInstallPlatform {
  if (isIosDevice()) return "ios";
  if (isAndroidDevice() || "onbeforeinstallprompt" in window) return "chromium";
  return "other";
}

export function isInstallBannerDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < DISMISS_MS;
  } catch {
    return false;
  }
}

export function dismissInstallBanner(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function clearInstallBannerDismiss(): void {
  try {
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    /* ignore */
  }
}

export function shouldOfferPwaInstall(): boolean {
  if (isPwaInstalled()) return false;
  return true;
}
