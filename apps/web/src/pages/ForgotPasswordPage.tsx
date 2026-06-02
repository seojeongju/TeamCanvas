import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { GlassCard } from "../components/ui/GlassCard";
import { useForgotPassword } from "../hooks/useAuth";

export function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await forgot.mutateAsync(email);
      setSubmitted(true);
      if (result.devLink) setDevLink(result.devLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청에 실패했습니다.");
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
            <Mail className="h-6 w-6 text-primary-500" />
          </div>
          <h1 className="text-xl font-bold text-navy-900">비밀번호 찾기</h1>
          <p className="mt-1 text-sm text-navy-600">
            가입한 이메일로 재설정 링크를 보내드립니다.
          </p>

          {submitted ? (
            <div className="mt-5 space-y-3">
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                등록된 이메일이면 비밀번호 재설정 링크를 보냈습니다.
              </p>
              {devLink && (
                <a href={devLink} className="block break-all text-xs text-primary-500 underline">
                  [개발] 재설정 링크 열기
                </a>
              )}
              <Link to="/login">
                <Button variant="secondary" fullWidth>
                  로그인으로
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {error && (
                <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
              )}
              <Input
                label="이메일"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <Button type="submit" fullWidth disabled={forgot.isPending}>
                {forgot.isPending ? "발송 중..." : "재설정 링크 받기"}
              </Button>
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
