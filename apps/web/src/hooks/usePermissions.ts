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

const BASE_PLAN_FEATURES: PlanFeature[] = ["calendar", "tasks"];

export function useHasFeature(feature: PlanFeature) {
  const { data } = useOrgPermissions();
  const sub = data?.subscription;
  if (!sub) return false;
  if (sub.status === "canceled" || sub.status === "suspended") return false;
  if (sub.status === "past_due") return BASE_PLAN_FEATURES.includes(feature);
  return sub.features.includes(feature);
}

export function useCurrentOrgRole() {
  const { data } = useOrgPermissions();
  return data?.role ?? null;
}

export function usePermissionMatrix() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["permissions-matrix", orgId],
    queryFn: () => api.getPermissionMatrix(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
  });
}
