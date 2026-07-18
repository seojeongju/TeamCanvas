import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useOrgStore } from "../stores/orgStore";
import type { AuthMeResponse } from "../lib/types";

function isOAuthComplete(search: string): boolean {
  return new URLSearchParams(search).get("oauth") === "complete";
}

const OAUTH_BOOTSTRAP_KEY = "teamcanvas-oauth-bootstrap";

export function consumeOAuthBootstrap(): AuthMeResponse | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(OAUTH_BOOTSTRAP_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(OAUTH_BOOTSTRAP_KEY);
    return JSON.parse(raw) as AuthMeResponse;
  } catch {
    sessionStorage.removeItem(OAUTH_BOOTSTRAP_KEY);
    return null;
  }
}

function useAuthStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    if (hydrated) return;
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, [hydrated]);

  return hydrated;
}

export function useAuthHydrated(): boolean {
  return useAuthStoreHydrated();
}

function applyAuthSuccess(data: AuthMeResponse) {
  useAuthStore.getState().setAuth(data.user, data.organizations, {
    isPlatformAdmin: data.isPlatformAdmin,
    platformRole: data.platformRole,
    sessionExpiresAt: data.sessionExpiresAt ?? null,
  });
  if (data.organizations[0] && !useOrgStore.getState().currentOrgId) {
    useOrgStore.getState().setCurrentOrgId(data.organizations[0].id);
  }
}

export function useAuthInit() {
  const [params] = useSearchParams();
  const oauthComplete = isOAuthComplete(params.toString());
  const hydrated = useAuthStoreHydrated();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setLoading = useAuthStore((s) => s.setLoading);

  return useQuery({
    queryKey: ["auth", "me"],
    enabled: hydrated,
    queryFn: async () => {
      const attempts = oauthComplete ? 4 : 3;
      let lastError: unknown;

      try {
        if (oauthComplete) {
          const bootstrap = consumeOAuthBootstrap();
          if (bootstrap?.user) {
            applyAuthSuccess(bootstrap);
            // 부트스트랩으로 UI는 즉시 열되, 쿠키 세션이 실제로 유효한지 확인한다.
            try {
              const verified = await api.me();
              applyAuthSuccess(verified);
              return verified;
            } catch (err) {
              const unauthorized =
                err instanceof ApiError
                  ? err.status === 401
                  : err instanceof Error && /unauthorized/i.test(err.message);
              if (unauthorized) {
                clearAuth();
                throw err instanceof Error ? err : new Error("Unauthorized");
              }
              // 일시적 네트워크 오류면 부트스트랩으로 진행하고, 이후 요청에서 재검증한다.
              return bootstrap;
            }
          }
        }

        for (let i = 0; i < attempts; i++) {
          try {
            const data = await api.me();
            applyAuthSuccess(data);
            return data;
          } catch (err) {
            lastError = err;
            if (i < attempts - 1) {
              await new Promise((resolve) => setTimeout(resolve, 250 * (i + 1)));
            }
          }
        }

        // 네트워크 오류 등으로 실패하면 로컬 세션을 바로 지우지 않는다.
        // 실제 미인증(401)일 때만 clearAuth 한다.
        const unauthorized =
          lastError instanceof ApiError
            ? lastError.status === 401
            : lastError instanceof Error && /unauthorized/i.test(lastError.message);

        if (unauthorized) {
          clearAuth();
        }

        throw lastError instanceof Error ? lastError : new Error("Unauthorized");
      } finally {
        setLoading(false);
      }
    },
    retry: false,
    staleTime: 30_000,
    refetchOnMount: true,
  });
}

export function useDevLogin() {
  const qc = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setCurrentOrgId = useOrgStore((s) => s.setCurrentOrgId);

  return useMutation({
    mutationFn: (provider: "google" | "kakao") => api.devLogin(provider),
    onSuccess: (data) => {
      setAuth(data.user, data.organizations, {
        isPlatformAdmin: data.isPlatformAdmin,
        platformRole: data.platformRole,
        sessionExpiresAt: data.sessionExpiresAt ?? null,
      });
      if (data.organizations[0]) setCurrentOrgId(data.organizations[0].id);
      qc.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

function useEmailAuthSuccess() {
  const qc = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setCurrentOrgId = useOrgStore((s) => s.setCurrentOrgId);

  return (data: Awaited<ReturnType<typeof api.login>>) => {
    setAuth(data.user, data.organizations, {
      isPlatformAdmin: data.isPlatformAdmin,
      platformRole: data.platformRole,
      sessionExpiresAt: data.sessionExpiresAt ?? null,
    });
    if (data.organizations[0]) setCurrentOrgId(data.organizations[0].id);
    qc.invalidateQueries({ queryKey: ["auth"] });
  };
}

export function useEmailRegister() {
  const onSuccess = useEmailAuthSuccess();
  return useMutation({
    mutationFn: (data: { email: string; password: string; name?: string }) => api.register(data),
    onSuccess,
  });
}

export function useEmailLogin() {
  const onSuccess = useEmailAuthSuccess();
  return useMutation({
    mutationFn: (data: { email: string; password: string }) => api.login(data),
    onSuccess,
  });
}

export function useResendVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.resendVerification(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth"] }),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api.forgotPassword(email),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      api.resetPassword(token, password),
  });
}

export function useVerifyEmail() {
  const qc = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (token: string) => api.verifyEmail(token),
    onSuccess: async () => {
      try {
        const me = await api.me();
        setAuth(me.user, me.organizations, {
          isPlatformAdmin: me.isPlatformAdmin,
          platformRole: me.platformRole,
          sessionExpiresAt: me.sessionExpiresAt ?? null,
        });
      } catch {
        /* not logged in */
      }
      qc.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      clearAuth();
      qc.clear();
    },
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const user = useAuthStore((s) => s.user);
  const setCurrentOrgId = useOrgStore((s) => s.setCurrentOrgId);

  return useMutation({
    mutationFn: ({ name, slug }: { name: string; slug?: string }) => api.createOrganization(name, slug),
    onSuccess: async (data) => {
      setCurrentOrgId(data.organization.id);
      if (user) {
        const me = await api.me();
        setAuth(me.user, me.organizations, {
          isPlatformAdmin: me.isPlatformAdmin,
          platformRole: me.platformRole,
          sessionExpiresAt: me.sessionExpiresAt ?? null,
        });
      }
      qc.invalidateQueries({ queryKey: ["auth"] });
      qc.invalidateQueries({ queryKey: ["org"] });
    },
  });
}
