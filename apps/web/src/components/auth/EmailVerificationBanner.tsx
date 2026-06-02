import { Mail, X } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useResendVerification } from "../../hooks/useAuth";
import { Button } from "../ui/Button";

export function EmailVerificationBanner() {
  const user = useAuthStore((s) => s.user);
  const resend = useResendVerification();
  const [dismissed, setDismissed] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!user || user.emailVerified || dismissed) return null;

  const handleResend = async () => {
    setMessage(null);
    try {
      const result = await resend.mutateAsync();
      setMessage(result.message);
      if (result.devLink) setDevLink(result.devLink);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "발송에 실패했습니다.");
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-primary-400/30 bg-primary-400/10 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-400/20">
          <Mail className="h-4 w-4 text-primary-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy-900">이메일 인증이 필요합니다</p>
          <p className="mt-0.5 text-xs text-navy-600">
            {user.email}로 인증 메일을 확인해주세요.
          </p>
          {message && <p className="mt-2 text-xs text-primary-600">{message}</p>}
          {devLink && (
            <a
              href={devLink}
              className="mt-2 block break-all text-xs text-primary-500 underline"
            >
              [개발] 인증 링크 열기
            </a>
          )}
          <Button
            variant="secondary"
            className="mt-3 h-9 px-4 text-xs"
            disabled={resend.isPending}
            onClick={handleResend}
          >
            {resend.isPending ? "발송 중..." : "인증 메일 재발송"}
          </Button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-navy-600/50 hover:text-navy-700"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
