import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useCurrentOrgId } from "../stores/orgStore";
import { useAuthStore } from "../stores/authStore";

export function useUpdateOrganization() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  const setAuth = useAuthStore((s) => s.setAuth);
  const user = useAuthStore((s) => s.user);
  const organizations = useAuthStore((s) => s.organizations);

  return useMutation({
    mutationFn: (data: { name?: string; timezone?: string }) => api.updateOrganization(orgId!, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["org", orgId] });
      if (user && data.organization) {
        const nextOrgs = organizations.map((o) =>
          o.id === orgId ? { ...o, name: data.organization.name } : o,
        );
        setAuth(user, nextOrgs, {
          isPlatformAdmin: useAuthStore.getState().isPlatformAdmin,
          platformRole: useAuthStore.getState().platformRole,
          sessionExpiresAt: useAuthStore.getState().sessionExpiresAt,
        });
      }
    },
  });
}

export function useTeamsManage() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["teams-manage", orgId],
    queryFn: () => api.getTeamsManage(orgId!),
    enabled: !!orgId,
  });
}

export function useTeamDetail(teamId: string | undefined) {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["team", orgId, teamId],
    queryFn: () => api.getTeamDetail(orgId!, teamId!),
    enabled: !!orgId && !!teamId,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (data: {
      name: string;
      color?: string;
      description?: string;
      departmentId?: string | null;
    }) => api.createTeam(orgId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams-manage", orgId] });
      qc.invalidateQueries({ queryKey: ["teams", orgId] });
      qc.invalidateQueries({ queryKey: ["org", orgId] });
    },
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: ({
      teamId,
      ...data
    }: {
      teamId: string;
      name?: string;
      color?: string;
      description?: string | null;
      departmentId?: string | null;
    }) => api.updateTeam(orgId!, teamId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["teams-manage", orgId] });
      qc.invalidateQueries({ queryKey: ["team", orgId, vars.teamId] });
      qc.invalidateQueries({ queryKey: ["teams", orgId] });
    },
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (teamId: string) => api.deleteTeam(orgId!, teamId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams-manage", orgId] });
      qc.invalidateQueries({ queryKey: ["teams", orgId] });
      qc.invalidateQueries({ queryKey: ["org", orgId] });
    },
  });
}

export function useAddTeamMember() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: ({
      teamId,
      userId,
      role,
    }: {
      teamId: string;
      userId: string;
      role?: string;
    }) => api.addTeamMember(orgId!, teamId, { userId, role }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["team", orgId, vars.teamId] });
      qc.invalidateQueries({ queryKey: ["teams-manage", orgId] });
    },
  });
}

export function useUpdateTeamMember() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: ({
      teamId,
      userId,
      role,
    }: {
      teamId: string;
      userId: string;
      role: string;
    }) => api.updateTeamMember(orgId!, teamId, userId, { role }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["team", orgId, vars.teamId] });
    },
  });
}

export function useRemoveTeamMember() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      api.removeTeamMember(orgId!, teamId, userId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["team", orgId, vars.teamId] });
      qc.invalidateQueries({ queryKey: ["teams-manage", orgId] });
      qc.invalidateQueries({ queryKey: ["members", orgId] });
    },
  });
}

export function useOrgSettingsDetail() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["org-settings", orgId],
    queryFn: () => api.getOrgSettings(orgId!),
    enabled: !!orgId,
  });
}

export function useUpdateOrgWorkSettings() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (data: Partial<import("../lib/types").OrgWorkSettings>) =>
      api.updateOrgWorkSettings(orgId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-settings", orgId] });
      qc.invalidateQueries({ queryKey: ["org", orgId] });
    },
  });
}

export function useUploadOrgLogo() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (file: File) => api.uploadOrgLogo(orgId!, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-settings", orgId] });
      qc.invalidateQueries({ queryKey: ["org", orgId] });
    },
  });
}

export function useDeleteOrgLogo() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: () => api.deleteOrgLogo(orgId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-settings", orgId] });
      qc.invalidateQueries({ queryKey: ["org", orgId] });
    },
  });
}

export function useDepartments() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["departments", orgId],
    queryFn: () => api.getDepartments(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (data: { name: string; parentId?: string | null }) =>
      api.createDepartment(orgId!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments", orgId] }),
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: ({ deptId, name }: { deptId: string; name: string }) =>
      api.updateDepartment(orgId!, deptId, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments", orgId] }),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (deptId: string) => api.deleteDepartment(orgId!, deptId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments", orgId] }),
  });
}

export function useTeamSummary(teamId: string | undefined) {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["team-summary", orgId, teamId],
    queryFn: () => api.getTeamSummary(orgId!, teamId!),
    enabled: !!orgId && !!teamId,
  });
}

export function useDeactivateOrganization() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: () => api.deactivateOrganization(orgId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org", orgId] });
      qc.invalidateQueries({ queryKey: ["org-settings", orgId] });
      qc.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useReactivateOrganization() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: () => api.reactivateOrganization(orgId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org", orgId] });
      qc.invalidateQueries({ queryKey: ["org-settings", orgId] });
      qc.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useTeamRequests() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["team-requests", orgId],
    queryFn: () => api.getTeamRequests(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateTeamRequest() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      color?: string;
      departmentId?: string | null;
    }) => api.createTeamRequest(orgId!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-requests", orgId] }),
  });
}

export function useApproveTeamRequest() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (requestId: string) => api.approveTeamRequest(orgId!, requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-requests", orgId] });
      qc.invalidateQueries({ queryKey: ["teams-manage", orgId] });
      qc.invalidateQueries({ queryKey: ["teams", orgId] });
    },
  });
}

export function useRejectTeamRequest() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason?: string }) =>
      api.rejectTeamRequest(orgId!, requestId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-requests", orgId] }),
  });
}

export function useHolidays(from?: number, to?: number) {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["holidays", orgId, from, to],
    queryFn: () => api.getHolidays(orgId!, from, to),
    enabled: !!orgId,
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (data: { name: string; date: string; yearly?: boolean }) =>
      api.createHoliday(orgId!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["holidays", orgId] }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (holidayId: string) => api.deleteHoliday(orgId!, holidayId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["holidays", orgId] }),
  });
}

export function useOrgWebhooks() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["org-webhooks", orgId],
    queryFn: () => api.getOrgWebhooks(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateOrgWebhook() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (data: {
      name: string;
      url: string;
      provider?: "slack" | "generic" | "kakaowork";
      events?: string[];
    }) => api.createOrgWebhook(orgId!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-webhooks", orgId] }),
  });
}

export function useUpdateOrgWebhook() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: ({
      webhookId,
      ...data
    }: {
      webhookId: string;
      name?: string;
      url?: string;
      provider?: "slack" | "generic" | "kakaowork";
      events?: string[];
      enabled?: boolean;
    }) => api.updateOrgWebhook(orgId!, webhookId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-webhooks", orgId] }),
  });
}

export function useDeleteOrgWebhook() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (webhookId: string) => api.deleteOrgWebhook(orgId!, webhookId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-webhooks", orgId] }),
  });
}

export function useAutomationPresets() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["automation-presets", orgId],
    queryFn: () => api.getAutomationPresets(orgId!),
    enabled: !!orgId,
  });
}

export function useUpdateAutomationPreset() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      api.updateAutomationPreset(orgId!, key, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-presets", orgId] }),
  });
}
