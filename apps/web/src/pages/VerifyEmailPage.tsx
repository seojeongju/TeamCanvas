import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { useVerifyEmail } from "../hooks/useAuth";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const verify = useVerifyEmail();
  const [done, setDone] = useState(false);

  const status = params.get("status");
  const error = params.get("error");
  const token = params.get("token");

  useEffect(() => {
    if (status === "success") {
      setDone(true);
      return;
    }
    if (token && !error) {
      verify.mutate(token, {
        onSuccess: () => setDone(true),
      });
    }
  }, [token, status, error]); // eslint-disable-line react-hooks/exhaustive-deps

  const errorMessage =
    error === "invalid_token"
      ? "유효하지 않거나 만료된 인증 링크입니다."
      : error === "missing_token"
        ? "인증 토큰이 없습니다."
        : verify.error instanceof Error
          ? verify.error.message
          : null;

  const success = done || status === "success";

  return (
    <div className="bg-mesh flex min-h-dvh items-center justify-center px-6">
      <div className="glass-strong w-full max-w-sm rounded-3xl p-8 text-center shadow-soft">
        {verify.isPending && !success && !errorMessage && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary-400" />
            <p className="mt-4 text-navy-800">이메일 인증 중...</p>
          </>
        )}

        {success && (
          <>
            <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="mt-4 text-xl font-bold text-navy-900">인증 완료</h1>
            <p className="mt-2 text-sm text-navy-600">이메일 인증이 완료되었습니다.</p>
            <Button fullWidth className="mt-6" onClick={() => navigate("/")}>
              시작하기
            </Button>
          </>
        )}

        {errorMessage && !verify.isPending && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-red-400" />
            <h1 className="mt-4 text-xl font-bold text-navy-900">인증 실패</h1>
            <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
            <Link to="/login">
              <Button variant="secondary" fullWidth className="mt-6">
                로그인으로 돌아가기
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
