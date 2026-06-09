import { cn } from "../../lib/cn";
import type { TaskFilters } from "../../lib/types";
import type { Team } from "../../lib/types";

interface TaskFilterBarProps {
  filters: TaskFilters;
  teams: Team[];
  onChange: (filters: TaskFilters) => void;
}

export function TaskFilterBar({ filters, teams, onChange }: TaskFilterBarProps) {
  const mine = filters.assignee === "me";
  const hasActiveFilter =
    filters.assignee === "me" || filters.overdue || !!filters.teamId;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...filters, assignee: mine ? "all" : "me" })}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition",
            mine ? "bg-primary-400 text-white shadow-glow" : "bg-white/80 text-navy-700 hover:bg-white",
          )}
        >
          내 업무만
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...filters, overdue: !filters.overdue })}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition",
            filters.overdue ? "bg-red-500 text-white" : "bg-white/80 text-navy-700 hover:bg-white",
          )}
        >
          지연만
        </button>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => onChange({ assignee: "all" })}
            className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-medium text-navy-600"
          >
            필터 초기화
          </button>
        )}
      </div>

      {teams.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onChange({ ...filters, teamId: undefined })}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
              !filters.teamId
                ? "bg-navy-800 text-white"
                : "bg-white/80 text-navy-700 hover:bg-white",
            )}
          >
            전체 팀
          </button>
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() =>
                onChange({
                  ...filters,
                  teamId: filters.teamId === team.id ? undefined : team.id,
                })
              }
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                filters.teamId === team.id
                  ? "bg-primary-400 text-white shadow-glow"
                  : "bg-white/80 text-navy-700 hover:bg-white",
              )}
            >
              {team.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
