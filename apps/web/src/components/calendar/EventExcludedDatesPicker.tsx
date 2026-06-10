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
}: {
  startDate: string;
  endDate: string;
  excludedDates: string[];
  onChange: (dates: string[]) => void;
}) {
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

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-navy-700">제외할 날짜</p>
      <p className="mb-2 text-xs text-navy-500">
        휴가·출장 등 기간 중 쉬는 날을 탭해 제외하세요. 시작일·종료일은 제외할 수 없습니다.
      </p>
      <div className="flex flex-wrap gap-2">
        {days.map((key) => {
          const isBoundary = key === startDate || key === endDate;
          const excluded = excludedSet.has(key);
          return (
            <button
              key={key}
              type="button"
              disabled={isBoundary}
              onClick={() => toggle(key)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-sm font-medium transition",
                isBoundary
                  ? "cursor-not-allowed bg-sky-50 text-navy-400"
                  : excluded
                    ? "bg-navy-100 text-navy-400 line-through"
                    : "bg-sky-100/60 text-navy-700 hover:bg-sky-100",
              )}
              title={isBoundary ? "시작·종료일은 제외할 수 없습니다" : excluded ? "포함으로 되돌리기" : "이 날 제외"}
            >
              {formatDayChip(key)}
            </button>
          );
        })}
      </div>
      {excludedDates.length > 0 && (
        <p className="mt-2 text-xs text-primary-600">
          {excludedDates.length}일 제외 · 실제 {days.length - excludedDates.length}일
        </p>
      )}
    </div>
  );
}
