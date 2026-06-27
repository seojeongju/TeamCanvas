import { RotateCcw } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { cn } from "../../lib/cn";
import { PROJECT_STATUS_OPTIONS } from "../../lib/projectUtils";
import { taskStatusLabel } from "../../lib/statusVisuals";
import { TASK_COLUMNS } from "../../lib/taskUtils";
import type {
  DashboardProjectFilter,
  DashboardStatusFilters,
  DashboardTaskFilter,
} from "../../lib/dashboardStatusFilters";
import type { TaskStatus } from "../../lib/types";

type ChipProps = {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  activeClass?: string;
};

function FilterChip({ active, onClick, label, count, activeClass }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition",
        active
          ? cn("bg-primary-400 text-white shadow-sm", activeClass)
          : "bg-white/80 text-navy-700 ring-1 ring-sky-100/90 hover:bg-white",
      )}
    >
      {label}
      {count != null && (
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[10px] tabular-nums",
            active ? "bg-white/20" : "bg-sky-50 text-navy-500",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

const TASK_FILTER_OPTIONS: { id: DashboardTaskFilter; label: string }[] = [
  { id: "all", label: "전체" },
  ...TASK_COLUMNS.map((c) => ({ id: c.id as DashboardTaskFilter, label: c.label })),
  { id: "overdue", label: "지연" },
];

const PROJECT_FILTER_OPTIONS: { id: DashboardProjectFilter; label: string }[] = [
  { id: "all", label: "전체" },
  ...PROJECT_STATUS_OPTIONS.filter((o) => o.value !== "archived").map((o) => ({
    id: o.value as DashboardProjectFilter,
    label: o.label,
  })),
];

type Props = {
  filters: DashboardStatusFilters;
  taskCounts: Record<DashboardTaskFilter, number>;
  projectCounts: Record<DashboardProjectFilter, number>;
  onChange: (filters: DashboardStatusFilters) => void;
};

export function DashboardStatusFilterBar({ filters, taskCounts, projectCounts, onChange }: Props) {
  const hasActive =
    filters.task !== "all" || filters.project !== "all";

  const setTask = (task: DashboardTaskFilter) => {
    onChange({ ...filters, task });
  };

  const setProject = (project: DashboardProjectFilter) => {
    onChange({ ...filters, project });
  };

  return (
    <GlassCard className="space-y-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-navy-700">상태 필터</p>
        {hasActive && (
          <button
            type="button"
            onClick={() => onChange({ task: "all", project: "all" })}
            className="inline-flex items-center gap-1 text-xs font-medium text-navy-500 hover:text-navy-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            초기화
          </button>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-navy-400">내 업무</p>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TASK_FILTER_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.id}
              active={filters.task === opt.id}
              onClick={() => setTask(opt.id)}
              label={opt.id === "all" ? opt.label : taskStatusLabel(opt.id as TaskStatus)}
              count={taskCounts[opt.id]}
              activeClass={opt.id === "overdue" ? "!bg-red-500" : undefined}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-navy-400">프로젝트</p>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PROJECT_FILTER_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.id}
              active={filters.project === opt.id}
              onClick={() => setProject(opt.id)}
              label={opt.label}
              count={projectCounts[opt.id]}
            />
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
