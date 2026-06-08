import { cn } from "../../lib/cn";
import type { CalendarViewMode } from "../../lib/calendarUtils";

const VIEWS: { id: CalendarViewMode; label: string }[] = [
  { id: "month", label: "월" },
  { id: "week", label: "주" },
  { id: "day", label: "일" },
  { id: "agenda", label: "아젠다" },
];

export function CalendarViewSwitcher({
  value,
  onChange,
}: {
  value: CalendarViewMode;
  onChange: (mode: CalendarViewMode) => void;
}) {
  return (
    <div className="flex rounded-xl bg-sky-100/50 p-1">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onChange(v.id)}
          className={cn(
            "flex-1 rounded-lg py-2 text-xs font-medium transition sm:text-sm",
            value === v.id ? "bg-white text-navy-900 shadow-sm" : "text-navy-600 hover:text-navy-800",
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
