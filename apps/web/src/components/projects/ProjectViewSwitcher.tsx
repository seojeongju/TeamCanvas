import { LayoutGrid, List } from "lucide-react";
import { cn } from "../../lib/cn";
import type { ProjectViewMode } from "../../lib/projectUtils";

type Props = {
  value: ProjectViewMode;
  onChange: (mode: ProjectViewMode) => void;
};

export function ProjectViewSwitcher({ value, onChange }: Props) {
  return (
    <div className="flex rounded-xl bg-white/60 p-0.5 ring-1 ring-sky-100/80">
      <button
        type="button"
        onClick={() => onChange("list")}
        className={cn(
          "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
          value === "list" ? "bg-white text-primary-700 shadow-sm" : "text-navy-600",
        )}
      >
        <List className="h-3.5 w-3.5" />
        목록
      </button>
      <button
        type="button"
        onClick={() => onChange("board")}
        className={cn(
          "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
          value === "board" ? "bg-white text-primary-700 shadow-sm" : "text-navy-600",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        보드
      </button>
    </div>
  );
}
