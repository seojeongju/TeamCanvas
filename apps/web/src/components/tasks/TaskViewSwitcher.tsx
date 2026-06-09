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
    <div className="flex rounded-2xl bg-sky-100/60 p-1" role="tablist" aria-label="보기 방식">
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
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition sm:text-sm",
              active ? "bg-white text-navy-900 shadow-sm" : "text-navy-600 hover:text-navy-800",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
