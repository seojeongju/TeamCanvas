import { useCallback, useEffect, useState } from "react";
import {
  dismissInstallBanner,
  getInstallPlatform,
  isInstallBannerDismissed,
  isPwaInstalled,
  type PwaInstallPlatform,
} from "../lib/pwaInstall";
import {
  getDeferredInstallPrompt,
  setDeferredInstallPrompt,
  subscribeInstallPrompt,
} from "../lib/pwaInstallStore";

export function usePwaInstall() {
  const [installed, setInstalled] = useState(isPwaInstalled);
  const [dismissed, setDismissed] = useState(isInstallBannerDismissed);
  const [hasPrompt, setHasPrompt] = useState(() => Boolean(getDeferredInstallPrompt()));
  const [platform, setPlatform] = useState<PwaInstallPlatform>(() => getInstallPlatform());

  useEffect(() => {
    setPlatform(getInstallPlatform());
    setInstalled(isPwaInstalled());
    setDismissed(isInstallBannerDismissed());
    setHasPrompt(Boolean(getDeferredInstallPrompt()));

    const onDisplayMode = () => setInstalled(isPwaInstalled());
    const unsubPrompt = subscribeInstallPrompt(() => {
      setHasPrompt(Boolean(getDeferredInstallPrompt()));
    });

    window.matchMedia("(display-mode: standalone)").addEventListener("change", onDisplayMode);
    window.matchMedia("(display-mode: fullscreen)").addEventListener("change", onDisplayMode);

    return () => {
      unsubPrompt();
      window.matchMedia("(display-mode: standalone)").removeEventListener("change", onDisplayMode);
      window.matchMedia("(display-mode: fullscreen)").removeEventListener("change", onDisplayMode);
    };
  }, []);

  const canNativeInstall = hasPrompt;

  const shouldShowBanner =
    !installed && !dismissed && (canNativeInstall || platform === "ios" || platform === "other");

  const install = useCallback(async (): Promise<boolean> => {
    const prompt = getDeferredInstallPrompt();
    if (!prompt) return false;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setDeferredInstallPrompt(null);
    if (outcome === "accepted") {
      setInstalled(true);
      return true;
    }
    return false;
  }, []);

  const dismiss = useCallback(() => {
    dismissInstallBanner();
    setDismissed(true);
  }, []);

  const refreshDismissed = useCallback(() => {
    setDismissed(isInstallBannerDismissed());
  }, []);

  return {
    installed,
    dismissed,
    platform,
    canNativeInstall,
    shouldShowBanner,
    install,
    dismiss,
    refreshDismissed,
  };
}
