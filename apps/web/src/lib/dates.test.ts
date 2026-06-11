import { describe, expect, it } from "vitest";
import {
  eventIncludesCalendarDay,
  formatEventTimeRange,
  formatRecurrenceRule,
  getAllDayInclusiveEndKey,
  normalizeTimedEventEnd,
  toDateLocal,
} from "./dates";

describe("dates", () => {
  it("formats recurrence labels", () => {
    expect(formatRecurrenceRule("FREQ=WEEKLY")).toBe("매주");
    expect(formatRecurrenceRule(null)).toBeNull();
  });

  it("all-day inclusive end key", () => {
    const start = new Date("2026-06-10T00:00:00").getTime();
    const endExclusive = new Date("2026-06-12T00:00:00").getTime();
    expect(getAllDayInclusiveEndKey(start, endExclusive)).toBe("2026-06-11");

    const endInclusive = new Date("2026-06-12T23:59:59").getTime();
    expect(getAllDayInclusiveEndKey(start, endInclusive)).toBe("2026-06-12");
  });

  it("eventIncludesCalendarDay respects excluded dates", () => {
    const start = new Date("2026-06-10T00:00:00").getTime();
    const end = new Date("2026-06-12T23:59:59").getTime();
    const day = new Date("2026-06-11T12:00:00");
    expect(
      eventIncludesCalendarDay(
        { startAt: start, endAt: end, allDay: true, excludedDates: ["2026-06-11"] },
        day,
      ),
    ).toBe(false);
    expect(
      eventIncludesCalendarDay({ startAt: start, endAt: end, allDay: true }, day),
    ).toBe(true);
  });

  it("toDateLocal", () => {
    expect(toDateLocal(new Date("2026-06-09T15:00:00").getTime())).toMatch(/2026-06-09/);
  });

  it("formatEventTimeRange shows same-day 1 hour span", () => {
    const start = new Date("2026-06-11T15:00:00").getTime();
    const end = new Date("2026-06-11T16:00:00").getTime();
    expect(formatEventTimeRange(start, end)).toBe("15:00 - 16:00");
  });

  it("formatEventTimeRange shows 24:00 for next-day midnight end", () => {
    const start = new Date("2026-06-11T15:00:00").getTime();
    const end = new Date("2026-06-12T00:00:00").getTime();
    expect(formatEventTimeRange(start, end)).toBe("15:00 - 24:00");
  });

  it("normalizeTimedEventEnd aligns end date drift within 24h", () => {
    const start = new Date("2026-06-11T15:00:00").getTime();
    const end = new Date("2026-06-12T16:00:00").getTime();
    expect(normalizeTimedEventEnd(start, end)).toBe(new Date("2026-06-11T16:00:00").getTime());
  });
});
