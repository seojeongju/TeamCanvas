import { GlassCard } from "../ui/GlassCard";
import { TaskCard } from "./TaskCard";
import { TASK_COLUMNS } from "../../lib/taskUtils";
import type { Task, TaskStatus } from "../../lib/types";

interface TaskListViewProps {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}

export function TaskListView({ tasks, onOpen, onStatusChange }: TaskListViewProps) {
  if (tasks.length === 0) {
    return (
      <GlassCard className="p-8 text-center">
        <p className="text-sm text-navy-600">표시할 업무가 없습니다.</p>
        <p className="mt-1 text-xs text-navy-500">필터를 변경하거나 새 업무를 추가해 보세요.</p>
      </GlassCard>
    );
  }

  const grouped = TASK_COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.status === col.id),
  })).filter((g) => g.tasks.length > 0);

  return (
    <div className="space-y-5">
      {grouped.map((group) => (
        <section key={group.id}>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">
            {group.label}
            <span className="ml-2 text-xs font-normal text-navy-500">{group.tasks.length}건</span>
          </h3>
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
