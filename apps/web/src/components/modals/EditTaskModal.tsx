import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useTeams, useUpdateTask } from "../../hooks/useData";
import { useOrgMembers } from "../../hooks/useAdmin";
import { PRIORITY_OPTIONS, TASK_COLUMNS, toDateInputValue } from "../../lib/taskUtils";
import type { Task, TaskPriority, TaskStatus } from "../../lib/types";
import { cn } from "../../lib/cn";

interface EditTaskModalProps {
  task: Task | null;
  onClose: () => void;
}

export function EditTaskModal({ task, onClose }: EditTaskModalProps) {
  const updateTask = useUpdateTask();
  const { data: membersData } = useOrgMembers();
  const { data: teamsData } = useTeams();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [teamId, setTeamId] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");

  const members = membersData?.members ?? [];
  const teams = teamsData?.teams ?? [];

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

  const selectClass =
    "min-h-12 w-full rounded-2xl border border-sky-200/80 bg-white/80 px-4 text-[15px] text-navy-800 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !title.trim()) return;
    await updateTask.mutateAsync({
      id: task.id,
      title: title.trim(),
      description: description.trim() || null,
      dueAt: dueDate ? new Date(dueDate).getTime() : null,
      assigneeId: assigneeId || null,
      priority,
      teamId: teamId || null,
      status,
    });
    onClose();
  };

  return (
    <Modal open={!!task} onClose={onClose} title="프로젝트 수정">
      {task && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="프로젝트 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-navy-700">설명 (선택)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="프로젝트 설명"
              className={cn(selectClass, "min-h-[72px] resize-none py-3")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-navy-700">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className={selectClass}
            >
              {TASK_COLUMNS.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.label}
                </option>
              ))}
            </select>
          </div>

          <Input label="마감일 (선택)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-navy-700">담당자</label>
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={selectClass}>
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
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
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
              <label className="text-sm font-medium text-navy-700">팀 (선택)</label>
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={selectClass}>
                <option value="">팀 없음</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button type="submit" fullWidth disabled={updateTask.isPending}>
            {updateTask.isPending ? "저장 중..." : "변경 저장"}
          </Button>
        </form>
      )}
    </Modal>
  );
}
