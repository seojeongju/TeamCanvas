import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useCurrentOrgId } from "../stores/orgStore";
import { useAuthStore } from "../stores/authStore";

export function useOrgMembers() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["members", orgId],
    queryFn: () => api.getOrgMembers(orgId!),
    enabled: !!orgId,
  });
}

export function useUpdateOrgMember() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: ({ userId, ...data }: { userId: string; role?: string; status?: string }) =>
      api.updateOrgMember(orgId!, userId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", orgId] }),
  });
}

export function useInviteOrgMember() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (data: { email: string; role?: string }) => api.inviteOrgMember(orgId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", orgId] });
      qc.invalidateQueries({ queryKey: ["org", orgId] });
    },
  });
}

export function useCreateInviteLink() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (data?: { email?: string; role?: string }) => api.createOrgInviteLink(orgId!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites", orgId] }),
  });
}

export function useOrgInvites() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["invites", orgId],
    queryFn: () => api.getOrgInvites(orgId!),
    enabled: !!orgId,
  });
}

export function useAuditLogs() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["audit-logs", orgId],
    queryFn: () => api.getAuditLogs(orgId!),
    enabled: !!orgId,
  });
}

export function useOrgSubscriptionDetail() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["subscription", orgId],
    queryFn: () => api.getOrgSubscription(orgId!),
    enabled: !!orgId,
  });
}

export function useStartCheckout() {
  return useMutation({
    mutationFn: ({
      orgId,
      planId,
      billingCycle,
    }: {
      orgId: string;
      planId: string;
      billingCycle?: "monthly" | "yearly";
    }) => api.startCheckout(orgId, { planId, billingCycle }),
  });
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api.adminDashboard(),
  });
}

export function useAdminOrganizations(q?: string) {
  return useQuery({
    queryKey: ["admin", "organizations", q],
    queryFn: () => api.adminOrganizations({ q, limit: 50 }),
  });
}

export function useAdminOrganization(orgId: string) {
  return useQuery({
    queryKey: ["admin", "organization", orgId],
    queryFn: () => api.adminOrganization(orgId),
    enabled: !!orgId,
  });
}

export function useAdminPlans() {
  return useQuery({
    queryKey: ["admin", "plans"],
    queryFn: () => api.adminPlans(),
  });
}

export function useAdminUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orgId,
      ...data
    }: {
      orgId: string;
      status?: string;
      planId?: string;
      subscriptionStatus?: string;
    }) => api.adminUpdateOrganization(orgId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["admin", "organization", vars.orgId] });
    },
  });
}

export function useAdminBootstrap() {
  const qc = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: () => api.adminBootstrap(),
    onSuccess: async () => {
      const me = await api.me();
      setAuth(me.user, me.organizations, {
        isPlatformAdmin: me.isPlatformAdmin,
        platformRole: me.platformRole,
      });
      qc.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}
