import { useRef, useState } from "react";
import { GlassCard } from "../ui/GlassCard";
import { cn } from "../../lib/cn";
import {
  advanceStatus,
  getDueClass,
  getInitials,
  getPriorityClass,
  getPriorityLabel,
  regressStatus,
} from "../../lib/taskUtils";
import type { Task, TaskStatus } from "../../lib/types";

interface TaskCardProps {
  task: Task;
  onOpen: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  compact?: boolean;
}

const SWIPE_THRESHOLD = 72;

export function TaskCard({ task, onOpen, onStatusChange, compact }: TaskCardProps) {
  const startX = useRef(0);
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    setOffsetX(e.touches[0].clientX - startX.current);
  };

  const handleTouchEnd = () => {
    if (offsetX > SWIPE_THRESHOLD && task.status !== "done") {
      onStatusChange(task, advanceStatus(task.status));
    } else if (offsetX < -SWIPE_THRESHOLD && task.status !== "todo") {
      onStatusChange(task, regressStatus(task.status));
    }
    setOffsetX(0);
    setSwiping(false);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4 text-xs font-medium">
        <span className={cn("text-emerald-600", offsetX > 20 ? "opacity-100" : "opacity-0")}>
          {task.status === "todo" ? "진행 →" : "완료 →"}
        </span>
        <span className={cn("text-sky-600", offsetX < -20 ? "opacity-100" : "opacity-0")}>← 되돌리기</span>
      </div>

      <GlassCard
        className={cn("relative p-4 transition-transform", compact && "p-3")}
        onClick={() => onOpen(task)}
      >
        <div
          style={{ transform: swiping ? `translateX(${offsetX}px)` : undefined }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                    getPriorityClass(task.priority),
                  )}
                >
                  {getPriorityLabel(task.priority)}
                </span>
                {task.teamName && (
                  <span className="truncate text-[10px] text-navy-500">{task.teamName}</span>
                )}
              </div>
              <p className={cn("mt-1 font-medium text-navy-900", compact ? "text-sm" : "text-[15px]")}>
                {task.title}
              </p>
              {task.labels && task.labels.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {task.labels.map((label) => (
                    <span
                      key={label.id}
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: label.color }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-400/15 text-[10px] font-bold text-primary-600">
                {getInitials(task.assignee)}
              </span>
              <span className="truncate text-xs text-navy-600">{task.assignee}</span>
            </div>
            {task.due && (
              <span className={cn("shrink-0 rounded-lg px-2 py-0.5 text-xs font-medium", getDueClass(task))}>
                {task.due}
              </span>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
