import type { OrgHoliday } from "./types";

export function holidaysForDay(
  year: number,
  month: number,
  day: number,
  holidays: OrgHoliday[],
): OrgHoliday[] {
  const md = `${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const ymd = `${year}-${md}`;
  return holidays.filter((h) => {
    if (h.yearly) return h.date === md || h.date.endsWith(`-${md}`);
    return h.date === ymd;
  });
}
