import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare, MapPin, MessageSquare, Pencil, Trash2, X } from "lucide-react";
import { Button } from "../ui/Button";
import { MentionTextarea } from "../ui/MentionTextarea";
import { ToastMessage } from "../ui/ToastMessage";
import { colorClass, formatRecurrenceRule, toDateLocal } from "../../lib/dates";
import { formatExcludedDatesSummary } from "../../lib/eventExcludedDates";
import { EntityFilesSection } from "../ui/EntityFilesSection";
import {
  useCreateEventComment,
  useCreateTask,
  useDeleteEvent,
  useEventAttendees,
  useEventComments,
  useUpdateEventRsvp,
} from "../../hooks/useData";
import { useOrgMembers } from "../../hooks/useAdmin";
import { useTeamDetail } from "../../hooks/useOrgSettings";
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
  const createComment = useCreateEventComment();
  const { data: membersData } = useOrgMembers();
  const { data: attendeesData } = useEventAttendees(event?.id);
  const { data: commentsData } = useEventComments(event?.id);
  const attendees = attendeesData?.attendees ?? [];
  const comments = commentsData?.comments ?? [];
  const members = membersData?.members ?? [];
  const [commentBody, setCommentBody] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);

  const { data: teamData } = useTeamDetail(
    event?.visibility === "team" && event?.teamId ? event.teamId : undefined,
  );

  const mentionMembers = useMemo(() => {
    const orgMembers = members.map((m) => ({ id: m.user_id, name: m.name }));
    if (event?.visibility !== "team" || !event?.teamId || !teamData?.members?.length) {
      return orgMembers;
    }
    const teamIds = new Set(teamData.members.map((m) => m.userId));
    const teamFirst = orgMembers.filter((m) => teamIds.has(m.id));
    const rest = orgMembers.filter((m) => !teamIds.has(m.id));
    return [...teamFirst, ...rest];
  }, [members, event?.visibility, event?.teamId, teamData?.members]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!event) return null;

  const excludedSummary =
    event.allDay && event.excludedDates?.length
      ? formatExcludedDatesSummary(
          toDateLocal(event.startAt),
          toDateLocal(event.endAt),
          event.excludedDates,
        )
      : null;

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

        {excludedSummary && (
          <p className="mb-3 text-xs text-navy-600">{excludedSummary}</p>
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

        <EntityFilesSection entityType="event" entityId={event.id} />

        <div className="mt-4 border-t border-sky-100/80 pt-4">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-navy-600" />
            <h3 className="text-sm font-semibold text-navy-800">댓글 {comments.length}</h3>
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-xs text-navy-500">첫 댓글을 남겨보세요.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="rounded-2xl bg-sky-50/80 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-navy-800">{c.userName}</span>
                    <span className="text-[10px] text-navy-500">{c.time}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-navy-700">{c.body}</p>
                </div>
              ))
            )}
          </div>
          <form
            className="mt-3 flex items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!commentBody.trim()) return;
              try {
                await createComment.mutateAsync({ eventId: event.id, body: commentBody.trim() });
                setCommentBody("");
                setToast({
                  tone: "info",
                  message: "댓글이 등록되었습니다. 관련 팀원에게 알림이 전송됩니다.",
                });
              } catch (err) {
                setToast({
                  tone: "error",
                  message: err instanceof Error ? err.message : "댓글 등록에 실패했습니다.",
                });
              }
            }}
          >
            <MentionTextarea
              value={commentBody}
              onChange={setCommentBody}
              members={mentionMembers}
              placeholder="댓글 입력... (@이름 멘션)"
              rows={2}
            />
            <Button type="submit" disabled={createComment.isPending || !commentBody.trim()} className="shrink-0">
              등록
            </Button>
          </form>
        </div>

        <Button
          variant="secondary"
          fullWidth
          className="mb-3 mt-4"
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

      {toast && (
        <ToastMessage message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
