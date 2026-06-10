import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskCard } from "./TaskCard";
import type { Task, TaskStatus } from "../../lib/types";

interface SortableTaskCardProps {
  task: Task;
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  canWrite?: boolean;
}

export function SortableTaskCard({
  task,
  onOpen,
  onEdit,
  onStatusChange,
  canWrite,
}: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", status: task.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard
        task={task}
        onOpen={onOpen}
        onEdit={onEdit}
        onStatusChange={onStatusChange}
        canWrite={canWrite}
      />
    </div>
  );
}
