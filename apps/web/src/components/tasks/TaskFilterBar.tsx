import type { ReactNode } from "react";
import { AlertTriangle, ChevronDown, RotateCcw, User } from "lucide-react";
import { cn } from "../../lib/cn";
import type { TaskFilters, TaskLabel, Team } from "../../lib/types";

interface TaskFilterBarProps {
  filters: TaskFilters;
  teams: Team[];
  labels?: TaskLabel[];
  onChange: (filters: TaskFilters) => void;
}

function QuickChip({
  active,
  onClick,
  children,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  activeClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition",
        active
          ? cn("bg-primary-400 text-white shadow-sm", activeClass)
          : "bg-white/80 text-navy-700 ring-1 ring-sky-100/90 hover:bg-white",
      )}
    >
      {children}
    </button>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  const active = value !== "";
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "appearance-none rounded-xl py-2 pl-3 pr-8 text-xs font-medium transition",
          "ring-1 ring-sky-100/90 focus:outline-none focus:ring-2 focus:ring-primary-300/60",
          active ? "bg-primary-400/10 text-primary-700 ring-primary-200" : "bg-white/80 text-navy-700",
        )}
        aria-label={placeholder}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-navy-400"
        strokeWidth={2}
      />
    </div>
  );
}

export function TaskFilterBar({ filters, teams, labels = [], onChange }: TaskFilterBarProps) {
  const mine = filters.assignee === "me";
  const hasActiveFilter =
    filters.assignee === "me" ||
    filters.overdue ||
    filters.dueToday ||
    !!filters.teamId ||
    !!filters.labelId ||
    !!filters.status;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <QuickChip
        active={mine}
        onClick={() => onChange({ ...filters, assignee: mine ? "all" : "me" })}
      >
        <User className="h-3.5 w-3.5" />
        내 업무
      </QuickChip>

      <QuickChip
        active={!!filters.overdue}
        activeClass="!bg-red-500"
        onClick={() =>
          onChange({ ...filters, overdue: !filters.overdue, dueToday: false })
        }
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        지연
      </QuickChip>

      {teams.length > 0 && (
        <FilterSelect
          value={filters.teamId ?? ""}
          placeholder="전체 팀"
          options={teams.map((t) => ({ value: t.id, label: t.name }))}
          onChange={(teamId) => onChange({ ...filters, teamId: teamId || undefined })}
        />
      )}

      {labels.length > 0 && (
        <FilterSelect
          value={filters.labelId ?? ""}
          placeholder="전체 라벨"
          options={labels.map((l) => ({ value: l.id, label: l.name }))}
          onChange={(labelId) => onChange({ ...filters, labelId: labelId || undefined })}
        />
      )}

      {hasActiveFilter && (
        <button
          type="button"
          onClick={() => onChange({ assignee: "all" })}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-medium text-navy-500 transition hover:bg-sky-50 hover:text-navy-700"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          초기화
        </button>
      )}
    </div>
  );
}
