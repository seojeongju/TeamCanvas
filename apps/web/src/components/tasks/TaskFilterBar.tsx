import type { ReactNode } from "react";
import { AlertTriangle, ChevronDown, RotateCcw } from "lucide-react";
import { TaskSavedFiltersMenu } from "./TaskSavedFiltersMenu";
import { cn } from "../../lib/cn";
import type { WorkScopeMode } from "../../lib/workScope";
import type { Project, TaskFilters, TaskLabel, Team } from "../../lib/types";

interface TaskFilterBarProps {
  filters: TaskFilters;
  scopeMode: WorkScopeMode;
  teams: Team[];
  projects?: Project[];
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
  emphasize,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  emphasize?: boolean;
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
          active || emphasize
            ? "bg-primary-400/10 text-primary-700 ring-primary-200"
            : "bg-white/80 text-navy-700",
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

/**
 * 범위 필터 — 지연/팀/프로젝트/라벨.
 * 전체·내 업무·팀별 전환은 ScopeModeSwitcher에서 담당.
 */
export function TaskFilterBar({
  filters,
  scopeMode,
  teams,
  projects = [],
  labels = [],
  onChange,
}: TaskFilterBarProps) {
  const hasActiveFilter =
    filters.overdue ||
    filters.dueToday ||
    !!filters.teamId ||
    !!filters.projectId ||
    !!filters.labelId ||
    !!filters.status;

  const teamPlaceholder =
    scopeMode === "team" ? (filters.teamId ? "선택한 팀" : "소속 팀 전체") : "전체 팀";

  return (
    <div className="space-y-1.5">
      <p className="px-0.5 text-[10px] font-medium text-navy-400">
        {scopeMode === "mine"
          ? "내 업무 추가 필터"
          : scopeMode === "team"
            ? "팀별 추가 필터"
            : "범위 필터"}
      </p>
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            placeholder={teamPlaceholder}
            emphasize={scopeMode === "team"}
            options={teams.map((t) => ({ value: t.id, label: t.name }))}
            onChange={(teamId) =>
              onChange({
                ...filters,
                teamId: teamId || undefined,
                scopeTeamIds: scopeMode === "team" && !teamId ? filters.scopeTeamIds : undefined,
              })
            }
          />
        )}

        {projects.length > 0 && (
          <FilterSelect
            value={filters.projectId ?? ""}
            placeholder="전체 프로젝트"
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            onChange={(projectId) => onChange({ ...filters, projectId: projectId || undefined })}
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
            onClick={() =>
              onChange({
                assignee: filters.assignee,
                scopeTeamIds: filters.scopeTeamIds,
              })
            }
            className="inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-medium text-navy-500 transition hover:bg-sky-50 hover:text-navy-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            초기화
          </button>
        )}

        <TaskSavedFiltersMenu filters={filters} onApply={onChange} />
      </div>
    </div>
  );
}
