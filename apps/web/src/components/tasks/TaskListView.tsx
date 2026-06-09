import { TaskCard } from "./TaskCard";
import { TaskEmptyState } from "./TaskEmptyState";
import { TASK_COLUMNS } from "../../lib/taskUtils";
import { cn } from "../../lib/cn";
import type { Task, TaskStatus } from "../../lib/types";

interface TaskListViewProps {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onCreate?: () => void;
}

export function TaskListView({ tasks, onOpen, onStatusChange, onCreate }: TaskListViewProps) {
  if (tasks.length === 0) {
    return <TaskEmptyState onCreate={onCreate} />;
  }

  const grouped = TASK_COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.status === col.id),
  })).filter((g) => g.tasks.length > 0);

  return (
    <div className="space-y-5">
      {grouped.map((group) => (
        <section key={group.id}>
          <div className={cn("mb-2.5 flex items-center gap-2 border-l-4 pl-2", group.color)}>
            <h3 className="text-sm font-semibold text-navy-800">{group.label}</h3>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-navy-600">
              {group.tasks.length}
            </span>
          </div>
          <div className="space-y-2">
            {group.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onOpen={onOpen}
                onStatusChange={onStatusChange}
                compact
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
