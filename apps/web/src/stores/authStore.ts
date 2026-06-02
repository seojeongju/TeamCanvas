import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Organization } from "../lib/types";

interface AuthState {
  user: User | null;
  organizations: Organization[];
  isPlatformAdmin: boolean;
  platformRole: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (user: User, organizations: Organization[], extras?: { isPlatformAdmin?: boolean; platformRole?: string | null }) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      organizations: [],
      isPlatformAdmin: false,
      platformRole: null,
      isLoading: true,
      isAuthenticated: false,
      setAuth: (user, organizations, extras) =>
        set({
          user,
          organizations,
          isPlatformAdmin: extras?.isPlatformAdmin ?? false,
          platformRole: extras?.platformRole ?? null,
          isAuthenticated: true,
          isLoading: false,
        }),
      setLoading: (isLoading) => set({ isLoading }),
      clearAuth: () =>
        set({
          user: null,
          organizations: [],
          isPlatformAdmin: false,
          platformRole: null,
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
        isAuthenticated: s.isAuthenticated,
      }),
    },
  ),
);
