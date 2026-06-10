import { useEffect, useState } from "react";
import { MessageSquare, Trash2, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import {
  useCreateTaskComment,
  useDeleteTask,
  useTaskComments,
  useTeams,
  useUpdateTask,
} from "../../hooks/useData";
import { useHasPermission } from "../../hooks/usePermissions";
import { useOrgMembers } from "../../hooks/useAdmin";
import { useAuthStore } from "../../stores/authStore";
import { EntityFilesSection } from "../ui/EntityFilesSection";
import { MentionTextarea } from "../ui/MentionTextarea";
import { TaskChecklistSection } from "./TaskChecklistSection";
import { TaskLabelsSection } from "./TaskLabelsSection";
import { PRIORITY_OPTIONS, TASK_COLUMNS, toDateInputValue } from "../../lib/taskUtils";
import type { Task, TaskPriority, TaskStatus } from "../../lib/types";
import { cn } from "../../lib/cn";

interface TaskDetailSheetProps {
  task: Task | null;
  onClose: () => void;
}

export function TaskDetailSheet({ task, onClose }: TaskDetailSheetProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createComment = useCreateTaskComment();
  const user = useAuthStore((s) => s.user);
  const canDeleteAny = useHasPermission("tasks:delete");
  const canWrite = useHasPermission("tasks:write");
  const canDelete =
    canDeleteAny || (canWrite && !!task?.creatorId && task.creatorId === user?.id);
  const { data: membersData } = useOrgMembers();
  const { data: teamsData } = useTeams();
  const { data: commentsData } = useTaskComments(task?.id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [teamId, setTeamId] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [commentBody, setCommentBody] = useState("");

  const members = membersData?.members ?? [];
  const teams = teamsData?.teams ?? [];
  const comments = commentsData?.comments ?? [];

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setDueDate(toDateInputValue(task.dueAt));
    setAssigneeId(task.assigneeId ?? "");
    setPriority((task.priority as TaskPriority) || "medium");
    setTeamId(task.teamId ?? "");
    setStatus(task.status);
  }, [task]);

  if (!task) return null;

  const save = async (patch: Omit<import("../../lib/types").UpdateTaskPayload, "id">) => {
    await updateTask.mutateAsync({ id: task.id, ...patch });
  };

  const handleDelete = async () => {
    if (!window.confirm(`"${task.title}" 프로젝트를 삭제할까요?`)) return;
    await deleteTask.mutateAsync(task.id);
    onClose();
  };

  const selectClass =
    "min-h-12 w-full rounded-2xl border border-sky-200/80 bg-white/80 px-4 text-[15px] text-navy-800 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button className="absolute inset-0 bg-navy-900/30 backdrop-blur-sm" onClick={onClose} aria-label="닫기" />
      <div className="glass-strong relative z-10 flex w-full max-w-lg max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl shadow-soft sm:max-h-[85vh] sm:rounded-3xl safe-bottom">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 pb-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-navy-900">프로젝트 상세</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-navy-600 hover:bg-sky-100/60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex gap-1.5">
          {TASK_COLUMNS.map((col) => (
            <button
              key={col.id}
              type="button"
              onClick={() => {
                setStatus(col.id);
                save({ status: col.id });
              }}
              className={cn(
                "flex-1 rounded-xl py-2 text-xs font-medium transition",
                status === col.id
                  ? "bg-primary-400 text-white shadow-glow"
                  : "bg-sky-100/60 text-navy-600 hover:bg-sky-100",
              )}
            >
              {col.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <Input
            label="제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== task.title && save({ title: title.trim() })}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-navy-700">설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() =>
                description !== (task.description ?? "") && save({ description: description || null })
              }
              rows={3}
              placeholder="프로젝트 설명 (선택)"
              className={cn(selectClass, "min-h-[88px] resize-none py-3")}
            />
          </div>

          <Input
            label="마감일"
            type="date"
            value={dueDate}
            onChange={(e) => {
              setDueDate(e.target.value);
              const dueAt = e.target.value ? new Date(e.target.value).getTime() : null;
              save({ dueAt });
            }}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-navy-700">담당자</label>
            <select
              value={assigneeId}
              onChange={(e) => {
                setAssigneeId(e.target.value);
                save({ assigneeId: e.target.value || null });
              }}
              className={selectClass}
            >
              <option value="">미배정</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-navy-700">우선순위</label>
            <select
              value={priority}
              onChange={(e) => {
                const next = e.target.value as TaskPriority;
                setPriority(next);
                save({ priority: next });
              }}
              className={selectClass}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {teams.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-navy-700">팀</label>
              <select
                value={teamId}
                onChange={(e) => {
                  setTeamId(e.target.value);
                  save({ teamId: e.target.value || null });
                }}
                className={selectClass}
              >
                <option value="">팀 없음</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <TaskLabelsSection task={task} />
        <TaskChecklistSection taskId={task.id} />
        <EntityFilesSection entityType="task" entityId={task.id} />

        <div className="mt-6 border-t border-sky-100/80 pt-4">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-navy-600" />
            <h3 className="text-sm font-semibold text-navy-800">댓글 {comments.length}</h3>
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-xs text-navy-500">첫 댓글을 남겨보세요.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="rounded-2xl bg-sky-50/80 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-navy-800">{c.userName}</span>
                    <span className="text-[10px] text-navy-500">{c.time}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-navy-700">{c.body}</p>
                </div>
              ))
            )}
          </div>
          <form
            className="mt-3 flex items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!commentBody.trim() || !task) return;
              await createComment.mutateAsync({ taskId: task.id, body: commentBody.trim() });
              setCommentBody("");
            }}
          >
            <MentionTextarea
              value={commentBody}
              onChange={setCommentBody}
              members={members.map((m) => ({ id: m.user_id, name: m.name }))}
              placeholder="댓글 입력... (@이름 멘션)"
              rows={2}
            />
            <Button type="submit" disabled={createComment.isPending || !commentBody.trim()} className="shrink-0">
              등록
            </Button>
          </form>
        </div>
        </div>

        {canDelete && (
          <div className="shrink-0 border-t border-sky-100/80 bg-white/95 px-6 py-4 backdrop-blur-sm">
            <Button
              variant="ghost"
              className="w-full text-red-600 hover:bg-red-50"
              onClick={handleDelete}
              disabled={deleteTask.isPending}
            >
              <Trash2 className="h-4 w-4" />
              {deleteTask.isPending ? "삭제 중..." : "프로젝트 삭제"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
