import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";
import {
  enumerateDateKeysInAllDayRange,
  isMultiDayAllDayRange,
} from "../../lib/eventExcludedDates";

function formatDayChip(key: string): string {
  const [, m, d] = key.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function EventExcludedDatesPicker({
  startDate,
  endDate,
  excludedDates,
  onChange,
  highlightDate,
  mode = "toggle",
}: {
  startDate: string;
  endDate: string;
  excludedDates: string[];
  onChange: (dates: string[]) => void;
  /** 캘린더에서 클릭한 날짜 — 선택·강조 */
  highlightDate?: string;
  /** toggle: 탭으로 즉시 전환, select: 날짜 선택 후 제외/해제 버튼 */
  mode?: "toggle" | "select";
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(highlightDate ?? null);

  useEffect(() => {
    if (highlightDate) setSelectedDate(highlightDate);
  }, [highlightDate]);

  if (!isMultiDayAllDayRange(startDate, endDate)) return null;

  const days = enumerateDateKeysInAllDayRange(startDate, endDate);
  const excludedSet = new Set(excludedDates);

  const toggle = (key: string) => {
    if (key === startDate || key === endDate) return;
    if (excludedSet.has(key)) {
      onChange(excludedDates.filter((d) => d !== key));
    } else {
      onChange([...excludedDates, key].sort());
    }
  };

  const addExclusion = () => {
    if (!selectedDate || selectedDate === startDate || selectedDate === endDate) return;
    if (excludedSet.has(selectedDate)) return;
    onChange([...excludedDates, selectedDate].sort());
  };

  const removeExclusion = () => {
    if (!selectedDate) return;
    onChange(excludedDates.filter((d) => d !== selectedDate));
  };

  const selectedExcluded = selectedDate ? excludedSet.has(selectedDate) : false;
  const canActOnSelected =
    !!selectedDate && selectedDate !== startDate && selectedDate !== endDate;

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-navy-700">제외할 날짜</p>
      <p className="mb-2 text-xs text-navy-500">
        {mode === "select"
          ? "날짜를 선택한 뒤 제외 추가·해제를 누르세요. 시작일·종료일은 제외할 수 없습니다."
          : "휴가·출장 등 기간 중 쉬는 날을 탭해 제외하세요. 시작일·종료일은 제외할 수 없습니다."}
      </p>
      <div className="flex flex-wrap gap-2">
        {days.map((key) => {
          const isBoundary = key === startDate || key === endDate;
          const excluded = excludedSet.has(key);
          const isSelected = selectedDate === key;
          const isHighlighted = highlightDate === key && !isSelected;

          return (
            <button
              key={key}
              type="button"
              disabled={mode === "toggle" && isBoundary}
              onClick={() => {
                if (mode === "select") {
                  setSelectedDate(key);
                  return;
                }
                toggle(key);
              }}
              className={cn(
                "rounded-xl px-3 py-1.5 text-sm font-medium transition",
                isBoundary
                  ? "cursor-default bg-sky-50 text-navy-400"
                  : excluded
                    ? "bg-navy-100 text-navy-400 line-through"
                    : "bg-sky-100/60 text-navy-700 hover:bg-sky-100",
                isSelected && "ring-2 ring-primary-400 ring-offset-1",
                isHighlighted && !excluded && "ring-2 ring-primary-300/80 ring-offset-1",
              )}
              title={
                isBoundary
                  ? "시작·종료일은 제외할 수 없습니다"
                  : mode === "select"
                    ? excluded
                      ? "제외된 날짜"
                      : "날짜 선택"
                    : excluded
                      ? "포함으로 되돌리기"
                      : "이 날 제외"
              }
            >
              {formatDayChip(key)}
            </button>
          );
        })}
      </div>

      {mode === "select" && canActOnSelected && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!selectedExcluded ? (
            <Button type="button" className="!min-h-9 !px-4 !py-2 text-sm" onClick={addExclusion}>
              이 날 제외 추가
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="!min-h-9 !px-4 !py-2 text-sm"
              onClick={removeExclusion}
            >
              제외 해제
            </Button>
          )}
        </div>
      )}

      {excludedDates.length > 0 && (
        <p className="mt-2 text-xs text-primary-600">
          {excludedDates.length}일 제외 · 실제 {days.length - excludedDates.length}일
        </p>
      )}
    </div>
  );
}
