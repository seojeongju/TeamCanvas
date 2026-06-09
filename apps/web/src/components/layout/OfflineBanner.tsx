import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="mb-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-900">
      <WifiOff className="h-4 w-4 shrink-0" />
      오프라인 모드 — 저장된 일정·업무 데이터를 표시합니다.
    </div>
  );
}
