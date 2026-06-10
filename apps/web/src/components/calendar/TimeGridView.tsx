import { useRef, useState } from "react";
import { cn } from "../../lib/cn";
import {
  HOUR_END,
  HOUR_START,
  SLOTS_PER_HOUR,
  SLOT_MINUTES,
  eventBlockStyle,
  eventsForDay,
  formatHourLabel,
  getSlotsCount,
  slotIndexToTimestamp,
  timestampToSlotIndex,
} from "../../lib/calendarUtils";
import { isPersonalGoogleEvent } from "../../lib/calendarEventSources";
import type { CalendarEvent } from "../../lib/types";
import { CalendarEventTrigger } from "./CalendarEventTrigger";

const SLOT_HEIGHT = 22;

export function TimeGridView({
  days,
  events,
  onEventClick,
  onRangeSelect,
}: {
  days: Date[];
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent, day?: Date) => void;
  onRangeSelect: (startAt: number, endAt: number) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ dayIndex: number; startSlot: number; endSlot: number } | null>(
    null,
  );

  const slotsCount = getSlotsCount();
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  const finishDrag = (state: { dayIndex: number; startSlot: number; endSlot: number }) => {
    const minSlot = Math.min(state.startSlot, state.endSlot);
    const maxSlot = Math.max(state.startSlot, state.endSlot);
    const day = days[state.dayIndex];
    const startAt = slotIndexToTimestamp(day, minSlot);
    const endAt = slotIndexToTimestamp(day, maxSlot + 1);
    onRangeSelect(startAt, endAt);
    setDrag(null);
  };

  const handleSlotPointerDown = (dayIndex: number, slotIndex: number) => {
    setDrag({ dayIndex, startSlot: slotIndex, endSlot: slotIndex });
  };

  const handleSlotPointerEnter = (dayIndex: number, slotIndex: number) => {
    if (!drag || drag.dayIndex !== dayIndex) return;
    setDrag({ ...drag, endSlot: slotIndex });
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[320px]">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div />
          {days.map((day) => {
            const isToday = new Date().toDateString() === day.toDateString();
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "text-center text-xs font-medium",
                  isToday ? "text-primary-600" : "text-navy-700",
                )}
              >
                <div>{["일", "월", "화", "수", "목", "금", "토"][day.getDay()]}</div>
                <div className={cn("text-sm", isToday && "font-bold")}>{day.getDate()}</div>
              </div>
            );
          })}

          <div className="relative">
            {hours.map((h) => (
              <div
                key={h}
                className="pr-1 text-right text-[10px] text-navy-500"
                style={{ height: SLOT_HEIGHT * SLOTS_PER_HOUR }}
              >
                {formatHourLabel(h)}
              </div>
            ))}
          </div>

          {days.map((day, dayIndex) => {
            const dayEvents = eventsForDay(events, day).filter((e) => !e.allDay);
            return (
              <div
                key={day.toISOString()}
                ref={dayIndex === 0 ? gridRef : undefined}
                className="relative rounded-lg border border-sky-100/80 bg-white/40"
                style={{ height: slotsCount * SLOT_HEIGHT }}
                onPointerLeave={() => {
                  if (drag?.dayIndex === dayIndex) finishDrag(drag);
                }}
                onPointerUp={() => {
                  if (drag?.dayIndex === dayIndex) finishDrag(drag);
                }}
              >
                {Array.from({ length: slotsCount }).map((_, slotIndex) => {
                  const isSelected =
                    drag?.dayIndex === dayIndex &&
                    slotIndex >= Math.min(drag.startSlot, drag.endSlot) &&
                    slotIndex <= Math.max(drag.startSlot, drag.endSlot);
                  return (
                    <div
                      key={slotIndex}
                      className={cn(
                        "absolute inset-x-0 border-t border-sky-50/80",
                        isSelected && "bg-primary-400/20",
                        slotIndex % SLOTS_PER_HOUR === 0 && "border-sky-100",
                      )}
                      style={{
                        top: slotIndex * SLOT_HEIGHT,
                        height: SLOT_HEIGHT,
                      }}
                      onPointerDown={() => handleSlotPointerDown(dayIndex, slotIndex)}
                      onPointerEnter={() => handleSlotPointerEnter(dayIndex, slotIndex)}
                    />
                  );
                })}

                {dayEvents.map((event) => {
                  const style = eventBlockStyle(event.startAt, event.endAt, day, SLOT_HEIGHT);
                  return (
                    <CalendarEventTrigger
                      key={event.id}
                      event={event}
                      day={day}
                      variant="block"
                      label={isPersonalGoogleEvent(event) ? `개인 ${event.title}` : event.title}
                      onClick={() => onEventClick(event, day)}
                      style={{ top: style.top, height: style.height, minHeight: SLOT_HEIGHT }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-center text-[10px] text-navy-500">
          빈 칸을 드래그하여 일정 시간을 선택하세요 ({SLOT_MINUTES}분 단위)
        </p>
      </div>
    </div>
  );
}

export function getDefaultRangeFromSlot(day: Date, startAt: number, endAt: number) {
  const startSlot = timestampToSlotIndex(startAt, day);
  const endSlot = timestampToSlotIndex(endAt, day);
  if (endSlot <= startSlot) {
    return {
      start: slotIndexToTimestamp(day, startSlot),
      end: slotIndexToTimestamp(day, startSlot + 2),
    };
  }
  return { start: startAt, end: endAt };
}
