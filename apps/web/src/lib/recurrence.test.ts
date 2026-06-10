import { describe, expect, it } from "vitest";
import { expandRecurrence, parseRecurrenceFreq } from "./recurrence";
import type { CalendarEvent } from "./types";

function baseEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    title: "주간 회의",
    startAt: new Date("2026-06-02T10:00:00").getTime(),
    endAt: new Date("2026-06-02T11:00:00").getTime(),
    allDay: false,
    recurrenceRule: "FREQ=WEEKLY",
    color: "#4A9FE8",
    teamName: "팀",
    time: "",
    ...overrides,
  };
}

describe("parseRecurrenceFreq", () => {
  it("parses weekly rule", () => {
    expect(parseRecurrenceFreq("FREQ=WEEKLY")).toBe("WEEKLY");
  });

  it("returns null for empty", () => {
    expect(parseRecurrenceFreq(null)).toBeNull();
  });
});

describe("expandRecurrence", () => {
  it("expands weekly occurrences in range", () => {
    const event = baseEvent();
    const rangeStart = new Date("2026-06-01T00:00:00").getTime();
    const rangeEnd = new Date("2026-06-30T23:59:59").getTime();
    const result = expandRecurrence(event, rangeStart, rangeEnd);
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result.every((o) => o.parentEventId === "evt-1")).toBe(true);
    expect(result[0].id).toContain("evt-1::");
  });

  it("skips excluded dates for all-day series", () => {
    const start = new Date("2026-06-10T00:00:00").getTime();
    const end = new Date("2026-06-12T00:00:00").getTime();
    const event = baseEvent({
      allDay: true,
      startAt: start,
      endAt: end,
      recurrenceRule: "FREQ=DAILY",
      excludedDates: ["2026-06-11"],
    });
    const rangeStart = new Date("2026-06-10T00:00:00").getTime();
    const rangeEnd = new Date("2026-06-14T23:59:59").getTime();
    const dates = expandRecurrence(event, rangeStart, rangeEnd).map((o) => o.occurrenceDate);
    expect(dates).not.toContain("2026-06-11");
    expect(dates).toContain("2026-06-10");
  });

  it("returns single event when no recurrence", () => {
    const event = baseEvent({ recurrenceRule: null });
    const result = expandRecurrence(event, event.startAt, event.endAt);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("evt-1");
  });
});
