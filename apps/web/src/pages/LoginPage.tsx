import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAuthStore } from "../stores/authStore";
import { useEmailLogin, useEmailRegister } from "../hooks/useAuth";
import { oauthUrl } from "../lib/api";
import { cn } from "../lib/cn";
import { DeveloperCredit } from "../components/layout/DeveloperCredit";

type AuthMode = "login" | "register";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.87 5.35 4.68 6.78-.15.54-.97 3.47-1.01 3.64 0 .06.02.12.06.16.04.04.1.06.16.06.07 0 .13-.03.18-.08.24-.18 2.92-1.94 4.12-2.73.65.1 1.32.15 1.99.15 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
    </svg>
  );
}

export function LoginPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const emailLogin = useEmailLogin();
  const emailRegister = useEmailRegister();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const oauthError = params.get("error");
  const verified = params.get("verified");

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [registerDevLink, setRegisterDevLink] = useState<string | null>(null);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const isPending = emailLogin.isPending || emailRegister.isPending;

  const handleOAuth = (provider: "google" | "kakao") => {
    window.location.href = oauthUrl(provider);
  };

  const afterAuth = (organizations: { length: number }) => {
    navigate(organizations.length > 0 ? "/" : "/onboarding");
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      if (mode === "register") {
        const data = await emailRegister.mutateAsync({ email, password, name: name || undefined });
        if (data.emailVerification?.devLink) {
          setRegisterDevLink(data.emailVerification.devLink);
        }
        afterAuth(data.organizations);
      } else {
        const data = await emailLogin.mutateAsync({ email, password });
        afterAuth(data.organizations);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "요청에 실패했습니다.");
    }
  };

  return (
    <div className="bg-mesh flex min-h-dvh flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-400 shadow-glow">
            <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <path d="M3 9h18M9 3v18" />
            </svg>
          </div>
          <p className="text-sm font-medium text-primary-500">Hello 👋</p>
          <h1 className="mt-2 text-3xl font-bold text-navy-900">
            Team<span className="text-gradient">Canvas</span>
          </h1>
        </div>

        {(oauthError || formError) && (
          <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-center text-sm text-red-600">
            {formError ?? `로그인 실패: ${oauthError}`}
          </div>
        )}

        {verified === "1" && (
          <div className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-700">
            이메일 인증이 완료되었습니다. 로그인해주세요.
          </div>
        )}

        {registerDevLink && (
          <div className="mb-4 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-navy-700">
            <p className="font-medium">[개발] 인증 메일 대신 아래 링크를 사용하세요:</p>
            <a href={registerDevLink} className="mt-1 block break-all text-primary-500 underline">
              {registerDevLink}
            </a>
          </div>
        )}

        <div className="glass-strong rounded-3xl p-6 shadow-soft">
          {/* Login / Register tabs */}
          <div className="mb-5 flex rounded-2xl bg-sky-100/60 p-1">
            {(["login", "register"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setMode(tab);
                  setFormError(null);
                }}
                className={cn(
                  "flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all",
                  mode === tab
                    ? "bg-white text-primary-500 shadow-soft"
                    : "text-navy-600 hover:text-navy-800",
                )}
              >
                {tab === "login" ? "로그인" : "회원가입"}
              </button>
            ))}
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {mode === "register" && (
              <Input
                label="이름"
                placeholder="홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            )}
            <Input
              label="이메일"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Input
              label="비밀번호"
              type="password"
              placeholder={mode === "register" ? "8자 이상" : "비밀번호"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              required
              minLength={8}
            />
            <Button type="submit" fullWidth disabled={isPending} className="mt-1">
              {isPending ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
            </Button>
            {mode === "login" && (
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs text-primary-500 hover:underline">
                  비밀번호를 잊으셨나요?
                </Link>
              </div>
            )}
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-sky-200/80" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white/80 px-2 text-navy-600">또는</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button variant="google" fullWidth type="button" onClick={() => handleOAuth("google")}>
              <GoogleIcon />
              Google로 계속하기
            </Button>
            <Button variant="kakao" fullWidth type="button" onClick={() => handleOAuth("kakao")}>
              <KakaoIcon />
              카카오로 계속하기
            </Button>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-navy-600/70">
          {mode === "register" ? (
            <>
              이미 계정이 있으신가요?{" "}
              <button type="button" className="text-primary-500 hover:underline" onClick={() => setMode("login")}>
                로그인
              </button>
            </>
          ) : (
            <>
              계정이 없으신가요?{" "}
              <button type="button" className="text-primary-500 hover:underline" onClick={() => setMode("register")}>
                회원가입
              </button>
            </>
          )}
        </p>

        <DeveloperCredit className="mt-8" />
      </div>
    </div>
  );
}
