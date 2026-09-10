import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { ScopeModeSwitcher } from "../components/ui/ScopeModeSwitcher";
import { CreateTaskModal } from "../components/modals/CreateTaskModal";
import { EditTaskModal } from "../components/modals/EditTaskModal";
import { useHasPermission } from "../hooks/usePermissions";
import { TaskBoardView } from "../components/tasks/TaskBoardView";
import { TaskDetailSheet } from "../components/tasks/TaskDetailSheet";
import { TaskFilterBar } from "../components/tasks/TaskFilterBar";
import { TaskListView } from "../components/tasks/TaskListView";
import { taskCountsByStatus } from "../components/tasks/TaskStatusTabs";
import { TaskSummaryBar } from "../components/tasks/TaskSummaryBar";
import { TaskViewSwitcher } from "../components/tasks/TaskViewSwitcher";
import { useProjects, useTaskLabels, useTasks, useTeams, useUpdateTask, useDuplicateTask } from "../hooks/useData";
import { useAuthStore } from "../stores/authStore";
import { computeTaskSummary, filterTasks, TASK_COLUMNS } from "../lib/taskUtils";
import {
  applyTaskScopeFilters,
  getTasksScopeMode,
  saveTasksScopeMode,
  type WorkScopeMode,
} from "../lib/workScope";
import type { Task, TaskFilters, TaskStatus, TaskViewMode } from "../lib/types";

function firstNonEmptyStatus(tasks: Task[]): TaskStatus {
  const counts = taskCountsByStatus(tasks);
  return TASK_COLUMNS.find((c) => counts[c.id] > 0)?.id ?? "todo";
}

export function TasksPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const { data, isError, isFetching, refetch } = useTasks();
  const { data: teamsData } = useTeams();
  const { data: projectsData } = useProjects();
  const { data: labelsData } = useTaskLabels();
  const updateTask = useUpdateTask();
  const duplicateTask = useDuplicateTask();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState<TaskViewMode>("list");
  const [scopeMode, setScopeMode] = useState<WorkScopeMode>(() => getTasksScopeMode());
  const [filters, setFilters] = useState<TaskFilters>({ assignee: "all" });
  const [filtersReady, setFiltersReady] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("todo");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const canWrite = useHasPermission("tasks:write");

  const allTasks = data?.tasks ?? [];
  const teams = teamsData?.teams ?? [];
  const projects = projectsData?.projects ?? [];
  const labels = labelsData?.labels ?? [];
  const myTeamIds = useMemo(() => teams.map((t) => t.id), [teams]);

  const scopedTasks = useMemo(
    () => filterTasks(allTasks, { ...filters, status: undefined }, userId),
    [allTasks, filters, userId],
  );
  const summary = useMemo(() => computeTaskSummary(allTasks, userId), [allTasks, userId]);
  const hasTasks = allTasks.length > 0;
  const loadFailed = isError && !hasTasks;

  const activeStatus = filters.status ?? "todo";
  const visibleCount = useMemo(
    () => scopedTasks.filter((t) => t.status === activeStatus).length,
    [scopedTasks, activeStatus],
  );

  const scopeSubtitle =
    scopeMode === "mine" ? "내 업무" : scopeMode === "team" ? "팀별 업무" : "전체 업무";

  const openCreate = (status: TaskStatus = "todo") => {
    setCreateStatus(status);
    setShowCreate(true);
  };

  const handleScopeChange = (mode: WorkScopeMode) => {
    setScopeMode(mode);
    saveTasksScopeMode(mode);
    setFilters((f) => applyTaskScopeFilters(f, mode, myTeamIds));
  };

  const handleFiltersChange = (next: TaskFilters) => {
    setFilters(applyTaskScopeFilters(next, scopeMode, myTeamIds));
  };

  useEffect(() => {
    if (!filtersReady || scopeMode !== "team" || filters.teamId) return;
    const same =
      (filters.scopeTeamIds?.length ?? 0) === myTeamIds.length &&
      (filters.scopeTeamIds ?? []).every((id, i) => id === myTeamIds[i]);
    if (same) return;
    setFilters((f) => applyTaskScopeFilters(f, "team", myTeamIds));
  }, [filtersReady, scopeMode, filters.teamId, filters.scopeTeamIds, myTeamIds]);

  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId || allTasks.length === 0) return;
    const task = allTasks.find((t) => t.id === taskId);
    if (task) setSelectedTask(task);
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  }, [searchParams, allTasks, setSearchParams]);

  useEffect(() => {
    const status = searchParams.get("status");
    const overdue = searchParams.get("overdue");
    const mode = getTasksScopeMode();
    setScopeMode(mode);
    setFilters((f) =>
      applyTaskScopeFilters(
        {
          ...f,
          status:
            status === "todo" ||
            status === "doing" ||
            status === "on_hold" ||
            status === "done"
              ? status
              : undefined,
          overdue: overdue === "1",
          dueToday: overdue === "1" ? false : f.dueToday,
        },
        mode,
        myTeamIds,
      ),
    );
    setFiltersReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (filters.status) next.set("status", filters.status);
        else next.delete("status");
        if (filters.overdue) next.set("overdue", "1");
        else next.delete("overdue");
        return next;
      },
      { replace: true },
    );
  }, [filters.status, filters.overdue, filtersReady, setSearchParams]);

  useEffect(() => {
    if (!filtersReady) return;
    const scoped = filterTasks(allTasks, { ...filters, status: undefined }, userId);
    if (scoped.length === 0) return;
    const counts = taskCountsByStatus(scoped);
    if (filters.status && counts[filters.status] > 0) return;
    const next = firstNonEmptyStatus(scoped);
    if (next !== filters.status) {
      setFilters((f) => ({ ...f, status: next }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filtersReady,
    allTasks,
    userId,
    filters.assignee,
    filters.overdue,
    filters.dueToday,
    filters.teamId,
    filters.scopeTeamIds,
    filters.projectId,
    filters.labelId,
    scopeMode,
  ]);

  const handleStatusTabChange = (status: TaskStatus) => {
    setFilters((f) => ({ ...f, status }));
  };

  const revealTaskStatus = (status: TaskStatus) => {
    setFilters((f) => ({
      ...f,
      status,
      ...(status === "done" ? { overdue: false, dueToday: false } : {}),
    }));
  };

  const handleStatusChange = async (task: Task, status: TaskStatus) => {
    if (task.status === status) return;
    try {
      await updateTask.mutateAsync({ id: task.id, status });
      revealTaskStatus(status);
    } catch (err) {
      const message = err instanceof Error ? err.message : "상태 변경에 실패했습니다.";
      if (message.includes("Blocked") || message.includes("dependencies")) {
        window.alert("선행 업무가 완료되지 않아 완료 처리할 수 없습니다.");
      }
    }
  };

  const handleMove = (taskId: string, status: TaskStatus, sortOrder: number) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;
    const patch: { id: string; status?: TaskStatus; sortOrder: number } = { id: taskId, sortOrder };
    if (task.status !== status) patch.status = status;
    updateTask.mutate(patch, {
      onSuccess: () => {
        if (patch.status) revealTaskStatus(patch.status);
      },
    });
  };

  const handleDuplicate = async (task: Task) => {
    await duplicateTask.mutateAsync({ taskId: task.id, includeSubtasks: false });
  };

  return (
    <div className="space-y-3 pb-4">
      <PageHeader
        title="업무"
        subtitle={
          hasTasks ? `총 ${allTasks.length}건 · ${scopeSubtitle}` : "팀 업무를 관리하세요"
        }
        action={
          canWrite ? (
            <button
              type="button"
              onClick={() => openCreate("todo")}
              className="glass flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-medium text-primary-600 hover:bg-white/90"
              aria-label="업무 추가"
            >
              <Plus className="h-4 w-4" />
              업무 추가
            </button>
          ) : undefined
        }
      />

      {hasTasks && (
        <TaskSummaryBar
          dueToday={summary.dueToday}
          overdue={summary.overdue}
          mine={summary.mine}
          doing={summary.doing}
          filters={filters}
          scopeMode={scopeMode}
          onFilterChange={handleFiltersChange}
          onScopeChange={handleScopeChange}
        />
      )}

      <GlassCard className="space-y-2.5 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <TaskViewSwitcher value={viewMode} onChange={setViewMode} />
            <ScopeModeSwitcher
              value={scopeMode}
              onChange={handleScopeChange}
              mineLabel="내 업무"
              teamLabel="팀별"
            />
          </div>
          {hasTasks && (
            <span className="shrink-0 text-xs text-navy-500">
              {scopedTasks.length !== allTasks.length
                ? `범위 ${scopedTasks.length}건 · 이 탭 ${visibleCount}건`
                : `이 탭 ${visibleCount}건`}
            </span>
          )}
        </div>
        {hasTasks && (
          <TaskFilterBar
            filters={filters}
            scopeMode={scopeMode}
            teams={teams}
            projects={projects}
            labels={labels}
            onChange={handleFiltersChange}
          />
        )}
      </GlassCard>

      {loadFailed ? (
        <GlassCard className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <p className="text-base font-semibold text-navy-900">업무 목록을 불러오지 못했습니다</p>
          <p className="max-w-[260px] text-sm text-navy-600">
            네트워크 상태 확인 후 다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="mt-1 rounded-xl bg-primary-400 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-60"
          >
            {isFetching ? "다시 불러오는 중..." : "다시 시도"}
          </button>
        </GlassCard>
      ) : viewMode === "board" ? (
        <TaskBoardView
          tasks={scopedTasks}
          onOpen={setSelectedTask}
          onEdit={setEditTask}
          onDuplicate={canWrite ? handleDuplicate : undefined}
          onStatusChange={handleStatusChange}
          onMove={handleMove}
          onCreate={() => openCreate("todo")}
          canWrite={canWrite}
          statusTab={activeStatus}
          onStatusTabChange={handleStatusTabChange}
        />
      ) : (
        <TaskListView
          tasks={scopedTasks}
          onOpen={setSelectedTask}
          onEdit={setEditTask}
          onDuplicate={canWrite ? handleDuplicate : undefined}
          onStatusChange={handleStatusChange}
          onCreate={() => openCreate("todo")}
          canWrite={canWrite}
          statusTab={activeStatus}
          onStatusTabChange={handleStatusTabChange}
        />
      )}

      {canWrite && (
        <button
          type="button"
          onClick={() => openCreate("todo")}
          className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-400 text-white shadow-glow transition hover:bg-primary-500 active:scale-95"
          aria-label="업무 추가"
        >
          <Plus className="h-6 w-6" strokeWidth={2.25} />
        </button>
      )}

      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        defaultStatus={createStatus}
      />

      <EditTaskModal task={editTask} onClose={() => setEditTask(null)} />

      <TaskDetailSheet
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChange={revealTaskStatus}
        onEdit={(task) => {
          setSelectedTask(null);
          setEditTask(task);
        }}
      />
    </div>
  );
}
