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
    mutationFn: (data?: {
      email?: string;
      emailDomain?: string;
      role?: string;
      inviteType?: "single" | "multi";
      maxUses?: number | null;
      expiryDays?: number;
      label?: string;
    }) => api.createOrgInviteLink(orgId!, data),
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

export function useRevokeOrgInvite() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (inviteId: string) => api.revokeOrgInvite(orgId!, inviteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites", orgId] }),
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

export function useBillingHistory() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["billing-history", orgId],
    queryFn: () => api.getBillingHistory(orgId!),
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

export function useCompleteMockCheckout() {
  const qc = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: ({ orgId, planId }: { orgId: string; planId: string }) =>
      api.completeMockCheckout(orgId, { planId }),
    onSuccess: async (_, vars) => {
      try {
        const me = await api.me();
        setAuth(me.user, me.organizations, {
          isPlatformAdmin: me.isPlatformAdmin,
          platformRole: me.platformRole,
          sessionExpiresAt: me.sessionExpiresAt ?? null,
        });
      } catch {
        // keep local auth state on transient me fetch failure
      }
      qc.invalidateQueries({ queryKey: ["subscription", vars.orgId] });
      qc.invalidateQueries({ queryKey: ["permissions", vars.orgId] });
      qc.invalidateQueries({ queryKey: ["org", vars.orgId] });
      qc.invalidateQueries({ queryKey: ["billing-history", vars.orgId] });
      qc.invalidateQueries({ queryKey: ["auth"] });
    },
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

export function useAdminCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; slug?: string; ownerEmail?: string; ownerUserId?: string }) =>
      api.adminCreateOrganization(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "organizations"] }),
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

export function useAdminUpdateOrganizationMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orgId,
      userId,
      ...data
    }: {
      orgId: string;
      userId: string;
      role?: string;
      status?: string;
    }) => api.adminUpdateOrganizationMember(orgId, userId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "organization", vars.orgId] });
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
    },
  });
}

export function useAdminRemoveOrganizationMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, userId }: { orgId: string; userId: string }) =>
      api.adminRemoveOrganizationMember(orgId, userId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "organization", vars.orgId] });
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
    },
  });
}

export function useAdminTransferOrganizationOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, newOwnerUserId }: { orgId: string; newOwnerUserId: string }) =>
      api.adminTransferOrganizationOwner(orgId, newOwnerUserId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "organization", vars.orgId] });
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
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
        sessionExpiresAt: me.sessionExpiresAt ?? null,
      });
      qc.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}
