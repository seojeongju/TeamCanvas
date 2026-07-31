const UPDATE_INTERVAL_MS = 15 * 60 * 1000;

let registration: ServiceWorkerRegistration | null = null;
let swScriptUrl = "/sw.js";
let updateServiceWorkerFn: ((reloadPage?: boolean) => Promise<void>) | null = null;

export function bindPwaUpdate(
  swUrl: string,
  reg: ServiceWorkerRegistration | undefined,
  updateFn: (reloadPage?: boolean) => Promise<void>,
): () => void {
  swScriptUrl = swUrl;
  registration = reg ?? null;
  updateServiceWorkerFn = updateFn;

  if (!reg) return () => undefined;

  const check = () => {
    void checkForPwaUpdate();
  };

  const intervalId = window.setInterval(check, UPDATE_INTERVAL_MS);

  const onVisible = () => {
    if (document.visibilityState === "visible") check();
  };
  const onOnline = () => check();

  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
  window.addEventListener("online", onOnline);

  // 설치형 PWA가 오래 열려 있어도 바로 한 번 검사
  check();

  return () => {
    window.clearInterval(intervalId);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
    window.removeEventListener("online", onOnline);
  };
}

export async function checkForPwaUpdate(): Promise<"checked" | "unavailable"> {
  if (!registration || !("serviceWorker" in navigator)) return "unavailable";
  if (registration.installing) return "checked";
  if ("connection" in navigator && !navigator.onLine) return "unavailable";

  try {
    const resp = await fetch(swScriptUrl, {
      cache: "no-store",
      headers: {
        cache: "no-store",
        "cache-control": "no-cache",
      },
    });
    if (resp?.status === 200) {
      await registration.update();
    }
    return "checked";
  } catch {
    return "unavailable";
  }
}

export async function applyPwaUpdate(): Promise<void> {
  if (updateServiceWorkerFn) {
    await updateServiceWorkerFn(true);
    return;
  }
  window.location.reload();
}
