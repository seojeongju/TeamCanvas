import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useCurrentOrgId } from "../stores/orgStore";
import { startOfDay, endOfDay } from "../lib/dates";

export function useOrgDetail() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganization(orgId!),
    enabled: !!orgId,
  });
}

export function useEvents(from?: number, to?: number) {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["events", orgId, from, to],
    queryFn: () => api.getEvents(orgId!, from, to),
    enabled: !!orgId,
  });
}

export function useTodayEvents() {
  const from = startOfDay(Date.now());
  const to = endOfDay(Date.now());
  return useEvents(from, to);
}

export function useCreateEvent() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();

  return useMutation({
    mutationFn: (data: {
      title: string;
      startAt: number;
      endAt: number;
      allDay?: boolean;
      description?: string;
    }) => api.createEvent(orgId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useTasks() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["tasks", orgId],
    queryFn: () => api.getTasks(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();

  return useMutation({
    mutationFn: (data: { title: string; status?: string; dueAt?: number }) =>
      api.createTask(orgId!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; status?: string }) => api.updateTask(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.getNotifications(),
  });
}
