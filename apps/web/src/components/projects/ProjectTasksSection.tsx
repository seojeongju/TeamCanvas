import { useState } from "react";
import { Link2, Plus, Copy, ChevronDown } from "lucide-react";
import { CreateTaskModal } from "../modals/CreateTaskModal";
import { LinkTasksToProjectModal } from "../modals/LinkTasksToProjectModal";
import { CopyProjectWorkModal } from "../modals/CopyProjectWorkModal";
import { SendProjectWorkModal } from "../modals/SendProjectWorkModal";
import { EditTaskModal } from "../modals/EditTaskModal";
import { TaskBoardView } from "../tasks/TaskBoardView";
import { TaskDetailSheet } from "../tasks/TaskDetailSheet";
import { TaskEmptyState } from "../tasks/TaskEmptyState";
import { TaskListView } from "../tasks/TaskListView";
import { TaskViewSwitcher } from "../tasks/TaskViewSwitcher";
import { useDuplicateTask, useTasks, useUpdateTask } from "../../hooks/useData";
import { useHasPermission } from "../../hooks/usePermissions";
import { canWriteProjectContent } from "../../lib/projectUtils";
import type { Project, Task, TaskStatus, TaskViewMode } from "../../lib/types";
import { GlassCard } from "../ui/GlassCard";

type Props = {
  project: Project;
};

export function ProjectTasksSection({ project }: Props) {
  const { data, isLoading } = useTasks({ projectId: project.id });
  const updateTask = useUpdateTask();
  const duplicateTask = useDuplicateTask();
  const canWriteTasks = useHasPermission("tasks:write");
  const canWrite = canWriteTasks && canWriteProjectContent(project.currentUserRole);

  const tasks = data?.tasks ?? [];
  const [viewMode, setViewMode] = useState<TaskViewMode>("list");
  const [showCreate, setShowCreate] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showCopyWork, setShowCopyWork] = useState(false);
  const [showSendWork, setShowSendWork] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("todo");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const openCreate = (status: TaskStatus = "todo") => {
    setCreateStatus(status);
    setShowCreate(true);
  };

  const handleStatusChange = (task: Task, status: TaskStatus) => {
    if (task.status === status) return;
    updateTask.mutate({ id: task.id, status });
  };

  const handleMove = (taskId: string, status: TaskStatus, sortOrder: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const patch: { id: string; status?: TaskStatus; sortOrder: number } = { id: taskId, sortOrder };
    if (task.status !== status) patch.status = status;
    updateTask.mutate(patch);
  };

  const handleDuplicate = async (task: Task) => {
    await duplicateTask.mutateAsync({ taskId: task.id, includeSubtasks: false });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-navy-800">업무</h2>
          <p className="text-xs text-navy-500">
            {isLoading ? "불러오는 중..." : `총 ${tasks.length}건`}
            {project.openTaskCount != null && project.openTaskCount > 0
              ? ` · 진행 ${project.openTaskCount}건`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canWrite && (
            <>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCopyMenu((prev) => !prev)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-white/80 px-3 text-xs font-medium text-navy-700 ring-1 ring-sky-100/90 hover:bg-white"
                >
                  <Copy className="h-3.5 w-3.5" />
                  복사
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </button>
                {showCopyMenu && (
                  <>
                    <button
                      type="button"
                      aria-label="복사 메뉴 닫기"
                      className="fixed inset-0 z-40"
                      onClick={() => setShowCopyMenu(false)}
                    />
                    <div className="absolute right-0 z-50 mt-1 w-52 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-sky-100">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCopyMenu(false);
                          setShowCopyWork(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-navy-700 hover:bg-sky-50"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        가져오기
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCopyMenu(false);
                          setShowSendWork(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-navy-700 hover:bg-sky-50"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        내보내기
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowLink(true)}
                className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-white/80 px-3 text-xs font-medium text-navy-700 ring-1 ring-sky-100/90 hover:bg-white"
              >
                <Link2 className="h-3.5 w-3.5" />
                연결
              </button>
            </>
          )}
          {tasks.length > 0 && <TaskViewSwitcher value={viewMode} onChange={setViewMode} />}
        </div>
      </div>

      {isLoading ? (
        <GlassCard className="p-6 text-center text-sm text-navy-600">업무 불러오는 중...</GlassCard>
      ) : tasks.length === 0 ? (
        <TaskEmptyState onCreate={canWrite ? () => openCreate("todo") : undefined} />
      ) : viewMode === "board" ? (
        <TaskBoardView
          tasks={tasks}
          onOpen={setSelectedTask}
          onEdit={setEditTask}
          onDuplicate={canWrite ? handleDuplicate : undefined}
          onStatusChange={handleStatusChange}
          onMove={handleMove}
          onCreate={() => openCreate("todo")}
          canWrite={canWrite}
        />
      ) : (
        <TaskListView
          tasks={tasks}
          onOpen={setSelectedTask}
          onEdit={setEditTask}
          onDuplicate={canWrite ? handleDuplicate : undefined}
          onStatusChange={handleStatusChange}
          onCreate={() => openCreate("todo")}
          canWrite={canWrite}
        />
      )}

      {canWrite && tasks.length > 0 && (
        <button
          type="button"
          onClick={() => openCreate("todo")}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-sky-200 bg-white/50 py-3 text-sm font-medium text-primary-600 transition hover:bg-white/80"
        >
          <Plus className="h-4 w-4" />
          업무 추가
        </button>
      )}

      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        defaultStatus={createStatus}
        defaultProjectId={project.id}
        defaultTeamId={project.teamId}
      />

      <EditTaskModal task={editTask} onClose={() => setEditTask(null)} />

      <TaskDetailSheet
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onEdit={(task) => {
          setSelectedTask(null);
          setEditTask(task);
        }}
      />

      <LinkTasksToProjectModal open={showLink} onClose={() => setShowLink(false)} project={project} />
      <CopyProjectWorkModal open={showCopyWork} onClose={() => setShowCopyWork(false)} project={project} />
      <SendProjectWorkModal open={showSendWork} onClose={() => setShowSendWork(false)} project={project} />
    </section>
  );
}
