import { useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { cn } from "../../lib/cn";
import { PROJECT_STATUS_OPTIONS } from "../../lib/projectUtils";
import type {
  DashboardProjectFilter,
  DashboardStatusFilters,
  DashboardTaskFilter,
} from "../../lib/dashboardStatusFilters";

type ChipProps = {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  activeClass?: string;
};

function FilterChip({ active, onClick, label, count, activeClass }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition",
        active
          ? cn("bg-primary-400 text-white shadow-sm", activeClass)
          : "bg-white/80 text-navy-700 ring-1 ring-sky-100/90 hover:bg-white",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 py-px text-[10px] tabular-nums",
          active ? "bg-white/20" : "bg-sky-50 text-navy-500",
        )}
      >
        {count}
      </span>
    </button>
  );
}

/** 내 업무: 미완료 / 상태 / 지연 — 건수는 담당자=나 기준 */
const TASK_FILTER_OPTIONS: { id: DashboardTaskFilter; label: string }[] = [
  { id: "all", label: "미완료" },
  { id: "todo", label: "할 일" },
  { id: "doing", label: "진행 중" },
  { id: "on_hold", label: "보류" },
  { id: "done", label: "완료" },
  { id: "overdue", label: "지연" },
];

/** 프로젝트: 운영중(계획·진행·보류) / 상태별 */
const PROJECT_FILTER_OPTIONS: { id: DashboardProjectFilter; label: string }[] = [
  { id: "all", label: "운영중" },
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
  const hasActive = filters.task !== "all" || filters.project !== "all";
  const myOpenTotal = taskCounts.all;
  const myAllTotal =
    taskCounts.todo + taskCounts.doing + taskCounts.on_hold + taskCounts.done;
  const prevFilters = useRef(filters);

  useEffect(() => {
    const prev = prevFilters.current;
    prevFilters.current = filters;
    if (prev.task !== filters.task) {
      document.getElementById("dashboard-my-tasks")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    } else if (prev.project !== filters.project) {
      document.getElementById("dashboard-projects")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [filters]);

  return (
    <GlassCard className="space-y-3 overflow-visible p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-navy-700">상태 필터</p>
          <p className="mt-0.5 text-[10px] text-navy-400">
            바로 아래 내 업무·프로젝트 위젯에 적용됩니다
          </p>
        </div>
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
        <p className="mb-1.5 text-[10px] font-medium text-navy-400">
          내 업무 · 담당 기준
          <span className="ml-1 tabular-nums text-navy-300">
            (미완료 {myOpenTotal} · 전체 {myAllTotal})
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TASK_FILTER_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.id}
              active={filters.task === opt.id}
              onClick={() => onChange({ ...filters, task: opt.id })}
              label={opt.label}
              count={taskCounts[opt.id] ?? 0}
              activeClass={opt.id === "overdue" ? "!bg-red-500" : undefined}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-medium text-navy-400">
          프로젝트 · 상태 기준
          <span className="ml-1 tabular-nums text-navy-300">
            (운영중 {projectCounts.all})
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PROJECT_FILTER_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.id}
              active={filters.project === opt.id}
              onClick={() => onChange({ ...filters, project: opt.id })}
              label={opt.label}
              count={projectCounts[opt.id] ?? 0}
            />
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
