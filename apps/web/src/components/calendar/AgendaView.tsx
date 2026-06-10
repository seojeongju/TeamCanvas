import { GlassCard } from "../ui/GlassCard";
import { colorClass, formatRecurrenceRule } from "../../lib/dates";
import { AGENDA_DAYS, addDaysToDate, eventsForDay } from "../../lib/calendarUtils";
import { cn } from "../../lib/cn";
import type { CalendarEvent } from "../../lib/types";

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

export function AgendaView({
  focusDate,
  events,
  onEventClick,
  onDayClick,
}: {
  focusDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
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
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onEventClick(event)}
                    className="w-full text-left"
                  >
                    <GlassCard className="flex items-center gap-3 p-3 transition hover:bg-sky-50/50">
                      <div className={cn("h-10 w-1 shrink-0 rounded-full", colorClass(event.color))} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-navy-900">{event.title}</p>
                        <p className="text-xs text-navy-600">
                          {event.time} · {event.teamName}
                        </p>
                        {event.recurrenceRule && (
                          <p className="mt-0.5 text-[10px] text-primary-600">
                            {formatRecurrenceRule(event.recurrenceRule)}
                          </p>
                        )}
                      </div>
                    </GlassCard>
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
