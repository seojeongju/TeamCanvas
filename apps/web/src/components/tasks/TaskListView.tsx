import { TaskEmptyState } from "./TaskEmptyState";
import { TaskFolderGroup } from "./TaskFolderGroup";
import { TASK_COLUMNS } from "../../lib/taskUtils";
import { groupTasksByTitle } from "../../lib/taskGroup";
import { cn } from "../../lib/cn";
import type { Task, TaskStatus } from "../../lib/types";

interface TaskListViewProps {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onCreate?: () => void;
  canWrite?: boolean;
}

const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-sky-400",
  doing: "bg-primary-400",
  done: "bg-emerald-400",
};

export function TaskListView({
  tasks,
  onOpen,
  onEdit,
  onStatusChange,
  onCreate,
  canWrite = true,
}: TaskListViewProps) {
  if (tasks.length === 0) {
    return <TaskEmptyState onCreate={onCreate} />;
  }

  const grouped = TASK_COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.status === col.id),
  })).filter((g) => g.tasks.length > 0);

  return (
    <div className="space-y-4">
      {grouped.map((group) => {
        const titleGroups = groupTasksByTitle(group.tasks);
        return (
          <section key={group.id}>
            <div className="mb-2 flex items-center justify-between px-0.5">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[group.id])} aria-hidden />
                <h3 className="text-sm font-semibold text-navy-800">{group.label}</h3>
                <span className="rounded-full bg-sky-100/80 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-navy-600">
                  {group.tasks.length}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {titleGroups.map((titleGroup) => (
                <TaskFolderGroup
                  key={`${group.id}-${titleGroup.key}`}
                  group={titleGroup}
                  onOpen={onOpen}
                  onEdit={onEdit}
                  onStatusChange={onStatusChange}
                  canWrite={canWrite}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
