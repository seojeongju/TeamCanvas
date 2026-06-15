import { Lock, Plus, X } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { Button } from "../ui/Button";
import { colorClass, formatRecurrenceRule } from "../../lib/dates";
import { addDaysToDate } from "../../lib/calendarUtils";
import {
  isPersonalGoogleEvent,
  personalGoogleEventClassName,
  splitCalendarEvents,
} from "../../lib/calendarEventSources";
import { eventListSubtitle, type EventDisplayContext } from "../../lib/todayEventsGroup";
import { calendarEventAriaLabel, eventPreviewTitle } from "../../lib/calendarEventUi";
import type { CalendarEvent, OrgHoliday } from "../../lib/types";
import { cn } from "../../lib/cn";
import { useMemberNameMap } from "../../hooks/useAdmin";
import { useAuthStore } from "../../stores/authStore";

function formatDaySheetTitle(date: Date): string {
  const today = new Date();
  const tomorrow = addDaysToDate(today, 1);
  if (date.toDateString() === today.toDateString()) {
    return `오늘 · ${date.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}`;
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return `내일 · ${date.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}`;
  }
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function DayEventRow({
  event,
  onClick,
  displayCtx,
}: {
  event: CalendarEvent;
  onClick: () => void;
  displayCtx: EventDisplayContext;
}) {
  const personal = isPersonalGoogleEvent(event);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={calendarEventAriaLabel(event, undefined, displayCtx)}
      className="w-full cursor-pointer text-left transition-shadow duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/80"
    >
      <GlassCard
        className={cn(
          "flex items-center gap-3 p-3 transition hover:bg-sky-50/60 hover:shadow-md",
          personal && "border border-red-200/80 bg-red-50/30",
        )}
      >
        <div
          className={cn(
            "h-10 w-1 shrink-0 rounded-full",
            colorClass(event.color),
            personal && personalGoogleEventClassName(),
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-navy-900">{eventPreviewTitle(event)}</p>
          <p className="text-xs text-navy-600">{eventListSubtitle(event, displayCtx)}</p>
          {event.recurrenceRule && (
            <p className="mt-0.5 text-[10px] text-primary-600">
              반복: {formatRecurrenceRule(event.recurrenceRule)}
            </p>
          )}
        </div>
        {personal && <Lock className="h-4 w-4 shrink-0 text-red-500/80" aria-hidden />}
      </GlassCard>
    </button>
  );
}

export function DayEventsSheet({
  date,
  events,
  holidays = [],
  onClose,
  onEventClick,
  onAdd,
}: {
  date: Date | null;
  events: CalendarEvent[];
  holidays?: OrgHoliday[];
  onClose: () => void;
  onEventClick: (event: CalendarEvent) => void;
  onAdd: () => void;
}) {
  const viewerId = useAuthStore((s) => s.user?.id);
  const memberNames = useMemberNameMap();
  const displayCtx: EventDisplayContext = { viewerId, memberNames };

  if (!date) return null;

  const { teamEvents, personalGoogleEvents } = splitCalendarEvents(events);

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-navy-900/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="닫기"
      />
      <div className="glass-strong relative z-10 flex w-full max-w-lg max-h-[88dvh] flex-col rounded-t-3xl shadow-soft sm:max-h-[80vh] sm:rounded-3xl safe-bottom">
        <div className="flex items-start justify-between gap-3 border-b border-white/50 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-navy-900">{formatDaySheetTitle(date)}</h2>
            <p className="mt-0.5 text-xs text-navy-600">일정 {events.length}건</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-navy-600 hover:bg-sky-100/60"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {holidays.length > 0 && (
            <div className="mb-4 space-y-1">
              {holidays.map((h) => (
                <p
                  key={h.id}
                  className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                >
                  {h.name}
                </p>
              ))}
            </div>
          )}

          {events.length === 0 ? (
            <p className="rounded-xl bg-sky-50/60 px-4 py-6 text-center text-sm text-navy-600">
              이 날짜에 등록된 일정이 없습니다.
            </p>
          ) : (
            <div className="space-y-3">
              {teamEvents.length > 0 && (
                <div className="space-y-2">
                  {teamEvents.map((event) => (
                    <DayEventRow
                      key={event.id}
                      event={event}
                      displayCtx={displayCtx}
                      onClick={() => onEventClick(event)}
                    />
                  ))}
                </div>
              )}
              {personalGoogleEvents.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1 px-1 text-[10px] font-medium text-red-700">
                    <Lock className="h-3 w-3" aria-hidden />
                    내 Google 일정 · 비공개
                  </p>
                  {personalGoogleEvents.map((event) => (
                    <DayEventRow
                      key={event.id}
                      event={event}
                      displayCtx={displayCtx}
                      onClick={() => onEventClick(event)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-white/50 px-5 py-4">
          <Button type="button" fullWidth onClick={onAdd}>
            <Plus className="h-4 w-4" />
            일정 추가
          </Button>
        </div>
      </div>
    </div>
  );
}
