import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { flushOfflineQueue } from "../../lib/offlineQueue";

export function OfflineBanner() {
  const qc = useQueryClient();
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    const onOnline = async () => {
      setOffline(false);
      const flushed = await flushOfflineQueue();
      if (flushed > 0) {
        setSyncMessage(`오프라인에서 저장한 ${flushed}건을 동기화했습니다.`);
        qc.invalidateQueries({ queryKey: ["tasks"] });
        qc.invalidateQueries({ queryKey: ["events"] });
        window.setTimeout(() => setSyncMessage(null), 4000);
      }
    };
    const off = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", off);
    };
  }, [qc]);

  if (!offline && !syncMessage) return null;

  if (syncMessage) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-900">
        {syncMessage}
      </div>
    );
  }

  return (
    <div className="mb-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-900">
      <WifiOff className="h-4 w-4 shrink-0" />
      오프라인 모드 — 저장된 일정·업무를 표시하며, 새 항목은 연결 후 자동 동기화됩니다.
    </div>
  );
}
