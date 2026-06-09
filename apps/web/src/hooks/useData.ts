import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useCurrentOrgId } from "../stores/orgStore";
import { startOfDay, endOfDay } from "../lib/dates";
import type { Task, TaskFilters, UpdateTaskPayload } from "../lib/types";

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

export function useTeams() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["teams", orgId],
    queryFn: () => api.getTeams(orgId!),
    enabled: !!orgId,
  });
}

export function useEventParticipants() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["event-participants", orgId],
    queryFn: () => api.getEventParticipants(orgId!),
    enabled: !!orgId,
  });
}

export function useEventReminders(from?: number, to?: number) {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["event-reminders", orgId, from, to],
    queryFn: () => api.getEventReminders(orgId!, from, to),
    enabled: !!orgId,
    refetchInterval: 60_000,
  });
}

export function useMarkReminderDelivered() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (reminderId: string) => api.markEventReminderDelivered(orgId!, reminderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-reminders"] }),
  });
}

export function useEventAttendees(eventId?: string) {
  return useQuery({
    queryKey: ["event-attendees", eventId],
    queryFn: () => api.getEventAttendees(eventId!),
    enabled: !!eventId,
  });
}

export function useUpdateEventRsvp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, rsvp }: { eventId: string; rsvp: "pending" | "accepted" | "declined" }) =>
      api.updateEventRsvp(eventId, { rsvp }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["event-attendees", vars.eventId] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useTodayEvents() {
  const from = startOfDay(Date.now());
  const to = endOfDay(Date.now());
  return useEvents(from, to);
}

type EventPayload = {
  title: string;
  startAt: number;
  endAt: number;
  allDay?: boolean;
  description?: string;
  location?: string;
  teamId?: string | null;
  color?: string;
  visibility?: "private" | "team" | "org";
  attendeeUserIds?: string[];
  reminderMinutes?: number[];
  recurrenceRule?: string | null;
};

export function useCreateEvent() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();

  return useMutation({
    mutationFn: (data: EventPayload) => api.createEvent(orgId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["event-reminders"] });
    },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, ...data }: EventPayload & { eventId: string }) =>
      api.updateEvent(eventId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["event-reminders"] });
      qc.invalidateQueries({ queryKey: ["event-attendees"] });
    },
  });
}

export function useFreeBusy(userIds: string[], from?: number, to?: number) {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["free-busy", orgId, userIds.join(","), from, to],
    queryFn: () => api.getFreeBusy(orgId!, userIds, from, to),
    enabled: !!orgId && userIds.length > 0 && !!from && !!to,
  });
}

export function useSuggestEventTimes() {
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (data: {
      prompt?: string;
      durationMinutes?: number;
      attendeeUserIds?: string[];
      from?: number;
      to?: number;
    }) => api.suggestEventTimes(orgId!, data),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.deleteEvent(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["event-reminders"] });
    },
  });
}

function applyTaskPatch(task: Task, patch: Omit<UpdateTaskPayload, "id">): Task {
  const next = { ...task, ...patch };
  if (patch.status === "done") {
    next.due = "완료";
    next.isOverdue = false;
  }
  return next;
}

export function useTasks(filters?: TaskFilters) {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["tasks", orgId, filters],
    queryFn: () => api.getTasks(orgId!, filters),
    enabled: !!orgId,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();

  return useMutation({
    mutationFn: (data: {
      title: string;
      status?: string;
      dueAt?: number;
      description?: string;
      assigneeId?: string;
      priority?: string;
      teamId?: string | null;
      eventId?: string | null;
    }) => api.createTask(orgId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateTaskPayload) => api.updateTask(id, data),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["tasks", orgId] });
      const snapshots = qc.getQueriesData<{ tasks: Task[] }>({ queryKey: ["tasks", orgId] });
      for (const [key, data] of snapshots) {
        if (!data?.tasks) continue;
        qc.setQueryData(key, {
          tasks: data.tasks.map((t) => (t.id === vars.id ? applyTaskPatch(t, vars) : t)),
        });
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["tasks", orgId] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();

  return useMutation({
    mutationFn: (taskId: string) => api.deleteTask(taskId),
    onMutate: async (taskId) => {
      await qc.cancelQueries({ queryKey: ["tasks", orgId] });
      const snapshots = qc.getQueriesData<{ tasks: Task[] }>({ queryKey: ["tasks", orgId] });
      for (const [key, data] of snapshots) {
        if (!data?.tasks) continue;
        qc.setQueryData(key, { tasks: data.tasks.filter((t) => t.id !== taskId) });
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["tasks", orgId] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useTaskComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: () => api.getTaskComments(taskId!),
    enabled: !!taskId,
  });
}

export function useCreateTaskComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, body }: { taskId: string; body: string }) =>
      api.createTaskComment(taskId, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["task-comments", vars.taskId] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.getNotifications(),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const prev = qc.getQueryData<{ notifications: import("../lib/types").Notification[] }>([
        "notifications",
      ]);
      if (prev) {
        qc.setQueryData(["notifications"], {
          notifications: prev.notifications.map((n) =>
            n.id === id ? { ...n, unread: false } : n,
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notifications"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const prev = qc.getQueryData<{ notifications: import("../lib/types").Notification[] }>([
        "notifications",
      ]);
      if (prev) {
        qc.setQueryData(["notifications"], {
          notifications: prev.notifications.map((n) => ({ ...n, unread: false })),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notifications"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => api.getNotificationPreferences(),
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: import("../lib/types").NotificationPreferences) =>
      api.updateNotificationPreferences(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-preferences"] }),
  });
}
