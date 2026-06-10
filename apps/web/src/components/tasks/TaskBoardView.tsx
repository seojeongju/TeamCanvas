import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { GlassCard } from "../ui/GlassCard";
import { SortableTaskCard } from "./SortableTaskCard";
import { TaskCard } from "./TaskCard";
import { TaskEmptyState } from "./TaskEmptyState";
import { TASK_COLUMNS } from "../../lib/taskUtils";
import { cn } from "../../lib/cn";
import type { Task, TaskStatus } from "../../lib/types";

interface TaskBoardViewProps {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onMove: (taskId: string, status: TaskStatus, sortOrder: number) => void;
  onCreate?: () => void;
}

function columnId(status: TaskStatus) {
  return `column-${status}`;
}

function resolveStatus(overId: string, tasks: Task[]): TaskStatus | null {
  if (overId.startsWith("column-")) return overId.replace("column-", "") as TaskStatus;
  const hit = tasks.find((t) => t.id === overId);
  return hit?.status ?? null;
}

export function TaskBoardView({ tasks, onOpen, onStatusChange, onMove, onCreate }: TaskBoardViewProps) {
  const [activeColumn, setActiveColumn] = useState<TaskStatus>("todo");
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const tasksByColumn = useMemo(
    () =>
      TASK_COLUMNS.reduce(
        (acc, col) => {
          acc[col.id] = tasks
            .filter((t) => t.status === col.id)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          return acc;
        },
        {} as Record<TaskStatus, Task[]>,
      ),
    [tasks],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const targetStatus = resolveStatus(String(over.id), tasks);
    if (!targetStatus) return;

    const columnTasks = tasksByColumn[targetStatus].filter((t) => t.id !== taskId);
    let insertIndex = columnTasks.length;

    if (!String(over.id).startsWith("column-")) {
      const overIndex = columnTasks.findIndex((t) => t.id === over.id);
      if (overIndex >= 0) insertIndex = overIndex;
    }

    const sortOrder = (insertIndex + 1) * 100;

    if (task.status !== targetStatus || (task.sortOrder ?? 0) !== sortOrder) {
      onMove(taskId, targetStatus, sortOrder);
    }
  };

  if (tasks.length === 0) {
    return <TaskEmptyState onCreate={onCreate} />;
  }

  return (
    <>
      <div className="flex gap-1.5 rounded-2xl bg-sky-100/50 p-1 md:hidden">
        {TASK_COLUMNS.map((col) => {
          const count = tasksByColumn[col.id].length;
          const active = activeColumn === col.id;
          return (
            <button
              key={col.id}
              type="button"
              onClick={() => setActiveColumn(col.id)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-semibold transition",
                active ? "bg-white text-navy-900 shadow-sm" : "text-navy-600",
              )}
            >
              <span className={cn("h-0.5 w-6 rounded-full", active ? col.color.replace("border-", "bg-") : "bg-transparent")} />
              <span>{col.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums",
                  active ? "bg-sky-100 text-navy-700" : "text-navy-500",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="md:hidden">
        <TaskColumn
          column={TASK_COLUMNS.find((c) => c.id === activeColumn)!}
          tasks={tasksByColumn[activeColumn]}
          onOpen={onOpen}
          onStatusChange={onStatusChange}
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="hidden gap-3 md:flex">
          {TASK_COLUMNS.map((col) => (
            <DroppableColumn
              key={col.id}
              column={col}
              tasks={tasksByColumn[col.id]}
              onOpen={onOpen}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="rotate-2 opacity-90">
              <TaskCard task={activeTask} onOpen={() => {}} onStatusChange={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

function DroppableColumn({
  column,
  tasks,
  onOpen,
  onStatusChange,
}: {
  column: (typeof TASK_COLUMNS)[number];
  tasks: Task[];
  onOpen: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(column.id) });

  return (
    <div className="min-w-0 flex-1">
      <div className={cn("mb-3 flex items-center gap-2 border-l-4 pl-2", column.color)}>
        <h3 className="text-sm font-semibold text-navy-800">{column.label}</h3>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-navy-600">
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[120px] space-y-2 rounded-2xl p-1 transition",
          isOver && "bg-sky-50/80 ring-2 ring-primary-400/20",
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <GlassCard className="p-4 text-center text-xs text-navy-500">
              {column.label} 프로젝트가 없습니다
            </GlassCard>
          ) : (
            tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                onOpen={onOpen}
                onStatusChange={onStatusChange}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

function TaskColumn({
  column,
  tasks,
  onOpen,
  onStatusChange,
}: {
  column: (typeof TASK_COLUMNS)[number];
  tasks: Task[];
  onOpen: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}) {
  return (
    <div>
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <GlassCard className="p-4 text-center text-xs text-navy-500">
            {column.label} 프로젝트가 없습니다
          </GlassCard>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={onOpen} onStatusChange={onStatusChange} />
          ))
        )}
      </div>
    </div>
  );
}
