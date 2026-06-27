import type { Project, ProjectStatus, Task, TaskStatus } from "./types";

const STORAGE_KEY = "tc-dashboard-status-filters";

export type DashboardTaskFilter = "all" | TaskStatus | "overdue";
export type DashboardProjectFilter = "all" | ProjectStatus;

export type DashboardStatusFilters = {
  task: DashboardTaskFilter;
  project: DashboardProjectFilter;
};

export const DEFAULT_DASHBOARD_STATUS_FILTERS: DashboardStatusFilters = {
  task: "all",
  project: "all",
};

const OPERATIONAL_PROJECT_STATUSES: ProjectStatus[] = ["planning", "active", "on_hold"];

export function getDashboardStatusFilters(): DashboardStatusFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DASHBOARD_STATUS_FILTERS };
    const parsed = JSON.parse(raw) as Partial<DashboardStatusFilters>;
    return {
      task: isTaskFilter(parsed.task) ? parsed.task : "all",
      project: isProjectFilter(parsed.project) ? parsed.project : "all",
    };
  } catch {
    return { ...DEFAULT_DASHBOARD_STATUS_FILTERS };
  }
}

export function saveDashboardStatusFilters(filters: DashboardStatusFilters): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
}

function isTaskFilter(value: unknown): value is DashboardTaskFilter {
  return (
    value === "all" ||
    value === "overdue" ||
    value === "todo" ||
    value === "doing" ||
    value === "done"
  );
}

function isProjectFilter(value: unknown): value is DashboardProjectFilter {
  return (
    value === "all" ||
    value === "planning" ||
    value === "active" ||
    value === "on_hold" ||
    value === "done" ||
    value === "archived"
  );
}

export function filterDashboardMyTasks(
  tasks: Task[],
  filter: DashboardTaskFilter,
  userId?: string,
): Task[] {
  if (!userId) return [];
  const mine = tasks.filter((t) => t.assigneeId === userId);

  switch (filter) {
    case "todo":
    case "doing":
    case "done":
      return mine.filter((t) => t.status === filter);
    case "overdue":
      return mine.filter((t) => t.status !== "done" && !!t.isOverdue);
    case "all":
    default:
      return mine.filter((t) => t.status !== "done");
  }
}

export function filterDashboardProjects(
  projects: Project[],
  filter: DashboardProjectFilter,
  userId?: string,
): Project[] {
  let list = projects;

  if (filter === "all") {
    list = projects.filter((p) => OPERATIONAL_PROJECT_STATUSES.includes(p.status));
  } else {
    list = projects.filter((p) => p.status === filter);
  }

  if (!userId) return list;

  const mine = list.filter((p) => p.ownerId === userId || p.isOwner);
  return mine.length > 0 ? mine : list;
}

export function countDashboardTasks(tasks: Task[], userId?: string): Record<DashboardTaskFilter, number> {
  if (!userId) {
    return { all: 0, todo: 0, doing: 0, done: 0, overdue: 0 };
  }
  const mine = tasks.filter((t) => t.assigneeId === userId);
  return {
    all: mine.filter((t) => t.status !== "done").length,
    todo: mine.filter((t) => t.status === "todo").length,
    doing: mine.filter((t) => t.status === "doing").length,
    done: mine.filter((t) => t.status === "done").length,
    overdue: mine.filter((t) => t.status !== "done" && !!t.isOverdue).length,
  };
}

export function countDashboardProjects(projects: Project[]): Record<DashboardProjectFilter, number> {
  const counts: Record<DashboardProjectFilter, number> = {
    all: projects.filter((p) => OPERATIONAL_PROJECT_STATUSES.includes(p.status)).length,
    planning: 0,
    active: 0,
    on_hold: 0,
    done: 0,
    archived: 0,
  };
  for (const p of projects) {
    counts[p.status] += 1;
  }
  return counts;
}
