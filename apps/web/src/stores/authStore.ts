import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Organization } from "../lib/types";

interface AuthState {
  user: User | null;
  organizations: Organization[];
  isPlatformAdmin: boolean;
  platformRole: string | null;
  sessionExpiresAt: number | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (
    user: User,
    organizations: Organization[],
    extras?: { isPlatformAdmin?: boolean; platformRole?: string | null; sessionExpiresAt?: number | null },
  ) => void;
  setLoading: (loading: boolean) => void;
  setSessionExpiresAt: (expiresAt: number | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      organizations: [],
      isPlatformAdmin: false,
      platformRole: null,
      sessionExpiresAt: null,
      isLoading: true,
      isAuthenticated: false,
      setAuth: (user, organizations, extras) =>
        set({
          user,
          organizations,
          isPlatformAdmin: extras?.isPlatformAdmin ?? false,
          platformRole: extras?.platformRole ?? null,
          sessionExpiresAt: extras?.sessionExpiresAt ?? null,
          isAuthenticated: true,
          isLoading: false,
        }),
      setLoading: (isLoading) => set({ isLoading }),
      setSessionExpiresAt: (sessionExpiresAt) => set({ sessionExpiresAt }),
      clearAuth: () =>
        set({
          user: null,
          organizations: [],
          isPlatformAdmin: false,
          platformRole: null,
          sessionExpiresAt: null,
          isAuthenticated: false,
          isLoading: false,
        }),
    }),
    {
      name: "teamcanvas-auth",
      partialize: (s) => ({
        user: s.user,
        organizations: s.organizations,
        isPlatformAdmin: s.isPlatformAdmin,
        sessionExpiresAt: s.sessionExpiresAt,
        // isAuthenticated는 서버(/auth/me) 검증 결과만 신뢰한다.
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<typeof current>),
        isAuthenticated: false,
        isLoading: true,
      }),
    },
  ),
);
