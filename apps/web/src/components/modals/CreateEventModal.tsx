import { useEffect, useRef, useState } from "react";
import { ChevronDown, Lock, Users, Building2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { ToastMessage } from "../ui/ToastMessage";
import { AiSuggestPanel } from "../calendar/AiSuggestPanel";
import { FreeBusyPanel } from "../calendar/FreeBusyPanel";
import { AttendeePicker } from "./AttendeePicker";
import {
  useCreateEvent,
  useEventAttendees,
  useEventParticipants,
  useOrgDetail,
  useTeams,
  useUpdateEvent,
} from "../../hooks/useData";
import { findConflictingEvents } from "../../lib/eventConflicts";
import { EVENT_TEMPLATES, getEventTemplate, type EventTemplateId } from "../../lib/eventTemplates";
import type { CalendarEvent, EventSuggestion } from "../../lib/types";
import {
  addDays,
  formatDateChipLabel,
  formatDurationMinutes,
  fromDatetimeLocal,
  getSmartDefaultRange,
  isSameCalendarDay,
  setDateKeepTime,
  toDatetimeLocal,
} from "../../lib/dates";
import {
  EVENT_TYPES,
  REMINDER_OPTIONS,
  getEventType,
  getEventTypeByColor,
  recurrenceFromRule,
  type EventTypeId,
} from "../../lib/eventTypes";
import { useAuthStore } from "../../stores/authStore";
import { cn } from "../../lib/cn";
import { EventExcludedDatesPicker } from "../calendar/EventExcludedDatesPicker";
import { parseExcludedDates, pruneExcludedDates } from "../../lib/eventExcludedDates";

interface CreateEventModalProps {
  open: boolean;
  onClose: () => void;
  prefillDate?: Date | null;
  prefillRange?: { start: number; end: number } | null;
  templateId?: EventTemplateId | null;
  editEvent?: CalendarEvent | null;
  /** 수정 시 캘린더에서 클릭한 날짜 (제외일 편집 초기 선택) */
  focusExcludeDate?: string;
  existingEvents?: CalendarEvent[];
}

const INITIAL_ADVANCED = {
  visibility: "org" as const,
  reminderMinutes: [10] as number[],
  attendeeUserIds: [] as string[],
  recurrence: "none" as "none" | "daily" | "weekly" | "monthly",
  teamId: "",
  description: "",
  location: "",
};

const VISIBILITY_OPTIONS = [
  {
    value: "private" as const,
    label: "나만 보기",
    desc: "본인 캘린더에만 표시",
    icon: Lock,
  },
  {
    value: "team" as const,
    label: "팀 공유",
    desc: "선택한 팀 멤버와 공유",
    icon: Users,
  },
  {
    value: "org" as const,
    label: "조직 공유",
    desc: "조직 전체 캘린더에 표시",
    icon: Building2,
  },
];

export function CreateEventModal({
  open,
  onClose,
  prefillDate,
  prefillRange,
  templateId,
  editEvent,
  focusExcludeDate,
  existingEvents = [],
}: CreateEventModalProps) {
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const { data: participantsData } = useEventParticipants();
  const { data: teamsData } = useTeams();
  const { data: editAttendeesData } = useEventAttendees(editEvent?.id);
  const isEdit = !!editEvent;

  const [eventType, setEventType] = useState<EventTypeId>("meeting");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [allDayStart, setAllDayStart] = useState("");
  const [allDayEnd, setAllDayEnd] = useState("");
  const [excludedDates, setExcludedDates] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [visibility, setVisibility] = useState<"private" | "team" | "org">(INITIAL_ADVANCED.visibility);
  const [teamId, setTeamId] = useState(INITIAL_ADVANCED.teamId);
  const [description, setDescription] = useState(INITIAL_ADVANCED.description);
  const [location, setLocation] = useState(INITIAL_ADVANCED.location);
  const [reminderMinutes, setReminderMinutes] = useState<number[]>(INITIAL_ADVANCED.reminderMinutes);
  const [attendeeUserIds, setAttendeeUserIds] = useState<string[]>(INITIAL_ADVANCED.attendeeUserIds);
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">(
    INITIAL_ADVANCED.recurrence,
  );
  const [timeError, setTimeError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);

  const { data: orgData } = useOrgDetail();
  const workHours = orgData?.organization.settings?.workHours;
  const teams = teamsData?.teams ?? [];
  const typeConfig = getEventType(eventType);
  const createInitializedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      createInitializedRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || editEvent) return;
    if (createInitializedRef.current) return;
    createInitializedRef.current = true;

    const template = templateId ? getEventTemplate(templateId) : null;
    const range = prefillRange
      ? { start: prefillRange.start, end: prefillRange.end }
      : getSmartDefaultRange(prefillDate ?? undefined, workHours);

    if (template && !prefillRange) {
      range.end = range.start + template.durationMinutes * 60 * 1000;
    }

    const dateStr = toDatetimeLocal(range.start).slice(0, 10);
    setEventType(template?.eventType ?? "meeting");
    setTitle(template?.title ?? "");
    setStart(toDatetimeLocal(range.start));
    setEnd(toDatetimeLocal(range.end));
    setAllDay(template?.eventType === "vacation");
    setAllDayStart(dateStr);
    setAllDayEnd(dateStr);
    setExcludedDates([]);
    setShowAdvanced(!!template);
    setVisibility(template?.visibility ?? INITIAL_ADVANCED.visibility);
    setTeamId(INITIAL_ADVANCED.teamId);
    setDescription("");
    setLocation("");
    setReminderMinutes(template ? [...template.reminderMinutes] : [...INITIAL_ADVANCED.reminderMinutes]);
    setAttendeeUserIds([]);
    setRecurrence(template?.recurrence ?? INITIAL_ADVANCED.recurrence);
    setTimeError(null);
    setTeamError(null);
  }, [open, editEvent, prefillDate, prefillRange, templateId, workHours]);

  useEffect(() => {
    if (!open || !editEvent) return;

    const dateStr = toDatetimeLocal(editEvent.startAt).slice(0, 10);
    setEventType(getEventTypeByColor(editEvent.color));
    setTitle(editEvent.title);
    setStart(toDatetimeLocal(editEvent.startAt));
    setEnd(toDatetimeLocal(editEvent.endAt));
    setAllDay(editEvent.allDay);
    setAllDayStart(dateStr);
    setAllDayEnd(toDatetimeLocal(editEvent.endAt).slice(0, 10));
    setExcludedDates(parseExcludedDates(editEvent.excludedDates));
    setVisibility((editEvent.visibility as "private" | "team" | "org") ?? "org");
    setTeamId(editEvent.teamId ?? "");
    setDescription(editEvent.description ?? "");
    setLocation(editEvent.location ?? "");
    setReminderMinutes([...INITIAL_ADVANCED.reminderMinutes]);
    setRecurrence(recurrenceFromRule(editEvent.recurrenceRule));
    setShowAdvanced(true);
    setTimeError(null);
    setTeamError(null);
  }, [open, editEvent]);

  useEffect(() => {
    if (!open || !editEvent || !editAttendeesData) return;
    setAttendeeUserIds(editAttendeesData.attendees.map((a) => a.user_id));
  }, [open, editEvent, editAttendeesData]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (visibility === "team" && !teamId && teams.length === 1) {
      setTeamId(teams[0].id);
    }
  }, [visibility, teamId, teams]);

  useEffect(() => {
    if (!allDay || !allDayStart || !allDayEnd) return;
    setExcludedDates((prev) => pruneExcludedDates(prev, allDayStart, allDayEnd));
  }, [allDay, allDayStart, allDayEnd]);

  const currentUser = useAuthStore((s) => s.user);
  const participants = (participantsData?.participants ?? []).filter((p) => p.id);
  const participantNames: Record<string, string> = Object.fromEntries(
    participants.map((p) => [p.id, p.name]),
  );
  if (currentUser?.id) participantNames[currentUser.id] = currentUser.name ?? "나";
  const freeBusyUserIds = Array.from(
    new Set([...(currentUser?.id ? [currentUser.id] : []), ...attendeeUserIds]),
  );
  const focusDayForBusy = start
    ? new Date(fromDatetimeLocal(start))
    : prefillDate ?? new Date();

  const durationMinutesForSuggest = (() => {
    if (allDay) return 60;
    if (!start || !end) return 60;
    return Math.max(15, Math.round((fromDatetimeLocal(end) - fromDatetimeLocal(start)) / 60000));
  })();

  const applySuggestion = (s: EventSuggestion) => {
    setStart(toDatetimeLocal(s.startAt));
    setEnd(toDatetimeLocal(s.endAt));
    setAllDay(false);
    if (s.suggestedTitle && !title.trim()) setTitle(s.suggestedTitle);
    setTimeError(null);
  };

  const dateChips = [
    { label: "오늘", date: new Date() },
    { label: "내일", date: addDays(new Date(), 1) },
    ...(prefillDate &&
    !isSameCalendarDay(prefillDate.getTime(), Date.now()) &&
    !isSameCalendarDay(prefillDate.getTime(), addDays(new Date(), 1).getTime())
      ? [{ label: formatDateChipLabel(prefillDate), date: prefillDate }]
      : []),
  ];

  const applyEventType = (typeId: EventTypeId) => {
    const config = getEventType(typeId);
    setEventType(typeId);

    if (config.allDay) {
      setAllDay(true);
      return;
    }

    if (!allDay && config.defaultDurationMinutes > 0 && start) {
      const startTs = fromDatetimeLocal(start);
      setEnd(toDatetimeLocal(startTs + config.defaultDurationMinutes * 60 * 1000));
    }
  };

  const applyDateChip = (target: Date) => {
    if (allDay) {
      const dateStr = toDatetimeLocal(target.getTime()).slice(0, 10);
      setAllDayStart(dateStr);
      setAllDayEnd(dateStr);
      return;
    }
    const newStart = setDateKeepTime(fromDatetimeLocal(start), target);
    const duration = fromDatetimeLocal(end) - fromDatetimeLocal(start);
    const newEnd = newStart + Math.max(duration, 60 * 60 * 1000);
    setStart(toDatetimeLocal(newStart));
    setEnd(toDatetimeLocal(newEnd));
    setTimeError(null);
  };

  const handleStartChange = (value: string) => {
    setStart(value);
    const startTs = fromDatetimeLocal(value);
    const endTs = fromDatetimeLocal(end);
    if (endTs <= startTs) {
      setEnd(toDatetimeLocal(startTs + 60 * 60 * 1000));
    }
    setTimeError(null);
  };

  const handleEndChange = (value: string) => {
    setEnd(value);
    const startTs = fromDatetimeLocal(start);
    const endTs = fromDatetimeLocal(value);
    if (endTs <= startTs) {
      setTimeError("종료 시간은 시작 시간보다 이후여야 합니다.");
    } else {
      setTimeError(null);
    }
  };

  const toggleReminder = (minutes: number) => {
    setReminderMinutes((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes].sort((a, b) => a - b),
    );
  };

  const applyTemplate = (id: EventTemplateId) => {
    const t = getEventTemplate(id);
    setEventType(t.eventType);
    setTitle(t.title);
    setVisibility(t.visibility);
    setRecurrence(t.recurrence);
    setReminderMinutes([...t.reminderMinutes]);
    if (t.eventType === "vacation") setAllDay(true);
    if (!allDay && start && t.durationMinutes > 0) {
      const startTs = fromDatetimeLocal(start);
      setEnd(toDatetimeLocal(startTs + t.durationMinutes * 60 * 1000));
    }
    setShowAdvanced(true);
  };

  const handleVisibilityChange = (value: "private" | "team" | "org") => {
    setVisibility(value);
    setTeamError(null);
    if (value !== "team") setTeamId("");
    else if (teams.length === 1) setTeamId(teams[0].id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (visibility === "team" && !teamId) {
      setTeamError("팀을 선택해 주세요.");
      setShowAdvanced(true);
      return;
    }

    let startAt: number;
    let endAt: number;

    if (allDay) {
      startAt = new Date(`${allDayStart}T00:00:00`).getTime();
      endAt = new Date(`${allDayEnd}T23:59:59`).getTime();
      if (endAt < startAt) {
        setTimeError("종료일은 시작일보다 이후여야 합니다.");
        return;
      }
    } else {
      startAt = fromDatetimeLocal(start);
      endAt = fromDatetimeLocal(end);
      if (endAt <= startAt) {
        setTimeError("종료 시간은 시작 시간보다 이후여야 합니다.");
        return;
      }
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      startAt,
      endAt,
      allDay,
      color: typeConfig.color,
      visibility,
      teamId: visibility === "team" ? teamId : null,
      attendeeUserIds,
      reminderMinutes: reminderMinutes.length > 0 ? reminderMinutes : [],
      recurrenceRule:
        recurrence === "none"
          ? null
          : recurrence === "daily"
            ? "FREQ=DAILY"
            : recurrence === "weekly"
              ? "FREQ=WEEKLY"
              : "FREQ=MONTHLY",
      excludedDates: allDay ? pruneExcludedDates(excludedDates, allDayStart, allDayEnd) : [],
    };

    try {
      if (isEdit && editEvent) {
        await updateEvent.mutateAsync({ eventId: editEvent.id, ...payload });
        setToast({ tone: "info", message: "일정을 수정했습니다." });
      } else {
        await createEvent.mutateAsync(payload);
        setToast({ tone: "info", message: "일정을 저장했습니다." });
      }
      onClose();
    } catch (err) {
      setToast({
        tone: "error",
        message: err instanceof Error ? err.message : "일정 저장에 실패했습니다.",
      });
    }
  };

  const currentStartEnd = (() => {
    if (allDay) {
      return {
        start: new Date(`${allDayStart}T00:00:00`).getTime(),
        end: new Date(`${allDayEnd}T23:59:59`).getTime(),
      };
    }
    if (!start || !end) return null;
    return { start: fromDatetimeLocal(start), end: fromDatetimeLocal(end) };
  })();

  const conflicts =
    currentStartEnd && currentStartEnd.end > currentStartEnd.start
      ? findConflictingEvents(
          existingEvents,
          currentStartEnd.start,
          currentStartEnd.end,
          editEvent?.id,
        )
      : [];

  const isPending = createEvent.isPending || updateEvent.isPending;
  const durationLabel =
    !allDay && start && end && !timeError
      ? formatDurationMinutes(fromDatetimeLocal(start), fromDatetimeLocal(end))
      : null;

  const saveBlockReason = !title.trim()
    ? "제목을 입력하면 저장할 수 있습니다."
    : timeError
      ? timeError
      : null;
  const canSave = !isPending && !timeError && !!title.trim();

  return (
    <>
      <Modal open={open} onClose={onClose} title={isEdit ? "일정 수정" : "일정 추가"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div>
              <p className="mb-2 text-sm font-medium text-navy-700">템플릿</p>
              <div className="flex flex-wrap gap-2">
                {EVENT_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t.id)}
                    className="rounded-xl bg-sky-100/60 px-3 py-1.5 text-left text-xs transition hover:bg-sky-100"
                    title={t.description}
                  >
                    <span className="font-medium text-navy-800">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium text-navy-700">유형</p>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => applyEventType(type.id)}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-sm font-medium transition",
                    eventType === type.id
                      ? "text-white shadow-glow"
                      : "bg-sky-100/60 text-navy-700 hover:bg-sky-100",
                  )}
                  style={
                    eventType === type.id ? { backgroundColor: type.color } : undefined
                  }
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="제목"
            placeholder={typeConfig.placeholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />

          <div>
            <p className="mb-2 text-sm font-medium text-navy-700">날짜</p>
            <div className="flex flex-wrap gap-2">
              {dateChips.map((chip) => {
                const active = allDay
                  ? allDayStart === toDatetimeLocal(chip.date.getTime()).slice(0, 10)
                  : isSameCalendarDay(fromDatetimeLocal(start), chip.date.getTime());
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => applyDateChip(chip.date)}
                    className={cn(
                      "rounded-xl px-3 py-1.5 text-sm font-medium transition",
                      active
                        ? "bg-primary-400 text-white shadow-glow"
                        : "bg-sky-100/60 text-navy-700 hover:bg-sky-100",
                    )}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-navy-700">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => {
                setAllDay(e.target.checked);
                if (!e.target.checked) setExcludedDates([]);
              }}
              className="h-4 w-4 rounded accent-primary-400"
            />
            종일 일정
          </label>

          {allDay ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="시작일"
                  type="date"
                  value={allDayStart}
                  onChange={(e) => setAllDayStart(e.target.value)}
                />
                <Input
                  label="종료일"
                  type="date"
                  value={allDayEnd}
                  onChange={(e) => setAllDayEnd(e.target.value)}
                />
              </div>
              <EventExcludedDatesPicker
                startDate={allDayStart}
                endDate={allDayEnd}
                excludedDates={excludedDates}
                onChange={setExcludedDates}
                highlightDate={isEdit ? focusExcludeDate : undefined}
                mode={isEdit ? "select" : "toggle"}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="시작"
                  type="datetime-local"
                  value={start}
                  onChange={(e) => handleStartChange(e.target.value)}
                />
                <Input
                  label="종료"
                  type="datetime-local"
                  value={end}
                  onChange={(e) => handleEndChange(e.target.value)}
                />
              </div>
              {durationLabel && (
                <p className="text-xs text-primary-600">소요 시간: {durationLabel}</p>
              )}
            </div>
          )}

          {timeError && (
            <p className="text-sm text-red-500" role="alert">
              {timeError}
            </p>
          )}

          {!isEdit && !allDay && (
            <AiSuggestPanel
              attendeeUserIds={attendeeUserIds}
              durationMinutes={durationMinutesForSuggest}
              onApply={applySuggestion}
            />
          )}

          {conflicts.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5" role="alert">
              <p className="text-sm font-medium text-amber-800">
                겹치는 일정 {conflicts.length}건
              </p>
              <ul className="mt-1 space-y-0.5">
                {conflicts.slice(0, 3).map((c) => (
                  <li key={c.id} className="text-xs text-amber-700">
                    · {c.title} ({c.time})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-sky-200/80 bg-sky-50/30">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-navy-800"
              aria-expanded={showAdvanced}
            >
              상세 옵션
              <ChevronDown className={cn("h-4 w-4 transition", showAdvanced && "rotate-180")} />
            </button>

            {showAdvanced && (
              <div className="space-y-4 border-t border-sky-200/60 px-4 pb-4 pt-3">
                <div>
                  <p className="mb-2 text-sm text-navy-700">공유 범위</p>
                  <div className="space-y-2">
                    {VISIBILITY_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const active = visibility === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleVisibilityChange(opt.value)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                            active
                              ? "border-primary-400 bg-primary-400/10"
                              : "border-sky-200 bg-white hover:bg-sky-50",
                          )}
                        >
                          <Icon
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0",
                              active ? "text-primary-600" : "text-navy-500",
                            )}
                          />
                          <span>
                            <span className="block text-sm font-medium text-navy-900">{opt.label}</span>
                            <span className="block text-xs text-navy-600">{opt.desc}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {visibility === "team" && (
                  <label className="block text-sm text-navy-700">
                    팀 선택
                    <select
                      className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm"
                      value={teamId}
                      onChange={(e) => {
                        setTeamId(e.target.value);
                        setTeamError(null);
                      }}
                    >
                      <option value="">팀을 선택하세요</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    {teamError && (
                      <p className="mt-1 text-xs text-red-500" role="alert">
                        {teamError}
                      </p>
                    )}
                    {teams.length === 0 && (
                      <p className="mt-1 text-xs text-navy-500">소속된 팀이 없습니다.</p>
                    )}
                  </label>
                )}

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="event-description" className="text-sm font-medium text-navy-700">
                    설명
                  </label>
                  <textarea
                    id="event-description"
                    rows={3}
                    placeholder="회의 안건, 준비물 등"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full resize-none rounded-2xl border border-sky-200/80 bg-white/80 px-4 py-3 text-[15px] text-navy-800 placeholder:text-navy-600/50 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
                  />
                </div>

                <Input
                  label="장소"
                  placeholder="회의실, 화상 회의 링크 등"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />

                <div>
                  <p className="mb-2 text-sm text-navy-700">알림</p>
                  <div className="flex flex-wrap gap-2">
                    {REMINDER_OPTIONS.map((opt) => {
                      const active = reminderMinutes.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleReminder(opt.value)}
                          className={cn(
                            "rounded-xl px-3 py-1.5 text-xs font-medium transition",
                            active
                              ? "bg-primary-400 text-white"
                              : "bg-white text-navy-700 ring-1 ring-sky-200 hover:bg-sky-50",
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {reminderMinutes.length === 0 && (
                    <p className="mt-1.5 text-xs text-navy-500">알림 없음</p>
                  )}
                </div>

                <label className="block text-sm text-navy-700">
                  반복
                  <select
                    className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm"
                    value={recurrence}
                    onChange={(e) =>
                      setRecurrence(e.target.value as "none" | "daily" | "weekly" | "monthly")
                    }
                  >
                    <option value="none">반복 없음</option>
                    <option value="daily">매일</option>
                    <option value="weekly">매주</option>
                    <option value="monthly">매월</option>
                  </select>
                </label>

                <AttendeePicker
                  participants={participants}
                  selectedIds={attendeeUserIds}
                  onChange={setAttendeeUserIds}
                />

                {!allDay && (
                  <FreeBusyPanel
                    userIds={freeBusyUserIds}
                    userNames={participantNames}
                    focusDay={focusDayForBusy}
                  />
                )}
              </div>
            )}
          </div>

          <div className="sticky bottom-0 -mx-6 border-t border-sky-100/80 bg-white/95 px-6 py-4 backdrop-blur-sm">
            {saveBlockReason && !isPending && (
              <p className="mb-2 text-center text-xs text-amber-700" role="status">
                {saveBlockReason}
              </p>
            )}
            <Button type="submit" fullWidth disabled={!canSave}>
              {isPending ? "저장 중..." : isEdit ? "변경 저장" : "일정 저장"}
            </Button>
          </div>
        </form>
      </Modal>

      {toast && (
        <ToastMessage message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      )}
    </>
  );
}
