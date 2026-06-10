import { useMemo } from "react";
import { cn } from "../../lib/cn";
import { colorClass } from "../../lib/dates";
import {
  getMonthWeeks,
  layoutMonthBarSegments,
  singleDayChipEvents,
  type MonthBarSegment,
} from "../../lib/calendarUtils";
import { holidaysForDay } from "../../lib/holidays";
import type { CalendarEvent, OrgHoliday } from "../../lib/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_BAR_LANES = 3;
const BAR_ROW_HEIGHT = 14;

export function MonthView({
  year,
  month,
  events,
  holidays = [],
  onDayClick,
  onEventClick,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  holidays?: OrgHoliday[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const today = new Date();

  const weeks = useMemo(() => getMonthWeeks(year, month), [year, month]);
  const barSegments = useMemo(() => layoutMonthBarSegments(weeks, events), [weeks, events]);

  const segmentsByWeek = useMemo(() => {
    const map = new Map<number, MonthBarSegment[]>();
    for (const seg of barSegments) {
      const list = map.get(seg.weekIndex) ?? [];
      list.push(seg);
      map.set(seg.weekIndex, list);
    }
    return map;
  }, [barSegments]);

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

      <div className="mt-1 space-y-1">
        {weeks.map((week, weekIndex) => {
          const weekBars = segmentsByWeek.get(weekIndex) ?? [];
          const visibleBars = weekBars.filter((b) => b.lane < MAX_BAR_LANES);
          const hiddenBarCount = weekBars.filter((b) => b.lane >= MAX_BAR_LANES).length;
          const maxLane = visibleBars.reduce((m, b) => Math.max(m, b.lane), -1);
          const barRows = maxLane >= 0 ? maxLane + 1 : 0;

          return (
            <div key={weekIndex}>
              {barRows > 0 && (
                <div
                  className="mb-0.5 grid grid-cols-7 gap-1"
                  style={{ gridTemplateRows: `repeat(${barRows}, ${BAR_ROW_HEIGHT}px)` }}
                >
                  {visibleBars.map((seg) => (
                    <button
                      key={`${seg.event.id}-w${weekIndex}-c${seg.startCol}-l${seg.lane}`}
                      type="button"
                      style={{
                        gridColumn: `${seg.startCol + 1} / span ${seg.span}`,
                        gridRow: seg.lane + 1,
                      }}
                      onClick={() => onEventClick(seg.event)}
                      className={cn(
                        "min-h-0 truncate px-1 text-left text-[9px] font-medium leading-[14px] text-white",
                        colorClass(seg.event.color),
                        seg.roundLeft && "rounded-l-md",
                        seg.roundRight && "rounded-r-md",
                        !seg.roundLeft && "rounded-l-none",
                        !seg.roundRight && "rounded-r-none",
                        seg.event.sourceType === "task" && "ring-1 ring-white/30",
                      )}
                      title={seg.event.title}
                    >
                      {seg.showTitle
                        ? seg.event.sourceType === "task"
                          ? `마감 ${seg.event.title}`
                          : seg.event.title
                        : "\u00a0"}
                    </button>
                  ))}
                </div>
              )}

              {hiddenBarCount > 0 && (
                <p className="mb-0.5 px-1 text-[8px] text-navy-500">+{hiddenBarCount}개 일정</p>
              )}

              <div className="grid grid-cols-7 gap-1">
                {week.map((day) => {
                  const inMonth = day.getMonth() === month;
                  const isToday = day.toDateString() === today.toDateString();
                  const dayChips = singleDayChipEvents(day, events);
                  const dayHolidays = inMonth ? holidaysForDay(year, month, day.getDate(), holidays) : [];

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => onDayClick(day)}
                      className={cn(
                        "relative flex min-h-[52px] flex-col items-center rounded-xl p-0.5 text-sm transition",
                        !inMonth && "opacity-35",
                        isToday
                          ? "bg-primary-400 font-bold text-white shadow-glow"
                          : "text-navy-800 hover:bg-sky-100/50",
                      )}
                    >
                      <span className="mt-1">{day.getDate()}</span>
                      {dayHolidays.length > 0 && (
                        <span
                          className={cn(
                            "max-w-full truncate px-0.5 text-[8px] font-medium",
                            isToday ? "text-white/90" : "text-red-500",
                          )}
                          title={dayHolidays.map((h) => h.name).join(", ")}
                        >
                          {dayHolidays[0].name}
                        </span>
                      )}
                      {dayChips.length > 0 && (
                        <div className="mt-auto flex w-full flex-col gap-0.5 px-0.5 pb-0.5">
                          {dayChips.slice(0, 2).map((e) => (
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
                          {dayChips.length > 2 && (
                            <span className={cn("text-[8px]", isToday ? "text-white/80" : "text-navy-500")}>
                              +{dayChips.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
