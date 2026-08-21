const UPDATE_INTERVAL_MS = 15 * 60 * 1000;
const APPLY_FALLBACK_MS = 2_000;

let registration: ServiceWorkerRegistration | null = null;
let swScriptUrl = "/sw.js";
let onApplyStart: (() => void) | null = null;

export function bindPwaUpdate(
  swUrl: string,
  reg: ServiceWorkerRegistration | undefined,
  opts?: { onApplyStart?: () => void },
): () => void {
  swScriptUrl = swUrl;
  registration = reg ?? null;
  onApplyStart = opts?.onApplyStart ?? null;

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

  check();

  return () => {
    window.clearInterval(intervalId);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
    window.removeEventListener("online", onOnline);
    onApplyStart = null;
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

/**
 * 수동 "앱 새로고침".
 * autoUpdate 모드의 virtual:pwa-register updateServiceWorker()는 no-op이므로
 * waiting SW가 있으면 SKIP_WAITING 후, 항상 location.reload()로 끝낸다.
 */
export async function applyPwaUpdate(): Promise<void> {
  onApplyStart?.();

  if (!("serviceWorker" in navigator)) {
    window.location.reload();
    return;
  }

  const reg =
    registration ?? (await navigator.serviceWorker.getRegistration().catch(() => undefined));

  if (reg?.waiting) {
    await activateWaitingWorker(reg.waiting);
  }

  window.location.reload();
}

function activateWaitingWorker(worker: ServiceWorker): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      window.clearTimeout(timer);
      resolve();
    };

    const onChange = () => done();
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    worker.postMessage({ type: "SKIP_WAITING" });

    const timer = window.setTimeout(done, APPLY_FALLBACK_MS);
  });
}
