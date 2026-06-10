import type { BeforeInstallPromptEvent } from "./pwaInstall";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function setDeferredInstallPrompt(event: BeforeInstallPromptEvent | null): void {
  deferredPrompt = event;
  listeners.forEach((fn) => fn());
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initPwaInstallListener(): void {
  if (typeof window === "undefined") return;
  if ((window as Window & { __pwaInstallInit?: boolean }).__pwaInstallInit) return;
  (window as Window & { __pwaInstallInit?: boolean }).__pwaInstallInit = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    setDeferredInstallPrompt(e as BeforeInstallPromptEvent);
  });

  window.addEventListener("appinstalled", () => {
    setDeferredInstallPrompt(null);
  });
}
