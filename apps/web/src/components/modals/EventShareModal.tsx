import { useState } from "react";
import { Copy, Link2, Trash2, X } from "lucide-react";
import { Button } from "../ui/Button";
import {
  useCreateEventShare,
  useEventShareStatus,
  useRevokeEventShare,
} from "../../hooks/useData";
import { ToastMessage } from "../ui/ToastMessage";

export function EventShareModal({
  eventId,
  eventTitle,
  onClose,
}: {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}) {
  const { data: status } = useEventShareStatus(eventId);
  const createShare = useCreateEventShare();
  const revokeShare = useRevokeEventShare();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const handleCreate = async () => {
    try {
      const res = await createShare.mutateAsync({ eventId, expiresInDays: 30 });
      setShareUrl(res.url);
      setToast("공유 링크가 생성되었습니다.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "링크 생성에 실패했습니다.");
    }
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setToast("클립보드에 복사했습니다.");
    } catch {
      setToast("복사에 실패했습니다.");
    }
  };

  const handleRevoke = async () => {
    try {
      await revokeShare.mutateAsync(eventId);
      setShareUrl(null);
      setToast("공유 링크를 해제했습니다.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "해제에 실패했습니다.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 p-4 sm:items-center">
      <div className="glass-strong w-full max-w-md rounded-2xl p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-navy-900">일정 공유</h2>
            <p className="mt-0.5 text-xs text-navy-500 line-clamp-1">{eventTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-navy-500 hover:bg-white/80"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-navy-600">
          링크를 받은 사람은 로그인 없이 일정을 볼 수 있습니다. (읽기 전용)
        </p>

        {shareUrl && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-white/70 p-3 ring-1 ring-sky-200/80">
            <Link2 className="h-4 w-4 shrink-0 text-primary-500" />
            <span className="min-w-0 flex-1 truncate text-xs text-navy-700">{shareUrl}</span>
            <button
              type="button"
              onClick={() => handleCopy(shareUrl)}
              className="shrink-0 rounded-lg p-2 text-primary-600 hover:bg-primary-50"
              aria-label="복사"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        )}

        {!shareUrl && status?.active && (
          <p className="mb-4 text-xs text-amber-700">
            활성 공유 링크가 있습니다. 새 링크를 만들면 기존 링크는 무효화됩니다.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleCreate}
            disabled={createShare.isPending}
            className="min-h-10 flex-1"
          >
            {status?.active || shareUrl ? "새 링크 만들기" : "공유 링크 만들기"}
          </Button>
          {(status?.active || shareUrl) && (
            <Button
              variant="secondary"
              onClick={handleRevoke}
              disabled={revokeShare.isPending}
              className="min-h-10"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              해제
            </Button>
          )}
        </div>

        {toast && (
          <ToastMessage message={toast} tone="info" onClose={() => setToast(null)} />
        )}
      </div>
    </div>
  );
}
