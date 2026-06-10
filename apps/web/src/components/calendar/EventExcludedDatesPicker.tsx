import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { getMonthWeeks } from "../../lib/calendarUtils";
import { toDateLocal } from "../../lib/dates";
import {
  enumerateDateKeysInAllDayRange,
  isMultiDayAllDayRange,
} from "../../lib/eventExcludedDates";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

type DayState = "outside" | "boundary" | "excluded" | "included";

function monthsInRange(startDate: string, endDate: string): { year: number; month: number }[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const months: { year: number; month: number }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endMonth) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function monthIndexForDate(
  months: { year: number; month: number }[],
  dateKey: string,
): number {
  const d = new Date(`${dateKey}T00:00:00`);
  const idx = months.findIndex((m) => m.year === d.getFullYear() && m.month === d.getMonth());
  return idx >= 0 ? idx : 0;
}

function dayState(
  key: string,
  startDate: string,
  endDate: string,
  excludedSet: Set<string>,
): DayState {
  if (key < startDate || key > endDate) return "outside";
  if (key === startDate || key === endDate) return "boundary";
  if (excludedSet.has(key)) return "excluded";
  return "included";
}

function formatMonthLabel(year: number, month: number): string {
  return `${year}년 ${month + 1}월`;
}

export function EventExcludedDatesPicker({
  startDate,
  endDate,
  excludedDates,
  onChange,
  highlightDate,
}: {
  startDate: string;
  endDate: string;
  excludedDates: string[];
  onChange: (dates: string[]) => void;
  /** 캘린더에서 클릭한 날짜 — 강조 */
  highlightDate?: string;
}) {
  const excludedSet = useMemo(() => new Set(excludedDates), [excludedDates]);

  const months = useMemo(
    () => monthsInRange(startDate, endDate),
    [startDate, endDate],
  );

  const [monthIndex, setMonthIndex] = useState(0);

  useEffect(() => {
    const anchor = highlightDate ?? startDate;
    setMonthIndex(monthIndexForDate(months, anchor));
  }, [startDate, endDate, highlightDate, months]);

  if (!isMultiDayAllDayRange(startDate, endDate)) return null;

  const days = enumerateDateKeysInAllDayRange(startDate, endDate);
  const includedCount = days.length - excludedDates.length;
  const current = months[monthIndex] ?? months[0];
  const canGoPrev = monthIndex > 0;
  const canGoNext = monthIndex < months.length - 1;

  const toggle = (key: string) => {
    if (key === startDate || key === endDate) return;
    if (excludedSet.has(key)) {
      onChange(excludedDates.filter((d) => d !== key));
    } else {
      onChange([...excludedDates, key].sort());
    }
  };

  const weeks = current ? getMonthWeeks(current.year, current.month) : [];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-navy-800">제외할 날짜</p>
          <p className="mt-0.5 text-xs text-navy-500">
            날짜를 눌러 제외·포함을 전환하세요. 시작·종료일은 고정입니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] text-navy-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 ring-1 ring-sky-200">
            <span className="h-2 w-2 rounded-full bg-primary-400" />
            포함
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 ring-1 ring-sky-200">
            <span className="h-2 w-2 rounded-full bg-navy-300" />
            제외
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 ring-1 ring-sky-200">
            <span className="h-2 w-2 rounded-full ring-2 ring-primary-300" />
            시작·종료
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-sky-200/80 bg-white/90 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMonthIndex((i) => Math.max(0, i - 1))}
            disabled={!canGoPrev}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition",
              canGoPrev
                ? "text-navy-700 hover:bg-sky-100/80"
                : "cursor-not-allowed text-navy-300",
            )}
            aria-label="이전 달"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="text-center">
            <p className="text-sm font-semibold text-navy-800">
              {current ? formatMonthLabel(current.year, current.month) : ""}
            </p>
            {months.length > 1 && (
              <p className="text-[10px] text-navy-500">
                {monthIndex + 1} / {months.length}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMonthIndex((i) => Math.min(months.length - 1, i + 1))}
            disabled={!canGoNext}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition",
              canGoNext
                ? "text-navy-700 hover:bg-sky-100/80"
                : "cursor-not-allowed text-navy-300",
            )}
            aria-label="다음 달"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {current && (
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((label, i) => (
              <div
                key={label}
                className={cn(
                  "pb-1 text-[10px] font-medium",
                  i === 0 ? "text-red-500" : i === 6 ? "text-primary-500" : "text-navy-500",
                )}
              >
                {label}
              </div>
            ))}
            {weeks.flat().map((day) => {
              const key = toDateLocal(day.getTime());
              const state = dayState(key, startDate, endDate, excludedSet);
              const inMonth = day.getMonth() === current.month;
              const dayNum = day.getDate();
              const isHighlighted = highlightDate === key;
              const clickable = state === "included" || state === "excluded";

              return (
                <button
                  key={`${current.year}-${current.month}-${key}`}
                  type="button"
                  disabled={!clickable}
                  onClick={() => toggle(key)}
                  className={cn(
                    "relative flex h-9 items-center justify-center rounded-xl text-sm transition",
                    !inMonth && "opacity-30",
                    state === "outside" && "cursor-default text-navy-300",
                    state === "boundary" &&
                      "cursor-default bg-primary-50 font-semibold text-primary-700 ring-2 ring-primary-300/60",
                    state === "included" &&
                      "bg-sky-50/80 font-medium text-navy-800 hover:bg-primary-100/60 hover:ring-1 hover:ring-primary-300/50",
                    state === "excluded" &&
                      "bg-navy-100/80 font-medium text-navy-400 line-through hover:bg-navy-200/60",
                    isHighlighted &&
                      state !== "boundary" &&
                      "ring-2 ring-amber-400 ring-offset-1",
                  )}
                  title={
                    state === "boundary"
                      ? "시작·종료일은 제외할 수 없습니다"
                      : state === "excluded"
                        ? "클릭하면 일정에 포함"
                        : state === "included"
                          ? "클릭하면 이 날 제외"
                          : undefined
                  }
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-navy-600">
        전체 <span className="font-medium text-navy-800">{days.length}일</span>
        {" · "}
        포함 <span className="font-medium text-primary-600">{includedCount}일</span>
        {excludedDates.length > 0 && (
          <>
            {" · "}
            제외 <span className="font-medium text-navy-500">{excludedDates.length}일</span>
          </>
        )}
      </p>
    </div>
  );
}
