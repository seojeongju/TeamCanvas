import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
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

export function useAuthInit() {
  const [params] = useSearchParams();
  const oauthComplete = isOAuthComplete(params.toString());
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setCurrentOrgId = useOrgStore((s) => s.setCurrentOrgId);

  return useQuery({
    // queryKey를 oauth 파라미터와 분리한다. URL에서 oauth=complete를 제거할 때
    // 이전 401 캐시가 재사용되어 로그인 직후 다시 로그아웃되는 문제를 방지한다.
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const attempts = oauthComplete ? 4 : 1;
      let lastError: unknown;

      try {
        if (oauthComplete) {
          const bootstrap = consumeOAuthBootstrap();
          if (bootstrap?.user) {
            setAuth(bootstrap.user, bootstrap.organizations, {
              isPlatformAdmin: bootstrap.isPlatformAdmin,
              platformRole: bootstrap.platformRole,
              sessionExpiresAt: bootstrap.sessionExpiresAt ?? null,
            });
            if (bootstrap.organizations[0] && !useOrgStore.getState().currentOrgId) {
              setCurrentOrgId(bootstrap.organizations[0].id);
            }
            return bootstrap;
          }
        }

        for (let i = 0; i < attempts; i++) {
          try {
            const data = await api.me();
            setAuth(data.user, data.organizations, {
              isPlatformAdmin: data.isPlatformAdmin,
              platformRole: data.platformRole,
              sessionExpiresAt: data.sessionExpiresAt ?? null,
            });
            if (data.organizations[0] && !useOrgStore.getState().currentOrgId) {
              setCurrentOrgId(data.organizations[0].id);
            }
            return data;
          } catch (err) {
            lastError = err;
            if (i < attempts - 1) {
              await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
            }
          }
        }

        clearAuth();
        throw lastError instanceof Error ? lastError : new Error("Unauthorized");
      } finally {
        setLoading(false);
      }
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
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
