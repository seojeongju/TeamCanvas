import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useOrgStore } from "../stores/orgStore";

export function useAuthInit() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setCurrentOrgId = useOrgStore((s) => s.setCurrentOrgId);

  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
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
      } catch {
        clearAuth();
        throw new Error("Unauthorized");
      } finally {
        setLoading(false);
      }
    },
    retry: false,
    staleTime: 60_000,
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
