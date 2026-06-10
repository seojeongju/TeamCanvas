import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useCurrentOrgId } from "../stores/orgStore";
import { startOfDay, endOfDay } from "../lib/dates";
import {
  cacheEvents,
  cacheTasks,
  getCachedEvents,
  getCachedTasks,
  isOffline,
} from "../lib/offlineCache";
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
    queryFn: async () => {
      const data = await api.getEvents(orgId!, from, to);
      if (orgId && from != null && to != null) {
        cacheEvents(orgId, from, to, data.events);
      }
      return data;
    },
    enabled: !!orgId,
    placeholderData: () => {
      if (!orgId || from == null || to == null) return undefined;
      const cached = getCachedEvents(orgId, from, to);
      return cached ? { events: cached } : undefined;
    },
    networkMode: isOffline() ? "always" : "online",
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

export function useOrgActivity(limit = 20) {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["org-activity", orgId, limit],
    queryFn: () => api.getOrgActivity(orgId!, limit),
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
    enabled: !!orgId && from != null && to != null,
    staleTime: 30_000,
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
  excludedDates?: string[];
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
    queryFn: async () => {
      const data = await api.getTasks(orgId!, filters);
      if (orgId) cacheTasks(orgId, data.tasks);
      return data;
    },
    enabled: !!orgId,
    placeholderData: () => {
      if (!orgId) return undefined;
      const cached = getCachedTasks(orgId);
      return cached ? { tasks: cached } : undefined;
    },
    networkMode: isOffline() ? "always" : "online",
  });
}

export function useTaskLabels() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["task-labels", orgId],
    queryFn: () => api.getTaskLabels(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateTaskLabel() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (data: { name: string; color?: string }) => api.createTaskLabel(orgId!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-labels", orgId] }),
  });
}

export function useDeleteTaskLabel() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: (labelId: string) => api.deleteTaskLabel(labelId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-labels", orgId] });
      qc.invalidateQueries({ queryKey: ["tasks", orgId] });
    },
  });
}

export function useTaskChecklist(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task-checklist", taskId],
    queryFn: () => api.getTaskChecklist(taskId!),
    enabled: !!taskId,
  });
}

export function useCreateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, title }: { taskId: string; title: string }) =>
      api.createChecklistItem(taskId, title),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["task-checklist", v.taskId] });
      invalidateTaskActivities(qc, v.taskId);
    },
  });
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      itemId,
      ...data
    }: {
      taskId: string;
      itemId: string;
      title?: string;
      done?: boolean;
    }) => api.updateChecklistItem(taskId, itemId, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["task-checklist", v.taskId] });
      invalidateTaskActivities(qc, v.taskId);
    },
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, itemId }: { taskId: string; itemId: string }) =>
      api.deleteChecklistItem(taskId, itemId),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["task-checklist", v.taskId] });
      invalidateTaskActivities(qc, v.taskId);
    },
  });
}

export function useGoogleCalendarStatus() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["google-calendar", orgId],
    queryFn: () => api.getGoogleCalendarStatus(orgId!),
    enabled: !!orgId,
  });
}

export function useSyncGoogleCalendar() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: () => api.syncGoogleCalendar(orgId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-calendar", orgId] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useDisconnectGoogleCalendar() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: () => api.disconnectGoogleCalendar(orgId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-calendar", orgId] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
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
      labelIds?: string[];
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
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["tasks", orgId] });
      qc.invalidateQueries({ queryKey: ["events"] });
      invalidateTaskActivities(qc, vars.id);
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

export function useTaskActivities(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task-activities", taskId],
    queryFn: () => api.getTaskActivities(taskId!),
    enabled: !!taskId,
  });
}

function invalidateTaskActivities(qc: ReturnType<typeof useQueryClient>, taskId?: string) {
  if (taskId) qc.invalidateQueries({ queryKey: ["task-activities", taskId] });
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
      invalidateTaskActivities(qc, vars.taskId);
    },
  });
}

export function useEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event", eventId],
    queryFn: () => api.getEvent(eventId!),
    enabled: !!eventId,
  });
}

export function useIcalFeedStatus() {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["ical-feed", orgId],
    queryFn: () => api.getIcalFeedStatus(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateIcalFeed() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: () => api.createIcalFeed(orgId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ical-feed", orgId] }),
  });
}

export function useRevokeIcalFeed() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: () => api.revokeIcalFeed(orgId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ical-feed", orgId] }),
  });
}

export function useEventShareStatus(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-share", eventId],
    queryFn: () => api.getEventShareStatus(eventId!),
    enabled: !!eventId,
  });
}

export function useCreateEventShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, expiresInDays }: { eventId: string; expiresInDays?: number }) =>
      api.createEventShare(eventId, expiresInDays),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["event-share", vars.eventId] });
    },
  });
}

export function useRevokeEventShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.revokeEventShare(eventId),
    onSuccess: (_data, eventId) => {
      qc.invalidateQueries({ queryKey: ["event-share", eventId] });
    },
  });
}

export function useEventComments(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-comments", eventId],
    queryFn: () => api.getEventComments(eventId!),
    enabled: !!eventId,
  });
}

export function useCreateEventComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, body }: { eventId: string; body: string }) =>
      api.createEventComment(eventId, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["event-comments", vars.eventId] });
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

export function useSearch(q: string) {
  const orgId = useCurrentOrgId();
  return useQuery({
    queryKey: ["search", orgId, q],
    queryFn: () => api.searchOrg(orgId!, q),
    enabled: !!orgId && q.length >= 1,
  });
}

function entityFilesKey(entityType: string, entityId: string) {
  return ["entity-files", entityType, entityId] as const;
}

export function useEntityFiles(entityType: "task" | "event", entityId: string | undefined) {
  return useQuery({
    queryKey: entityFilesKey(entityType, entityId ?? ""),
    queryFn: () => api.getEntityFiles(entityType, entityId!),
    enabled: !!entityId,
  });
}

export function useUploadEntityFile() {
  const qc = useQueryClient();
  const orgId = useCurrentOrgId();
  return useMutation({
    mutationFn: ({
      entityType,
      entityId,
      file,
    }: {
      entityType: "task" | "event";
      entityId: string;
      file: File;
    }) => api.uploadEntityFile(orgId!, entityType, entityId, file),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: entityFilesKey(vars.entityType, vars.entityId) });
    },
  });
}

export function useDeleteEntityFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId }: { fileId: string; entityType: "task" | "event"; entityId: string }) =>
      api.deleteFile(fileId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: entityFilesKey(vars.entityType, vars.entityId) });
    },
  });
}

export const useTaskFiles = (taskId: string | undefined) => useEntityFiles("task", taskId);
export const useUploadTaskFile = useUploadEntityFile;
export const useDeleteTaskFile = useDeleteEntityFile;

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
