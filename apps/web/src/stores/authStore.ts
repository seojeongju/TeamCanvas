import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Organization } from "../lib/types";

interface AuthState {
  user: User | null;
  organizations: Organization[];
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (user: User, organizations: Organization[]) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      organizations: [],
      isLoading: true,
      isAuthenticated: false,
      setAuth: (user, organizations) =>
        set({ user, organizations, isAuthenticated: true, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      clearAuth: () =>
        set({ user: null, organizations: [], isAuthenticated: false, isLoading: false }),
    }),
    {
      name: "teamcanvas-auth",
      partialize: (s) => ({ user: s.user, organizations: s.organizations, isAuthenticated: s.isAuthenticated }),
    },
  ),
);
