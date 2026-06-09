import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { CreateTaskModal } from "../components/modals/CreateTaskModal";
import { TaskBoardView } from "../components/tasks/TaskBoardView";
import { TaskDetailSheet } from "../components/tasks/TaskDetailSheet";
import { TaskFilterBar } from "../components/tasks/TaskFilterBar";
import { TaskListView } from "../components/tasks/TaskListView";
import { TaskSummaryBar } from "../components/tasks/TaskSummaryBar";
import { TaskViewSwitcher } from "../components/tasks/TaskViewSwitcher";
import { useTasks, useTeams, useUpdateTask } from "../hooks/useData";
import { useAuthStore } from "../stores/authStore";
import { computeTaskSummary, filterTasks } from "../lib/taskUtils";
import type { Task, TaskFilters, TaskStatus, TaskViewMode } from "../lib/types";

export function TasksPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const { data } = useTasks();
  const { data: teamsData } = useTeams();
  const updateTask = useUpdateTask();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState<TaskViewMode>("list");
  const [filters, setFilters] = useState<TaskFilters>({ assignee: "all" });
  const [showCreate, setShowCreate] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("todo");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const allTasks = data?.tasks ?? [];
  const teams = teamsData?.teams ?? [];
  const tasks = useMemo(() => filterTasks(allTasks, filters, userId), [allTasks, filters, userId]);
  const summary = useMemo(() => computeTaskSummary(allTasks, userId), [allTasks, userId]);

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
    <div className="space-y-4 pb-4">
      <PageHeader title="업무" subtitle="팀 업무를 관리하세요" />

      <TaskSummaryBar
        dueToday={summary.dueToday}
        overdue={summary.overdue}
        mine={summary.mine}
        doing={summary.doing}
      />

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <TaskViewSwitcher value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      <TaskFilterBar filters={filters} teams={teams} onChange={setFilters} />

      {viewMode === "board" ? (
        <TaskBoardView
          tasks={tasks}
          onOpen={setSelectedTask}
          onStatusChange={handleStatusChange}
          onMove={handleMove}
        />
      ) : (
        <TaskListView tasks={tasks} onOpen={setSelectedTask} onStatusChange={handleStatusChange} />
      )}

      <p className="text-center text-xs text-navy-600/70">
        탭: 상세 · 스와이프: 상태 변경 · 데스크톱 칸반: 드래그 정렬
      </p>

      <button
        type="button"
        onClick={() => {
          setCreateStatus("todo");
          setShowCreate(true);
        }}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-400 text-white shadow-glow transition hover:bg-primary-500 active:scale-95"
        aria-label="업무 추가"
      >
        <Plus className="h-6 w-6" />
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
