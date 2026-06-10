import { Lock } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { colorClass, formatRecurrenceRule } from "../../lib/dates";
import { AGENDA_DAYS, addDaysToDate, eventsForDay } from "../../lib/calendarUtils";
import {
  isPersonalGoogleEvent,
  personalGoogleEventClassName,
  splitCalendarEvents,
} from "../../lib/calendarEventSources";
import { eventListSubtitle } from "../../lib/todayEventsGroup";
import { cn } from "../../lib/cn";
import { calendarEventAriaLabel } from "../../lib/calendarEventUi";
import type { CalendarEvent } from "../../lib/types";
import { useEventPreviewTooltip } from "./EventPreviewTooltip";

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatAgendaDayLabel(d: Date): string {
  const today = new Date();
  const tomorrow = addDaysToDate(today, 1);
  if (d.toDateString() === today.toDateString()) return "오늘";
  if (d.toDateString() === tomorrow.toDateString()) return "내일";
  return d.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function AgendaEventRow({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: () => void;
}) {
  const personal = isPersonalGoogleEvent(event);
  const {
    triggerRef,
    tooltipId,
    tooltipVisible,
    tooltipPortal,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
  } = useEventPreviewTooltip(event);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onClick}
        aria-label={calendarEventAriaLabel(event)}
        aria-describedby={tooltipVisible ? tooltipId : undefined}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocus}
        onBlur={onBlur}
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
          <p className="truncate font-medium text-navy-900">{event.title}</p>
          <p className="text-xs text-navy-600">{eventListSubtitle(event)}</p>
          {event.recurrenceRule && (
            <p className="mt-0.5 text-[10px] text-primary-600">
              {formatRecurrenceRule(event.recurrenceRule)}
            </p>
          )}
        </div>
        {personal && <Lock className="h-4 w-4 shrink-0 text-red-500/80" aria-hidden />}
        </GlassCard>
      </button>
      {tooltipPortal}
    </>
  );
}

function AgendaDayEvents({
  dayEvents,
  onEventClick,
}: {
  dayEvents: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}) {
  const { teamEvents, personalGoogleEvents } = splitCalendarEvents(dayEvents);

  return (
    <div className="space-y-3">
      {teamEvents.length > 0 && (
        <div className="space-y-2">
          {teamEvents.map((event) => (
            <AgendaEventRow key={event.id} event={event} onClick={() => onEventClick(event)} />
          ))}
        </div>
      )}
      {personalGoogleEvents.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1 px-1 text-[10px] font-medium text-red-700">
            <Lock className="h-3 w-3" aria-hidden />
            내 Google 일정 · 비공개
          </p>
          {personalGoogleEvents.map((event) => (
            <AgendaEventRow key={event.id} event={event} onClick={() => onEventClick(event)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AgendaView({
  focusDate,
  events,
  onEventClick,
  onDayClick,
}: {
  focusDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent, day?: Date) => void;
  onDayClick: (date: Date) => void;
}) {
  const days = Array.from({ length: AGENDA_DAYS }, (_, i) => addDaysToDate(focusDate, i));

  return (
    <div className="space-y-4">
      {days.map((day) => {
        const key = dateKey(day);
        const dayEvents = eventsForDay(events, day).sort((a, b) => a.startAt - b.startAt);
        const isToday = day.toDateString() === new Date().toDateString();

        return (
          <section key={key}>
            <button
              type="button"
              onClick={() => onDayClick(day)}
              className={cn(
                "mb-2 flex w-full items-center justify-between text-left",
                isToday ? "text-primary-600" : "text-navy-800",
              )}
            >
              <h3 className="text-sm font-semibold">{formatAgendaDayLabel(day)}</h3>
              <span className="text-xs text-navy-500">+ 추가</span>
            </button>

            {dayEvents.length === 0 ? (
              <p className="rounded-xl bg-sky-50/50 px-3 py-2 text-xs text-navy-500">일정 없음</p>
            ) : (
              <AgendaDayEvents dayEvents={dayEvents} onEventClick={(event) => onEventClick(event, day)} />
            )}
          </section>
        );
      })}
    </div>
  );
}
