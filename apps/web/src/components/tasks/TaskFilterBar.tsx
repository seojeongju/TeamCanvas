import type { CSSProperties, ReactNode } from "react";
import { AlertTriangle, RotateCcw, Tag, User, Users } from "lucide-react";
import { cn } from "../../lib/cn";
import type { TaskFilters, TaskLabel, Team } from "../../lib/types";

const SCROLL =
  "flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

interface TaskFilterBarProps {
  filters: TaskFilters;
  teams: Team[];
  labels?: TaskLabel[];
  onChange: (filters: TaskFilters) => void;
}

function FilterChip({
  active,
  onClick,
  children,
  className,
  style,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium transition",
        active
          ? "bg-primary-400 text-white shadow-glow"
          : "bg-white/90 text-navy-700 ring-1 ring-sky-100 hover:bg-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TaskFilterBar({ filters, teams, labels = [], onChange }: TaskFilterBarProps) {
  const mine = filters.assignee === "me";
  const hasActiveFilter =
    filters.assignee === "me" || filters.overdue || !!filters.teamId || !!filters.labelId;

  return (
    <div className="space-y-2.5">
      <div className={SCROLL}>
        <FilterChip
          active={mine}
          onClick={() => onChange({ ...filters, assignee: mine ? "all" : "me" })}
        >
          <User className="h-3.5 w-3.5" />
          내 업무
        </FilterChip>
        <FilterChip
          active={!!filters.overdue}
          onClick={() => onChange({ ...filters, overdue: !filters.overdue })}
          className={filters.overdue ? "!bg-red-500 !text-white !shadow-none" : undefined}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          지연
        </FilterChip>

        {teams.length > 0 && (
          <>
            <span className="mx-0.5 w-px shrink-0 self-center bg-sky-200/80" aria-hidden />
            <FilterChip
              active={!filters.teamId}
              onClick={() => onChange({ ...filters, teamId: undefined })}
              className={!filters.teamId ? "!bg-navy-800 !text-white !shadow-none" : undefined}
            >
              <Users className="h-3.5 w-3.5" />
              전체 팀
            </FilterChip>
            {teams.map((team) => (
              <FilterChip
                key={team.id}
                active={filters.teamId === team.id}
                onClick={() =>
                  onChange({
                    ...filters,
                    teamId: filters.teamId === team.id ? undefined : team.id,
                  })
                }
              >
                {team.name}
              </FilterChip>
            ))}
          </>
        )}

        {labels.length > 0 && (
          <>
            <span className="mx-0.5 w-px shrink-0 self-center bg-sky-200/80" aria-hidden />
            <FilterChip
              active={!filters.labelId}
              onClick={() => onChange({ ...filters, labelId: undefined })}
              className={!filters.labelId ? "!bg-violet-600 !text-white !shadow-none" : undefined}
            >
              <Tag className="h-3.5 w-3.5" />
              전체 라벨
            </FilterChip>
            {labels.map((label) => (
              <FilterChip
                key={label.id}
                active={filters.labelId === label.id}
                onClick={() =>
                  onChange({
                    ...filters,
                    labelId: filters.labelId === label.id ? undefined : label.id,
                  })
                }
                style={filters.labelId === label.id ? { backgroundColor: label.color } : undefined}
                className={
                  filters.labelId === label.id ? "!text-white !shadow-sm !ring-0" : undefined
                }
              >
                {label.name}
              </FilterChip>
            ))}
          </>
        )}

        {hasActiveFilter && (
          <>
            <span className="mx-0.5 w-px shrink-0 self-center bg-sky-200/80" aria-hidden />
            <FilterChip active={false} onClick={() => onChange({ assignee: "all" })}>
              <RotateCcw className="h-3.5 w-3.5" />
              초기화
            </FilterChip>
          </>
        )}
      </div>
    </div>
  );
}
