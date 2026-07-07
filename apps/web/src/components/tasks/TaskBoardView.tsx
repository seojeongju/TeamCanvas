import { useEffect, useMemo, useState } from "react";
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
import { TaskPaginatedColumn } from "./TaskPaginatedColumn";
import { TaskStatusTabs, taskCountsByStatus } from "./TaskStatusTabs";
import { TASK_COLUMNS } from "../../lib/taskUtils";
import { cn } from "../../lib/cn";
import type { Task, TaskStatus } from "../../lib/types";

/** 좁은 레이아웃(max-w-lg)에서도 읽기 좋은 칸반 열 너비 */
const BOARD_COLUMN_WIDTH = "w-[17.5rem]";

interface TaskBoardViewProps {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onMove: (taskId: string, status: TaskStatus, sortOrder: number) => void;
  onCreate?: () => void;
  canWrite?: boolean;
  statusTab?: TaskStatus;
  onStatusTabChange?: (status: TaskStatus) => void;
}

function columnId(status: TaskStatus) {
  return `column-${status}`;
}

function resolveStatus(overId: string, tasks: Task[]): TaskStatus | null {
  if (overId.startsWith("column-")) return overId.replace("column-", "") as TaskStatus;
  const hit = tasks.find((t) => t.id === overId);
  return hit?.status ?? null;
}

export function TaskBoardView({
  tasks,
  onOpen,
  onEdit,
  onStatusChange,
  onMove,
  onCreate,
  canWrite = true,
  statusTab,
  onStatusTabChange,
}: TaskBoardViewProps) {
  const [internalColumn, setInternalColumn] = useState<TaskStatus>("todo");
  const activeColumn = statusTab ?? internalColumn;
  const setActiveColumn = onStatusTabChange ?? setInternalColumn;
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  useEffect(() => {
    if (statusTab) setInternalColumn(statusTab);
  }, [statusTab]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const counts = useMemo(() => taskCountsByStatus(tasks), [tasks]);

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
      <TaskStatusTabs
        className="md:hidden"
        active={activeColumn}
        onChange={setActiveColumn}
        counts={counts}
      />

      <div className="md:hidden">
        <TaskColumn
          column={TASK_COLUMNS.find((c) => c.id === activeColumn)!}
          tasks={tasksByColumn[activeColumn]}
          resetKey={`${activeColumn}-${tasks.length}`}
          onOpen={onOpen}
          onEdit={onEdit}
          onStatusChange={onStatusChange}
          canWrite={canWrite}
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="hidden md:block">
          <p className="mb-2 text-[11px] text-navy-500">열을 좌우로 스크롤해 다른 상태를 확인하세요.</p>
          <div className="-mx-1 overflow-x-auto pb-2 [scrollbar-width:thin]">
            <div className="flex w-max snap-x snap-mandatory gap-3 px-1">
              {TASK_COLUMNS.map((col) => (
                <DroppableColumn
                  key={col.id}
                  column={col}
                  tasks={tasksByColumn[col.id]}
                  resetKey={`${col.id}-${tasks.length}`}
                  onOpen={onOpen}
                  onEdit={onEdit}
                  onStatusChange={onStatusChange}
                  canWrite={canWrite}
                />
              ))}
            </div>
          </div>
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className={cn("rotate-1 opacity-95 shadow-lg", BOARD_COLUMN_WIDTH)}>
              <TaskCard
                task={activeTask}
                variant="board"
                onOpen={() => {}}
                onEdit={() => {}}
                onStatusChange={() => {}}
              />
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
  resetKey,
  onOpen,
  onEdit,
  onStatusChange,
  canWrite,
}: {
  column: (typeof TASK_COLUMNS)[number];
  tasks: Task[];
  resetKey: string;
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  canWrite?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(column.id) });

  return (
    <div className={cn("flex shrink-0 snap-start flex-col", BOARD_COLUMN_WIDTH)}>
      <div className={cn("mb-2 flex items-center gap-2 border-l-4 pl-2", column.color)}>
        <h3 className="text-sm font-semibold text-navy-800">{column.label}</h3>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-navy-600">
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[120px] rounded-2xl bg-sky-50/40 p-2 transition",
          isOver && "bg-sky-50/90 ring-2 ring-primary-400/20",
        )}
      >
        {tasks.length === 0 ? (
          <p className="py-6 text-center text-xs text-navy-400">업무 없음</p>
        ) : (
          <TaskPaginatedColumn tasks={tasks} resetKey={resetKey}>
            {(visibleTasks) => (
              <SortableContext
                items={visibleTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {visibleTasks.map((task) => (
                    <SortableTaskCard
                      key={task.id}
                      task={task}
                      variant="board"
                      onOpen={onOpen}
                      onEdit={onEdit}
                      onStatusChange={onStatusChange}
                      canWrite={canWrite}
                    />
                  ))}
                </div>
              </SortableContext>
            )}
          </TaskPaginatedColumn>
        )}
      </div>
    </div>
  );
}

function TaskColumn({
  column,
  tasks,
  resetKey,
  onOpen,
  onEdit,
  onStatusChange,
  canWrite,
}: {
  column: (typeof TASK_COLUMNS)[number];
  tasks: Task[];
  resetKey: string;
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  canWrite?: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <GlassCard className="p-4 text-center text-xs text-navy-500">
        {column.label} 업무가 없습니다
      </GlassCard>
    );
  }

  return (
    <TaskPaginatedColumn tasks={tasks} resetKey={resetKey}>
      {(visibleTasks) => (
        <div className="space-y-2">
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              variant="board"
              onOpen={onOpen}
              onEdit={onEdit}
              onStatusChange={onStatusChange}
              canWrite={canWrite}
            />
          ))}
        </div>
      )}
    </TaskPaginatedColumn>
  );
}
