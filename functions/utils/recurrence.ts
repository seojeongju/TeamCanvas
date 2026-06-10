import { toDateLocal } from "./helpers";

export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY";

const MAX_OCCURRENCES = 366;
const MAX_HORIZON_MS = 366 * 24 * 60 * 60 * 1000;

export function parseRecurrenceFreq(rule: string | null | undefined): RecurrenceFreq | null {
  if (!rule) return null;
  const match = rule.toUpperCase().match(/FREQ=(DAILY|WEEKLY|MONTHLY)/);
  return (match?.[1] as RecurrenceFreq | undefined) ?? null;
}

function advanceOccurrenceStart(startAt: number, freq: RecurrenceFreq): number {
  const d = new Date(startAt);
  if (freq === "DAILY") d.setDate(d.getDate() + 1);
  else if (freq === "WEEKLY") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.getTime();
}

/** 반복 일정 리마인더용 occurrence 시작 시각 목록 */
export function recurrenceOccurrenceStarts(
  startAt: number,
  recurrenceRule: string | null | undefined,
  excludedDates: string[] | undefined,
  fromTs: number,
  toTs: number,
): number[] {
  const freq = parseRecurrenceFreq(recurrenceRule);
  if (!freq) return startAt >= fromTs && startAt <= toTs ? [startAt] : [];

  const excluded = new Set(excludedDates ?? []);
  const starts: number[] = [];
  let cursor = startAt;
  let count = 0;
  const horizonEnd = Math.min(toTs, startAt + MAX_HORIZON_MS);

  while (cursor <= horizonEnd && count < MAX_OCCURRENCES) {
    const dateKey = toDateLocal(cursor);
    if (cursor >= fromTs && cursor <= toTs && !excluded.has(dateKey)) {
      starts.push(cursor);
    }
    const next = advanceOccurrenceStart(cursor, freq);
    if (next <= cursor) break;
    cursor = next;
    count++;
  }

  return starts;
}
