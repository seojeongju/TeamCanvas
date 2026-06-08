import { cn } from "../../lib/cn";
import { colorClass } from "../../lib/dates";
import type { CalendarEvent } from "../../lib/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function MonthView({
  year,
  month,
  events,
  onDayClick,
  onEventClick,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const today = new Date();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const eventsByDay = new Map<number, CalendarEvent[]>();
  for (const e of events) {
    const d = new Date(e.startAt);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      eventsByDay.set(day, [...(eventsByDay.get(day) ?? []), e]);
    }
  }

  return (
    <>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={cn(
              "py-1 text-xs font-medium",
              i === 0 ? "text-red-400" : i === 6 ? "text-primary-500" : "text-navy-600",
            )}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const isToday =
            day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const dayEvents = eventsByDay.get(day) ?? [];

          return (
            <button
              key={day}
              type="button"
              onClick={() => onDayClick(new Date(year, month, day))}
              className={cn(
                "relative flex aspect-square flex-col items-center rounded-xl p-0.5 text-sm transition",
                isToday
                  ? "bg-primary-400 font-bold text-white shadow-glow"
                  : "text-navy-800 hover:bg-sky-100/50",
              )}
            >
              <span className="mt-1">{day}</span>
              {dayEvents.length > 0 && (
                <div className="mt-auto flex w-full flex-col gap-0.5 px-0.5 pb-0.5">
                  {dayEvents.slice(0, 2).map((e) => (
                    <span
                      key={e.id}
                      role="button"
                      tabIndex={0}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick(e);
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") {
                          ev.stopPropagation();
                          onEventClick(e);
                        }
                      }}
                      className={cn(
                        "truncate rounded px-0.5 text-[9px] font-medium",
                        isToday ? "bg-white/25 text-white" : `${colorClass(e.color)} text-white`,
                      )}
                    >
                      {e.title}
                    </span>
                  ))}
                  {dayEvents.length > 2 && (
                    <span className={cn("text-[8px]", isToday ? "text-white/80" : "text-navy-500")}>
                      +{dayEvents.length - 2}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
