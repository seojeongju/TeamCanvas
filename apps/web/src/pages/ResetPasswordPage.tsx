import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { GlassCard } from "../components/ui/GlassCard";
import { useResetPassword } from "../hooks/useAuth";
import { api } from "../lib/api";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reset = useResetPassword();
  const token = params.get("token") ?? "";

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setTokenValid(false);
      return;
    }
    api
      .resetTokenStatus(token)
      .then((r) => setTokenValid(r.valid))
      .catch(() => setTokenValid(false))
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    try {
      await reset.mutateAsync({ token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "변경에 실패했습니다.");
    }
  };

  return (
    <div className="bg-mesh flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-1 text-sm text-navy-600 hover:text-primary-500"
        >
          <ArrowLeft className="h-4 w-4" />
          로그인으로
        </Link>

        <GlassCard className="p-6">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-400/10">
            <KeyRound className="h-6 w-6 text-primary-500" />
          </div>
          <h1 className="text-xl font-bold text-navy-900">새 비밀번호 설정</h1>

          {validating && (
            <div className="mt-8 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
            </div>
          )}

          {!validating && !tokenValid && (
            <div className="mt-5">
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                유효하지 않거나 만료된 링크입니다.
              </p>
              <Link to="/forgot-password">
                <Button variant="secondary" fullWidth className="mt-4">
                  다시 요청하기
                </Button>
              </Link>
            </div>
          )}

          {done && (
            <div className="mt-5 space-y-4">
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                비밀번호가 변경되었습니다.
              </p>
              <Button fullWidth onClick={() => navigate("/login")}>
                로그인하기
              </Button>
            </div>
          )}

          {!validating && tokenValid && !done && (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {error && (
                <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
              )}
              <Input
                label="새 비밀번호"
                type="password"
                placeholder="8자 이상"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoFocus
              />
              <Input
                label="비밀번호 확인"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
              />
              <Button type="submit" fullWidth disabled={reset.isPending}>
                {reset.isPending ? "저장 중..." : "비밀번호 변경"}
              </Button>
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
