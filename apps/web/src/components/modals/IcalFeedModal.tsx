import { useState } from "react";
import { Check, Copy, Link2, Trash2, X } from "lucide-react";
import { Button } from "../ui/Button";
import { useCreateIcalFeed, useIcalFeedStatus, useRevokeIcalFeed } from "../../hooks/useData";

export function IcalFeedModal({ onClose }: { onClose: () => void }) {
  const { data: status } = useIcalFeedStatus();
  const createFeed = useCreateIcalFeed();
  const revokeFeed = useRevokeIcalFeed();
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [webcalUrl, setWebcalUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<"https" | "webcal" | null>(null);

  const handleCreate = async () => {
    const result = await createFeed.mutateAsync();
    setFeedUrl(result.url);
    setWebcalUrl(result.webcalUrl);
  };

  const handleRevoke = async () => {
    if (!window.confirm("구독 URL을 폐기할까요? 외부 캘린더에서 더 이상 동기화되지 않습니다.")) return;
    await revokeFeed.mutateAsync();
    setFeedUrl(null);
    setWebcalUrl(null);
  };

  const copy = async (text: string, kind: "https" | "webcal") => {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const active = status?.active || !!feedUrl;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button className="absolute inset-0 bg-navy-900/30 backdrop-blur-sm" onClick={onClose} aria-label="닫기" />
      <div className="glass-strong relative z-10 w-full max-w-lg rounded-t-3xl p-6 shadow-soft sm:rounded-3xl safe-bottom">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy-900">캘린더 구독</h2>
            <p className="mt-1 text-sm text-navy-600">
              Google Calendar, Apple 캘린더 등에 URL을 추가하면 일정이 자동 동기화됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-navy-600 hover:bg-sky-100/60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!active && !feedUrl ? (
          <Button fullWidth onClick={handleCreate} disabled={createFeed.isPending}>
            <Link2 className="h-4 w-4" />
            {createFeed.isPending ? "생성 중..." : "구독 URL 생성"}
          </Button>
        ) : (
          <div className="space-y-4">
            {feedUrl ? (
              <>
                <FeedUrlRow
                  label="HTTPS URL"
                  hint="Outlook, 일부 앱"
                  url={feedUrl}
                  copied={copied === "https"}
                  onCopy={() => copy(feedUrl, "https")}
                />
                {webcalUrl && (
                  <FeedUrlRow
                    label="WebCal URL"
                    hint="Apple 캘린더, Google (구독 추가)"
                    url={webcalUrl}
                    copied={copied === "webcal"}
                    onCopy={() => copy(webcalUrl, "webcal")}
                  />
                )}
                <p className="text-xs text-amber-700">
                  URL은 한 번만 표시됩니다. 복사해 두세요. 재생성하면 이전 URL은 무효화됩니다.
                </p>
              </>
            ) : (
              <p className="text-sm text-navy-600">
                구독이 활성화되어 있습니다. URL을 잃어버렸다면 재생성하세요.
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                fullWidth
                onClick={handleCreate}
                disabled={createFeed.isPending}
              >
                {createFeed.isPending ? "..." : feedUrl ? "URL 재생성" : "URL 재생성"}
              </Button>
              <Button
                variant="ghost"
                className="text-red-600 hover:bg-red-50"
                onClick={handleRevoke}
                disabled={revokeFeed.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {status?.lastUsedAt && (
              <p className="text-[10px] text-navy-500">
                마지막 동기화:{" "}
                {new Date(status.lastUsedAt).toLocaleString("ko-KR", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FeedUrlRow({
  label,
  hint,
  url,
  copied,
  onCopy,
}: {
  label: string;
  hint: string;
  url: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-2xl bg-sky-50/80 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-navy-800">{label}</span>
        <span className="text-[10px] text-navy-500">{hint}</span>
      </div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate text-[11px] text-navy-700">{url}</code>
        <button
          type="button"
          onClick={onCopy}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-navy-600 hover:bg-sky-100"
          aria-label="복사"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
