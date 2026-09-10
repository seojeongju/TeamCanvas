import type { TaskFilters } from "./types";

export type WorkScopeMode = "all" | "mine" | "team";

const TASKS_KEY = "tc-tasks-scope-mode";
const PROJECTS_KEY = "tc-projects-scope-mode";

function isScopeMode(value: unknown): value is WorkScopeMode {
  return value === "all" || value === "mine" || value === "team";
}

function readScope(key: string): WorkScopeMode {
  try {
    const raw = localStorage.getItem(key);
    if (isScopeMode(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "all";
}

function writeScope(key: string, mode: WorkScopeMode) {
  try {
    localStorage.setItem(key, mode);
  } catch {
    /* ignore */
  }
}

export function getTasksScopeMode(): WorkScopeMode {
  return readScope(TASKS_KEY);
}

export function saveTasksScopeMode(mode: WorkScopeMode) {
  writeScope(TASKS_KEY, mode);
}

export function getProjectsScopeMode(): WorkScopeMode {
  return readScope(PROJECTS_KEY);
}

export function saveProjectsScopeMode(mode: WorkScopeMode) {
  writeScope(PROJECTS_KEY, mode);
}

/** scopeMode에 맞춰 업무 필터 필드 정리 */
export function applyTaskScopeFilters(
  filters: TaskFilters,
  mode: WorkScopeMode,
  myTeamIds: string[],
): TaskFilters {
  const next: TaskFilters = {
    ...filters,
    scopeTeamIds: undefined,
  };

  if (mode === "mine") {
    next.assignee = "me";
    return next;
  }

  next.assignee = "all";

  if (mode === "team") {
    if (next.teamId) {
      next.scopeTeamIds = undefined;
    } else {
      next.scopeTeamIds = myTeamIds;
    }
  }

  return next;
}

export function scopeModeFromTaskFilters(filters: TaskFilters): WorkScopeMode | null {
  if (filters.assignee === "me") return "mine";
  if (filters.teamId || (filters.scopeTeamIds && filters.scopeTeamIds.length > 0)) return "team";
  return null;
}
