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
    mutationFn: (data: { name: string; color?: string; description?: string }) =>
      api.createTeam(orgId!, data),
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
    },
  });
}
