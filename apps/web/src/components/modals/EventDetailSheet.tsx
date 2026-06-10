import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare, ExternalLink, Lock, MapPin, MessageSquare, Pencil, Trash2, X } from "lucide-react";
import { Button } from "../ui/Button";
import { MentionTextarea } from "../ui/MentionTextarea";
import { ToastMessage } from "../ui/ToastMessage";
import { EventExcludedDatesPicker } from "../calendar/EventExcludedDatesPicker";
import { colorClass, formatEventTimeRange, formatRecurrenceRule, toDateLocal } from "../../lib/dates";
import {
  canManageExcludedDates,
  parseExcludedDates,
  pruneExcludedDates,
} from "../../lib/eventExcludedDates";
import { EntityFilesSection } from "../ui/EntityFilesSection";
import {
  useCreateEventComment,
  useCreateTask,
  useDeleteEvent,
  useEvent,
  useEventAttendees,
  useEventComments,
  useUpdateEvent,
  useUpdateEventRsvp,
} from "../../hooks/useData";
import { useOrgMembers } from "../../hooks/useAdmin";
import { useHasPermission } from "../../hooks/usePermissions";
import { useTeamDetail } from "../../hooks/useOrgSettings";
import { useAuthStore } from "../../stores/authStore";
import type { CalendarEvent } from "../../lib/types";
import { cn } from "../../lib/cn";
import { eventPreviewTitle } from "../../lib/calendarEventUi";
import { googleCalendarOpenUrl, personalGoogleEventClassName } from "../../lib/calendarEventSources";

const VISIBILITY_LABELS: Record<string, string> = {
  private: "나만 보기",
  team: "팀 공유",
  org: "조직 공유",
};

export function EventDetailSheet({
  event,
  focusedDay,
  onClose,
  onEdit,
  onEventUpdated,
}: {
  event: CalendarEvent | null;
  /** 캘린더에서 클릭한 날짜 — 제외일 편집 시 초기 선택 */
  focusedDay?: Date | null;
  onClose: () => void;
  onEdit: (event: CalendarEvent, focusedDay?: Date | null) => void;
  onEventUpdated?: (event: CalendarEvent) => void;
}) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canDeleteAny = useHasPermission("events:delete");
  const canWrite = useHasPermission("events:write");
  const isGoogle = event?.sourceType === "google";
  const teamEventId = event?.id && !isGoogle ? event.id : undefined;

  const deleteEvent = useDeleteEvent();
  const updateEvent = useUpdateEvent();
  const createTask = useCreateTask();
  const updateRsvp = useUpdateEventRsvp();
  const createComment = useCreateEventComment();
  const { data: freshEventData } = useEvent(teamEventId);
  const { data: membersData } = useOrgMembers();
  const { data: attendeesData } = useEventAttendees(teamEventId);
  const { data: commentsData } = useEventComments(teamEventId);
  const attendees = attendeesData?.attendees ?? [];
  const comments = commentsData?.comments ?? [];
  const members = membersData?.members ?? [];
  const [commentBody, setCommentBody] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);
  const [excludedDates, setExcludedDates] = useState<string[]>([]);
  const [excludedDirty, setExcludedDirty] = useState(false);

  const displayEvent = isGoogle ? event : (freshEventData?.event ?? event);

  const { data: teamData } = useTeamDetail(
    displayEvent?.visibility === "team" && displayEvent?.teamId ? displayEvent.teamId : undefined,
  );

  const mentionMembers = useMemo(() => {
    const orgMembers = members.map((m) => ({ id: m.user_id, name: m.name }));
    if (displayEvent?.visibility !== "team" || !displayEvent?.teamId || !teamData?.members?.length) {
      return orgMembers;
    }
    const teamIds = new Set(teamData.members.map((m) => m.userId));
    const teamFirst = orgMembers.filter((m) => teamIds.has(m.id));
    const rest = orgMembers.filter((m) => !teamIds.has(m.id));
    return [...teamFirst, ...rest];
  }, [members, displayEvent?.visibility, displayEvent?.teamId, teamData?.members]);

  const startDate = displayEvent ? toDateLocal(displayEvent.startAt) : "";
  const endDate = displayEvent ? toDateLocal(displayEvent.endAt) : "";
  const focusDateKey = focusedDay ? toDateLocal(focusedDay.getTime()) : undefined;
  const showExcludedEditor = displayEvent ? canManageExcludedDates(displayEvent) : false;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!displayEvent) return;
    setExcludedDates(parseExcludedDates(displayEvent.excludedDates));
    setExcludedDirty(false);
  }, [displayEvent?.id, displayEvent?.excludedDates]);

  if (!displayEvent) return null;

  const isGoogleEvent = displayEvent.sourceType === "google";
  const displayTitle = isGoogleEvent ? eventPreviewTitle(displayEvent) : displayEvent.title;

  const canDelete =
    !isGoogleEvent &&
    displayEvent.sourceType !== "task" &&
    (canDeleteAny ||
      (canWrite && !!displayEvent.creatorId && displayEvent.creatorId === user?.id));

  const handleExcludedChange = (dates: string[]) => {
    setExcludedDates(pruneExcludedDates(dates, startDate, endDate));
    setExcludedDirty(true);
  };

  const handleSaveExcluded = async () => {
    const normalized = pruneExcludedDates(excludedDates, startDate, endDate);
    try {
      await updateEvent.mutateAsync({
        eventId: displayEvent.id,
        title: displayEvent.title,
        startAt: displayEvent.startAt,
        endAt: displayEvent.endAt,
        allDay: displayEvent.allDay,
        description: displayEvent.description ?? undefined,
        location: displayEvent.location ?? undefined,
        teamId: displayEvent.teamId ?? null,
        color: displayEvent.color,
        visibility: (displayEvent.visibility as "private" | "team" | "org") ?? "org",
        attendeeUserIds: attendees.map((a) => a.user_id),
        reminderMinutes: [10],
        recurrenceRule: displayEvent.recurrenceRule ?? null,
        excludedDates: normalized,
      });
      setExcludedDirty(false);
      setToast({ tone: "info", message: "제외 날짜를 저장했습니다." });
      onEventUpdated?.({ ...displayEvent, excludedDates: normalized });
    } catch (err) {
      setToast({
        tone: "error",
        message: err instanceof Error ? err.message : "제외 날짜 저장에 실패했습니다.",
      });
    }
  };

  const handleConvertToTask = async () => {
    const result = await createTask.mutateAsync({
      title: displayEvent.title,
      description: displayEvent.description ?? undefined,
      dueAt: displayEvent.endAt,
      teamId: displayEvent.teamId ?? undefined,
      eventId: displayEvent.id,
    });
    onClose();
    navigate(`/tasks?task=${result.id}`);
  };

  const handleDelete = async () => {
    if (!window.confirm(`"${displayTitle}" 일정을 삭제할까요?`)) return;
    try {
      await deleteEvent.mutateAsync(displayEvent.id);
      onClose();
    } catch (err) {
      setToast({
        tone: "error",
        message: err instanceof Error ? err.message : "일정 삭제에 실패했습니다.",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button className="absolute inset-0 bg-navy-900/30 backdrop-blur-sm" onClick={onClose} aria-label="닫기" />
      <div className="glass-strong relative z-10 flex w-full max-w-lg max-h-[92dvh] flex-col overflow-y-auto overscroll-contain rounded-t-3xl p-6 shadow-soft sm:max-h-[85vh] sm:rounded-3xl safe-bottom">
        <div className="mb-4 flex items-start gap-3">
          <div
            className={cn(
              "mt-1 h-10 w-1.5 shrink-0 rounded-full",
              colorClass(displayEvent.color),
              isGoogleEvent && personalGoogleEventClassName(),
            )}
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-navy-900">{displayTitle}</h2>
            <p className="mt-1 text-sm text-navy-600">
              {formatEventTimeRange(displayEvent.startAt, displayEvent.endAt, displayEvent.allDay)}
            </p>
            {isGoogleEvent ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600/90">
                <Lock className="h-3 w-3 shrink-0" aria-hidden />
                내 Google 일정 · 읽기 전용 · 팀원 비공개
              </p>
            ) : (
              <p className="text-xs text-navy-500">
                {displayEvent.teamName} ·{" "}
                {VISIBILITY_LABELS[displayEvent.visibility ?? "org"] ?? displayEvent.visibility}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-navy-600 hover:bg-sky-100/60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {displayEvent.description ? (
          <div className="mb-3">
            <p className="mb-1 text-xs font-medium text-navy-700">설명</p>
            <p className="whitespace-pre-wrap text-sm text-navy-700">{displayEvent.description}</p>
          </div>
        ) : isGoogleEvent ? (
          <p className="mb-3 text-sm text-navy-500">설명이 없습니다.</p>
        ) : null}

        {displayEvent.location && (
          <p className="mb-3 flex items-center gap-1.5 text-sm text-navy-600">
            <MapPin className="h-4 w-4 shrink-0" />
            {displayEvent.location}
          </p>
        )}

        {isGoogleEvent && (
          <div className="mb-4 space-y-3">
            <p className="rounded-xl border border-red-200/80 bg-red-50/40 px-3 py-2 text-xs leading-relaxed text-navy-600">
              TeamCanvas에서는 조회만 가능합니다. 일정을 수정하려면 Google Calendar에서 변경한 뒤{" "}
              <strong>동기화</strong>를 실행하세요.
            </p>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => window.open(googleCalendarOpenUrl(displayEvent), "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-4 w-4" />
              Google Calendar에서 열기
            </Button>
          </div>
        )}

        {!isGoogleEvent && displayEvent.recurrenceRule && (
          <p className="mb-3 text-xs text-primary-600">
            반복: {formatRecurrenceRule(displayEvent.recurrenceRule)}
          </p>
        )}

        {!isGoogleEvent && showExcludedEditor && (
          <div className="mb-4 rounded-2xl border border-sky-100/80 bg-sky-50/40 p-4">
            <EventExcludedDatesPicker
              startDate={startDate}
              endDate={endDate}
              excludedDates={excludedDates}
              onChange={handleExcludedChange}
              highlightDate={focusDateKey}
              mode="select"
            />
            {excludedDirty && (
              <Button
                type="button"
                fullWidth
                className="mt-3 !min-h-10"
                disabled={updateEvent.isPending}
                onClick={handleSaveExcluded}
              >
                {updateEvent.isPending ? "저장 중..." : "제외 날짜 저장"}
              </Button>
            )}
          </div>
        )}

        {!isGoogleEvent && attendees.length > 0 && (
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

        {!isGoogleEvent && (
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700"
              onClick={() => updateRsvp.mutate({ eventId: displayEvent.id, rsvp: "accepted" })}
            >
              참석
            </button>
            <button
              type="button"
              className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-700"
              onClick={() => updateRsvp.mutate({ eventId: displayEvent.id, rsvp: "declined" })}
            >
              불참
            </button>
          </div>
        )}

        {!isGoogleEvent && <EntityFilesSection entityType="event" entityId={displayEvent.id} />}

        {!isGoogleEvent && (
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
                await createComment.mutateAsync({ eventId: displayEvent.id, body: commentBody.trim() });
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
        )}

        {!isGoogleEvent && (
          <>
            <Button
              variant="secondary"
              fullWidth
              className="mb-3 mt-4"
              onClick={handleConvertToTask}
              disabled={createTask.isPending}
            >
              <CheckSquare className="h-4 w-4" />
              {createTask.isPending ? "변환 중..." : "프로젝트로 변환"}
            </Button>

            <div className="flex gap-2">
              <Button variant="secondary" fullWidth onClick={() => onEdit(displayEvent, focusedDay)}>
                <Pencil className="h-4 w-4" />
                수정
              </Button>
              {canDelete && (
                <Button
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50"
                  onClick={handleDelete}
                  disabled={deleteEvent.isPending}
                  aria-label="일정 삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {toast && (
        <ToastMessage message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
