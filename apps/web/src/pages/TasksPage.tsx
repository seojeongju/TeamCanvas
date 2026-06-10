import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { CreateTaskModal } from "../components/modals/CreateTaskModal";
import { TaskBoardView } from "../components/tasks/TaskBoardView";
import { TaskDetailSheet } from "../components/tasks/TaskDetailSheet";
import { TaskFilterBar } from "../components/tasks/TaskFilterBar";
import { TaskListView } from "../components/tasks/TaskListView";
import { TaskSummaryBar } from "../components/tasks/TaskSummaryBar";
import { TaskViewSwitcher } from "../components/tasks/TaskViewSwitcher";
import { useTaskLabels, useTasks, useTeams, useUpdateTask } from "../hooks/useData";
import { useAuthStore } from "../stores/authStore";
import { computeTaskSummary, filterTasks } from "../lib/taskUtils";
import type { Task, TaskFilters, TaskStatus, TaskViewMode } from "../lib/types";

export function TasksPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const { data } = useTasks();
  const { data: teamsData } = useTeams();
  const { data: labelsData } = useTaskLabels();
  const updateTask = useUpdateTask();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState<TaskViewMode>("list");
  const [filters, setFilters] = useState<TaskFilters>({ assignee: "all" });
  const [showCreate, setShowCreate] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("todo");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const allTasks = data?.tasks ?? [];
  const teams = teamsData?.teams ?? [];
  const labels = labelsData?.labels ?? [];
  const tasks = useMemo(() => filterTasks(allTasks, filters, userId), [allTasks, filters, userId]);
  const summary = useMemo(() => computeTaskSummary(allTasks, userId), [allTasks, userId]);
  const hasTasks = allTasks.length > 0;

  const openCreate = (status: TaskStatus = "todo") => {
    setCreateStatus(status);
    setShowCreate(true);
  };

  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId || allTasks.length === 0) return;
    const task = allTasks.find((t) => t.id === taskId);
    if (task) setSelectedTask(task);
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  }, [searchParams, allTasks, setSearchParams]);

  const handleStatusChange = (task: Task, status: TaskStatus) => {
    if (task.status === status) return;
    updateTask.mutate({ id: task.id, status });
  };

  const handleMove = (taskId: string, status: TaskStatus, sortOrder: number) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;
    const patch: { id: string; status?: TaskStatus; sortOrder: number } = { id: taskId, sortOrder };
    if (task.status !== status) patch.status = status;
    updateTask.mutate(patch);
  };

  return (
    <div className="space-y-3 pb-4">
      <PageHeader
        title="프로젝트"
        subtitle={hasTasks ? `총 ${allTasks.length}건` : "팀 프로젝트를 관리하세요"}
      />

      {hasTasks && (
        <TaskSummaryBar
          dueToday={summary.dueToday}
          overdue={summary.overdue}
          mine={summary.mine}
          doing={summary.doing}
          filters={filters}
          onFilterChange={setFilters}
        />
      )}

      <GlassCard className="space-y-2.5 p-3">
        <div className="flex items-center justify-between gap-3">
          <TaskViewSwitcher value={viewMode} onChange={setViewMode} />
          {hasTasks && (
            <span className="shrink-0 text-xs text-navy-500">
              {tasks.length !== allTasks.length
                ? `${tasks.length}건 표시`
                : `${allTasks.length}건`}
            </span>
          )}
        </div>
        {hasTasks && (
          <TaskFilterBar filters={filters} teams={teams} labels={labels} onChange={setFilters} />
        )}
      </GlassCard>

      {viewMode === "board" ? (
        <TaskBoardView
          tasks={tasks}
          onOpen={setSelectedTask}
          onStatusChange={handleStatusChange}
          onMove={handleMove}
          onCreate={() => openCreate("todo")}
        />
      ) : (
        <TaskListView
          tasks={tasks}
          onOpen={setSelectedTask}
          onStatusChange={handleStatusChange}
          onCreate={() => openCreate("todo")}
        />
      )}

      <button
        type="button"
        onClick={() => openCreate("todo")}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-400 text-white shadow-glow transition hover:bg-primary-500 active:scale-95"
        aria-label="프로젝트 추가"
      >
        <Plus className="h-6 w-6" strokeWidth={2.25} />
      </button>

      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        defaultStatus={createStatus}
      />

      <TaskDetailSheet task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
