import { useEffect, useRef, useState } from "react";
import { Calendar, CheckCircle2, ListTree, Plus, Trash2, User } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import {
  useCreateTaskSubtask,
  useDeleteTask,
  useTaskSubtasks,
  useUpdateTaskSubtaskStatus,
  useUpdateTaskSubtaskTitle,
} from "../../hooks/useData";
import { useHasPermission } from "../../hooks/usePermissions";
import { formatTaskCreatedDateTime, TASK_COLUMNS } from "../../lib/taskUtils";
import { cn } from "../../lib/cn";
import type { TaskStatus } from "../../lib/types";

type Props = {
  taskId: string;
  /** 상세 진입 시 입력란에 포커스 */
  autoFocusAdd?: boolean;
  /** 카드 인라인 펼침용 축소 UI */
  compact?: boolean;
  /** false면 하위 업무 API를 호출하지 않음 (접힌 카드) */
  enabled?: boolean;
  /** 값이 바뀔 때마다 추가 입력란에 포커스 */
  focusKey?: number;
};

export function TaskSubtasksSection({
  taskId,
  autoFocusAdd = false,
  compact = false,
  enabled = true,
  focusKey = 0,
}: Props) {
  const { data, isLoading } = useTaskSubtasks(taskId, { enabled });
  const create = useCreateTaskSubtask();
  const updateStatus = useUpdateTaskSubtaskStatus();
  const updateTitle = useUpdateTaskSubtaskTitle();
  const deleteTask = useDeleteTask();
  const canWrite = useHasPermission("tasks:write");
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  const subtasks = data?.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.status === "done").length;
  const progress = subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0;

  useEffect(() => {
    if (!enabled || !canWrite) return;
    if (!autoFocusAdd && focusKey <= 0) return;
    const id = window.setTimeout(() => addInputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [enabled, canWrite, autoFocusAdd, focusKey]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !canWrite) return;
    await create.mutateAsync({ taskId, title: title.trim() });
    setTitle("");
    addInputRef.current?.focus();
  };

  const toggleDone = (subId: string, status: TaskStatus) => {
    if (!canWrite) return;
    updateStatus.mutate({
      subtaskId: subId,
      parentTaskId: taskId,
      status: status === "done" ? "todo" : "done",
    });
  };

  const saveTitle = async (subId: string) => {
    const next = editTitle.trim();
    if (!next) {
      setEditingId(null);
      return;
    }
    const current = subtasks.find((s) => s.id === subId);
    if (current && current.title !== next) {
      await updateTitle.mutateAsync({ subtaskId: subId, parentTaskId: taskId, title: next });
    }
    setEditingId(null);
  };

  const handleDelete = async (subId: string, subTitle: string) => {
    if (!canWrite) return;
    if (!window.confirm(`「${subTitle}」하위 업무를 삭제할까요?`)) return;
    await deleteTask.mutateAsync(subId);
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-sky-100/80 bg-sky-50/40",
        compact ? "p-2.5" : "mt-4 p-4",
      )}
    >
      <div className={cn("flex items-start justify-between gap-3", compact ? "mb-2" : "mb-3")}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ListTree className={cn("text-primary-500", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
            <h3 className={cn("font-semibold text-navy-800", compact ? "text-xs" : "text-sm")}>
              하위 업무 · 진행 상황
            </h3>
          </div>
          {!compact && (
            <p className="mt-1 text-xs text-navy-500">
              세부 진행 항목을 추가해 업무 진행 내용을 파악하세요.
            </p>
          )}
        </div>
        {subtasks.length > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-navy-700 ring-1 ring-sky-100">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            {doneCount}/{subtasks.length}
          </span>
        )}
      </div>

      {subtasks.length > 0 && (
        <div className={cn(compact ? "mb-2" : "mb-3")}>
          <div className="mb-1 flex items-center justify-between text-[11px] text-navy-500">
            <span>진행률</span>
            <span className="font-medium text-navy-700">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-sky-100">
            <div
              className="h-full rounded-full bg-primary-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {isLoading ? (
          <p className="py-2 text-center text-xs text-navy-500">불러오는 중...</p>
        ) : subtasks.length === 0 ? (
          <p className="rounded-xl bg-white/70 px-3 py-2.5 text-center text-xs text-navy-500">
            {canWrite
              ? "아직 하위 업무가 없습니다. 아래에서 진행 항목을 추가해 보세요."
              : "아직 하위 업무가 없습니다."}
          </p>
        ) : (
          subtasks.map((sub) => {
            const done = sub.status === "done";
            const isEditing = editingId === sub.id;
            const createdLabel =
              sub.createdAt != null ? formatTaskCreatedDateTime(sub.createdAt) : "";
            const creatorLabel = sub.creatorName?.trim() || "작성자 없음";
            return (
              <div
                key={sub.id}
                className={cn(
                  "flex items-start gap-2 rounded-xl bg-white/90 px-2.5 py-2 ring-1 ring-sky-100/80",
                  done && "opacity-80",
                )}
              >
                <input
                  type="checkbox"
                  checked={done}
                  disabled={!canWrite}
                  onChange={() => toggleDone(sub.id, sub.status)}
                  className="mt-1 h-4 w-4 rounded border-sky-300 text-primary-500"
                  aria-label="완료 토글"
                />

                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => void saveTitle(sub.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void saveTitle(sub.id);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      className="w-full rounded-lg border border-primary-200 bg-white px-2 py-1 text-sm outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={!canWrite}
                      onClick={() => {
                        setEditingId(sub.id);
                        setEditTitle(sub.title);
                      }}
                      className={cn(
                        "w-full text-left text-sm",
                        done ? "text-navy-400 line-through" : "text-navy-800",
                        canWrite && "hover:text-primary-600",
                      )}
                    >
                      {sub.title}
                    </button>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {!compact && (
                      <select
                        value={sub.status}
                        disabled={!canWrite}
                        onChange={(e) =>
                          updateStatus.mutate({
                            subtaskId: sub.id,
                            parentTaskId: taskId,
                            status: e.target.value as TaskStatus,
                          })
                        }
                        className="rounded-lg border-0 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-navy-700"
                      >
                        {TASK_COLUMNS.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.label}
                          </option>
                        ))}
                      </select>
                    )}
                    <span
                      className="inline-flex max-w-full items-center gap-0.5 truncate rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-navy-600"
                      title={`작성자 ${creatorLabel}`}
                    >
                      <User className="h-3 w-3 shrink-0 opacity-70" strokeWidth={2} />
                      {creatorLabel}
                    </span>
                    {createdLabel && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-navy-600"
                        title={`작성 ${createdLabel}`}
                      >
                        <Calendar className="h-3 w-3 opacity-70" strokeWidth={2} />
                        {createdLabel}
                      </span>
                    )}
                    {!compact && sub.assignee && sub.assignee !== "미배정" && (
                      <span className="text-[10px] text-navy-400">담당 {sub.assignee}</span>
                    )}
                    {!compact && sub.due && (
                      <span className="text-[10px] text-navy-400">마감 {sub.due}</span>
                    )}
                  </div>
                </div>

                {canWrite && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(sub.id, sub.title)}
                    className="mt-0.5 rounded-lg p-1 text-navy-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="하위 업무 삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {canWrite && (
        <form onSubmit={handleAdd} className={cn("flex gap-2", compact ? "mt-2" : "mt-3")}>
          <Input
            ref={addInputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={compact ? "진행 항목 추가…" : "진행 항목 추가 (예: 초안 작성, 리뷰 요청…)"}
            className={cn("flex-1 text-sm", compact ? "!min-h-9" : "!min-h-10")}
            autoFocus={autoFocusAdd && focusKey <= 0}
          />
          <Button
            type="submit"
            disabled={create.isPending || !title.trim()}
            className="shrink-0"
            aria-label="추가"
          >
            <Plus className="h-4 w-4" />
            {!compact && "추가"}
          </Button>
        </form>
      )}
    </div>
  );
}
