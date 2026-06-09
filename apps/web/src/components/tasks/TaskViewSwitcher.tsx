import { cn } from "../../lib/cn";
import type { TaskViewMode } from "../../lib/types";

const VIEWS: { id: TaskViewMode; label: string }[] = [
  { id: "list", label: "리스트" },
  { id: "board", label: "칸반" },
];

export function TaskViewSwitcher({
  value,
  onChange,
}: {
  value: TaskViewMode;
  onChange: (mode: TaskViewMode) => void;
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
