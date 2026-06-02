import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useCurrentOrgId } from "../stores/orgStore";
import type { Permission, PlanFeature } from "../lib/types";

export function useOrgPermissions() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["permissions", orgId],
    queryFn: () => api.getOrgPermissions(orgId!),
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

export function useHasPermission(permission: Permission) {
  const { data } = useOrgPermissions();
  return data?.permissions.includes(permission) ?? false;
}

export function useHasFeature(feature: PlanFeature) {
  const { data } = useOrgPermissions();
  return data?.subscription?.features.includes(feature) ?? false;
}

export function useCurrentOrgRole() {
  const { data } = useOrgPermissions();
  return data?.role ?? null;
}
