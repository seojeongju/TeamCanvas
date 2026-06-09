import { Columns3, List } from "lucide-react";
import { cn } from "../../lib/cn";
import type { TaskViewMode } from "../../lib/types";

const VIEWS: { id: TaskViewMode; label: string; icon: typeof List }[] = [
  { id: "list", label: "리스트", icon: List },
  { id: "board", label: "칸반", icon: Columns3 },
];

export function TaskViewSwitcher({
  value,
  onChange,
}: {
  value: TaskViewMode;
  onChange: (mode: TaskViewMode) => void;
}) {
  return (
    <div
      className="inline-flex rounded-xl bg-sky-100/50 p-0.5"
      role="tablist"
      aria-label="보기 방식"
    >
      {VIEWS.map((v) => {
        const Icon = v.icon;
        const active = value === v.id;
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v.id)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              active ? "bg-white text-navy-900 shadow-sm" : "text-navy-500 hover:text-navy-700",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
