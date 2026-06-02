import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuthStore } from "./authStore";

interface OrgState {
  currentOrgId: string | null;
  setCurrentOrgId: (id: string) => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      currentOrgId: null,
      setCurrentOrgId: (id) => set({ currentOrgId: id }),
    }),
    { name: "teamcanvas-org" },
  ),
);

export function useCurrentOrgId(): string | null {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const organizations = useAuthStore((s) => s.organizations);
  if (orgId && organizations.some((o) => o.id === orgId)) return orgId;
  return organizations[0]?.id ?? null;
}
