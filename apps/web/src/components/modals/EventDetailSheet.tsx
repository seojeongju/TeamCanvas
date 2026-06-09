import { useNavigate } from "react-router-dom";
import { CheckSquare, MapPin, Pencil, Trash2, X } from "lucide-react";
import { Button } from "../ui/Button";
import { colorClass, formatRecurrenceRule } from "../../lib/dates";
import { useCreateTask, useDeleteEvent, useEventAttendees, useUpdateEventRsvp } from "../../hooks/useData";
import type { CalendarEvent } from "../../lib/types";
import { cn } from "../../lib/cn";

const VISIBILITY_LABELS: Record<string, string> = {
  private: "나만 보기",
  team: "팀 공유",
  org: "조직 공유",
};

export function EventDetailSheet({
  event,
  onClose,
  onEdit,
}: {
  event: CalendarEvent | null;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
}) {
  const navigate = useNavigate();
  const deleteEvent = useDeleteEvent();
  const createTask = useCreateTask();
  const updateRsvp = useUpdateEventRsvp();
  const { data: attendeesData } = useEventAttendees(event?.id);
  const attendees = attendeesData?.attendees ?? [];

  if (!event) return null;

  const handleConvertToTask = async () => {
    const result = await createTask.mutateAsync({
      title: event.title,
      description: event.description ?? undefined,
      dueAt: event.endAt,
      teamId: event.teamId ?? undefined,
      eventId: event.id,
    });
    onClose();
    navigate(`/tasks?task=${result.id}`);
  };

  const handleDelete = async () => {
    if (!window.confirm(`"${event.title}" 일정을 삭제할까요?`)) return;
    await deleteEvent.mutateAsync(event.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button className="absolute inset-0 bg-navy-900/30 backdrop-blur-sm" onClick={onClose} aria-label="닫기" />
      <div className="glass-strong relative z-10 flex w-full max-w-lg max-h-[92dvh] flex-col overflow-y-auto overscroll-contain rounded-t-3xl p-6 shadow-soft sm:max-h-[85vh] sm:rounded-3xl safe-bottom">
        <div className="mb-4 flex items-start gap-3">
          <div className={cn("mt-1 h-10 w-1.5 shrink-0 rounded-full", colorClass(event.color))} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-navy-900">{event.title}</h2>
            <p className="mt-1 text-sm text-navy-600">{event.time}</p>
            <p className="text-xs text-navy-500">
              {event.teamName} · {VISIBILITY_LABELS[event.visibility ?? "org"] ?? event.visibility}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-navy-600 hover:bg-sky-100/60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {event.description && (
          <p className="mb-3 whitespace-pre-wrap text-sm text-navy-700">{event.description}</p>
        )}

        {event.location && (
          <p className="mb-3 flex items-center gap-1.5 text-sm text-navy-600">
            <MapPin className="h-4 w-4 shrink-0" />
            {event.location}
          </p>
        )}

        {event.recurrenceRule && (
          <p className="mb-3 text-xs text-primary-600">
            반복: {formatRecurrenceRule(event.recurrenceRule)}
          </p>
        )}

        {attendees.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-navy-700">참석자</p>
            <div className="flex flex-wrap gap-1.5">
              {attendees.map((a) => (
                <span
                  key={a.user_id}
                  className="rounded-full bg-sky-100/80 px-2.5 py-1 text-xs text-navy-700"
                >
                  {a.name}
                  <span className="ml-1 text-navy-500">({a.rsvp})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700"
            onClick={() => updateRsvp.mutate({ eventId: event.id, rsvp: "accepted" })}
          >
            참석
          </button>
          <button
            type="button"
            className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-700"
            onClick={() => updateRsvp.mutate({ eventId: event.id, rsvp: "declined" })}
          >
            불참
          </button>
        </div>

        <Button
          variant="secondary"
          fullWidth
          className="mb-3"
          onClick={handleConvertToTask}
          disabled={createTask.isPending}
        >
          <CheckSquare className="h-4 w-4" />
          {createTask.isPending ? "변환 중..." : "업무로 변환"}
        </Button>

        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => onEdit(event)}>
            <Pencil className="h-4 w-4" />
            수정
          </Button>
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-50"
            onClick={handleDelete}
            disabled={deleteEvent.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
