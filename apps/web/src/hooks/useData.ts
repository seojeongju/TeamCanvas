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
