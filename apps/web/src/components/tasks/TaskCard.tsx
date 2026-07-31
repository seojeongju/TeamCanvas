import { useRef, useState } from "react";
import { Calendar, ChevronDown, Copy, Eye, ListTree, Paperclip, Pencil, Trash2 } from "lucide-react";
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
  formatTaskCreatedAt,
  getDueClass,
  getInitials,
  getPriorityClass,
  getPriorityLabel,
  regressStatus,
} from "../../lib/taskUtils";
import {
  canDeleteEntity,
  COLLABORATION_DELETE_MESSAGE,
  isOrgAdminRole,
  taskHasCollaborationLinks,
} from "../../lib/deletePermissions";
import { useDeleteTask } from "../../hooks/useData";
import { useCurrentOrgRole, useHasPermission } from "../../hooks/usePermissions";
import { useAuthStore } from "../../stores/authStore";
import type { Task, TaskStatus } from "../../lib/types";
import { TaskSubtasksSection } from "./TaskSubtasksSection";

interface TaskCardProps {
  task: Task;
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDuplicate?: (task: Task) => void | Promise<void>;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  canWrite?: boolean;
  compact?: boolean;
  inFolder?: boolean;
  /** 칸반 열 — 상태 뱃지 숨김, 제목 2줄 말줄임 */
  variant?: "default" | "board";
}

const SWIPE_THRESHOLD = 72;

export function TaskCard({
  task,
  onOpen,
  onEdit,
  onDuplicate,
  onStatusChange,
  canWrite = true,
  compact,
  inFolder,
  variant = "default",
}: TaskCardProps) {
  const isBoard = variant === "board";
  const startX = useRef(0);
  const suppressClick = useRef(false);
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);
  const workTone = taskWorkTone(task);

  const deleteTask = useDeleteTask();
  const user = useAuthStore((s) => s.user);
  const orgRole = useCurrentOrgRole();
  const canDeletePerm = useHasPermission("tasks:delete");
  const isAdmin = isOrgAdminRole(orgRole);
  const canDelete =
    canDeleteEntity({
      isOrgAdmin: isAdmin,
      hasAdminDeletePermission: canDeletePerm,
      isCreator: !!task.creatorId && task.creatorId === user?.id,
      hasCollaborationLinks: taskHasCollaborationLinks(task),
    }) &&
    (isAdmin || canDeletePerm || (canWrite && task.creatorId === user?.id));

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    setOffsetX(e.touches[0].clientX - startX.current);
  };

  const handleTouchEnd = () => {
    if (Math.abs(offsetX) > SWIPE_THRESHOLD) {
      suppressClick.current = true;
      if (offsetX > SWIPE_THRESHOLD && task.status !== "done") {
        onStatusChange(task, advanceStatus(task.status));
      } else if (offsetX < -SWIPE_THRESHOLD && task.status !== "todo" && task.status !== "on_hold") {
        onStatusChange(task, regressStatus(task.status));
      }
    }
    setOffsetX(0);
    setSwiping(false);
  };

  const toggleSubtasks = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setSubtasksExpanded((v) => !v);
  };

  const handleDuplicate = async () => {
    if (!onDuplicate || duplicating) return;
    setDuplicating(true);
    try {
      await onDuplicate(task);
    } finally {
      setDuplicating(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete || deleting) return;
    if (!window.confirm(`「${task.title}」업무를 삭제할까요?`)) return;
    setDeleting(true);
    try {
      await deleteTask.mutateAsync(task.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "삭제에 실패했습니다.";
      window.alert(
        message.toLowerCase().includes("collaborat") || message.includes("연결된")
          ? COLLABORATION_DELETE_MESSAGE
          : message,
      );
    } finally {
      setDeleting(false);
    }
  };

  const paddingClass = compact ? "p-3" : "p-3.5";

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
          "relative overflow-hidden p-0 transition-transform",
          compact && "shadow-sm",
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

          <div className={cn("min-w-0 flex-1", paddingClass)}>
            <button
              type="button"
              onClick={toggleSubtasks}
              aria-expanded={subtasksExpanded}
              className="w-full text-left"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
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
                    {task.teamName && (
                      <span className="max-w-[7rem] truncate rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-navy-500">
                        {task.teamName}
                      </span>
                    )}
                    {(task.attachmentCount ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-navy-500">
                        <Paperclip className="h-3 w-3" />
                        {task.attachmentCount}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      <ListTree className="h-3 w-3" />
                      {(task.subtaskCount ?? 0) > 0
                        ? `${task.subtaskDoneCount ?? 0}/${task.subtaskCount}`
                        : "하위"}
                    </span>
                  </div>

                  <p
                    title={task.title}
                    className={cn(
                      "mt-1.5 font-semibold leading-snug [word-break:keep-all]",
                      isBoard
                        ? "line-clamp-2 text-sm text-navy-900"
                        : cn(
                            compact ? "line-clamp-2 text-sm" : "line-clamp-3 text-[15px]",
                            workToneTitleClass(workTone),
                          ),
                    )}
                  >
                    {task.title}
                  </p>

                  {task.labels && task.labels.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {task.labels.map((label) => (
                        <span
                          key={label.id}
                          className="max-w-full truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: label.color }}
                          title={label.name}
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <ChevronDown
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 text-navy-300 transition-transform",
                    subtasksExpanded && "rotate-180",
                  )}
                  strokeWidth={2}
                  aria-hidden
                />
              </div>

              <div className="mt-2.5 space-y-1.5 border-t border-sky-50 pt-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-400/15 text-[9px] font-bold text-primary-600">
                    {getInitials(task.assignee)}
                  </span>
                  <span className="truncate text-xs text-navy-600">{task.assignee}</span>
                </div>
                {(task.subtaskCount ?? 0) > 0 && !subtasksExpanded && (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] text-navy-500">
                      <span>하위 진행</span>
                      <span>
                        {task.subtaskDoneCount ?? 0}/{task.subtaskCount}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-sky-100">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{
                          width: `${Math.round(
                            ((task.subtaskDoneCount ?? 0) / (task.subtaskCount ?? 1)) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                {(task.createdAt != null || task.due) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {task.createdAt != null && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-navy-500">
                        <Calendar className="h-3 w-3 opacity-70" strokeWidth={2} />
                        작성 {formatTaskCreatedAt(task.createdAt)}
                      </span>
                    )}
                    {task.due && (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium",
                          getDueClass(task),
                        )}
                      >
                        <Calendar className="h-3 w-3 opacity-70" strokeWidth={2} />
                        마감 {task.due}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>

            {subtasksExpanded && (
              <TaskSubtasksSection
                taskId={task.id}
                compact
                enabled={subtasksExpanded}
                autoFocusAdd
              />
            )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onOpen(task)}
                className="inline-flex min-w-[4.5rem] flex-1 items-center justify-center gap-1 rounded-xl bg-sky-100/70 py-2 text-xs font-medium text-navy-700 transition hover:bg-sky-100"
              >
                <Eye className="h-3.5 w-3.5" />
                상세
              </button>
              {canWrite && onDuplicate && (
                <button
                  type="button"
                  onClick={() => void handleDuplicate()}
                  disabled={duplicating}
                  className="inline-flex min-w-[4.5rem] flex-1 items-center justify-center gap-1 rounded-xl bg-white/80 py-2 text-xs font-medium text-navy-700 ring-1 ring-sky-100/90 transition hover:bg-white disabled:opacity-60"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {duplicating ? "복사 중" : "복사"}
                </button>
              )}
              {canWrite && (
                <button
                  type="button"
                  onClick={() => onEdit(task)}
                  className="inline-flex min-w-[4.5rem] flex-1 items-center justify-center gap-1 rounded-xl bg-primary-400/10 py-2 text-xs font-medium text-primary-600 transition hover:bg-primary-400/20"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  수정
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  className="inline-flex min-w-[4.5rem] flex-1 items-center justify-center gap-1 rounded-xl bg-red-50 py-2 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting ? "삭제 중" : "삭제"}
                </button>
              )}
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
