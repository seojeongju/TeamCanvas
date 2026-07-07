import { useRef, useState } from "react";
import { Calendar, ChevronRight, Eye, Paperclip, Pencil } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { cn } from "../../lib/cn";
import {
  taskStatusLabel,
  taskWorkTone,
  workToneAccentClass,
  workToneBadgeClass,
  workToneCardClass,
  workToneTitleClass,
} from "../../lib/statusVisuals";
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
  onEdit: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  canWrite?: boolean;
  compact?: boolean;
  inFolder?: boolean;
  /** 칸반 열 뷰 — 상태 뱃지 숨김, 제목 줄임, 컴팩트 푸터 */
  variant?: "default" | "board";
}

const SWIPE_THRESHOLD = 72;
const BOARD_LABEL_LIMIT = 2;

export function TaskCard({
  task,
  onOpen,
  onEdit,
  onStatusChange,
  canWrite = true,
  compact,
  inFolder,
  variant = "default",
}: TaskCardProps) {
  const isBoard = variant === "board";
  const startX = useRef(0);
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const workTone = taskWorkTone(task);

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
    } else if (offsetX < -SWIPE_THRESHOLD && task.status !== "todo" && task.status !== "on_hold") {
      onStatusChange(task, regressStatus(task.status));
    }
    setOffsetX(0);
    setSwiping(false);
  };

  const visibleLabels = isBoard
    ? (task.labels ?? []).slice(0, BOARD_LABEL_LIMIT)
    : (task.labels ?? []);
  const hiddenLabelCount = isBoard ? Math.max(0, (task.labels?.length ?? 0) - BOARD_LABEL_LIMIT) : 0;

  const paddingClass = isBoard ? "p-3" : compact ? "p-3" : "p-3.5";

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", inFolder && "rounded-xl")}>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4 text-xs font-medium">
        <span className={cn("text-emerald-600", offsetX > 20 ? "opacity-100" : "opacity-0")}>
          {task.status === "todo" || task.status === "on_hold" ? "진행 →" : "완료 →"}
        </span>
        <span className={cn("text-sky-600", offsetX < -20 ? "opacity-100" : "opacity-0")}>
          ← 되돌리기
        </span>
      </div>

      <GlassCard
        className={cn(
          "group relative overflow-hidden p-0 transition-transform",
          compact && "shadow-sm",
          isBoard && "shadow-sm hover:shadow-md",
          workToneCardClass(workTone),
        )}
      >
        <div
          className="flex"
          style={{ transform: swiping ? `translateX(${offsetX}px)` : undefined }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <div className={cn("w-1 shrink-0", workToneAccentClass(workTone))} aria-hidden />

          <div className={cn("flex min-w-0 flex-1 flex-col", paddingClass, isBoard && "pb-0")}>
            <button type="button" onClick={() => onOpen(task)} className="w-full text-left">
              <div className="flex items-start gap-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1">
                    {!isBoard && (
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                          workToneBadgeClass(workTone),
                        )}
                      >
                        {taskStatusLabel(task.status)}
                      </span>
                    )}
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                        getPriorityClass(task.priority),
                      )}
                    >
                      {getPriorityLabel(task.priority)}
                    </span>
                    {!isBoard && task.teamName && (
                      <span className="max-w-[5.5rem] truncate rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-navy-500">
                        {task.teamName}
                      </span>
                    )}
                    {(task.attachmentCount ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-navy-500">
                        <Paperclip className="h-3 w-3" />
                        {task.attachmentCount}
                      </span>
                    )}
                  </div>

                  {isBoard && (task.teamName || task.projectName) && (
                    <p className="mt-1 truncate text-[11px] font-medium text-navy-500">
                      {task.projectName ?? task.teamName}
                    </p>
                  )}

                  <p
                    title={task.title}
                    className={cn(
                      "font-semibold leading-snug text-navy-900",
                      isBoard
                        ? "mt-1 line-clamp-2 break-words text-sm"
                        : cn(
                            "mt-1.5",
                            compact ? "line-clamp-2 text-sm" : "line-clamp-3 text-[15px]",
                            workToneTitleClass(workTone),
                          ),
                    )}
                  >
                    {task.title}
                  </p>

                  {visibleLabels.length > 0 && (
                    <div className={cn("flex flex-wrap gap-1", isBoard ? "mt-1.5" : "mt-1.5")}>
                      {visibleLabels.map((label) => (
                        <span
                          key={label.id}
                          className="max-w-[6.5rem] truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: label.color }}
                          title={label.name}
                        >
                          {label.name}
                        </span>
                      ))}
                      {hiddenLabelCount > 0 && (
                        <span className="rounded-md bg-navy-100 px-1.5 py-0.5 text-[10px] font-medium text-navy-600">
                          +{hiddenLabelCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <ChevronRight
                  className={cn(
                    "shrink-0 text-navy-300 transition group-hover:text-navy-400",
                    isBoard ? "mt-0.5 h-3.5 w-3.5" : "mt-0.5 h-4 w-4",
                  )}
                  strokeWidth={2}
                  aria-hidden
                />
              </div>

              <div
                className={cn(
                  "flex items-center justify-between gap-2 border-sky-50",
                  isBoard ? "mt-2 border-t pt-2" : "mt-2.5 border-t pt-2.5",
                )}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-400/15 text-[9px] font-bold text-primary-600">
                    {getInitials(task.assignee)}
                  </span>
                  <span className="truncate text-xs text-navy-600">{task.assignee}</span>
                </div>
                {task.due && (
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium",
                      getDueClass(task),
                    )}
                  >
                    <Calendar className="h-3 w-3 opacity-70" strokeWidth={2} />
                    {task.due}
                  </span>
                )}
              </div>
            </button>

            {isBoard ? (
              <div className="-mx-3 mt-2 flex overflow-hidden rounded-b-2xl border-t border-sky-100/80">
                <button
                  type="button"
                  onClick={() => onOpen(task)}
                  className="inline-flex flex-1 items-center justify-center gap-1 py-2.5 text-[11px] font-medium text-navy-600 transition hover:bg-sky-50/80"
                >
                  <Eye className="h-3.5 w-3.5" />
                  상세
                </button>
                {canWrite && (
                  <>
                    <div className="w-px bg-sky-100/80" aria-hidden />
                    <button
                      type="button"
                      onClick={() => onEdit(task)}
                      className="inline-flex flex-1 items-center justify-center gap-1 py-2.5 text-[11px] font-medium text-primary-600 transition hover:bg-primary-400/5"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      수정
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => onOpen(task)}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-sky-100/70 py-2 text-xs font-medium text-navy-700 transition hover:bg-sky-100"
                >
                  <Eye className="h-3.5 w-3.5" />
                  상세보기
                </button>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => onEdit(task)}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary-400/10 py-2 text-xs font-medium text-primary-600 transition hover:bg-primary-400/20"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    수정
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
